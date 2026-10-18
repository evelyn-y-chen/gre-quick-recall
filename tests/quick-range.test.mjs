import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const model = {};
new Function('exports', ts.transpileModule(fs.readFileSync(new URL('../app/quickRangeModel.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText)(model);
const data = file => JSON.parse(fs.readFileSync(new URL(`../app/${file}.json`, import.meta.url), 'utf8'));
const bb = data('bbEquivalents');
const groupsOf = entries => [...new Set(entries.map(entry => entry.list ? `List ${String(entry.list).padStart(2, '0')}` : entry.category))];

test('BB keeps the selected lower-volume lists when returning or refreshing', () => {
  const saved = { volume: '下', lists: [31, 33, 36] };
  assert.deepEqual(model.restoreBBRange(JSON.stringify(saved), bb), saved);
  assert.deepEqual(model.restoreBBRange(JSON.stringify({ volume: '下', lists: [1, 16, 31, 31, '32', 999] }), bb), { volume: '下', lists: [31] });
  assert.deepEqual(model.restoreBBRange(JSON.stringify({ volume: '中', lists: [1, 16, 30, 31] }), bb), { volume: '中', lists: [16, 30] });
});

test('BB retains intentional empty ranges and rejects corrupt stored preferences', () => {
  assert.deepEqual(model.restoreBBRange('{"volume":"下","lists":[]}', bb), { volume: '下', lists: [] });
  assert.deepEqual(model.restoreBBRange('{"volume":"全部","lists":[1,36]}', bb), { volume: '全部', lists: [1, 36] });
  for (const raw of [null, '{invalid', '[]', 'null', '{"volume":"other","lists":[31]}', '{"volume":"下","lists":"31"}']) {
    assert.deepEqual(model.restoreBBRange(raw, bb), { volume: '全部', lists: [1] });
  }
});

test('fill, reading and math-index selections independently round-trip against their own source options', () => {
  const deckOptions = [groupsOf(data('lcljFill')), groupsOf(data('lcljReading').map((entry, index) => ({ ...entry, list: Math.floor(index / 50) + 1 }))), groupsOf(data('lcljMath'))];
  for (const options of deckOptions) {
    const selection = [options[1], options.at(-1)];
    assert.deepEqual(model.restoreGroupRange(JSON.stringify(selection), options), selection);
    assert.deepEqual(model.restoreGroupRange(JSON.stringify([options.at(-1), 'missing-group', options.at(-1), 1]), options), [options.at(-1)]);
    assert.deepEqual(model.restoreGroupRange('[]', options), []);
    assert.deepEqual(model.restoreGroupRange(null, options), [options[0]]);
    assert.deepEqual(model.restoreGroupRange('{broken', options), [options[0]]);
  }
  assert.deepEqual(model.restoreGroupRange('["List 62"]', deckOptions[1]), []);
  assert.deepEqual(model.restoreGroupRange('["List 01"]', deckOptions[2]), []);
  assert.deepEqual(model.restoreGroupRange(null, []), []);
});

// Execute the real components in the same small hook host used by scheduling
// tests. The browser timers stay pending until requested, making restore/write
// races observable without touching any real browser or user storage.
function quickView(name, initialStorage = {}, initialDeck = 'lclj-fill') {
  const modules = new Map(), timers = new Map();
  let timerId = 0, hooks = [], effects = [], cursor = 0, dirty = false, tree, deck = initialDeck;
  const browser = { setTimeout(fn) { const id = ++timerId; timers.set(id, fn); return id; }, clearTimeout(id) { timers.delete(id); }, addEventListener() {}, removeEventListener() {} };
  const react = {
    useState(initial) { const i = cursor++; if (!(i in hooks)) hooks[i] = typeof initial === 'function' ? initial() : initial; return [hooks[i], value => { const next = typeof value === 'function' ? value(hooks[i]) : value; if (!Object.is(hooks[i], next)) { hooks[i] = next; dirty = true; } }]; },
    useRef(initial) { const i = cursor++; return hooks[i] ?? (hooks[i] = { current: initial }); },
    useMemo(create, deps) { const i = cursor++, old = hooks[i]; if (!old || deps.some((value, n) => value !== old.deps[n])) hooks[i] = { value: create(), deps }; return hooks[i].value; },
    useEffect(effect, deps) { const i = cursor++, old = hooks[i]; if (!old || !deps || deps.some((value, n) => value !== old.deps?.[n])) { hooks[i] = { deps, cleanup: old?.cleanup }; effects.push(() => { hooks[i].cleanup?.(); hooks[i].cleanup = effect(); }); } },
  };
  const jsx = (type, props) => ({ type, props: props ?? {} });
  function load(importName) {
    if (importName === '../community/SelectionChips') {const out={};new Function('exports','require',ts.transpileModule(fs.readFileSync(new URL('../community/SelectionChips.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText)(out,name=>({jsx,jsxs:jsx}));return out;}
    if (importName === '../community/learningPlanStore') return {recordLearningPlanRatings(){}};
    if (importName === 'react') return react;
    if (importName === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (importName === './SharedWordMemory') return { default: () => null, useWordMemory: () => undefined };
    if (importName === './RatingCloudSync' || importName === './RevealControls') return { default: () => null };
    if (importName.endsWith('.json')) return { default: data(importName.slice(2, -5)) };
    if (modules.has(importName)) return modules.get(importName);
    assert.ok(['./BBQuick', './LcljQuick', './quickRangeModel', './ratingSyncModel', './ratingStorage', './wordMemoryModel', './bbModel', '../community/storage'].includes(importName), `Unexpected import: ${importName}`);
    const file = importName === '../community/storage' ? '../community/storage.ts' : `../app/${importName.slice(2)}${['./BBQuick', './LcljQuick'].includes(importName) ? '.tsx' : '.ts'}`;
    const exported = {}; modules.set(importName, exported);
    const output = ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    new Function('require', 'exports', 'window', output)(load, exported, browser);
    return exported;
  }
  const storage = load('../community/storage'); storage.loadStorage(initialStorage);
  const Component = load(`./${name}`).default;
  function render() { for (let n = 0; n < 10; n++) { dirty = false; cursor = 0; tree = Component({ deck, ratings: {}, onRate() {}, pronounce() {} }); while (effects.length) effects.shift()(); if (!dirty) return; } throw Error('Hook host did not settle'); }
  function nodes(node) { if (!node || typeof node !== 'object') return []; return Array.isArray(node) ? node.flatMap(nodes) : typeof node.type==='function'?nodes(node.type(node.props)):[node, ...nodes(node.props?.children)]; }
  function text(node) { if (node == null || typeof node === 'boolean') return ''; if (Array.isArray(node)) return node.map(text).join(''); return typeof node === 'object' ? text(node.props?.children) : String(node); }
  function clean() { for (const hook of hooks) hook?.cleanup?.(); hooks = []; effects = []; }
  render();
  return {
    snapshot: () => storage.exportStorage(),
    selected: () => nodes(tree).filter(node => node.type === 'button' && node.props['aria-pressed'] === true).map(node=>text(node).replace(/^✓ /,'')),
    volume: () => nodes(tree).find(node => node.type === 'select')?.props.value,
    click(label) { const button = nodes(tree).find(node => node.type === 'button' && text(node).replace(/^✓ /,'').startsWith(label)); assert.ok(button, `Missing button ${label}`); button.props.onClick(); render(); },
    flush() { const pending = [...timers.values()]; timers.clear(); for (const fn of pending) fn(); render(); },
    remount(nextDeck = deck, workspace) { clean(); if (workspace) storage.loadStorage(workspace); deck = nextDeck; render(); },
    changeDeck(nextDeck) { deck = nextDeck; render(); },
    close: clean,
  };
}

test('BB restores before writing, and scope persists across leaving and reentering the component', () => {
  const rangeKey = 'gre-bb-selection-v1', value = JSON.stringify({ volume: '下', lists: [31, 33] });
  const view = quickView('BBQuick', { [rangeKey]: value });
  try {
    assert.equal(view.snapshot()[rangeKey], value, 'Initial default must not overwrite the stored lower-volume scope');
    view.flush(); assert.equal(view.volume(), '下');
    assert.ok(view.selected().some(label => label.startsWith('List 31')));
    assert.ok(view.selected().some(label => label.startsWith('List 33')));
    view.click('全不选'); assert.deepEqual(JSON.parse(view.snapshot()[rangeKey]), { volume: '下', lists: [] });
    view.remount(); view.flush(); assert.equal(view.volume(), '下'); assert.ok(!view.selected().some(label => label.startsWith('List ')));
    const firstWorkspace = view.snapshot();
    view.remount(undefined, {}); view.flush(); assert.equal(view.volume(), '全部');
    view.remount(undefined, firstWorkspace); view.flush(); assert.equal(view.volume(), '下');
  } finally { view.close(); }
});

test('Lclj switching decks never writes a previous range into the next deck before restoration', () => {
  const fillKey = 'gre-lclj-fill-selection-v1', readingKey = 'gre-lclj-reading-selection-v2';
  const view = quickView('LcljQuick', { [fillKey]: '["List 62"]', [readingKey]: '["List 07"]' });
  try {
    assert.equal(view.snapshot()[fillKey], '["List 62"]'); view.flush(); assert.ok(view.selected().includes('List 62'));
    view.changeDeck('lclj-reading');
    assert.equal(view.snapshot()[readingKey], '["List 07"]', 'Deck switch must not persist List 62 under the reading key');
    view.flush(); assert.ok(view.selected().includes('List 07'));
    view.click('List 07'); assert.equal(view.snapshot()[readingKey], '[]');
    view.remount('lclj-fill'); view.flush(); assert.ok(view.selected().includes('List 62'));
    view.remount('lclj-reading'); view.flush(); assert.ok(!view.selected().some(label => label.startsWith('List ')));
  } finally { view.close(); }
});

 test('BB last selection, clear and select all show the same state that is saved',()=>{
 const key='gre-bb-selection-v1',v=quickView('BBQuick',{[key]:JSON.stringify({volume:'下',lists:[31]})});
 try{v.flush();v.click('List 31');assert.deepEqual(JSON.parse(v.snapshot()[key]).lists,[]);assert.equal(v.selected().some(s=>s.startsWith('List ')),false);v.click('全选');const saved=JSON.parse(v.snapshot()[key]);assert.ok(saved.lists.length>1);assert.equal(v.selected().filter(s=>s.startsWith('List ')).length,saved.lists.length);v.click('全不选');assert.equal(v.selected().filter(s=>s.startsWith('List ')).length,0);}finally{v.close();}
});
