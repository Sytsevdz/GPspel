const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, mocks) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
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

function fixture({ admin = true, user = true, failure = false, completed = false } = {}) {
  const row = { id: 'gp', name: 'GP', status: 'upcoming', is_sprint_weekend: false,
    deadline: '2027-06-01T12:00:00.000Z', qualification_start: '2027-06-01T11:00:00.000Z', settings_completed: completed };
  const writes = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: user ? { id: 'admin' } : null } }) },
    from(table) {
      let update;
      return {
        select() { return this; }, eq() { return this; }, order() { return this; }, returns() { return this; },
        update(value) { update = value; writes.push(value); return this; },
        maybeSingle: async () => ({ data: table === 'profiles' ? { role: admin ? 'admin' : 'member' }
          : table === 'grand_prix' ? { ...row } : null }),
        then(resolve, reject) {
          if (update && !failure) Object.assign(row, update);
          return Promise.resolve({ data: table === 'driver_prices' ? [{ driver_id: 'driver', price: 10 }] : [],
            error: failure && update ? { message: 'write failed' } : null }).then(resolve, reject);
        },
      };
    },
  };
  const noop = () => null;
  const mocks = {
    'next/cache': { revalidatePath() {} },
    'next/link': { default: noop },
    'next/navigation': { redirect(url) { throw new Error(url); } },
    '@/lib/supabase': { createServerSupabaseClient: () => client },
    '@/lib/grand-prix-drivers': {
      getGrandPrixDrivers: async () => [{ id: 'driver', name: 'Driver', constructor_team: 'Team' }],
      getExplicitGrandPrixDrivers: async () => [{ id: 'driver' }],
    },
  };
  // The server tree retains component props and server actions for inspection.
  for (const [id, names] of Object.entries({
    './workflow-controller': ['WorkflowController'], './bonus-question-form': ['BonusQuestionForm'],
    '@/app/admin/grand-prix/[id]/deadline/deadline-form': ['DeadlineForm'],
    '@/app/admin/confirm-submit-button': ['ConfirmSubmitButton'],
    '@/app/admin/confirm-reactivate-submit-button': ['ConfirmReactivateSubmitButton'],
    '@/app/admin/reset-prices-submit-button': ['ResetPricesSubmitButton'],
    '@/app/admin/grand-prix/[id]/league-participation-filter': ['LeagueParticipationFilter'],
    '@/components/admin/grand-prix-driver-participants-editor': ['GrandPrixDriverParticipantsEditor'],
  })) mocks[id] = Object.fromEntries(names.map(name => [name, noop]));
  return { row, writes, mocks, page: () => load('src/app/admin/grand-prix/[id]/page.tsx', mocks).default({ params: { id: 'gp' }, searchParams: {} }) };
}
function find(node, predicate) {
  if (!node || typeof node !== 'object') return;
  if (predicate(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) {
    const found = find(child, predicate); if (found) return found;
  }
}
function form() {
  const value = new FormData(); value.set('grand_prix_id', 'gp');
  value.set('deadline', '2027-06-01T14:00'); value.set('qualification_start', '2027-06-01T13:00');
  return value;
}

test('server page reads durable settings after save, refresh and reopening; prefilled inputs alone do not complete it', async () => {
  const f = fixture();
  let tree = await f.page();
  assert.equal(find(tree, n => n.props?.['data-workflow-section'] === 'settings').props.open, true);
  const before = { ...f.row };
  const result = await load('src/app/actions/grand-prix-deadlines.ts', f.mocks).updateGrandPrixDeadline(undefined, form());
  assert.equal(result.status, 'success');
  assert.equal(f.row.settings_completed, true);
  assert.equal(f.row.deadline, before.deadline);
  assert.equal(f.row.qualification_start, before.qualification_start);
  assert.equal(f.row.status, before.status);
  for (const visit of ['refresh', 'reopen']) {
    tree = await f.page();
    assert.equal(find(tree, n => n.props?.['data-workflow-section'] === 'settings').props.open, false, visit);
    assert.equal(find(tree, n => n.props?.['data-workflow-section'] === 'bonus').props.open, true, visit);
  }
});

test('grandfathered GP settings are complete without any writes', async () => {
  const f = fixture({ completed: true }); const tree = await f.page();
  assert.equal(find(tree, n => n.props?.['data-workflow-section'] === 'bonus').props.open, true);
  assert.deepEqual(f.writes, []);
});

for (const options of [{ admin: false }, { user: false }, { failure: true }]) {
  test(`deadline save cannot mark settings complete on failure: ${JSON.stringify(options)}`, async () => {
    const f = fixture(options);
    const result = await load('src/app/actions/grand-prix-deadlines.ts', f.mocks).updateGrandPrixDeadline(undefined, form());
    assert.equal(result.status, 'error'); assert.equal(f.row.settings_completed, false);
    if (!options.failure) assert.deepEqual(f.writes, []);
  });
}

test('invalid timing does not write the completion receipt', async () => {
  const f = fixture(); const data = form(); data.set('deadline', 'invalid');
  const result = await load('src/app/actions/grand-prix-deadlines.ts', f.mocks).updateGrandPrixDeadline(undefined, data);
  assert.equal(result.status, 'error'); assert.deepEqual(f.writes, []);
});

test('weekend save persists completion atomically and preserves timing', async () => {
  const f = fixture(); const before = { ...f.row }; const tree = await f.page();
  const settings = find(tree, n => n.props?.['data-workflow-section'] === 'settings');
  const weekendForm = find(settings, n => n.type === 'form' && typeof n.props.action === 'function');
  const data = form(); data.set('is_sprint_weekend', 'true');
  await assert.rejects(weekendForm.props.action(data), /Weekendtype\+bijgewerkt/);
  assert.deepEqual(f.writes, [{ is_sprint_weekend: true, settings_completed: true }]);
  assert.equal(f.row.deadline, before.deadline); assert.equal(f.row.qualification_start, before.qualification_start);
  assert.equal(f.row.status, before.status);
});
