import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

// Run each actual window keydown handler with its surrounding state controlled.
// Focus deliberately remains on the background, so overlay event bubbling cannot
// provide the protection tested here.
function loadHandler(file, name, scope) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = [];
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) declarations.push(node);
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.equal(declarations.length, 1, `Expected one ${name} in ${file}`);
  const compiled = ts.transpileModule(`${declarations[0].getText(source)}\nexport default ${name};`, {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText;
  const exports = {};
  new Function(...Object.keys(scope), 'exports', compiled)(...Object.values(scope), exports);
  return exports.default;
}

function environment() {
  const calls = [];
  let overlay = false;
  const document = {querySelector(selector) {
    assert.equal(selector, '.learningPlanOverlay, .onboardingOverlay, .workspaceMenuOverlay');
    return overlay ? {className: 'learningPlanOverlay'} : null;
  }};
  return {
    calls, document,
    setOverlay(value) {overlay = value;},
    spy(name) {return (...args) => calls.push([name, ...args]);},
    key(handler, key, code = key) {
      let prevented = false;
      handler({key, code, target: {matches: () => false, closest: () => null},
        preventDefault() {prevented = true;}});
      return prevented;
    },
  };
}

const fixtures = [
  {
    name: 'Vocabulary page', file: 'app/page.tsx', handler: 'handleKeyboard',
    scope(env) {return {
      document: env.document, view: 'quick', quickType: 'words',
      quickActiveWord: {id: 'word-1', word: 'candid'},
      moveQuickWord: env.spy('move'), toggleQuickMeaning: env.spy('reveal'),
      pronounce: env.spy('speak'), rateQuickWordInPlace: env.spy('rate'),
    };},
    expected: [['rate', 'word-1', 'unknown'], ['rate', 'word-1', 'fuzzy'],
      ['rate', 'word-1', 'familiar'], ['move', 1], ['reveal', 'word-1'], ['speak', 'candid']],
  },
  {
    name: 'BB quick review', file: 'app/BBQuick.tsx', handler: 'keydown',
    scope(env) {
      const current = {id: 'bb-1', words: [{word: 'candid'}]};
      return {document: env.document, current, entries: [current, {id: 'bb-2'}],
        equivalents: [], scroll: {current: false}, colors: [
          {value: 'unknown'}, {value: 'fuzzy'}, {value: 'familiar'},
        ], setActiveId: env.spy('move'), toggleEquivalent: env.spy('reveal'),
        reveal: env.spy('meaning'), pronounce: env.spy('speak'), rate: env.spy('rate')};
    },
    expected: [['rate', 'bb-1', 'unknown'], ['rate', 'bb-1', 'fuzzy'],
      ['rate', 'bb-1', 'familiar'], ['move', 'bb-2'], ['reveal', 'bb-1'], ['speak', 'candid']],
  },
  {
    name: 'Fill, reading and math-index quick review', file: 'app/LcljQuick.tsx', handler: 'keydown',
    scope(env) {
      const active = {id: 'lclj-1', word: 'candid'};
      return {document: env.document, active, visible: [active, {id: 'lclj-2'}],
        scroll: {current: false}, setActiveId: env.spy('move'), reveal: env.spy('reveal'),
        pronounce: env.spy('speak'), rate: env.spy('rate')};
    },
    expected: [['rate', 'lclj-1', 'unknown'], ['rate', 'lclj-1', 'fuzzy'],
      ['rate', 'lclj-1', 'familiar'], ['move', 'lclj-2'], ['reveal', 'lclj-1'], ['speak', 'candid']],
  },
];

for (const fixture of fixtures) {
  test(`${fixture.name} ignores background shortcuts while a planner overlay exists, then resumes`, () => {
    const env = environment();
    const scope = fixture.scope(env);
    const handler = loadHandler(fixture.file, fixture.handler, scope);
    const keys = [['1'], ['2'], ['3'], ['ArrowRight'], ['Enter'], [' ', 'Space']];
    env.setOverlay(true);
    for (const args of keys) assert.equal(env.key(handler, ...args), false);
    assert.deepEqual(env.calls, []);
    if (scope.scroll) assert.equal(scope.scroll.current, false);

    env.setOverlay(false);
    for (const args of keys) assert.equal(env.key(handler, ...args), true);
    assert.deepEqual(env.calls, fixture.expected);

    // A minimal document host without querySelector keeps existing shortcuts.
    delete env.document.querySelector;
    env.calls.length = 0;
    assert.equal(env.key(handler, '3'), true);
    assert.deepEqual(env.calls, [fixture.expected[2]]);
  });
}

test('the page study handler cannot answer or grade a background exercise under the planner', () => {
  const env = environment();
  const common = {document: env.document, view: 'study', currentWordStage: 'choice',
    speak: env.spy('speak'), choose: env.spy('choose'), grade: env.spy('grade')};
  const choice = loadHandler('app/page.tsx', 'handleKeyboard', {
    ...common, revealed: false, options: [{id: 'answer-1'}],
  });
  const grading = loadHandler('app/page.tsx', 'handleKeyboard', {
    ...common, revealed: true, selected: 'answer-1', current: {id: 'answer-1'},
  });
  env.setOverlay(true);
  assert.equal(env.key(choice, 'a'), false);
  assert.equal(env.key(grading, '3'), false);
  assert.equal(env.key(grading, ' ', 'Space'), false);
  assert.deepEqual(env.calls, []);

  env.setOverlay(false);
  assert.equal(env.key(choice, 'a'), true);
  assert.equal(env.key(grading, '3'), true);
  assert.equal(env.key(grading, ' ', 'Space'), true);
  assert.deepEqual(env.calls, [['choose', {id: 'answer-1'}], ['grade', 'correct'], ['speak']]);
});

test('notebook review cannot rate a background word while a plan or introduction covers it',()=>{
 const env=environment(),word={id:'nb-1',word:'candid'};
 const handler=loadHandler('app/VocabularyNotebook.tsx','handleKeyboard',{
  document:env.document,review:true,activeWord:word,batch:{words:[word]},loading:false,saving:false,
  rateWord:env.spy('rate'),pronounce:env.spy('speak'),setActiveId:env.spy('move'),rowRefs:{current:{}},
  setRevealed:()=>env.calls.push(['reveal']),
 });
 env.setOverlay(true);for(const [key,code] of [['1','1'],['2','2'],['3','3'],['ArrowRight','ArrowRight'],['Enter','Enter'],[' ','Space']])assert.equal(env.key(handler,key,code),false);
 assert.deepEqual(env.calls,[]);
 env.setOverlay(false);assert.equal(env.key(handler,'3'),true);assert.deepEqual(env.calls,[['rate','nb-1','familiar',false],['reveal']]);
});
