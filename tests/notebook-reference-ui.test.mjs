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
function notebook() {
  const modules = new Map(), storage = new Map(), calls = [], listeners = new Map();
  let hooks = [], effects = [], cursor = 0, dirty = false, tree;
  const jsx = (type, props) => ({ type, props: props ?? {} });
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
    if (name === './SharedWordMemory') return { default: props => jsx('aside', { 'data-shared-word': props.word, 'data-editing': !!props.editing, children: '共享记忆：把论据串起来' }), useWordMemory: () => ({ drafts: {}, save: async () => true }) };
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
  storage.set(model.NOTEBOOK_DRAFT_KEY, savedDraft);
  const Component = load('./VocabularyNotebook').default;
  function render() { for (let n = 0; n < 20; n++) { dirty = false; cursor = 0; tree = Component({ words: [], pronounce() {} }); while (effects.length) effects.shift()(); if (!dirty) return; } throw Error('Notebook hook host did not settle'); }
  function nodes(node) { if (!arguments.length) node = tree; if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(n => nodes(n)); if (typeof node.type === 'function') return nodes(node.type(node.props)); return [node, ...nodes(node.props?.children)]; }
  function text(node) { if (node == null || typeof node === 'boolean') return ''; if (Array.isArray(node)) return node.map(text).join(''); return typeof node === 'object' ? text(node.props?.children) : String(node); }
  async function settle() { for (let n = 0; n < 8; n++) { await Promise.resolve(); render(); } }
  function findButton(label) { const button = nodes().find(n => n.type === 'button' && text(n) === label); assert.ok(button, `Missing button ${label}`); return button; }
  render();
  return {
    ready: async () => { await settle(); const history = nodes().find(n => n.type === 'select' && nodes().some(parent => parent.props?.className === 'notebookHistory' && nodes(parent).includes(n))); assert.ok(history); history.props.onChange({ target: { value: original.id } }); await settle(); },
    nodes, text, calls, savedDraft,
    draft: () => JSON.parse(storage.get(model.NOTEBOOK_DRAFT_KEY)),
    rawDraft: () => storage.get(model.NOTEBOOK_DRAFT_KEY),
    click: async label => { await findButton(label).props.onClick(); await settle(); },
    edit(label, value) { const wrapper = nodes().find(n => n.type === 'label' && text(n).startsWith(label) && nodes(n).some(child => child.type === 'textarea')); assert.ok(wrapper, `Missing textarea label ${label}`); nodes(wrapper).find(n => n.type === 'textarea').props.onChange({ target: { value } }); render(); },
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
