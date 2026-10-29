import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const original = {
  id: 'batch-reference', source: 'Day 04 · 批注汇总', date: '2026-10-29',
  words: [{ id: 'word-cogent', word: 'cogent', meaning: '手写：有说服力', note: '【全能词】有说服力的\n【A+】证据支持这一结论', origin: 'Day04 · 2.1 · 第1题 B', rating: 'fuzzy' }],
};

// Mount the real notebook with isolated IO. SharedWordMemory remains a separate
// subtree so a collection reference can never silently replace a shared note.
function notebook({ storage = new Map() } = {}) {
  const modules = new Map(), calls = [], listeners = new Map();
  let hooks = [], effects = [], cursor = 0, dirty = false, tree;
  const jsx = (type, props) => ({ type, props: props ?? {} });
  // The real memory provider lives above the notebook. Keep its draft outside
  // the conditional child so toggling that child exercises the same boundary.
  const memory = {
    drafts: {},
    edit(word, value) { memory.drafts[word] = { text: value, revision: 3 }; dirty = true; },
    save: async () => true,
  };
  const react = {
    useState(initial) { const i = cursor++; if (!(i in hooks)) hooks[i] = typeof initial === 'function' ? initial() : initial; return [hooks[i], value => { const next = typeof value === 'function' ? value(hooks[i]) : value; if (!Object.is(next, hooks[i])) { hooks[i] = next; dirty = true; } }]; },
    useRef(initial) { const i = cursor++; return hooks[i] ?? (hooks[i] = { current: initial }); },
    useMemo(create, deps) { const i = cursor++, old = hooks[i]; if (!old || deps.some((v, n) => !Object.is(v, old.deps[n]))) hooks[i] = { value: create(), deps }; return hooks[i].value; },
    useEffect(effect, deps) { const i = cursor++, old = hooks[i]; if (!old || !deps || deps.some((v, n) => !Object.is(v, old.deps?.[n]))) { hooks[i] = { deps, cleanup: old?.cleanup }; effects.push(() => { hooks[i].cleanup?.(); hooks[i].cleanup = effect(); }); } },
  };
  const browser = { innerHeight: 900, matchMedia: () => ({ matches: true }), addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name), dispatchEvent() {} };
  async function appFetch(url, options) {
    calls.push({ url, ...options });
    if (url === '/api/mind-map') return { ok: true, json: async () => ({ maps: [], tables: [] }) };
    if (options?.method === 'PUT') return { ok: true, json: async () => ({ revision: 8 }) };
    return { ok: true, json: async () => ({ batches: [] }) };
  }
  function load(name) {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === '../community/storage') return { studyStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) } };
    if (name === '../community/api') return { appFetch };
    if (name === '../community/learningPlanStore') return { recordLearningPlanWords() {} };
    if (name === '../community/practiceReviewModel') return { reviewDay: () => '2026-10-29' };
    if (name === './SharedWordMemory') return { default: props => jsx('aside', { 'data-shared-word': props.word, 'data-editing': !!props.editing, children: props.editing ? jsx('textarea', { 'aria-label': `${props.word} 的记忆方法`, value: memory.drafts[props.word]?.text ?? '共享记忆：把论据串起来', onChange: e => memory.edit(props.word, e.target.value) }) : memory.drafts[props.word]?.text ?? '共享记忆：把论据串起来' }), useWordMemory: () => memory };
    if (['./DictionaryLinks', './DictionaryLookup', './RevealControls'].includes(name)) return { default: () => null };
    if (name === './notebookCatalog') return { buildNotebookCatalog: () => [] };
    assert.ok(['./VocabularyNotebook', './notebookModel'].includes(name), `Unexpected import ${name}`);
    if (modules.has(name)) return modules.get(name);
    const exported = {}; modules.set(name, exported);
    const source = fs.readFileSync(new URL(`../app/${name.slice(2)}${name === './VocabularyNotebook' ? '.tsx' : '.ts'}`, import.meta.url), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    new Function('require', 'exports', 'window', 'document', 'requestAnimationFrame', 'cancelAnimationFrame', compiled)(load, exported, browser, { querySelector: () => null }, () => 1, () => {});
    return exported;
  }
  const model = load('./notebookModel');
  const savedDraft = JSON.stringify({ [original.id]: { batch: original, revision: 7 } });
  if (!storage.has(model.NOTEBOOK_DRAFT_KEY)) storage.set(model.NOTEBOOK_DRAFT_KEY, savedDraft);
  const Component = load('./VocabularyNotebook').default;
  function render() { for (let n = 0; n < 20; n++) { dirty = false; cursor = 0; tree = Component({ words: [], pronounce() {} }); while (effects.length) effects.shift()(); if (!dirty) return; } throw Error('Notebook hook host did not settle'); }
  function nodes(node) { if (!arguments.length) node = tree; if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(n => nodes(n)); if (typeof node.type === 'function') return nodes(node.type(node.props)); return [node, ...nodes(node.props?.children)]; }
  function text(node) { if (node == null || typeof node === 'boolean') return ''; if (Array.isArray(node)) return node.map(text).join(''); return typeof node === 'object' ? text(node.props?.children) : String(node); }
  async function settle() { for (let n = 0; n < 8; n++) { await Promise.resolve(); render(); } }
  function findButton(label) { const button = nodes().find(n => n.type === 'button' && text(n) === label); assert.ok(button, `Missing button ${label}`); return button; }
  function checkbox(label) { const wrapper = nodes().find(n => n.type === 'label' && text(n) === label); const input = wrapper && nodes(wrapper).find(n => n.type === 'input' && n.props.type === 'checkbox'); assert.ok(input, `Missing checkbox ${label}`); return input; }
  render();
  return {
    ready: async () => { await settle(); const history = nodes().find(n => n.type === 'select' && nodes().some(parent => parent.props?.className === 'notebookHistory' && nodes(parent).includes(n))); assert.ok(history); history.props.onChange({ target: { value: original.id } }); await settle(); },
    nodes, text, calls, savedDraft, storage,
    draft: () => JSON.parse(storage.get(model.NOTEBOOK_DRAFT_KEY)),
    rawDraft: () => storage.get(model.NOTEBOOK_DRAFT_KEY),
    click: async label => { await findButton(label).props.onClick(); await settle(); },
    checked: label => checkbox(label).props.checked,
    toggle: async (label, checked) => { checkbox(label).props.onChange({ target: { checked } }); await settle(); },
    edit(label, value) { const wrapper = nodes().find(n => n.type === 'label' && text(n).startsWith(label) && nodes(n).some(child => child.type === 'textarea')); assert.ok(wrapper, `Missing textarea label ${label}`); nodes(wrapper).find(n => n.type === 'textarea').props.onChange({ target: { value } }); render(); },
    editMemory(value) { const input = nodes().find(n => n.type === 'textarea' && n.props['aria-label'] === `${original.words[0].word} 的记忆方法`); assert.ok(input); input.props.onChange({ target: { value } }); render(); },
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
    await view.click('保存到当前工作区 · 有修改');
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
    assert.deepEqual(JSON.parse(storage.get('gre-notebook-display-v1')), { showReference: false, showMemory: true });
    assert.equal(first.rawDraft(), first.savedDraft);
  } finally { first.close(); }
  const reopened = notebook({ storage });
  try {
    await reopened.ready();
    assert.equal(reopened.checked('显示对照释义'), false);
    assert.equal(reopened.checked('显示记忆笔记'), true);
    assert.ok(!reopened.nodes().some(n => n.type === 'textarea' && n.props.value === original.words[0].note));
    assert.ok(reopened.nodes().some(n => n.props?.['data-shared-word'] === 'cogent'));
    assert.equal(reopened.rawDraft(), reopened.savedDraft);
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
