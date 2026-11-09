import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import {loadTs} from './helpers/load-ts.mjs';

const compile = file => ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

// Run the real provider and in-memory storage. Limit indexed enumeration so a
// regression fails promptly instead of hanging the test runner for 20 seconds.
function environment(initial, memories = {}) {
  const storage = loadTs('community/storage.ts'), model = {};
  new Function('exports', compile('app/wordMemoryModel.ts'))(model);
  storage.loadStorage(initial);
  let indexedReads = 0, snapshots = 0, current, fail = false;
  const measuredStorage = new Proxy(storage.studyStorage, { get(target, key) {
    if (key === 'key') return index => {
      if (++indexedReads > 2) throw Error('Repeated full-key enumeration');
      return target.key(index);
    };
    return Reflect.get(target, key);
  } });
  const react = {
    createContext: () => ({ Provider: 'Provider' }),
    useContext: () => null,
    useState(initial) {
      const host = current, index = host.cursor++;
      if (!(index in host.hooks)) host.hooks[index] = typeof initial === 'function' ? initial() : initial;
      return [host.hooks[index], next => {
        const value = typeof next === 'function' ? next(host.hooks[index]) : next;
        if (!Object.is(value, host.hooks[index])) { host.hooks[index] = value; host.dirty = true; }
      }];
    },
    useRef(initial) {
      const host = current, index = host.cursor++;
      return host.hooks[index] ??= { current: initial };
    },
    useEffect(effect, deps) {
      const host = current, index = host.cursor++, old = host.hooks[index];
      if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) {
        host.hooks[index] = { deps, cleanup: old?.cleanup };
        host.effects.push(() => { host.hooks[index].cleanup?.(); host.hooks[index].cleanup = effect(); });
      }
    },
  };
  const provider = {}, events = { addEventListener() {}, removeEventListener() {} };
  const dependencies = {
    react,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    '../community/storage': { ...storage, studyStorage: measuredStorage, exportStorage: () => { snapshots++; return storage.exportStorage(); } },
    '../community/api': { appFetch: async () => fail ? { ok: false } : { ok: true, json: async () => ({ memories: structuredClone(memories) }) } },
    './wordMemoryModel': model,
  };
  new Function('exports', 'require', 'window', 'document', compile('app/SharedWordMemory.tsx'))(
    provider, name => { assert.ok(name in dependencies, name); return dependencies[name]; }, events, { ...events, visibilityState: 'visible' },
  );
  const host = { hooks: [], cursor: 0, effects: [], dirty: true, tree: null };
  const render = () => {
    for (let i = 0; i < 20; i++) {
      current = host; host.cursor = 0; host.dirty = false;
      host.tree = provider.SharedWordMemoryProvider({ children: 'Fixture' });
      while (host.effects.length) host.effects.shift()();
      if (!host.dirty) return;
    }
    throw Error('Provider did not settle');
  };
  return {
    storage, mount: render, value: () => host.tree.props.value,
    reads: () => ({ indexedReads, snapshots }), setFailure: value => { fail = value; },
    async settle() { for (let i = 0; i < 12; i++) { await Promise.resolve(); if (host.dirty) render(); } },
    close() { for (const hook of host.hooks) hook?.cleanup?.(); },
  };
}

test('startup scans a large learning space once and preserves every legacy note and unrelated record', async () => {
  const draftKey = 'gre-shared-word-memory-drafts-v1';
  const initial = {
    ...Object.fromEntries(Array.from({ length: 13565 }, (_, i) => [`study-record:${i}`, `value:${i}`])),
    'gre-a-plus-note-draft:CANDID': 'Legacy A+ note',
    'gre-a-plus-note-draft:lucid': 'Legacy lucid note',
    'gre-quanneng-vocab-v1-words': JSON.stringify([{ id: 'one', word: 'candid', note: 'Legacy vocabulary note' }]),
    [draftKey]: JSON.stringify({ candid: { text: 'Unsaved current draft', revision: 7 }, newword: { text: 'Keep pending draft', revision: 2 } }),
  };
  const env = environment(initial, { lucid: { text: 'Saved shared note', revision: 4, sources: [] } });
  try {
    env.mount(); await env.settle();
    assert.deepEqual(env.reads(), { indexedReads: 0, snapshots: 1 });
    const drafts = env.value().drafts;
    assert.deepEqual(drafts.candid, { text: 'Unsaved current draft\n\nLegacy A+ note\n\nLegacy vocabulary note', revision: 7 });
    assert.deepEqual(drafts.lucid, { text: 'Saved shared note\n\nLegacy lucid note', revision: 4 });
    assert.deepEqual(drafts.newword, { text: 'Keep pending draft', revision: 2 });
    const after = env.storage.exportStorage();
    for (const [key, value] of Object.entries(initial)) if (key !== draftKey) assert.equal(after[key], value, key);
    assert.equal(Object.keys(after).filter(key=>key!=='gre-workspace-field-edits-v1').length, Object.keys(initial).length + 3, 'Only migration markers and edit-time metadata are added');
    const changes = [], stop = env.storage.subscribeStudyStorage(key => changes.push(key));
    await env.value().refresh(); await env.settle();
    assert.deepEqual(changes, [], 'Refreshing an already imported account must not rewrite drafts or notes');
    assert.deepEqual(env.storage.exportStorage(), after);
    assert.deepEqual(env.reads(), { indexedReads: 0, snapshots: 2 });
    env.storage.studyStorage.setItem('gre-a-plus-note-draft:lucid', 'New legacy addition');
    await env.value().refresh(); await env.settle();
    assert.equal(env.value().drafts.lucid.text, 'Saved shared note\n\nLegacy lucid note\n\nNew legacy addition');
    assert.equal(env.value().drafts.lucid.revision, 4);
    stop();
  } finally { env.close(); }
});

test('a failed shared-memory read keeps old notes and pending drafts without migrating against an empty response', async () => {
  const initial = { 'gre-a-plus-note-draft:candid': 'Legacy note', 'gre-shared-word-memory-drafts-v1': JSON.stringify({ lucid: { text: 'Pending note', revision: 1 } }) };
  const env = environment(initial);
  try {
    env.setFailure(true); env.mount(); await env.settle();
    assert.deepEqual(env.storage.exportStorage(), initial);
    assert.deepEqual(env.reads(), { indexedReads: 0, snapshots: 0 });
    assert.equal(env.value().ready, false);
    assert.match(env.value().status, /读取失败/);
  } finally { env.close(); }
});
