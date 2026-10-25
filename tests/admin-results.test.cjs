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
    if (id.startsWith('@/')) return load(`src/${id.slice(2)}.ts`, mocks);
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
