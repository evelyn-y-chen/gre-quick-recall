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
function quickView(name, initialStorage = {}, initialDeck = 'lclj-fill', initialRatings = {}) {
  const modules = new Map(), timers = new Map(), rateCalls = [], listeners=new Map(), scrolled=[],spoken=[];
  let timerId = 0, hooks = [], effects = [], cursor = 0, dirty = false, tree, deck = initialDeck;
  const browser = { setTimeout(fn) { const id = ++timerId; timers.set(id, fn); return id; }, clearTimeout(id) { timers.delete(id); }, addEventListener(name,fn) {listeners.set(name,fn);}, removeEventListener(name,fn) {if(listeners.get(name)===fn)listeners.delete(name);} };
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
    if (importName === '../community/Practice') return {default:()=>null};
    if (importName === './RatingCloudSync' || importName === './RevealControls' || importName === './NotebookFrequency') return { default: () => null };
    if (importName.endsWith('.json')) return { default: data(importName.slice(2, -5)) };
    if (modules.has(importName)) return modules.get(importName);
    assert.ok(['./BBQuick', './LcljQuick', './ZhangQuick', './QingshanQuick', './qingshanCatalog', './zhangCatalog', './quickRangeModel', './ratingSyncModel', './ratingStorage', './wordMemoryModel', './bbModel', './studyWordOrder', '../community/storage'].includes(importName), `Unexpected import: ${importName}`);
    const file = importName === '../community/storage' ? '../community/storage.ts' : `../app/${importName.slice(2)}${['./BBQuick', './LcljQuick', './ZhangQuick', './QingshanQuick'].includes(importName) ? '.tsx' : '.ts'}`;
    const exported = {}; modules.set(importName, exported);
    const output = ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    new Function('require', 'exports', 'window', 'document', output)(load, exported, browser, {querySelector(){return null;}});
    return exported;
  }
  const storage = load('../community/storage'); storage.loadStorage(initialStorage);
  const Component = load(`./${name}`).default;
  function render() { for (let n = 0; n < 10; n++) { dirty = false; cursor = 0; tree = Component({ deck, ratings: initialRatings, onRate: (...args) => rateCalls.push(args), pronounce(word) {spoken.push(word);} }); for(const n of nodes(tree))if(n.props?.ref)n.props.ref({scrollIntoView(options){scrolled.push({word:text(n),options});}}); while (effects.length) effects.shift()(); if (!dirty) return; } throw Error('Hook host did not settle'); }
  function nodes(node) { if (!node || typeof node !== 'object') return []; return Array.isArray(node) ? node.flatMap(nodes) : typeof node.type==='function'?nodes(node.type(node.props)):[node, ...nodes(node.props?.children)]; }
  function text(node) { if (node == null || typeof node === 'boolean') return ''; if (Array.isArray(node)) return node.map(text).join(''); return typeof node === 'object' ? text(node.props?.children) : String(node); }
  function clean() { for (const hook of hooks) hook?.cleanup?.(); hooks = []; effects = []; }
  const bbLabel = entry => `第 ${entry.number} 组 · ${entry.words[0].word}`;
  const colorGroup = () => nodes(tree).find(node => node.props?.['aria-label'] === 'BB 复习颜色（可多选）');
  render();
  return {
    nodes: () => nodes(tree), text, rateCalls, scrolled, spoken,
    key(key,target={closest(){return null;}}){let prevented=false;listeners.get("keydown")?.({key,code:key===' '?'Space':key,target,preventDefault(){prevented=true;}});render();return prevented;},
    active:()=>nodes(tree).find(n=>n.props?.["aria-current"]==="true"),
    snapshot: () => storage.exportStorage(),
    selected: () => nodes(tree).filter(node => node.type === 'button' && node.props['aria-pressed'] === true).map(node=>text(node).replace(/^✓ /,'')),
    volume: () => nodes(tree).find(node => node.type === 'select')?.props.value,
    click(label) { const button = nodes(tree).find(node => node.type === 'button' && text(node).replace(/^✓ /,'').startsWith(label)); assert.ok(button, `Missing button ${label}`); button.props.onClick(); render(); },
    flush() { const pending = [...timers.values()]; timers.clear(); for (const fn of pending) fn(); render(); },
    remount(nextDeck = deck, workspace) { clean(); if (workspace) storage.loadStorage(workspace); deck = nextDeck; render(); },
    changeDeck(nextDeck) { deck = nextDeck; render(); },
    bbVisible: () => nodes(tree).filter(node => node.type === 'article').map(node => node.props['aria-label']),
    bbRows: () => nodes(tree).filter(node => node.type === 'article').map(node => ({ label: node.props['aria-label'], header: text(nodes(node).find(child => child.type === 'header')), rating: nodes(node).filter(child => child.type === 'button' && child.props['aria-pressed'] === true).map(text) })),
    lcljRows: () => nodes(tree).filter(node => node.props?.role === 'row' && !node.props.className?.includes('quickHeader')).map(node => ({ word: text(nodes(node).find(child => child.props?.className === 'quickWord')), source: text(nodes(node).find(child => child.props?.className?.includes('lcljSource'))), rating: nodes(node).filter(child => child.type === 'button' && child.props['aria-pressed'] === true).map(text) })),
    bbSelectedColors: () => nodes(colorGroup()).filter(node => node.type === 'button' && node.props['aria-pressed']).map(node => text(node).replace(/\s*\d+$/, '').trim()),
    bbColorCount(label) { const button = nodes(colorGroup()).find(node => node.type === 'button' && text(node).startsWith(label)); return Number(text(button).match(/\d+$/)?.[0]); },
    bbRate(id, label) { const entry = bb.find(entry => entry.id === id); const article = nodes(tree).find(node => node.type === 'article' && node.props['aria-label'] === bbLabel(entry)); assert.ok(article); const button = nodes(article).find(node => node.type === 'button' && text(node) === label); assert.ok(button); button.props.onClick(); render(); },
    search(value) { const input = nodes(tree).find(node => node.type === 'input' && node.props['aria-label']?.startsWith('搜索')); assert.ok(input); input.props.onChange({ target: { value } }); render(); },
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

const bbReviewLabels = entries => entries.map(entry => `第 ${entry.number} 组 · ${entry.words[0].word}`);

test('BB review can combine red, yellow and unrated groups without changing saved ratings', () => {
  const scoped = bb.filter(entry => entry.list === 1);
  const [red, yellow, green] = scoped;
  const ratings = { [red.id]: 'unknown', [yellow.id]: 'fuzzy', [green.id]: 'familiar' };
  const view = quickView('BBQuick', { 'gre-bb-ratings-v1': JSON.stringify(ratings) });
  try {
    view.flush();
    assert.deepEqual(view.bbSelectedColors(), ['全部']);
    view.click('不认识'); view.click('模糊');
    assert.deepEqual(view.bbSelectedColors(), ['不认识', '模糊']);
    assert.deepEqual(view.bbVisible(), bbReviewLabels([red, yellow]));
    assert.equal(view.bbColorCount('不认识'), 1);
    assert.equal(view.bbColorCount('模糊'), 1);
    view.click('未标记');
    assert.deepEqual(view.bbVisible(), bbReviewLabels(scoped.filter(entry => entry.id !== green.id)));
    view.click('不认识');
    assert.deepEqual(view.bbSelectedColors(), ['模糊', '未标记']);
    assert.deepEqual(view.bbVisible(), bbReviewLabels(scoped.filter(entry => ![red.id, green.id].includes(entry.id))));
    view.click('全部');
    assert.deepEqual(view.bbSelectedColors(), ['全部']);
    assert.deepEqual(view.bbVisible(), bbReviewLabels(scoped));
    assert.deepEqual(JSON.parse(view.snapshot()['gre-bb-ratings-v1']), ratings);
  } finally { view.close(); }
});

test('BB combined review keeps rerated cards in this round and refreshes only when filtering again', () => {
  const [red, yellow] = bb.filter(entry => entry.list === 1);
  const view = quickView('BBQuick', { 'gre-bb-ratings-v1': JSON.stringify({ [red.id]: 'unknown', [yellow.id]: 'fuzzy' }) });
  try {
    view.flush(); view.click('不认识'); view.click('模糊');
    view.bbRate(red.id, '熟悉');
    assert.deepEqual(view.bbVisible(), bbReviewLabels([red, yellow]), 'A newly green card must not disappear during review');
    assert.equal(view.bbColorCount('不认识'), 0);
    assert.equal(view.bbColorCount('熟悉'), 1);
    assert.equal(JSON.parse(view.snapshot()['gre-bb-ratings-v1'])[red.id], 'familiar');
    view.click('不认识');
    assert.deepEqual(view.bbSelectedColors(), ['模糊']);
    assert.deepEqual(view.bbVisible(), bbReviewLabels([yellow]));
    view.bbRate(yellow.id, '熟悉');
    assert.deepEqual(view.bbVisible(), bbReviewLabels([yellow]));
    view.click('模糊');
    assert.deepEqual(view.bbSelectedColors(), ['模糊'], 'Clicking the sole selected color refreshes it, as in other decks');
    assert.deepEqual(view.bbVisible(), []);
    view.click('熟悉');
    assert.deepEqual(view.bbVisible(), bbReviewLabels([red, yellow]));
  } finally { view.close(); }
});

test('BB color combinations intersect the current List range and search, including empty results', () => {
  const [red, yellow] = bb.filter(entry => entry.list === 1);
  const otherList = bb.find(entry => entry.list === 2);
  const ratings = { [red.id]: 'unknown', [yellow.id]: 'fuzzy', [otherList.id]: 'unknown' };
  const view = quickView('BBQuick', { 'gre-bb-ratings-v1': JSON.stringify(ratings) });
  try {
    view.flush(); view.click('不认识'); view.click('模糊');
    assert.deepEqual(view.bbVisible(), bbReviewLabels([red, yellow]));
    view.search(red.words[0].word);
    const query = red.words[0].word.toLowerCase();
    assert.deepEqual(view.bbVisible(), bbReviewLabels([red, yellow].filter(entry => [entry.comparison, ...entry.words.flatMap(word => [word.word, word.meaning, word.memory])].join(' ').toLowerCase().includes(query))));
    view.search('definitely-not-a-word-987654321'); assert.deepEqual(view.bbVisible(), []);
    view.search(''); view.click('List 2');
    assert.deepEqual(view.bbVisible(), bbReviewLabels([red, yellow, otherList]));
    view.click('全不选'); assert.deepEqual(view.bbVisible(), []);
    assert.deepEqual(view.bbSelectedColors(), ['不认识', '模糊']);
    view.click('List 1'); assert.deepEqual(view.bbVisible(), bbReviewLabels([red, yellow]));
  } finally { view.close(); }
});

test('BB A–Z sorts by the visible core word within the same range and preserves group labels and ratings', () => {
  const rangeKey = 'gre-bb-selection-v1';
  const selected = bb.filter(entry => entry.volume === '下' && [31, 33].includes(entry.list));
  const ratings = { [selected[0].id]: 'unknown', [selected[1].id]: 'fuzzy' };
  const view = quickView('BBQuick', {
    [rangeKey]: JSON.stringify({ volume: '下', lists: [31, 33] }),
    'gre-bb-ratings-v1': JSON.stringify(ratings),
  });
  try {
    view.flush();
    const beforeStorage = view.snapshot(), originalRows = view.bbRows();
    assert.deepEqual(view.bbVisible(), bbReviewLabels(selected));
    view.click('A–Z 字母排序');
    assert.ok(view.selected().includes('A–Z 字母排序'));
    assert.ok(!view.selected().includes('原顺序'));
    const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });
    const expected = [...selected].sort((left, right) => collator.compare(left.words[0].word, right.words[0].word));
    assert.deepEqual(view.bbVisible(), bbReviewLabels(expected));
    assert.notDeepEqual(view.bbVisible(), bbReviewLabels(selected), 'The fixture must visibly exercise a changed display order');
    assert.deepEqual(new Set(view.bbVisible()), new Set(bbReviewLabels(selected)));
    const byLabel = new Map(originalRows.map(row => [row.label, row]));
    for (const row of view.bbRows()) assert.deepEqual(row, byLabel.get(row.label), 'Original List/group/page labels and rating remain attached to the same group');
    assert.deepEqual(view.snapshot(), beforeStorage, 'Changing display order must not write range or learning data');
    view.click('原顺序');
    assert.ok(view.selected().includes('原顺序'));
    assert.ok(!view.selected().includes('A–Z 字母排序'));
    assert.deepEqual(view.bbRows(), originalRows);
    assert.deepEqual(view.snapshot(), beforeStorage);
  } finally { view.close(); }
});

for (const [deck, file, selectedGroups] of [
  ['lclj-fill', 'lcljFill', ['List 01', 'List 02']],
  ['lclj-reading', 'lcljReading', ['List 01', 'List 02']],
  ['lclj-math', 'lcljMath', null],
]) {
  test(`${deck} A–Z preserves selected membership, source labels and ratings and can restore original order`, () => {
    const source = data(file).map((entry, index) => deck === 'lclj-reading' ? { ...entry, list: Math.floor(index / 50) + 1 } : entry);
    const group = entry => entry.list ? `List ${String(entry.list).padStart(2, '0')}` : entry.category;
    const groups = selectedGroups ?? groupsOf(source).slice(0, 2);
    const selected = source.filter(entry => groups.includes(group(entry)));
    const key = deck === 'lclj-reading' ? 'gre-lclj-reading-selection-v2' : `gre-${deck}-selection-v1`;
    const ratings = { [selected[0].id]: 'familiar', [selected[1].id]: 'fuzzy' };
    const beforeRatings = structuredClone(ratings);
    const view = quickView('LcljQuick', { [key]: JSON.stringify(groups) }, deck, ratings);
    try {
      view.flush();
      const originalRows = view.lcljRows(), beforeStorage = view.snapshot();
      assert.deepEqual(originalRows.map(row => row.word), selected.map(entry => entry.word));
      view.click('A–Z 字母排序');
      assert.ok(view.selected().includes('A–Z 字母排序'));
      assert.ok(!view.selected().includes('原顺序'));
      const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });
      const expected = [...selected].sort((left, right) => collator.compare(left.word.normalize('NFKC').trim().replace(/\s+/g, ' '), right.word.normalize('NFKC').trim().replace(/\s+/g, ' ')));
      const rows = view.lcljRows();
      assert.deepEqual(rows.map(row => row.word), expected.map(entry => entry.word));
      assert.deepEqual(rows.map(row => JSON.stringify(row)).sort(), originalRows.map(row => JSON.stringify(row)).sort(), 'Only row positions change; labels and marks stay attached');
      assert.deepEqual(view.snapshot(), beforeStorage);
      assert.deepEqual(ratings, beforeRatings);
      assert.deepEqual(view.rateCalls, []);
      view.click('原顺序');
      assert.ok(view.selected().includes('原顺序'));
      assert.ok(!view.selected().includes('A–Z 字母排序'));
      assert.deepEqual(view.lcljRows(), originalRows);
    } finally { view.close(); }
  });
}

for(const deck of ['zhang-words','zhang-pairs','zhang-jijing'])test(`${deck} arrows move the active word and scroll to it; editing fields keep their own keys`,()=>{
 const view=quickView('ZhangQuick',{},deck),file=deck==='zhang-words'?'zhangWords':deck==='zhang-pairs'?'zhangPairs':'zhangJijing',entries=data(file);
 view.flush();assert.match(view.text(view.active()),new RegExp(entries[0].word));
 assert.equal(view.key('ArrowDown'),true);assert.match(view.text(view.active()),new RegExp(entries[1].word));assert.ok(view.scrolled.length);assert.equal(view.scrolled.at(-1).options.block,'center');
 assert.equal(view.key('ArrowUp'),true);assert.match(view.text(view.active()),new RegExp(entries[0].word));
 const scrollCount=view.scrolled.length;view.key('ArrowUp');assert.equal(view.scrolled.length,scrollCount,'Boundary key does not scroll to another row');
 assert.equal(view.key('ArrowDown',{closest(){return {};}}),false);assert.match(view.text(view.active()),new RegExp(entries[0].word));
 view.key('Enter');assert.ok(view.text(view.active()).includes(entries[0].meaning));view.key('2');
 assert.equal(JSON.parse(view.snapshot()[`gre-${deck}-ratings-v1`])[entries[0].id],'fuzzy');
});

for(const [deck,file,common,special] of [['qingshan-precise','qingshanPrecise','词典释义','精准释义'],['qingshan-rare','qingshanRare','常见释义','重要僻义']])test(`${deck} preserves source columns and page selection, supports keyboard navigation and note visibility`,()=>{
 const view=quickView('QingshanQuick',{},deck),entries=data(file),key=`gre-${deck}-selection-v1`;
 try{
  view.flush();assert.match(view.text(view.active()),new RegExp(entries[0].word));
  assert.ok(view.nodes().some(n=>n.props?.role==='columnheader'&&view.text(n)===common));assert.ok(view.nodes().some(n=>n.props?.role==='columnheader'&&view.text(n)===special));
  view.key('Enter');assert.ok(view.text(view.active()).includes(entries[0].commonMeaning));assert.ok(view.text(view.active()).includes(entries[0].specialMeaning));
  assert.equal(view.key('ArrowDown'),true);assert.match(view.text(view.active()),new RegExp(entries[1].word));assert.equal(view.scrolled.at(-1).options.block,'center');
  assert.equal(view.key('ArrowDown',{closest(){return {};}}),false);assert.match(view.text(view.active()),new RegExp(entries[1].word));
  view.key('2');assert.equal(JSON.parse(view.snapshot()[`gre-${deck}-ratings-v1`])[entries[1].id],'fuzzy');
  view.click('隐藏共享笔记');assert.match(view.text(view.active()),/笔记已隐藏/);view.click('显示共享笔记');
  view.click('原表第 2 页');assert.deepEqual(JSON.parse(view.snapshot()[key]),['原表第 1 页','原表第 2 页']);
  view.click('原表第 1 页');assert.deepEqual(JSON.parse(view.snapshot()[key]),['原表第 2 页']);view.remount();view.flush();assert.deepEqual(JSON.parse(view.snapshot()[key]),['原表第 2 页']);
  const last=entries.filter(e=>e.list===2).at(-1);view.search(last.specialMeaning);assert.ok(view.active());assert.ok(view.text(view.active()).includes(last.word)||view.nodes().some(n=>n.props?.role==='row'&&view.text(n).includes(last.word)));
 }finally{view.close();}
});

test('Qingshan shows one word for adjacent repeated source rows, searches every sense and retains legacy ratings until an explicit self-test',()=>{
 const deck='qingshan-rare',entries=data('qingshanRare'),rows=entries.filter(e=>e.word==='sound'),key=`gre-${deck}-ratings-v1`;
 const ratings={[rows[0].id]:'familiar',[rows[1].id]:'fuzzy',[entries.at(-1).id]:'unknown'};
 const view=quickView('QingshanQuick',{[key]:JSON.stringify(ratings)},deck);
 const displayed=()=>view.nodes().filter(n=>n.props?.role==='row'&&view.text(n).includes('sound'));
 try{
  view.flush();view.search('sound');assert.equal(displayed().length,1);
  assert.deepEqual(JSON.parse(view.snapshot()[key]),ratings);
  assert.ok(view.nodes().some(n=>n.props?.className==='quickCount'&&view.text(n).includes('词库 132 条')));
  const row=displayed()[0];assert.ok(view.nodes().some(n=>n.props?.['aria-label']==='sound 掌握程度'));
  assert.ok(view.text(row).includes('第 2–3 行'));
  assert.ok(view.nodes().some(n=>n.type==='button'&&n.props['aria-pressed']&&view.text(n)==='模糊'));
  view.key('Enter');assert.ok(view.text(displayed()[0]).includes(rows[0].specialMeaning));assert.ok(view.text(displayed()[0]).includes(rows[1].specialMeaning));
  view.search('完好的，健康的');assert.equal(displayed().length,1,'A sense from the second source row is searchable');
  view.key('3');const saved=JSON.parse(view.snapshot()[key]);assert.equal(saved[rows[0].id],'familiar');assert.equal(saved[rows[1].id],'familiar');assert.equal(saved[entries.at(-1).id],'unknown');
  view.remount();view.flush();view.key('ArrowDown');assert.match(view.text(view.active()),/sound/);view.key('ArrowDown');assert.ok(view.text(view.active()).startsWith(entries[3].word),'Keyboard navigation skips the merged second source row');
 }finally{view.close();}
});
