import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const collection = (id, words) => ({ id, source: 'Synthetic collection', date: '2026-11-02', words: words.map((word, i) => ({ id: `${id}-${i}`, word, meaning: 'Synthetic meaning', note: '', origin: 'Synthetic source' })) });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

// Execute the real provider, model, storage publisher, and notebook DB store.
// Only React's hook scheduler and the local runtime database are isolated.
function environment() {
  const cache = new Map();
  let current;
  const react = {
    createContext(value) { return { value, Provider: Symbol('Provider') }; },
    useContext(context) { return context.value; },
    useState(initial) {
      const host = current, index = host.cursor++;
      if (!(index in host.hooks)) host.hooks[index] = typeof initial === 'function' ? initial() : initial;
      return [host.hooks[index], next => { host.setCalls++; const value = typeof next === 'function' ? next(host.hooks[index]) : next; if (!Object.is(value, host.hooks[index])) { host.hooks[index] = value; host.dirty = true; } }];
    },
    useEffect(effect, deps) {
      const host = current, index = host.cursor++, previous = host.hooks[index];
      if (!previous || !deps || deps.length !== previous.deps?.length || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        host.hooks[index] = { deps, cleanup: previous?.cleanup };
        host.effects.push(() => { host.hooks[index].cleanup?.(); host.hooks[index].cleanup = effect(); });
      }
    },
  };
  function load(filename) {
    const full = path.resolve(filename);
    if (cache.has(full)) return cache.get(full);
    const exports = {}; cache.set(full, exports);
    const result = ts.transpileModule(fs.readFileSync(full, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } });
    new Function('require', 'exports', result.outputText)(name => {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
      assert.ok(name.startsWith('.'), `Unexpected nonlocal import: ${name}`);
      const source = path.resolve(path.dirname(full), name);
      return load(fs.existsSync(source + '.ts') ? source + '.ts' : source + '.tsx');
    }, exports);
    return exports;
  }
  const runtime = load('db/runtime.ts'), store = load('db/notebookStore.ts'), storage = load('community/storage.ts'), model = load('app/notebookModel.ts'), component = load('app/NotebookFrequency.tsx');
  function database(initial = []) {
    const rows = new Map(initial.map(batch => [batch.id, { batch: structuredClone(batch), revision: 1 }])), reads = [], queries = [];
    const db = { prepare(query) {
      queries.push(query); let params;
      return { bind(...values) { params = values; return this; }, async first() {
        if (query.includes('json_group_array(json(value))')) {
          assert.deepEqual(params, ['vocab-notebook:', 'vocab-notebook;']);
          const pending = deferred(); reads.push(pending); return pending.promise;
        }
        if (query.startsWith('INSERT')) {
          const batch = JSON.parse(params[1]); if (rows.has(batch.id)) return null;
          rows.set(batch.id, { batch, revision: 1 }); return { revision: 1 };
        }
        if (query.startsWith('UPDATE')) {
          const batch = JSON.parse(params[0]), old = rows.get(batch.id);
          if (!old || old.revision !== params[2]) return null;
          const revision = old.revision + 1; rows.set(batch.id, { batch, revision }); return { revision };
        }
        throw Error('Unexpected SQL: ' + query);
      } };
    } };
    return { db, rows, reads, queries, resolve(index, batches = [...rows.values()].map(row => row.batch)) { reads[index].resolve({ items: JSON.stringify(batches) }); } };
  }
  function mount() {
    const host = { hooks: [], cursor: 0, effects: [], dirty: true, tree: null, setCalls: 0, closed: false };
    host.render = () => {
      assert.equal(host.closed, false);
      for (let i = 0; i < 20; i++) {
        current = host; host.cursor = 0; host.dirty = false;
        host.tree = component.NotebookFrequencyProvider({ children: 'Fixture' });
        while (host.effects.length) host.effects.shift()();
        if (!host.dirty) return;
      }
      throw Error('Provider did not settle');
    };
    host.counts = () => structuredClone(host.tree.props.value);
    host.countsIdentity = () => host.tree.props.value;
    host.settle = async () => { for (let n = 0; n < 8; n++) { await Promise.resolve(); if (!host.closed && host.dirty) host.render(); } };
    host.close = () => { for (const hook of host.hooks) hook?.cleanup?.(); host.closed = true; };
    host.render(); return host;
  }
  return { runtime, store, storage, draftKey: model.NOTEBOOK_DRAFT_KEY, database, mount };
}

function putDraft(env, batch, revision = 1) { env.storage.studyStorage.setItem(env.draftKey, JSON.stringify({ [batch.id]: { batch, revision } })); }

test('provider loads local collections, updates live drafts, and keeps one count when that draft is saved', async () => {
  const env = environment(), first = collection('first', ['cogent', 'COGENT', 'lucid']), second = collection('second', ['cogent']);
  const db = env.database([first, second]); env.runtime.setRuntimeDatabase(db.db);
  const view = env.mount();
  try {
    assert.deepEqual(view.counts(), {}); db.resolve(0); await view.settle();
    assert.deepEqual(view.counts(), { cogent: 2, lucid: 1 });
    const edit = collection('first', ['lucid', 'new']);
    putDraft(env, edit); await view.settle();
    assert.deepEqual(view.counts(), { lucid: 1, new: 1, cogent: 1 }, 'Removing a word from the active draft suppresses only its collection');
    assert.equal(db.reads.length, 1, 'A draft edit should not scan the database');
    assert.deepEqual(await env.store.saveNotebookBatch(edit, 1), { revision: 2 });
    assert.equal(db.reads.length, 2, 'Successful save publishes a refresh');
    db.resolve(1); await view.settle();
    assert.deepEqual(view.counts(), { lucid: 1, new: 1, cogent: 1 }, 'Saved collection and still-present draft must not count twice');
    env.storage.studyStorage.removeItem(env.draftKey); await view.settle();
    assert.deepEqual(view.counts(), { lucid: 1, new: 1, cogent: 1 });
    putDraft(env, collection('pending', ['lucid', ''])); await view.settle();
    assert.deepEqual(view.counts(), { lucid: 2, new: 1, cogent: 1 });
    env.storage.studyStorage.setItem('unrelated-setting', 'value'); await view.settle();
    assert.equal(db.reads.length, 2, 'Display settings cannot cause needless notebook scans');
  } finally { view.close(); }
});

test('notebook store publishes only successful conditional inserts/updates; stale writes keep counters unchanged', async () => {
  const env = environment(), first = collection('first', ['cogent']);
  const db = env.database([first]); env.runtime.setRuntimeDatabase(db.db); const view = env.mount();
  const events = []; const unsubscribe = env.store.subscribeNotebookChanges(() => events.push('saved'));
  try {
    db.resolve(0); await view.settle();
    assert.equal(await env.store.saveNotebookBatch(collection('first', ['wrong']), 0), null, 'Duplicate insert has conflict semantics');
    assert.equal(await env.store.saveNotebookBatch(collection('first', ['wrong']), 8), null, 'Stale update has conflict semantics');
    assert.deepEqual(events, []); assert.equal(db.reads.length, 1); assert.deepEqual(view.counts(), { cogent: 1 });
    const second = collection('second', ['cogent']);
    assert.deepEqual(await env.store.saveNotebookBatch(second, 0), { revision: 1 });
    assert.deepEqual(events, ['saved']); db.resolve(1); await view.settle();
    assert.deepEqual(view.counts(), { cogent: 2 });
  } finally { unsubscribe(); view.close(); }
});

test('out-of-order refreshes cannot revert newer saved counts, and a failed read preserves available counts', async () => {
  const env = environment(), db = env.database([collection('first', ['cogent'])]); env.runtime.setRuntimeDatabase(db.db); const view = env.mount();
  try {
    const old = [collection('first', ['cogent'])];
    await env.store.saveNotebookBatch(collection('second', ['lucid']), 0);
    db.resolve(1); await view.settle();
    assert.deepEqual(view.counts(), { cogent: 1, lucid: 1 });
    db.resolve(0, old); await view.settle();
    assert.deepEqual(view.counts(), { cogent: 1, lucid: 1 }, 'Late initial reads must not replace newer counts');
    await env.store.saveNotebookBatch(collection('third', ['new']), 0);
    db.reads[2].reject(Error('Synthetic transient local read failure')); await view.settle();
    assert.deepEqual(view.counts(), { cogent: 1, lucid: 1 });
    putDraft(env, collection('draft', ['new'])); await view.settle();
    assert.deepEqual(view.counts(), { cogent: 1, lucid: 1, new: 1 }, 'Drafts still update after a failed refresh');
  } finally { view.close(); }
});

test('workspace remount drops old counts, unsubscribes listeners, and ignores old outstanding reads', async () => {
  const env = environment(), oldDB = env.database([collection('old', ['old-account-word'])]);
  env.runtime.setRuntimeDatabase(oldDB.db); const oldView = env.mount();
  oldView.close(); const oldSetCalls = oldView.setCalls;
  // App keys its provider by workspace generation. Simulate precisely that
  // unmount/remount boundary while the first account read remains outstanding.
  env.storage.loadStorage({});
  const newDB = env.database([collection('new', ['new-account-word'])]); env.runtime.setRuntimeDatabase(newDB.db);
  const newView = env.mount();
  try {
    assert.deepEqual(newView.counts(), {});
    newDB.resolve(0); await newView.settle();
    assert.deepEqual(newView.counts(), { 'new-account-word': 1 });
    oldDB.resolve(0); await oldView.settle(); await newView.settle();
    assert.equal(oldView.setCalls, oldSetCalls, 'Unmounted provider must not set state from an old response');
    assert.deepEqual(newView.counts(), { 'new-account-word': 1 });
    putDraft(env, collection('new-draft', ['new-account-word'])); await newView.settle();
    await env.store.saveNotebookBatch(collection('saved-new', ['new-account-word']), 0);
    assert.equal(newDB.reads.length, 2, 'Only the new provider should subscribe to saved events');
    assert.equal(oldView.setCalls, oldSetCalls, 'Old provider must unsubscribe from draft and saved events');
    newDB.resolve(1); await newView.settle();
    assert.deepEqual(newView.counts(), { 'new-account-word': 3 });
  } finally { newView.close(); }
});


test('typing meanings, written answers and ratings preserves badge context identity until words change',async()=>{
 const env=environment(),first=collection('first',['cogent','lucid']);
 const db=env.database([first]);env.runtime.setRuntimeDatabase(db.db);const view=env.mount();
 try{
  db.resolve(0);await view.settle();const identity=view.countsIdentity();
  for(let i=0;i<100;i++){
   const next=structuredClone(first);next.words[0].meaning='Meaning '+i;
   next.words[0].recalls=[{id:'attempt',answer:'Answer '+i,checked:false}];next.words[0].rating='familiar';
   putDraft(env,next);await view.settle();
   assert.equal(view.countsIdentity(),identity,'Unchanged counts must not rerender every badge');
  }
  putDraft(env,collection('first',['cogent','new']));await view.settle();
  assert.notEqual(view.countsIdentity(),identity);assert.deepEqual(view.counts(),{cogent:1,new:1});
 }finally{view.close();}
});
