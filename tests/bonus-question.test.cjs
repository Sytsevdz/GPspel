const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(id => {
    if (id in mocks) return mocks[id];
    if (id.startsWith('@/')) {
      const base = path.join('src', id.slice(2));
      return load(fs.existsSync(base + '.ts') ? base + '.ts' : base + '.tsx', mocks);
    }
    return require(id);
  }, module, module.exports);
  return module.exports;
}
const drivers = ['a', 'b', 'c'].map((id, i) => ({ id, name: id, constructorTeam: `Team ${i}` }));
function fixture({ type = null, points = 10, answer = 'Team 0', questionError = null } = {}) {
  const question = type ? { id: 'bonus', grand_prix_id: 'gp', question_type: type, subject_driver_id: 'a', points } : null;
  const prediction = { user_id: 'player', quali_p1: 'a', quali_p2: 'b', quali_p3: 'c', race_p1: 'a', race_p2: 'b', race_p3: 'c', fastest_pitstop_team: 'Team 0' };
  const tables = {
    grand_prix: [{ id: 'gp', is_sprint_weekend: false }],
    league_members: [{ user_id: 'player' }],
    grand_prix_bonus_questions: question ? [question] : [],
    predictions: [prediction],
    grand_prix_driver_results: drivers.map((d, i) => ({ driver_id: d.id, race_position: i + 1, quali_position: i + 1, sprint_quali_position: null, sprint_race_position: null })),
    grand_prix_bonus_results: [{ fastest_pitstop_team: 'Team 0' }],
    grand_prix_bonus_predictions: [{ user_id: 'player', answer_team: answer, answer_driver_id: 'a', answer_position: 1 }],
    grand_prix_bonus_answers: [{ answer_driver_id: 'a' }],
    grand_prix_scores: [{ user_id: 'player', team_quali_points: 8, quali_prediction_points: 30, fastest_pitstop_prediction_points: 10 }],
  };
  const writes = [];
  const reads = [];
  const supabase = {
    auth: { getUser: async () => ({ data: { user: { id: 'player' } } }) },
    from(table) {
      reads.push(table);
      const result = () => ({ data: tables[table] ?? [], error: table === 'grand_prix_bonus_questions' ? questionError : null });
      return {
        select() { return this; }, eq() { return this; }, in() { return this; }, returns() { return this; },
        upsert(value) { writes.push({ table, value }); return this; },
        delete() { writes.push({ table, operation: 'delete' }); return this; },
        maybeSingle: async () => ({ ...result(), data: result().data[0] ?? null }),
        then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject); },
      };
    },
  };
  const mocks = {
    'next/cache': { revalidatePath() {} },
    '@/lib/supabase': { createServerSupabaseClient: () => supabase },
    '@/lib/team-selection-data': { getGrandPrixAndDriversById: async () => ({ grandPrix: { status: 'upcoming', is_sprint_weekend: false }, drivers }) },
    '@/lib/grand-prix-drivers': { getGrandPrixDrivers: async () => drivers.map(d => ({ ...d, constructor_team: d.constructorTeam })) },
  };
  return { writes, reads, mocks, question };
}
function form(extra = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ league_id: 'league', grand_prix_id: 'gp', quali_p1: 'a', quali_p2: 'b', quali_p3: 'c', race_p1: 'a', race_p2: 'b', race_p3: 'c', ...extra })) data.set(key, value);
  return data;
}

test('no configured question awards no bonus, even with matching legacy pitstop data', async () => {
  const f = fixture();
  await load('src/app/actions/grand-prix-scores.ts', f.mocks).calculateGrandPrixRaceScores('gp');
  const score = f.writes.find(w => w.table === 'grand_prix_scores').value[0];
  assert.equal(score.fastest_pitstop_prediction_points, 0);
  assert.equal(score.bonus_prediction_points, 0);
  assert.equal(score.team_quali_points, 8);
  assert.equal(score.quali_prediction_points, 30);
  assert.equal(score.race_prediction_points, 30);
  assert.equal(score.total_points, 68);
  assert(!f.reads.includes('grand_prix_bonus_results'), 'no implicit pitstop result lookup');
  assert(!f.writes.some(w => w.table === 'grand_prix_bonus_prediction_scores'));
});
for (const answer of ['Team 0', 'Team 1']) {
  test(`explicit pitstop question: ${answer === 'Team 0' ? 'correct' : 'incorrect'} answer`, async () => {
    const f = fixture({ type: 'fastest_pitstop_team', answer });
    await load('src/app/actions/grand-prix-scores.ts', f.mocks).calculateGrandPrixRaceScores('gp');
    const score = f.writes.find(w => w.table === 'grand_prix_scores').value[0];
    assert.equal(score.bonus_prediction_points, answer === 'Team 0' ? 10 : 0);
    assert.equal(score.fastest_pitstop_prediction_points, 0, 'never double-count pitstop');
    assert.equal(f.writes.find(w => w.table === 'grand_prix_bonus_answers').value.answer_team, 'Team 0');
  });
}
for (const type of ['driver_finish_position', 'fastest_lap_driver', 'best_team', 'fastest_pitstop_team']) {
  test(`${type} retains configured points and ignores legacy pitstop prediction`, async () => {
    const f = fixture({ type, points: 15 });
    await load('src/app/actions/grand-prix-scores.ts', f.mocks).calculateGrandPrixRaceScores('gp');
    const score = f.writes.find(w => w.table === 'grand_prix_scores').value[0];
    assert.equal(score.bonus_prediction_points, 15);
    assert.equal(score.fastest_pitstop_prediction_points, 0);
  });
}
test('no configured question saves podium predictions without requiring or storing a pitstop guess', async () => {
  const f = fixture();
  const action = load('src/app/actions/predictions.ts', f.mocks).savePrediction;
  for (const extra of [{}, { fastest_pitstop_team: 'Team 0' }]) {
    assert.equal((await action(undefined, form(extra))).status, 'success');
  }
  assert.equal(f.writes.length, 2);
  assert(f.writes.every(w => w.table === 'predictions' && !('fastest_pitstop_team' in w.value)));
});
test('configured pitstop answer is saved against the selected question', async () => {
  const f = fixture({ type: 'fastest_pitstop_team' });
  const result = await load('src/app/actions/predictions.ts', f.mocks).savePrediction(undefined, form({ bonus_question_id: 'bonus', bonus_answer_team: 'Team 0' }));
  assert.equal(result.status, 'success');
  assert.deepEqual(f.writes.find(w => w.table === 'grand_prix_bonus_predictions').value, { grand_prix_bonus_question_id: 'bonus', user_id: 'player', answer_position: null, answer_driver_id: null, answer_team: 'Team 0' });
});
test('cannot bypass configured bonus or save stale/forged question IDs and invalid answers', async () => {
  for (const [options, extra] of [
    [{ type: 'best_team' }, {}],
    [{ type: 'fastest_pitstop_team' }, { bonus_question_id: 'bonus', bonus_answer_team: 'invalid' }],
    [{}, { bonus_question_id: 'forged', bonus_answer_team: 'Team 0' }],
    [{ type: 'fastest_pitstop_team' }, { bonus_question_id: 'old', bonus_answer_team: 'Team 0' }],
    [{ questionError: { message: 'failed' } }, {}],
  ]) {
    const f = fixture(options);
    assert.equal((await load('src/app/actions/predictions.ts', f.mocks).savePrediction(undefined, form(extra))).status, 'error');
    assert.equal(f.writes.length, 0);
  }
});
test('question lookup failure aborts score publication before writes', async () => {
  const f = fixture({ questionError: { message: 'failed' } });
  await assert.rejects(load('src/app/actions/grand-prix-scores.ts', f.mocks).calculateGrandPrixRaceScores('gp'), /Failed to load bonus question/);
  assert.equal(f.writes.length, 0);
});
test('player form hides bonus without configuration; explicit pitstop renders a regular team question', () => {
  let valid;
  const effects = [];
  const f = fixture();
  const mocks = {
    ...f.mocks,
    react: { ...React, useState: initial => [initial, () => {}], useRef: value => ({ current: value }), useMemo: fn => fn(), useEffect: fn => effects.push(fn) },
    'react-dom': { useFormState: () => [{ status: 'idle' }, undefined], useFormStatus: () => ({ pending: false }) },
    'next/image': { default: () => null },
  };
  const { PredictionsForm } = load('src/app/leagues/[leagueId]/predictions/predictions-form.tsx', mocks);
  const initialValues = { qualiP1: 'a', qualiP2: 'b', qualiP3: 'c', raceP1: 'a', raceP2: 'b', raceP3: 'c', fastestPitstopTeam: '', bonusAnswerPosition: '', sprintQualiP1: '', sprintQualiP2: '', sprintQualiP3: '', sprintRaceP1: '', sprintRaceP2: '', sprintRaceP3: '' };
  const props = { leagueId: 'league', grandPrixId: 'gp', drivers, constructorTeams: ['Team 0'], initialValues, onValidityChange: value => { valid = value; } };
  const html = renderToStaticMarkup(React.createElement(PredictionsForm, props));
  effects.forEach(fn => fn());
  assert.equal(valid, true, 'podiums alone are complete without a bonus question');
  assert(!html.includes('name="bonus_question_id"'));
  assert(!html.includes('name="fastest_pitstop_team"'));
  assert(!html.includes('Snelste pitstop'));
  const pitstop = renderToStaticMarkup(React.createElement(PredictionsForm, { ...props, bonusPrediction: { questionId: 'bonus', questionType: 'fastest_pitstop_team', questionText: 'Welk team maakt de snelste pitstop?', pointsAvailable: 10 } }));
  assert(pitstop.includes('Snelste pitstop'));
  assert(pitstop.includes('name="bonus_answer_team"'));
  assert(pitstop.includes('name="bonus_question_id"'));
});
test('admin selector has no default question and includes explicit pitstop', () => {
  const { BonusQuestionForm } = load('src/app/admin/grand-prix/[id]/bonus-question-form.tsx', {
    react: { ...React, useState: initial => [initial, () => {}] },
  });
  const html = renderToStaticMarkup(React.createElement(BonusQuestionForm, { grandPrixId: 'gp', initialType: '', initialDriverId: '', initialPoints: 10, drivers, action: undefined }));
  assert.match(html, /<option value="" disabled="" selected="">Geen bonusvraag geselecteerd/);
  assert.match(html, /<option value="fastest_pitstop_team">Snelste pitstop/);
});
