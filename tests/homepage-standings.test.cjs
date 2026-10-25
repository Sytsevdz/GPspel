const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
// Run with: node tests/homepage-standings.test.cjs
// Render the actual Server Component with mocked data; never contact Supabase.
const root = require('node:path').resolve(__dirname, '..');
const ts = require(root + '/node_modules/typescript');
const jsx = (type, props) => ({type, props});
function load(file, mocks = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(root + '/' + file, 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020}
  }).outputText;
  vm.runInNewContext(code, {exports, require: name => mocks[name] ?? {}, Date, Map, Set});
  return exports;
}
const timelineHelpers = load('src/lib/team-selection-data.ts', {
  '@/lib/grand-prix-status': load('src/lib/grand-prix-status.ts')
});
const gp = (id, status, year) => ({id, name: id, status, qualification_start: `${year}-01-02T00:00:00Z`, deadline: `${year}-01-01T00:00:00Z`, is_sprint_weekend: true});
const previous = gp('previous', 'finished', 2020);
const current = gp('current', 'locked', 2021);
const future = gp('future', 'upcoming', 2099);
const profiles = ['Zoe', 'Ada', 'Ben', 'No score', 'Null score'].map((display_name, i) => ({id: String(i), display_name}));
async function render(timeline, scores) {
  const supabase = {
    auth: {getUser: async () => ({data: {user: {id: '0'}}})},
    from(table) {
      let rows = {profiles, grand_prix: timeline, grand_prix_scores: scores, league_members: []}[table] ?? [];
      const query = {
        select() {return this},
        eq(key, value) {rows = rows.filter(row => row[key] === value); return this},
        neq(key, value) {rows = rows.filter(row => row[key] !== value); return this},
        order() {return this},
        returns() {return this},
        maybeSingle: async () => ({data: rows[0] ?? null}),
        then(resolve, reject) {return Promise.resolve({data: rows}).then(resolve, reject)}
      };
      return query;
    }
  };
  const page = load('src/app/page.tsx', {
    'react/jsx-runtime': {jsx, jsxs: jsx, Fragment: 'Fragment'},
    '@/lib/supabase': {createServerSupabaseClient: () => supabase},
    '@/lib/team-selection-data': timelineHelpers,
    '@/lib/grand-prix-drivers': {getGrandPrixDrivers: async () => []},
    '@/lib/session-publication': load('src/lib/session-publication.ts'),
    '@/lib/datetime': {formatUtcIsoInAmsterdamShort: x => x},
    './dashboard/global-standings-panel': {GlobalStandingsPanel: 'GlobalStandingsPanel'}
  });
  const tree = await page.default();
  const panels = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(visit);
    if (node.type === 'GlobalStandingsPanel') panels.push(node.props);
    visit(node.props?.children);
  }
  visit(tree);
  function checkSerializable(value) {
    assert.notEqual(typeof value, 'function');
    assert.notEqual(typeof value, 'symbol');
    if (value && typeof value === 'object') {
      assert.equal('$$typeof' in value, false);
      Object.values(value).forEach(checkSerializable);
    }
  }
  panels.forEach(checkSerializable);
  return JSON.parse(JSON.stringify(panels));
}
(async () => {
  for (const points of [12, 25, 70]) {
    const scores = [
      {grand_prix_id: previous.id, user_id: '0', total_points: 100},
      {grand_prix_id: current.id, user_id: '0', total_points: points},
      {grand_prix_id: current.id, user_id: '1', total_points: points},
      {grand_prix_id: current.id, user_id: '2', total_points: 0},
      {grand_prix_id: current.id, user_id: '4', total_points: null}
    ];
    const panels = await render([previous, current, future], scores);
    assert.equal(panels[0].grandPrix.id, timelineHelpers.getScoreGrandPrix([previous, current, future]).grandPrix.id);
    assert.equal(panels[0].grandPrix.id, current.id);
    assert.equal(panels[0].deadlinePassed, true);
    assert.deepEqual(panels[0].standings.map(x => [x.spelerNaam, x.totaalPunten]), [['Ada', points], ['Zoe', points], ['Ben', 0], ['No score', 0], ['Null score', 0]]);
    assert.equal(panels[1].standings.find(x => x.userId === '0').totaalPunten, 100 + points);
    assert.equal(panels[0].standings.length, profiles.length); // No league memberships required.
  }
  const finished = await render([previous, {...current, status: 'finished'}, future], [{grand_prix_id: current.id, user_id: '0', total_points: 70}]);
  assert.equal(finished[0].grandPrix.id, current.id);
  assert.equal(finished[0].standings[0].totaalPunten, 70);
  const fallback = await render([previous, future], []);
  assert.equal(fallback[0].grandPrix.id, previous.id);
  const beforeFirst = await render([future], []);
  assert.equal(beforeFirst[0].grandPrix.id, future.id);
  assert.equal(beforeFirst[0].deadlinePassed, false);
  const cancelled = await render([previous, {...current, status: 'cancelled'}, future], []);
  assert.equal(cancelled[0].grandPrix.id, previous.id);
  const empty = await render([], []);
  assert.equal(empty.length, 1); // Season panel remains when there is no GP.
  console.log('PASS: qualification/sprint/race totals; league GP parity; all players without leagues; ties; zero/null/missing scores; unchanged season totals; finished fallback; pre-deadline details; cancelled/empty calendar; JSON-serializable panel data.');
})().catch(error => {console.error(error); process.exitCode = 1});
