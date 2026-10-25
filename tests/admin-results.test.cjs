const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

// Load the actual TS actions/components with isolated external service and hook mocks.
function load(file, mocks = {}) {
  const filename = path.resolve(file);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output)(id => {
    if (id in mocks) return mocks[id];
    if (id === './publish-score-actions') return load('src/app/admin/grand-prix/[id]/result/publish-score-actions.tsx', mocks);
    if (id.startsWith('@/')) {
      const base = `src/${id.slice(2)}`;
      return load(fs.existsSync(`${base}.ts`) ? `${base}.ts` : `${base}.tsx`, mocks);
    }
    return require(id);
  }, module, module.exports);
  return module.exports;
}

function fixture({ sprint = false, role = 'admin', status = 'locked', question = null, questionError = null } = {}) {
  const writes = [];
  const calculations = [];
  const supabase = {
    auth: { getUser: async () => ({ data: { user: { id: 'admin' } } }) },
    from(table) {
      const query = {
        select() { return this; }, eq() { return this; },
        async maybeSingle() {
          return { data: table === 'profiles' ? { role } : table === 'grand_prix' ? { id: 'gp', status, is_sprint_weekend: sprint, deadline: '2026-01-01' } : question, error: table === 'grand_prix_bonus_questions' ? questionError : null };
        },
        delete() { writes.push({ table, operation: 'delete' }); return this; },
        insert(value) { writes.push({ table, operation: 'insert', value }); return this; },
        upsert(value) { writes.push({ table, operation: 'upsert', value }); return this; },
        then(resolve) { return Promise.resolve({ error: null }).then(resolve); },
      };
      return query;
    },
  };
  const actions = load('src/app/actions/grand-prix-results.ts', {
    'next/cache': { revalidatePath() {} },
    '@/lib/supabase': { createServerSupabaseClient: () => supabase },
    '@/lib/grand-prix-drivers': { getGrandPrixDrivers: async () => [{ id: 'driver', constructor_team: 'Team' }] },
    '@/app/actions/grand-prix-scores': {
      calculateGrandPrixSprintQualificationScores: async () => calculations.push('quali'),
      calculateGrandPrixSprintRaceScores: async () => calculations.push('race'),
    },
  });
  return { actions, writes, calculations };
}
function form(extra = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ grand_prix_id: 'gp', expected_grand_prix_id: 'gp', qualification_order: 'driver', race_order: 'driver', ...extra })) data.set(key, value);
  return data;
}
for (const name of ['publishGrandPrixSprintQualificationScores', 'publishGrandPrixSprintRaceScores']) {
  test(`${name}: refuse regular GP, allow sprint GP`, async () => {
    for (const sprint of [false, true]) {
      const f = fixture({ sprint });
      const result = await f.actions[name](undefined, form());
      assert.equal(result.status, sprint ? 'success' : 'error');
      assert.equal(f.calculations.length, sprint ? 1 : 0);
    }
  });
  test(`${name}: retain admin, cancellation and GP identity checks`, async () => {
    for (const options of [{ role: 'player' }, { status: 'cancelled' }, {}]) {
      const f = fixture({ sprint: true, ...options });
      const data = form(options.role || options.status ? {} : { expected_grand_prix_id: 'other' });
      assert.equal((await f.actions[name](undefined, data)).status, 'error');
      assert.equal(f.calculations.length, 0);
    }
  });
}
for (const type of [null, 'driver_finish_position', 'fastest_lap_driver']) {
  test(`saving ${type} preserves inactive pitstop result, even with stale posted field`, async () => {
    const f = fixture({ question: type ? { id: 'bonus', question_type: type, subject_driver_id: 'driver' } : null });
    assert.equal((await f.actions.saveGrandPrixResult(undefined, form({ fastest_pitstop_team: 'old team', fastest_lap_driver_id: 'driver' }))).status, 'success');
    assert.equal(f.writes.filter(w => w.table === 'grand_prix_bonus_results').length, 0);
    if (type) assert.ok(f.writes.some(w => w.table === 'grand_prix_bonus_answers'));
  });
}
test('active pitstop saves valid team, rejects invalid team, preserves missing field', async () => {
  for (const [extra, status, count] of [[{ fastest_pitstop_team: 'Team' }, 'success', 1], [{ fastest_pitstop_team: 'invalid' }, 'error', 0], [{}, 'success', 0]]) {
    const f = fixture({ question: { id: 'bonus', question_type: 'fastest_pitstop_team' } });
    assert.equal((await f.actions.saveGrandPrixResult(undefined, form(extra))).status, status);
    assert.equal(f.writes.filter(w => w.table === 'grand_prix_bonus_results').length, count);
  }
});
test('bonus config query failure stops writes', async () => {
  const f = fixture({ questionError: { message: 'failed' } });
  assert.equal((await f.actions.saveGrandPrixResult(undefined, form())).status, 'error');
  assert.equal(f.writes.length, 0);
});
test('publication UI renders sprint options only for sprint weekends', () => {
  const { PublishScoreActions } = load('src/app/admin/grand-prix/[id]/result/publish-score-actions.tsx', {
    'react-dom': { useFormState: () => [{ status: 'idle' }, undefined], useFormStatus: () => ({ pending: false }) },
    '@/app/admin/confirm-submit-button': { ConfirmSubmitButton: () => null },
    '@/app/actions/grand-prix-results': {},
    '../workflow-controller': { reportResultWorkflow() {} },
  });
  for (const sprint of [false, true]) {
    const html = renderToStaticMarkup(React.createElement(PublishScoreActions, { grandPrixId: 'gp', isSprintWeekend: sprint }));
    assert.equal(html.includes('Sprint kwalificatie publiceren'), sprint);
    assert.equal(html.includes('Sprint race publiceren'), sprint);
    assert.ok(html.includes('Kwalificatie publiceren'));
    assert.ok(html.includes('Race publiceren'));
  }
});
test('result form shows pitstop input only for the configured question and retains scrollable lists', () => {
  const { ResultForm } = load('src/app/admin/grand-prix/[id]/result/result-form.tsx', {
    'next/image': { __esModule: true, default: () => null },
    'react-dom': { useFormState: () => [{ status: 'idle' }, undefined], useFormStatus: () => ({ pending: false }) },
    '@/app/actions/grand-prix-results': {},
    '../workflow-controller': { reportResultWorkflow() {} },
    '@/app/team-bonus-card': { TeamBonusCard: () => React.createElement('span', null, 'Pitstop picker') },
    '@/lib/team-side-view-images': {},
    '@/lib/team-selection-teams': {},
  });
  for (const question of [null, 'fastest_lap_driver', 'driver_finish_position', 'fastest_pitstop_team']) {
    const html = renderToStaticMarkup(React.createElement(ResultForm, {
      grandPrixId: 'gp', isSprintWeekend: false, bonusQuestionType: question,
      drivers: [{ id: 'driver', name: 'Driver', constructorTeam: 'Team' }], constructorTeams: ['Team'],
      initialValues: { qualificationOrder: ['driver'], raceOrder: ['driver'], sprintQualificationOrder: ['driver'], sprintRaceOrder: ['driver'], fastestPitstopTeam: 'Team', fastestLapDriverId: 'driver' },
    }));
    assert.equal(html.includes('name="fastest_pitstop_team"'), question === 'fastest_pitstop_team');
    assert.equal(html.includes('Pitstop picker'), question === 'fastest_pitstop_team');
    assert.equal(html.includes('name="fastest_lap_driver_id"'), question === 'fastest_lap_driver');
    assert.equal((html.match(/class="result-rankings-list"/g) || []).length, 2);
  }
});
test('dashboard groups all statuses, orders history newest first, and retains every GP link', async () => {
  const rows = ['finished', 'cancelled', 'locked', 'upcoming', 'open'].map((status, i) => ({
    id: status, name: status, status, qualification_start: `2026-10-${10 + i}T12:00:00Z`, deadline: '2026-10-01T12:00:00Z',
  }));
  const supabase = {
    auth: { getUser: async () => ({ data: { user: { id: 'admin' } } }) },
    from(table) { return {
      select() { return this; }, eq() { return this; }, order() { return this; },
      maybeSingle: async () => ({ data: { role: 'admin' } }),
      returns: async () => ({ data: rows }),
    }; },
  };
  const { default: Page } = load('src/app/admin/page.tsx', {
    'next/link': { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) },
    'next/navigation': { redirect() { throw new Error('unexpected redirect'); } },
    '@/lib/supabase': { createServerSupabaseClient: () => supabase },
  });
  const html = renderToStaticMarkup(await Page({ searchParams: {} }));
  const ids = [...html.matchAll(/href="\/admin\/grand-prix\/([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(ids, ['locked', 'upcoming', 'open', 'cancelled', 'finished']);
});

const workflow = load('src/lib/result-workflow.ts');
const unpublished = { qualification: false, sprintQualification: false, sprintRace: false, final: false };
for (const sprint of [false, true]) {
  test(`result workflow: ${sprint ? 'sprint' : 'regular'} sequence, publication and reset`, () => {
    const phases = workflow.resultPhases(sprint);
    assert.deepEqual(phases.map(p => p.id), sprint ? ['sprintQualification', 'sprintRace', 'qualification', 'final'] : ['qualification', 'final']);
    let state = { published: unpublished, open: workflow.initialOpenPhases(phases, unpublished) };
    for (let i = 0; i < phases.length; i++) {
      assert.deepEqual(state.open, [phases[i].id]);
      state = workflow.advanceResultPhase(state, phases, phases[i].id);
      assert.equal(state.published[phases[i].id], true);
    }
    assert.deepEqual(state.open, []);
    assert.deepEqual(workflow.advanceResultPhase(state, phases, 'reset'), { published: unpublished, open: [phases[0].id] });
    assert.deepEqual(workflow.initialOpenPhases(phases, { ...unpublished, [phases[0].id]: true }), [phases[1].id]);
  });
}

test('result editor preserves manual reopening, saved values, bonus fields and open phase across revalidation', async () => {
  const hooks = []; let cursor = 0;
  const react = { ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial;
      return [hooks[index], value => { hooks[index] = typeof value === 'function' ? value(hooks[index]) : value; }];
    },
    useCallback: callback => callback,
    useMemo: callback => callback(),
  };
  const { ResultForm } = load('src/app/admin/grand-prix/[id]/result/result-form.tsx', {
    react,
    'next/image': { __esModule: true, default: () => null },
    'react-dom': { useFormState: action => [{ status: 'idle' }, action] },
    './publish-score-actions': { PublishScoreActions: () => null },
    '@/app/actions/grand-prix-results': { saveGrandPrixResult: async () => ({ status: 'success', message: 'Opgeslagen' }) },
    '@/app/team-bonus-card': { TeamBonusCard: () => null },
    '@/lib/team-side-view-images': {}, '@/lib/team-selection-teams': {},
  });
  const props = {
    grandPrixId: 'gp', isSprintWeekend: true, published: { ...unpublished, sprintQualification: true }, bonusQuestionType: 'fastest_lap_driver',
    drivers: [{ id: 'driver', name: 'Driver', constructorTeam: 'Team' }], constructorTeams: ['Team'],
    initialValues: { qualificationOrder: ['driver'], raceOrder: ['driver'], sprintQualificationOrder: ['driver'], sprintRaceOrder: ['driver'], fastestPitstopTeam: '', fastestLapDriverId: 'driver' },
  };
  function render(extra = {}) { cursor = 0; return ResultForm({ ...props, ...extra }); }
  const details = tree => tree.props.children[1];
  let tree = render();
  assert.deepEqual(details(tree).map(d => d.props.open), [false, true, false, false]);
  details(tree)[0].props.onToggle({ currentTarget: { open: true } });
  tree = render();
  assert.equal(details(tree)[0].props.open, true);
  await tree.props.children[0].props.action({ status: 'idle' }, new FormData());
  tree = render({ published: { ...unpublished } }); // stale refresh must not reset local progress
  assert.deepEqual(details(tree).map(d => d.props.open), [true, true, false, false]);
  const publication = details(tree)[1].props.children.at(-1);
  publication.props.onPublished('sprintRace');
  tree = render();
  assert.deepEqual(details(tree).map(d => d.props.open), [true, false, true, false]);
  details(tree)[2].props.onToggle({ currentTarget: { open: false } });
  tree = render();
  details(tree)[2].props.children.at(-1).props.onFailed('qualification');
  tree = render();
  assert.equal(details(tree)[2].props.open, true);
  const children = [...tree.props.children];
  children[0] = React.cloneElement(children[0], { action: undefined });
  const html = renderToStaticMarkup(React.cloneElement(tree, {}, ...children));
  assert.ok(html.includes('form="result-save-gp" name="fastest_lap_driver_id" value="driver"'));
  assert.ok(html.includes('name="qualification_order" value="driver"'));
});

for (const status of ['success', 'error']) {
  test(`publication ${status} ${status === 'success' ? 'advances' : 'keeps current phase and feedback'}; thrown errors remain retryable`, async () => {
    let action;
    const published = [];
    const failed = [];
    const { PublishScoreActions } = load('src/app/admin/grand-prix/[id]/result/publish-score-actions.tsx', {
      react: { ...React, useEffect: effect => effect() },
      'react-dom': { useFormState: callback => { action = callback; return [{ status, message: 'Existing feedback' }, callback]; }, useFormStatus: () => ({ pending: false }) },
      '@/app/admin/confirm-submit-button': { ConfirmSubmitButton: () => null },
      '@/app/actions/grand-prix-results': { publishGrandPrixQualificationScores: async () => { throw new Error('database unavailable'); } },
      '../workflow-controller': { reportResultWorkflow() {} },
    });
    const html = renderToStaticMarkup(React.createElement(PublishScoreActions, { grandPrixId: 'gp', isSprintWeekend: false, phase: 'qualification', onPublished: phase => published.push(phase), onFailed: phase => failed.push(phase) }));
    assert.deepEqual(published, status === 'success' ? ['qualification'] : []);
    assert.deepEqual(failed, status === 'error' ? ['qualification'] : []);
    assert.ok(html.includes('Existing feedback'));
    assert.equal((await action({ status: 'idle' }, new FormData())).status, 'error');
  });
}

test('publication indicator treats zero points as published and null as unpublished', () => {
  const { isSessionPublished } = load('src/lib/session-publication.ts');
  assert.equal(isSessionPublished({ points: 0 }, 'points'), true);
  assert.equal(isSessionPublished({ points: null }, 'points'), false);
});

test('result page passes serializable publication flags from score components, independent of stored result order', async () => {
  for (const hasScores of [false, true]) {
    let received;
    const supabase = {
      auth: { getUser: async () => ({ data: { user: { id: 'admin' } } }) },
      from(table) {
        const data = table === 'profiles' ? { role: 'admin' }
          : table === 'grand_prix' ? { id: 'gp', name: 'GP', status: 'locked', deadline: '2026-01-01', is_sprint_weekend: true }
          : table === 'grand_prix_driver_results' ? [{ driver_id: 'driver', quali_position: 1, race_position: 1 }]
          : table === 'grand_prix_scores' ? (hasScores ? [{ team_quali_points: 0, team_race_points: null, team_sprint_quali_points: 2, team_sprint_race_points: null }] : []) : null;
        return { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data }), returns: async () => ({ data }), then(resolve) { return Promise.resolve({ data }).then(resolve); } };
      },
    };
    const { default: Page } = load('src/app/admin/grand-prix/[id]/result/page.tsx', {
      'next/link': { __esModule: true, default: ({ children }) => React.createElement('a', null, children) },
      'next/navigation': { redirect() { throw new Error('unexpected redirect'); } },
      '@/lib/supabase': { createServerSupabaseClient: () => supabase },
      '@/lib/grand-prix-drivers': { getGrandPrixDrivers: async () => [{ id: 'driver', name: 'Driver', constructor_team: 'Team' }] },
      './result-form': { ResultForm: props => { received = props; return null; } },
      './publish-score-actions': { PublishScoreActions: () => null },
    });
    renderToStaticMarkup(await Page({ params: { id: 'gp' } }));
    assert.deepEqual(received.published, { ...unpublished, qualification: hasScores, sprintQualification: hasScores });
    assert.deepEqual(JSON.parse(JSON.stringify(received)), received);
  }
});
