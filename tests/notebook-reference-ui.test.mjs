import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const original = {
  id: 'batch-reference', source: 'Day 04 · 批注汇总', date: '2026-10-29',
  words: [{ id: 'word-cogent', word: 'cogent', meaning: '手写：有说服力', note: '【全能词】有说服力的\n【A+】证据支持这一结论', origin: 'Day04 · 2.1 · 第1题 B', rating: 'fuzzy' }],
};

const notebookSavedRecords=new WeakMap();

// Mount the real notebook with isolated IO. SharedWordMemory remains a separate
// subtree so a collection reference can never silently replace a shared note.
function notebook({ storage = new Map(), fixture = original, savedCollections = [], failedReads = new Set(), persistResult = {destination:'device',synced:true}, putHook } = {}) {
  const modules = new Map(), calls = [], listeners = new Map(), timers=new Map();let timerId=0;
  if(!notebookSavedRecords.has(storage))notebookSavedRecords.set(storage,new Map([[fixture.id,{batch:structuredClone(fixture),revision:7}],...savedCollections.map(batch=>[batch.id,{batch:structuredClone(batch),revision:5}])]));
  const records=notebookSavedRecords.get(storage);
  let hooks = [], effects = [], cursor = 0, dirty = false, tree;
  const jsx = (type, props) => ({ type, props: props ?? {} });
  // The real memory provider lives above the notebook. Keep its draft outside
  // the conditional child so toggling that child exercises the same boundary.
  const memory = {
    drafts: {},
    edit(word, value) { memory.drafts={...memory.drafts,[word]:{text:value,revision:3}};dirty=true; },
    save: async () => {memory.drafts={};dirty=true;return true;},
  };
  const rowRenders=new Map();
  const react = {
    memo(component){
      const cache=new Map();
      return props=>{
        const id=props.word.id,previous=cache.get(id);
        if(previous&&Object.keys(previous.props).length===Object.keys(props).length&&Object.keys(props).every(key=>Object.is(previous.props[key],props[key])))return previous.tree;
        rowRenders.set(id,(rowRenders.get(id)??0)+1);
        const tree=component(props);cache.set(id,{props,tree});return tree;
      };
    },
    useState(initial) { const i = cursor++; if (!(i in hooks)) hooks[i] = typeof initial === 'function' ? initial() : initial; return [hooks[i], value => { const next = typeof value === 'function' ? value(hooks[i]) : value; if (!Object.is(next, hooks[i])) { hooks[i] = next; dirty = true; } }]; },
    useRef(initial) { const i = cursor++; return hooks[i] ?? (hooks[i] = { current: initial }); },
    useMemo(create, deps) { const i = cursor++, old = hooks[i]; if (!old || deps.some((v, n) => !Object.is(v, old.deps[n]))) hooks[i] = { value: create(), deps }; return hooks[i].value; },
    useEffect(effect, deps) { const i = cursor++, old = hooks[i]; if (!old || !deps || deps.some((v, n) => !Object.is(v, old.deps?.[n]))) { hooks[i] = { deps, cleanup: old?.cleanup }; effects.push(() => { hooks[i].cleanup?.(); hooks[i].cleanup = effect(); }); } },
  };
  const browser = { setTimeout(fn){const id=++timerId;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);}, innerHeight: 900, matchMedia: () => ({ matches: true }), addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name), dispatchEvent() {} };
  async function appFetch(url, options) {
    calls.push({ url, ...options });
    if (url === '/api/mind-map') return { ok: true, json: async () => ({ maps: [], tables: [] }) };
    if (options?.method === 'PUT') {const payload=JSON.parse(options.body),response=putHook?await putHook(payload):{ok:true,json:async()=>({revision:payload.revision+1})};const result=await response.json();if(response.ok)records.set(payload.batch.id,{batch:structuredClone(payload.batch),revision:result.revision});return {...response,json:async()=>result};}
    if (url.startsWith('/api/notebook?id=')) {
      const id = decodeURIComponent(url.slice('/api/notebook?id='.length));
      const saved = records.get(id);
      return { ok: !!saved && !failedReads.has(id), json: async () => saved && !failedReads.has(id) ? saved : { error: '读取失败' } };
    }
    return { ok: true, json: async () => ({ batches: [...records.values()].map(({batch:item,revision}) => ({ id: item.id, source: item.source, date: item.date, count: item.words.length, revision })) }) };
  }
  function load(name) {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === '../community/storage') return { studyStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) } };
    if (name === '../community/api') return { appFetch,getWorkspaceGeneration:()=>1 };
    if (name === '../community/workspacePersistence') return {persistLearningWorkspace:async()=>{calls.push({url:'workspace-persist'});return persistResult;}};
    if (name === '../community/learningPlanStore') return { recordLearningPlanWords() {} };
    if (name === '../community/practiceReviewModel') return { reviewDay: () => '2026-10-29' };
    if (name === '../community/Practice') return { default: props => jsx('section', { 'data-notebook-practice': props }) };
    if (name === './NotebookRecallTools') return {default:props=>jsx('section',{'data-recall-tools':props})};
    if (name === './SharedWordMemory') return { default: props => jsx('aside', { 'data-shared-word': props.word, 'data-editing': !!props.editing, children: props.editing ? jsx('textarea', { 'aria-label': `${props.word} 的记忆方法`, value: memory.drafts[props.word]?.text ?? '共享记忆：把论据串起来', onChange: e => memory.edit(props.word, e.target.value) }) : memory.drafts[props.word]?.text ?? '共享记忆：把论据串起来' }), useWordMemory: () => memory };
    if (['./DictionaryLinks', './DictionaryLookup', './RevealControls', './NotebookFrequency'].includes(name)) return { default: () => null };
    if (name === './notebookCatalog') return { buildNotebookCatalog: () => [] };
    assert.ok(['./VocabularyNotebook', './NotebookWrittenRecall', './notebookAutosave', './notebookModel', './studyWordOrder', './notebookPracticeModel', './notebookFrequencyModel', './notebookRecallModel'].includes(name), `Unexpected import ${name}`);
    if (modules.has(name)) return modules.get(name);
    const exported = {}; modules.set(name, exported);
    const source = fs.readFileSync(new URL(`../app/${name.slice(2)}${['./VocabularyNotebook','./NotebookWrittenRecall'].includes(name) ? '.tsx' : '.ts'}`, import.meta.url), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    new Function('require', 'exports', 'window', 'document', 'requestAnimationFrame', 'cancelAnimationFrame', compiled)(load, exported, browser, { querySelector: () => null }, () => 1, () => {});
    return exported;
  }
  const model = load('./notebookModel');
  if (!storage.has(model.NOTEBOOK_DRAFT_KEY)) storage.set(model.NOTEBOOK_DRAFT_KEY, JSON.stringify({ [fixture.id]: { batch: fixture, revision: 7 } }));
  const savedDraft=storage.get(model.NOTEBOOK_DRAFT_KEY);
  const Component = load('./VocabularyNotebook').default;
  function render() { for (let n = 0; n < 20; n++) { dirty = false; cursor = 0; tree = Component({ words: [], pronounce() {} }); while (effects.length) effects.shift()(); if (!dirty) return; } throw Error('Notebook hook host did not settle'); }
  function nodes(node) { if (!arguments.length) node = tree; if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(n => nodes(n)); if (typeof node.type === 'function') return nodes(node.type(node.props)); return [node, ...nodes(node.props?.children)]; }
  function text(node) { if (node == null || typeof node === 'boolean') return ''; if (Array.isArray(node)) return node.map(text).join(''); return typeof node === 'object' ? text(node.props?.children) : String(node); }
  async function settle() { for (let n = 0; n < 8; n++) { await Promise.resolve(); render(); } }
  function findButton(label) { const button = nodes().find(n => n.type === 'button' && text(n) === label); assert.ok(button, `Missing button ${label}`); return button; }
  function checkbox(label) { const wrapper = nodes().find(n => n.type === 'label' && text(n) === label); const input = wrapper && nodes(wrapper).find(n => n.type === 'input' && n.props.type === 'checkbox'); assert.ok(input, `Missing checkbox ${label}`); return input; }
  render();
  return {
    ready: async () => { await settle(); const history = nodes().find(n => n.type === 'select' && nodes().some(parent => parent.props?.className === 'notebookHistory' && nodes(parent).includes(n))); assert.ok(history); history.props.onChange({ target: { value: fixture.id } }); await settle(); },
    nodes, text, calls, savedDraft, storage, rowRenders,
    recallTools:()=>nodes().find(node=>node.props?.['data-recall-tools'])?.props['data-recall-tools'],
    startRecall(ids){nodes().find(node=>node.props?.['data-recall-tools']).props['data-recall-tools'].onStart(ids);render();},
    updateRecallBatch(batch){nodes().find(node=>node.props?.['data-recall-tools']).props['data-recall-tools'].onUpdate(batch);render();},
    saved:()=>structuredClone(records.get(fixture.id)),
    flushTimers:async()=>{const pending=[...timers.values()];timers.clear();for(const fn of pending)fn();await settle();await settle();},
    draft: () => JSON.parse(storage.get(model.NOTEBOOK_DRAFT_KEY)),
    rawDraft: () => storage.get(model.NOTEBOOK_DRAFT_KEY),
    click: async label => { await findButton(label).props.onClick(); await settle(); },
    clickAria: async label => { const button = nodes().find(n => n.type === 'button' && n.props['aria-label'] === label); assert.ok(button, `Missing button ${label}`); await button.props.onClick(); await settle(); },
    checked: label => checkbox(label).props.checked,
    toggle: async (label, checked) => { checkbox(label).props.onChange({ target: { checked } }); await settle(); },
    selectCollection: async (source, checked = true) => { const wrapper = nodes().find(n => n.type === 'label' && nodes(n).some(child => child.type === 'span' && text(child).startsWith(source))); const input = wrapper && nodes(wrapper).find(n => n.type === 'input' && n.props.type === 'checkbox'); assert.ok(input, `Missing collection ${source}`); input.props.onChange({ target: { checked } }); await settle(); },
    practice: () => nodes().find(n => n.props?.['data-notebook-practice'])?.props['data-notebook-practice'],
    edit(label, value) { const wrapper = nodes().find(n => n.type === 'label' && text(n).startsWith(label) && nodes(n).some(child => child.type === 'textarea')); assert.ok(wrapper, `Missing textarea label ${label}`); nodes(wrapper).find(n => n.type === 'textarea').props.onChange({ target: { value } }); render(); },
    editMemory(value) { const input = nodes().find(n => n.type === 'textarea' && n.props['aria-label'] === `${fixture.words[0].word} 的记忆方法`); assert.ok(input); input.props.onChange({ target: { value } }); render(); },
    editAnswer(number,value) { const input=nodes().find(n=>n.type==='textarea'&&n.props['aria-label']===`${fixture.words[0].word} 第 ${number} 次回忆释义`); assert.ok(input);input.props.onChange({target:{value}});render(); },
    editEntry(value) { const input=nodes().find(n=>n.type==='input'&&n.props['aria-label']==='新一行英文单词');assert.ok(input);input.props.onChange({target:{value}});render(); },
    submitEntry() { const form=nodes().find(n=>n.type==='form'&&n.props.className==='notebookEntryRow');assert.ok(form);form.props.onSubmit({preventDefault(){}});render(); },
    memoryDraft: () => structuredClone(memory.drafts),
    close() { for (const hook of hooks) hook?.cleanup?.(); },
  };
}

test('notebook keeps handwritten meaning, editable collection reference and shared memory separate without writes on render', async () => {
  const view = notebook();
  try {
    await view.ready();
    const area = label => view.nodes().find(n => n.type === 'label' && view.text(n) === label);
    const meaning = area('释义'), reference = area('对照释义与收集笔记');
    assert.ok(meaning); assert.ok(reference); assert.notEqual(meaning, reference);
    assert.equal(view.nodes(meaning).find(n => n.type === 'textarea').props.value, original.words[0].meaning);
    assert.equal(view.nodes(reference).find(n => n.type === 'textarea').props.value, original.words[0].note);
    assert.equal(view.nodes().find(n => n.props?.['data-shared-word'] === 'cogent').props['data-editing'], true);
    assert.equal(view.rawDraft(), view.savedDraft, 'Opening and rendering must not rewrite collection data');
    assert.equal(view.calls.filter(call => call.method === 'PUT').length, 0);
    view.edit('对照释义与收集笔记', '【BB六选二】新增对照笔记');
    const word = view.draft()[original.id].batch.words[0];
    assert.deepEqual(word, { ...original.words[0], note: '【BB六选二】新增对照笔记' });
    await view.click('立即保存');
    const writes = view.calls.filter(call => call.method === 'PUT');
    assert.equal(writes.length, 1);
    assert.deepEqual(JSON.parse(writes[0].body), { batch: { ...original, words: [word] }, revision: 7 });
  } finally { view.close(); }
});

test('notebook review masks collection and shared notes until reveal and hides both again', async () => {
  const view = notebook();
  try {
    await view.ready(); await view.click('遮挡复习');
    const visible = () => view.text({ props: { children: view.nodes().filter(n => typeof n.type !== 'function').map(n => n.props?.children) } });
    assert.ok(!visible().includes(original.words[0].meaning));
    assert.ok(!visible().includes(original.words[0].note));
    assert.ok(!view.nodes().some(n => n.props?.['data-shared-word'] === 'cogent'));
    assert.ok(!view.nodes().some(n => n.type === 'textarea' && n.props.value === original.words[0].note), 'Masked note must be unmounted, not merely visually hidden');
    await view.click('点击揭晓释义与笔记');
    const reference = view.nodes().find(n => n.type === 'section' && n.props.className === 'notebookCollectionNote');
    assert.ok(reference); assert.ok(view.text(reference).includes(original.words[0].note));
    assert.ok(view.nodes().some(n => n.props?.['data-shared-word'] === 'cogent' && !n.props['data-editing']));
    const reveal = view.nodes().find(n => n.type === 'button' && n.props.className === 'notebookReveal');
    assert.equal(reveal.props['aria-expanded'], true);
    await view.click(original.words[0].meaning);
    assert.ok(!view.nodes().some(n => n.props?.className === 'notebookCollectionNote'));
    assert.ok(!view.nodes().some(n => n.props?.['data-shared-word'] === 'cogent'));
    assert.equal(view.rawDraft(), view.savedDraft, 'Review controls must not change existing data or ratings');
    assert.equal(view.calls.filter(call => call.method === 'PUT').length, 0);
  } finally { view.close(); }
});

for (const mode of ['edit', 'review']) {
  test(`notebook independently hides reference and memory in ${mode} without changing learning data`, async () => {
    const view = notebook();
    try {
      await view.ready();
      if (mode === 'review') { await view.click('遮挡复习'); await view.click('点击揭晓释义与笔记'); }
      const reference = () => view.nodes().some(n => (n.type === 'textarea' && n.props.value === original.words[0].note) || n.props?.className === 'notebookCollectionNote');
      const memory = () => view.nodes().some(n => n.props?.['data-shared-word'] === original.words[0].word);
      const collapsed = () => view.nodes().some(n => n.type === 'section' && n.props.className?.split(' ').includes('notebookNotesHidden'));
      assert.equal(view.checked('显示对照释义'), true);
      assert.equal(view.checked('显示记忆笔记'), true);
      assert.ok(reference()); assert.ok(memory());

      await view.toggle('显示对照释义', false);
      assert.ok(!reference(), 'Reference content must be removed from the rendered tree');
      assert.ok(memory(), 'The memory column remains available independently');
      assert.ok(!collapsed());
      await view.toggle('显示对照释义', true);
      await view.toggle('显示记忆笔记', false);
      assert.ok(reference(), 'The collection reference remains available independently');
      assert.ok(!memory(), 'Shared memory must be removed from the rendered tree');

      await view.toggle('显示对照释义', false);
      assert.ok(!reference()); assert.ok(!memory()); assert.ok(collapsed());
      assert.ok(!view.nodes().some(n => n.props?.className === 'notebookCardNote'), 'Both hidden must remove the empty note column');
      await view.toggle('显示记忆笔记', true);
      await view.toggle('显示对照释义', true);
      assert.ok(reference()); assert.ok(memory()); assert.ok(!collapsed());
      assert.equal(view.rawDraft(), view.savedDraft, 'Display preferences must not change the batch, meanings, or ratings');
      assert.deepEqual(view.memoryDraft(), {}, 'Display preferences must not create or delete shared notes');
      assert.equal(view.calls.filter(call => call.method === 'PUT').length, 0);
    } finally { view.close(); }
  });
}

test('notebook keeps unsaved reference and shared memory drafts when hidden and shown again', async () => {
  const view = notebook();
  try {
    await view.ready();
    const reference = '【GLEE】我补充的对照释义';
    const memory = '我还没保存的联想记忆';
    view.edit('对照释义与收集笔记', reference);
    view.editMemory(memory);
    const before = view.rawDraft(), sharedBefore = view.memoryDraft();
    await view.toggle('显示对照释义', false);
    await view.toggle('显示记忆笔记', false);
    await view.click('遮挡复习');
    await view.click('点击揭晓释义与笔记');
    assert.ok(!view.nodes().some(n => n.props?.className === 'notebookCardNote'));
    await view.toggle('显示对照释义', true);
    await view.toggle('显示记忆笔记', true);
    assert.ok(view.nodes().some(n => n.props?.className === 'notebookCollectionNote' && view.text(n).includes(reference)));
    assert.ok(view.nodes().some(n => n.props?.['data-shared-word'] === 'cogent' && view.text(n) === memory));
    await view.click('收集与编辑');
    assert.ok(view.nodes().some(n => n.type === 'textarea' && n.props.value === reference));
    assert.ok(view.nodes().some(n => n.type === 'textarea' && n.props['aria-label'] === 'cogent 的记忆方法' && n.props.value === memory));
    assert.equal(view.rawDraft(), before);
    assert.deepEqual(view.memoryDraft(), sharedBefore);
    assert.deepEqual(view.draft()[original.id].batch.words[0], { ...original.words[0], note: reference });
    assert.equal(view.calls.filter(call => call.method === 'PUT').length, 0);
  } finally { view.close(); }
});

test('notebook remembers display choices across reopening without embedding them in learning data', async () => {
  const storage = new Map();
  const first = notebook({ storage });
  try {
    await first.ready();
    await first.toggle('显示对照释义', false);
    assert.deepEqual(JSON.parse(storage.get('gre-notebook-display-v1')), { showBriefMeaning: true, showReference: false, showMemory: true });
    assert.equal(first.rawDraft(), first.savedDraft);
  } finally { first.close(); }
  const reopened = notebook({ storage });
  try {
    await reopened.ready();
    assert.equal(reopened.checked('显示对照释义'), false);
    assert.equal(reopened.checked('显示记忆笔记'), true);
    assert.ok(!reopened.nodes().some(n => n.type === 'textarea' && n.props.value === original.words[0].note));
    assert.ok(reopened.nodes().some(n => n.props?.['data-shared-word'] === 'cogent'));
    assert.deepEqual(reopened.saved().batch, original, 'Autosave may commit the draft while the first editor closes, without changing its contents');
    assert.equal(reopened.calls.filter(call => call.method === 'PUT').length, 0);
  } finally { reopened.close(); }
});

test('notebook handles absent, malformed, and partial display preferences safely', async () => {
  for (const [saved, expected] of [[undefined, [true, true]], ['{broken', [true, true]], ['null', [true, true]], [JSON.stringify({ showReference: false }), [false, true]], [JSON.stringify({ showMemory: false }), [true, false]]]) {
    const storage = new Map();
    if (saved !== undefined) storage.set('gre-notebook-display-v1', saved);
    const view = notebook({ storage });
    try {
      await view.ready();
      assert.deepEqual([view.checked('显示对照释义'), view.checked('显示记忆笔记')], expected, `Unexpected fallback for ${saved}`);
      assert.equal(view.rawDraft(), view.savedDraft);
      assert.equal(view.calls.filter(call => call.method === 'PUT').length, 0);
    } finally { view.close(); }
  }
});

const sortingFixture = {
  ...original,
  words: ['zeta', 'lucid', 'abate', 'cogent'].map((word, index) => ({
    id: `sorting-${word}`, word, meaning: `我的释义 ${index}`, note: `对照笔记 ${index}`,
    origin: `List 04 · 第 ${index + 1} 词`, rating: ['unknown', 'fuzzy', 'familiar', 'fuzzy'][index],
  })),
};
function displayedNotebookWords(view) {
  return view.nodes().filter(node => node.type === 'article' && node.props.className?.split(' ').includes('notebookWord')).map(row => {
    const heading = view.nodes(row).find(node => node.props?.className === 'notebookCardTitle');
    return heading.type === 'input' ? heading.props.value : view.text(heading);
  });
}
function selectedNotebookOrder(view) {
  const controls = view.nodes().find(node => node.props?.['aria-label'] === '生词本显示顺序');
  return view.nodes(controls).filter(node => node.type === 'button' && node.props['aria-pressed']).map(view.text);
}

test('notebook A–Z is a display choice in edit and review and never rewrites collection order or learning data', async () => {
  const view = notebook({ fixture: sortingFixture });
  try {
    await view.ready();
    const originalWords = sortingFixture.words.map(word => word.word);
    assert.deepEqual(displayedNotebookWords(view), originalWords);
    await view.click('A–Z 字母排序');
    assert.deepEqual(selectedNotebookOrder(view), ['A–Z 字母排序']);
    assert.deepEqual(displayedNotebookWords(view), ['abate', 'cogent', 'lucid', 'zeta']);
    assert.equal(view.rawDraft(), view.savedDraft);
    assert.deepEqual(view.draft()[sortingFixture.id], { batch: sortingFixture, revision: 7 });
    await view.click('遮挡复习');
    assert.deepEqual(displayedNotebookWords(view), ['abate', 'cogent', 'lucid', 'zeta']);
    assert.deepEqual(selectedNotebookOrder(view), ['A–Z 字母排序']);
    await view.click('原顺序');
    assert.deepEqual(displayedNotebookWords(view), originalWords);
    assert.deepEqual(selectedNotebookOrder(view), ['原顺序']);
    assert.equal(view.rawDraft(), view.savedDraft, 'View controls must not alter word order, meaning, note, origin or rating');
    assert.equal(view.calls.filter(call => call.method === 'PUT').length, 0);
    assert.deepEqual(view.memoryDraft(), {});
  } finally { view.close(); }
});

test('removing and undoing a notebook word while sorted restores its original collection position', async () => {
  const view = notebook({ fixture: sortingFixture });
  try {
    await view.ready(); await view.click('A–Z 字母排序');
    await view.clickAria('移除 abate');
    assert.deepEqual(displayedNotebookWords(view), ['cogent', 'lucid', 'zeta']);
    assert.deepEqual(view.draft()[sortingFixture.id].batch.words, sortingFixture.words.filter(word => word.word !== 'abate'));
    await view.click('撤销移除 abate');
    assert.deepEqual(displayedNotebookWords(view), ['abate', 'cogent', 'lucid', 'zeta']);
    assert.deepEqual(view.draft()[sortingFixture.id].batch, sortingFixture);
    await view.click('原顺序');
    assert.deepEqual(displayedNotebookWords(view), ['zeta', 'lucid', 'abate', 'cogent']);
    assert.deepEqual(view.draft()[sortingFixture.id].batch.words[2], sortingFixture.words[2], 'Undo must use the original data index, not the sorted display index');
    assert.equal(view.calls.filter(call => call.method === 'PUT').length, 0);
  } finally { view.close(); }
});

const practiceCollection = (id, source, words) => ({
  id, source, date: '2026-11-02',
  words: words.map((word, index) => ({ id: `${id}-word-${index}`, word, meaning: `${source} 的 ${word} 释义`, note: `${source} 的笔记`, origin: `第 ${index + 1} 题` })),
});

test('notebook tests only selected saved collections and the current unsaved draft without saving or changing either', async () => {
  const saved = practiceCollection('saved-practice', '已保存课堂收集', ['lucid']);
  const ignored = practiceCollection('ignored-practice', '未选择的收集', ['exclude-me']);
  const view = notebook({ savedCollections: [saved, ignored] });
  try {
    await view.ready();
    view.edit('释义', '我的尚未保存的新释义');
    const beforeDraft = view.rawDraft(), beforeSaved = structuredClone(saved);
    await view.selectCollection(original.source);
    await view.selectCollection(saved.source);
    await view.selectCollection(ignored.source);
    await view.selectCollection(ignored.source, false);
    await view.click('测试所选 2 次收集');
    const props = view.practice(); assert.ok(props, 'Selected collections should open the actual Practice integration boundary');
    assert.equal(props.deck, 'notebook');
    assert.deepEqual(props.notebook.terms.map(term => term.word), ['cogent', 'lucid']);
    assert.equal(props.notebook.terms[0].meaning, '我的尚未保存的新释义');
    assert.equal(props.notebook.collections, 2);
    assert.ok(!props.notebook.source.includes(ignored.source));
    assert.deepEqual(view.calls.filter(call => call.url.startsWith('/api/notebook?id=')).map(call => call.url), ['/api/notebook?id=saved-practice']);
    assert.equal(view.rawDraft(), beforeDraft, 'Opening a combined test must not save, remove or replace the current draft');
    assert.deepEqual(saved, beforeSaved);
    assert.equal(view.calls.filter(call => call.method === 'PUT').length, 0);
    props.onClose();
  } finally { view.close(); }
});

test('notebook can combine an unopened local draft with a saved collection without implicitly adding the open collection', async () => {
  const local = practiceCollection('unopened-draft', '尚未打开的草稿', ['lucid']);
  local.words[0].meaning = '草稿中清楚的释义';
  const saved = practiceCollection('saved-second', '另一份已保存收集', ['abate']);
  const rawDraft = JSON.stringify({ [original.id]: { batch: original, revision: 7 }, [local.id]: { batch: local, revision: 0 } });
  const storage = new Map([['gre-vocabulary-notebook-drafts-v1', rawDraft]]);
  const view = notebook({ storage, savedCollections: [saved] });
  try {
    await view.ready();
    await view.selectCollection(local.source);
    await view.selectCollection(saved.source);
    await view.click('测试所选 2 次收集');
    const props = view.practice(); assert.ok(props);
    assert.deepEqual(props.notebook.terms.map(term => term.word).sort(), ['abate', 'lucid']);
    assert.equal(props.notebook.terms.find(term => term.word === 'lucid').meaning, '草稿中清楚的释义');
    assert.ok(!props.notebook.terms.some(term => term.word === 'cogent'), 'The currently open collection is not automatically part of a different selection');
    assert.equal(view.rawDraft(), rawDraft);
    assert.ok(!view.calls.some(call => call.url.includes('id=unopened-draft')), 'Local drafts must not be replaced with older saved copies');
    assert.equal(view.calls.filter(call => call.method === 'PUT').length, 0);
  } finally { view.close(); }
});

test('one failed collection read prevents a partial notebook test and leaves every local draft intact', async () => {
  const missing = practiceCollection('cannot-read', '读取失败的收集', ['lucid']);
  const view = notebook({ savedCollections: [missing], failedReads: new Set([missing.id]) });
  try {
    await view.ready();
    view.edit('释义', '必须保留的未保存批注');
    const beforeDraft = view.rawDraft();
    await view.selectCollection(original.source);
    await view.selectCollection(missing.source);
    await view.click('测试所选 2 次收集');
    assert.equal(view.practice(), undefined, 'A failed selected collection must not silently launch a smaller test');
    assert.ok(view.nodes().some(node => node.props?.role === 'status' && view.text(node).includes('部分收集未能读取')));
    assert.equal(view.rawDraft(), beforeDraft);
    assert.deepEqual(view.memoryDraft(), {});
    assert.equal(view.calls.filter(call => call.method === 'PUT').length, 0);
  } finally { view.close(); }
});

test('written recall retains separate attempts, manual judgements and the original meanings across save and reopen',async()=>{
 const storage=new Map(),view=notebook({storage});
 try{
  await view.ready();
  assert.ok(!view.nodes().some(n=>n.props?.className==='notebookRecallComparison'));
  view.editAnswer(1,'我想是有说服力的');
  await view.click('核对释义');
  assert.ok(view.nodes().some(n=>n.props?.className==='notebookRecallComparison'&&view.text(n).includes(original.words[0].meaning)));
  await view.click('正确');
  const first=view.draft()[original.id].batch.words[0];
  assert.equal(first.recalls[0].answer,'我想是有说服力的');assert.equal(first.recalls[0].result,'correct');
  assert.equal(first.meaning,original.words[0].meaning);assert.equal(first.note,original.words[0].note);assert.equal(first.rating,'fuzzy');
  await view.click('再写一次');view.editAnswer(2,'有条理的？');await view.click('核对释义');await view.click('错误');
  assert.ok(view.text(view.nodes().find(n=>n.props?.className==='notebookRecallHistory')).includes('我想是有说服力的'));
  const before=structuredClone(view.draft()[original.id].batch);
  await view.click('立即保存');
  const write=view.calls.filter(call=>call.method==='PUT').at(-1);assert.deepEqual(JSON.parse(write.body).batch,before);
  const reopened=notebook({storage:new Map(),fixture:before});
  try{await reopened.ready();assert.equal(reopened.nodes().find(n=>n.type==='textarea'&&n.props['aria-label']==='cogent 第 2 次回忆释义').props.value,'有条理的？');assert.ok(reopened.nodes().some(n=>n.type==='button'&&reopened.text(n)==='错误'&&n.props['aria-pressed']));}
  finally{reopened.close();}
 }finally{view.close();}
});

test('rewriting an answer resets its previous judgement; hide and sort controls retain the draft without counting a new collection',async()=>{
 const view=notebook();
 try{
  await view.ready();view.editAnswer(1,'手写释义');await view.click('核对释义');await view.click('模糊');
  view.editAnswer(1,'改写后的释义');
  const word=view.draft()[original.id].batch.words[0];
  assert.equal(word.recalls[0].checked,false);assert.equal(word.recalls[0].result,undefined);
  assert.ok(!view.nodes().some(n=>n.props?.className==='notebookRecallComparison'));
  const raw=view.rawDraft();await view.click('A–Z 字母排序');await view.click('遮挡复习');await view.click('收集与编辑');
  assert.equal(view.rawDraft(),raw);assert.equal(Object.keys(view.draft()).length,1);
  assert.equal(view.draft()[original.id].batch.words.length,1);
  assert.deepEqual(view.memoryDraft(),{});
 }finally{view.close();}
});

test('the final entry row survives reopening before it is added, then counts exactly once with an optional blank definition',async()=>{
 const storage=new Map(),view=notebook({storage});
 try{
  await view.ready();view.editEntry('lucid');
  assert.deepEqual(view.draft()[original.id].batch.entryDraft,{word:'lucid',meaning:''});
  assert.equal(view.draft()[original.id].batch.words.length,1);
 }finally{view.close();}
 const reopened=notebook({storage});
 try{
  await reopened.ready();assert.equal(reopened.nodes().find(n=>n.type==='input'&&n.props['aria-label']==='新一行英文单词').props.value,'lucid');
  reopened.submitEntry();
  const batch=reopened.draft()[original.id].batch;
  assert.equal(batch.words.length,2);assert.equal(batch.words[1].word,'lucid');assert.equal(batch.words[1].meaning,'');assert.equal(batch.entryDraft,undefined);
  assert.deepEqual(batch.words[0],original.words[0]);
 }finally{reopened.close();}
});

test('notebook automatically saves editing, typed recall, assessments and the final pending line without a manual save',async()=>{
 const view=notebook();
 try{
  await view.ready();view.edit('释义','我的新版释义');view.editAnswer(1,'先回忆的答案');await view.click('核对释义');await view.click('正确');view.editEntry('lucid');view.editMemory('自动保存的共享笔记');
  const before=view.draft()[original.id].batch;
  assert.equal(view.calls.filter(call=>call.method==='PUT').length,0);
  await view.flushTimers();
  assert.equal(view.calls.filter(call=>call.method==='PUT').length,1);assert.deepEqual(view.saved().batch,before);assert.deepEqual(view.draft(),{});assert.deepEqual(view.memoryDraft(),{});
  assert.ok(view.nodes().some(n=>n.props?.role==='status'&&view.text(n).includes('已自动保存到这台设备')));
  assert.ok(view.calls.some(call=>call.url==='workspace-persist'));
 }finally{view.close();}
});

test('background autosave keeps inputs enabled and includes a newer answer typed before the first write completes',async()=>{
 let release;const held=new Promise(resolve=>{release=resolve;});let writes=0;
 const view=notebook({putHook:async payload=>{if(++writes===1)await held;return {ok:true,json:async()=>({revision:payload.revision+1})};}});
 try{
  await view.ready();view.editAnswer(1,'第一版');await view.flushTimers();
  assert.ok(view.nodes().some(n=>n.type==='fieldset'&&n.props.disabled===false&&view.nodes(n).some(child=>child.props?.className==='notebookEntryRow')));
  view.editAnswer(1,'保存时继续写的第二版');release();await view.flushTimers();await view.flushTimers();
  assert.equal(view.saved().batch.words[0].recalls[0].answer,'保存时继续写的第二版');assert.equal(view.saved().revision,9);assert.deepEqual(view.draft(),{});
 }finally{view.close();}
});

test('a pending account upload is shown as pending, and retry confirms account saving without another collection write',async()=>{
 const result={destination:'account',synced:false,message:'本机已保存，账号同步待完成'},view=notebook({persistResult:result});
 try{
  await view.ready();view.editAnswer(1,'离线时写的释义');await view.flushTimers();
  assert.equal(view.saved().batch.words[0].recalls[0].answer,'离线时写的释义');
  assert.ok(view.nodes().some(n=>n.props?.role==='status'&&view.text(n).includes('账号同步待完成')));
  assert.ok(!view.nodes().some(n=>n.props?.role==='status'&&view.text(n).includes('已自动保存到账号')));
  const writes=view.calls.filter(call=>call.method==='PUT').length;result.synced=true;await view.click('重试保存');
  assert.equal(view.calls.filter(call=>call.method==='PUT').length,writes);assert.ok(view.nodes().some(n=>n.props?.role==='status'&&view.text(n).includes('已自动保存到账号')));
 }finally{view.close();}
});

test('brief meanings can be edited, hidden and reopened with autosave while complete annotations stay unchanged',async()=>{
 const storage=new Map(),view=notebook({storage});
 try{
  await view.ready();
  assert.equal(view.checked('显示简短释义'),true);
  const cue=()=>view.nodes().find(n=>n.type==='textarea'&&n.props['aria-label']==='cogent 简短释义');
  assert.equal(cue().props.value,'有说服力');
  view.edit('简短释义','论据有力');await view.flushTimers();
  assert.deepEqual(view.saved().batch.words[0],{...original.words[0],briefMeaning:'论据有力'});
  const before=view.rawDraft();await view.toggle('显示简短释义',false);
  assert.equal(cue(),undefined);assert.equal(view.rawDraft(),before);
  assert.ok(view.nodes().some(n=>n.type==='textarea'&&n.props.value===original.words[0].meaning));
  await view.toggle('显示简短释义',true);assert.equal(cue().props.value,'论据有力');
  await view.click('遮挡复习');assert.ok(!view.nodes().some(n=>n.props?.className==='notebookBriefPreview'));
  await view.click('点击揭晓释义与笔记');assert.ok(view.nodes().some(n=>n.props?.className==='notebookBriefPreview'&&view.text(n).includes('论据有力')));
  await view.toggle('显示简短释义',false);assert.ok(!view.nodes().some(n=>n.props?.className==='notebookBriefPreview'));
 }finally{view.close();}
 const reopened=notebook({storage});try{
  await reopened.ready();assert.equal(reopened.checked('显示简短释义'),false);
  await reopened.toggle('显示简短释义',true);
  assert.equal(reopened.nodes().find(n=>n.type==='textarea'&&n.props['aria-label']==='cogent 简短释义').props.value,'论据有力');
  assert.equal(reopened.saved().batch.words[0].meaning,original.words[0].meaning);
 }finally{reopened.close();}
});

test('whole-page recall reveals forgotten words immediately, keeps manual grading after unified check and saves mastery separately',async()=>{
 const fixture={...original,words:[original.words[0],{id:'word-lucid',word:'lucid',meaning:'清楚易懂的',note:'透亮的联想',origin:'Day8第2题'},{id:'word-blank',word:'blank',meaning:'空白的',note:'没有回忆答案的词',origin:'Day8第3题'}]};
 const storage=new Map(),view=notebook({storage,fixture});
 try{
  await view.ready();await view.click('整页回忆');
  const references=()=>view.nodes().filter(n=>n.props?.className==='notebookWholeReference');
  assert.equal(references().length,3);
  for(const word of fixture.words)assert.ok(!references().some(n=>view.text(n).includes(word.meaning)));
  assert.ok(!view.nodes().some(n=>n.props?.['data-shared-word']));
  assert.ok(!view.nodes().some(n=>n.type==='textarea'&&fixture.words.some(w=>n.props.value===w.meaning||n.props.value===w.note)));
  assert.ok(!view.nodes().some(n=>n.type==='button'&&view.text(n)==='核对释义'));
  view.editAnswer(1,'令人信服的');await view.clickAria('lucid 不记得');
  assert.ok(view.nodes().some(n=>n.props?.['aria-label']==='lucid 不记得'&&n.props['aria-pressed']));
  assert.ok(references().some(n=>view.text(n).includes('清楚易懂的')));
  assert.ok(!references().some(n=>view.text(n).includes(fixture.words[0].meaning)),'Other meanings stay hidden while this word is forgotten');
  assert.equal(view.draft()[fixture.id].batch.words[1].recalls[0].result,'incorrect');
  assert.equal(view.draft()[fixture.id].batch.words[1].rating,undefined,'Forgotten is a recall choice, not an automatic red rating');
  assert.ok(view.text(view.nodes().find(n=>n.props?.['aria-label']==='页尾整页回忆操作')).includes('已回忆 2 / 3'));
  await view.click('统一核对释义');
  for(const word of fixture.words)assert.ok(references().some(n=>view.text(n).includes(word.meaning)),'All rows reveal, including a blank answer');
  assert.equal(view.nodes().filter(n=>n.props?.className==='notebookRecallResults').length,2);
  const saved=view.draft()[fixture.id].batch;
  assert.equal(saved.recallPhase,'checking');assert.equal(saved.words[0].recalls[0].checked,true);
  assert.deepEqual(saved.words[1].recalls.map(({answer,checked,forgotten})=>({answer,checked,forgotten})),[{answer:'',checked:true,forgotten:true}]);
  assert.equal(saved.words[2].recalls,undefined,'A missing answer must not be fabricated');
  const group=view.nodes().find(n=>n.props?.['aria-label']==='lucid 掌握程度');
  view.nodes(group).find(n=>n.type==='button'&&view.text(n)==='不认识').props.onClick();
  await view.flushTimers();
  assert.equal(view.saved().batch.words[1].rating,'unknown');
  assert.equal(view.saved().batch.words[0].rating,'fuzzy');
  await view.click('隐藏释义，继续回忆');assert.ok(references().every(n=>view.text(n)==='参考释义待统一核对'));
  assert.equal(view.draft()[fixture.id].batch.words[0].recalls[0].answer,'令人信服的');
  await view.click('统一核对释义');await view.flushTimers();
  for(let i=0;i<fixture.words.length;i++)assert.equal(view.saved().batch.words[i].meaning,fixture.words[i].meaning);
 }finally{view.close();}
 const reopened=notebook({storage,fixture});try{
  await reopened.ready();assert.ok(reopened.nodes().some(n=>n.props?.className==='notebookWholeReference'&&reopened.text(n).includes('清楚易懂的')));
  assert.ok(reopened.nodes().some(n=>n.props?.['aria-label']==='lucid 不记得'&&n.props['aria-pressed']));
  assert.equal(reopened.saved().batch.recallPhase,'checking');
 }finally{reopened.close();}
});

test('forgotten choice can be toggled or replaced with a written answer without losing previous text or changing mastery',async()=>{
 const view=notebook();try{
  await view.ready();view.editAnswer(1,'我原先写的内容');await view.clickAria('cogent 不记得');
  let word=view.draft()[original.id].batch.words[0];assert.equal(word.recalls[0].forgotten,true);assert.equal(word.recalls[0].answer,'我原先写的内容');assert.equal(word.rating,'fuzzy');
  await view.clickAria('cogent 不记得');assert.equal(view.draft()[original.id].batch.words[0].recalls[0].forgotten,undefined);
  await view.clickAria('cogent 不记得');view.editAnswer(1,'后来想起来了');
  word=view.draft()[original.id].batch.words[0];assert.equal(word.recalls[0].forgotten,undefined);assert.equal(word.recalls[0].answer,'后来想起来了');assert.equal(word.rating,'fuzzy');
 }finally{view.close();}
});


test('editing one written answer in a large collection leaves every other word row untouched',async()=>{
 const fixture=structuredClone(original);
 fixture.words=Array.from({length:200},(_,index)=>({...structuredClone(original.words[0]),id:'perf-'+index,word:index?'word-'+index:original.words[0].word,recalls:[]}));
 const view=notebook({fixture});
 try{
  await view.ready();view.nodes();const before=new Map(view.rowRenders);
  for(let i=0;i<10;i++){view.editAnswer(1,'回忆 '+i);view.nodes();}
  assert.equal(view.rowRenders.get('perf-0')-before.get('perf-0'),10);
  for(let index=1;index<200;index++)assert.equal(view.rowRenders.get('perf-'+index),before.get('perf-'+index));
  assert.equal(view.draft()[fixture.id].batch.words[0].recalls[0].answer,'回忆 9');
  await view.flushTimers();assert.equal(view.saved().batch.words[0].recalls[0].answer,'回忆 9');
 }finally{view.close();}
});

test('forgotten reveals an answer and counts one error; correcting the judgement updates the same attempt and keeps the written answer',async()=>{
 const view=notebook();try{
  await view.ready();await view.click('整页回忆');view.editAnswer(1,'我的原答案');await view.clickAria('cogent 不记得');
  let current=view.draft()[original.id].batch.words[0];assert.equal(current.recalls[0].result,'incorrect');assert.equal(current.recalls[0].checked,true);
  assert.ok(view.nodes().some(node=>node.props?.className==='notebookWholeReference'&&view.text(node).includes(original.words[0].meaning)));
  assert.ok(view.nodes().some(node=>node.props?.className==='notebookRecallStats'&&view.text(node).includes('错误 1 次')));
  await view.click('正确');current=view.draft()[original.id].batch.words[0];assert.equal(current.recalls[0].result,'correct');assert.equal(current.recalls[0].forgotten,undefined);assert.equal(current.recalls[0].answer,'我的原答案');
  assert.ok(view.nodes().some(node=>node.props?.className==='notebookRecallStats'&&view.text(node).includes('过关 1 次 · 错误 0 次')));
  assert.ok(view.nodes().some(node=>node.props?.className?.includes('notebookJudged-correct')));
  await view.click('错误');await view.click('错误');
  assert.ok(view.nodes().some(node=>node.props?.className==='notebookRecallStats'&&view.text(node).includes('过关 0 次 · 错误 1 次')));
  await view.flushTimers();assert.equal(view.saved().batch.words[0].recalls[0].result,'incorrect');assert.equal(view.saved().batch.words[0].rating,original.words[0].rating);
 }finally{view.close();}
});

test('a selected wrong-word round and its reminder autosave and reopen without resetting other words or old answers',async()=>{
 const fixture={...original,words:[{...original.words[0],recalls:[{id:'correct-old',answer:'旧答案一',checked:true,result:'correct'}]},{id:'lucid-row',word:'lucid',meaning:'清晰的',note:'旧笔记',origin:'来源',recalls:[{id:'wrong-old',answer:'旧答案二',checked:true,result:'incorrect'}]}]};
 const storage=new Map(),view=notebook({storage,fixture});let saved;
 try{
  await view.ready();view.startRecall(['lucid-row']);
  let draft=view.draft()[fixture.id].batch;assert.deepEqual(draft.recallRound.wordIds,['lucid-row']);assert.deepEqual(draft.words[0],fixture.words[0]);assert.deepEqual(draft.words[1].recalls[0],fixture.words[1].recalls[0]);
  assert.ok(!view.nodes().some(node=>node.type==='textarea'&&node.props['aria-label']?.startsWith('cogent 第')));
  await view.clickAria('lucid 不记得');
  draft=view.draft()[fixture.id].batch;view.updateRecallBatch({...draft,recallReminder:{id:'reminder-one',at:'2026-12-01T01:00:00Z',wordIds:['lucid-row'],label:'重点攻克'}});
  await view.flushTimers();saved=view.saved().batch;assert.equal(saved.words[1].recalls.length,2);assert.equal(saved.words[1].recalls.at(-1).result,'incorrect');assert.deepEqual(saved.words[0],fixture.words[0]);
 }finally{view.close();}
 const reopened=notebook({storage,fixture});try{
  await reopened.ready();assert.deepEqual(reopened.recallTools().batch,saved);assert.equal(reopened.nodes().filter(node=>node.type==='article').length,1);
  assert.ok(reopened.nodes().some(node=>node.props?.className==='notebookRecallStats'&&reopened.text(node).includes('连续错 2 次')));
 }finally{reopened.close();}
});
