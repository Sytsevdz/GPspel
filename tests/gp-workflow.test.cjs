const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function fixture() {
  const ids = ['participants', 'prices', 'settings', 'bonus', 'results', 'overview'];
  const listeners = {};
  const elements = ids.map(id => ({
    open: false, dataset: { workflowSection: id }, status: { textContent: '' },
    querySelector() { return this.status; },
    addEventListener(name, callback) { this[name] = callback; }, removeEventListener() {},
  }));
  const document = {
    querySelector(selector) { return elements[ids.findIndex(id => selector.includes(`"${id}"`))]; },
    addEventListener(name, callback) { listeners[name] = callback; }, removeEventListener() {},
  };
  const window = { addEventListener(name, callback) { listeners[name] = callback; }, removeEventListener() {},
    dispatchEvent(event) { listeners[event.type]?.(event); } };
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('src/app/admin/grand-prix/[id]/workflow-controller.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  new Function('require', 'module', 'exports', 'document', 'window', 'CustomEvent', code)(
    () => ({ useEffect: effect => effect() }), module, module.exports, document, window,
    class { constructor(type, { detail }) { this.type = type; this.detail = detail; } },
  );
  return { ...module.exports, elements, listeners, render(completed, extra = {}) {
    module.exports.WorkflowController({ grandPrixId: 'gp', completed, message: null, error: null, ...extra });
  }, submit(index) { listeners.submit({ target: { closest: () => elements[index] } }); } };
}
test('new and configured GPs open only the first incomplete section; overview stays collapsed', () => {
  for (const [completed, expected] of [ [[false,false,false,false,false,false],0], [[true,true,false,true,false,false],2] ]) {
    const f = fixture(); f.render(completed);
    assert.deepEqual(f.elements.map(e => e.open), completed.map((_, index) => index === expected));
  }
});
test('confirmed redirect success advances; errors and resets keep the section open', () => {
  for (const [extra, advance] of [ [{message:'GP-deelnemers opgeslagen'},true], [{error:'Opslaan mislukt'},false], [{message:'Automatische standaarddeelnemers hersteld'},false] ]) {
    const f = fixture(); const completed = [false,false,false,false,false,false];
    f.render(completed); f.submit(0); f.render(completed, extra);
    assert.equal(f.elements[0].open, !advance); assert.equal(f.elements[1].open, advance);
  }
});
test('manual open/close survives revalidation and successful deadline save advances', () => {
  const f = fixture(); const completed = [true,true,false,true,false,false]; f.render(completed);
  f.elements[0].open = true; f.elements[0].toggle({target:f.elements[0]});
  f.elements[2].open = false; f.elements[2].toggle({target:f.elements[2]});
  f.render([...completed]); assert.equal(f.elements[0].open,true); assert.equal(f.elements[2].open,false);
  f.reportWorkflowSuccess('gp','settings'); assert.equal(f.elements[2].open,false); assert.equal(f.elements[3].open,true);
});
test('results require all regular or sprint publications and reset invalidates completion', () => {
  for (const sprint of [false,true]) {
    const f = fixture(); const completed = [true,true,false,true,false,false]; f.render(completed);
    f.reportResultWorkflow('gp','qualification',sprint); f.reportResultWorkflow('gp','final',sprint);
    f.render(completed); assert.equal(f.elements[5].open,!sprint);
    if (sprint) {
      f.reportResultWorkflow('gp','sprintQualification',true); f.reportResultWorkflow('gp','sprintRace',true);
      f.render(completed); assert.equal(f.elements[5].open,true);
    }
    f.reportResultWorkflow('gp','reset',sprint); f.render(completed);
    assert.equal(f.elements[4].open,true); assert.equal(f.elements[4].status.textContent,'');
  }
});
test('management uses exactly the requested section order without passing server children to a client', () => {
  const source = fs.readFileSync('src/app/admin/grand-prix/[id]/page.tsx','utf8');
  assert.deepEqual([...source.matchAll(/data-workflow-section="([^"]+)"/g)].map(m=>m[1]), ['participants','prices','settings','bonus','results','overview']);
  assert.match(source, /<WorkflowController[^>]+\/>/);
});

test('bonus redirect advances to results even after client state was lost', () => {
  const f = fixture();
  f.render([true,true,false,true,false,false], {
    message: 'Bonusvraag opgeslagen', bonusFeedback: 'save-1',
  });
  assert.equal(f.elements[2].open, false, 'settings must stay collapsed');
  assert.equal(f.elements[3].open, false, 'saved bonus must collapse');
  assert.equal(f.elements[4].open, true, 'results must open');
});

test('bonus error after remount keeps bonus open without advancing', () => {
  const f = fixture();
  f.render([true,true,false,true,false,false], {
    error: 'Bonusvraag opslaan mislukt', bonusFeedback: 'save-error',
  });
  assert.equal(f.elements[2].open, false);
  assert.equal(f.elements[3].open, true);
  assert.equal(f.elements[4].open, false);
});

test('bonus feedback is handled once; revalidation preserves manual toggles', () => {
  const f = fixture();
  const feedback = { message: 'Bonusvraag opgeslagen', bonusFeedback: 'save-1' };
  const completed = [true,true,false,true,false,false];
  f.render(completed, feedback);
  f.elements[3].open = true; f.elements[3].toggle({target:f.elements[3]});
  f.elements[4].open = false; f.elements[4].toggle({target:f.elements[4]});
  f.render([...completed], feedback);
  assert.equal(f.elements[3].open, true);
  assert.equal(f.elements[4].open, false);
  f.render([...completed], { ...feedback, bonusFeedback: 'save-2' });
  assert.equal(f.elements[2].open, false);
  assert.equal(f.elements[3].open, false);
  assert.equal(f.elements[4].open, true);
});
