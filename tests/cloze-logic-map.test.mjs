import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const ts = createRequire(import.meta.url)('typescript');

function loadTs(path, dependencies = {}) {
 const source = readFileSync(path, 'utf8').replaceAll('import.meta.env.', 'testEnv.');
 const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX}}).outputText;
 const exports = {};
 new Function('require', 'exports', 'testEnv', compiled)(name => {
  if (name in dependencies) return dependencies[name];
  throw Error('Unexpected dependency: ' + name);
 }, exports, {});
 return exports;
}
const model = loadTs('community/clozeLogicMapModel.ts');
const content = () => ({schemaVersion: 1, root: {id: 'r', label: '测试根', children: [
 {id: 'a', label: '第一分支', tone: 'opposite', children: [{id: 'a1', label: '规则甲', details: ['原文第一行', '原文第二行']}]},
 {id: 'b', label: '第二分支', tone: 'same', children: [{id: 'b1', label: '规则乙'}]},
]}});
const row = () => ({id: 'gre-cloze-signals', title: '测试导图', content: content(), version: 1, updated_at: '2026-10-23T00:00:00Z'});
const session = (id = 'a') => ({user: {id}, access_token: `${id}-captured-token`});
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {let resolve, reject; const promise = new Promise((a, b) => {resolve = a; reject = b;}); return {promise, resolve, reject};}

test('tree validation preserves literal text and returns an independent bounded tree', () => {
 const input = content(); input.root.children[0].children[0].label = '<b>原文</b>';
 const parsed = model.parseClozeLogicContent(input);
 assert.equal(parsed.root.children[0].children[0].label, '<b>原文</b>');
 parsed.root.children[0].children[0].details.push('新行');
 assert.equal(input.root.children[0].children[0].details.length, 2);
 assert.equal(model.countLogicNodes(parsed.root), 5);
});
test('invalid schemas, cycles, duplicate IDs and vocabulary-specific fields are rejected', () => {
 const duplicate = content(); duplicate.root.children[1].id = 'a';
 const cyclic = content(); cyclic.root.children.push(cyclic.root);
 const extra = content(); extra.root.word = 'word field';
 const invalidDetail = content(); invalidDetail.root.details = [42];
 const invalidTone = content(); invalidTone.root.tone = 'administrator';
 const tooDeep = content(); let parent = tooDeep.root;
 for (let i = 0; i < 26; i++) {parent.children = [{id: 'depth-' + i, label: '层'}]; parent = parent.children[0];}
 for (const input of [null, {...content(), schemaVersion: 2}, duplicate, cyclic, extra, invalidDetail, invalidTone, tooDeep]) assert.equal(model.parseClozeLogicContent(input), null);
 assert.equal(model.parseAdminCourseMap({...row(), id: 'other'}), null);
 assert.equal(model.parseAdminCourseMap({...row(), updated_at: 'not a date'}), null);
});
test('arbitrary subtree folding preserves descendants and all-expand/all-collapse are deterministic', () => {
 const root = model.parseClozeLogicContent(content()).root;
 const initial = model.initialExpandedIds(root);
 assert.deepEqual([...initial], ['r', 'a', 'b']);
 assert.deepEqual(model.visibleNodeIds(root, initial), ['r', 'a', 'a1', 'b', 'b1']);
 const folded = model.toggleExpandedId(initial, 'a');
 assert.deepEqual(model.visibleNodeIds(root, folded), ['r', 'a', 'b', 'b1']);
 assert.equal(initial.has('a'), true);
 const all = new Set(model.expandableNodeIds(root));
 assert.deepEqual([...all], ['r', 'a', 'a1', 'b']);
 assert.deepEqual(model.visibleNodeIds(root, new Set()), ['r']);
 assert.deepEqual(model.visibleNodeIds(root, model.toggleExpandedId(folded, 'a')), model.visibleNodeIds(root, all));
});

function accessHarness({permission = {data: true, error: null}, result = {data: row(), error: null}} = {}) {
 const calls = [], options = [], signals = [];
 const module = loadTs('community/adminCourseMapAccess.ts', {
  '@supabase/supabase-js': {createClient(_url, _key, config) {
   options.push(config);
   return {
    rpc(name) {calls.push(['rpc', name]); return {abortSignal(signal) {signals.push(signal); return Promise.resolve(permission);}};},
    from(table) {calls.push(['from', table]); const query = {
     select(columns) {calls.push(['select', columns]); return query;},
     eq(key, value) {calls.push(['eq', key, value]); return query;},
     abortSignal(signal) {signals.push(signal); return query;},
     maybeSingle() {return Promise.resolve(result);},
    }; return query;},
   };
  }},
  './publicCloud.json': {default: {url: 'https://example.invalid', publishableKey: 'public-test-key'}},
  './clozeLogicMapModel': model,
 });
 return {module, calls, options, signals};
}
test('a missing session and a denied or failed role check cannot read map content', async () => {
 const missing = accessHarness();
 await assert.rejects(missing.module.readAdminCourseMap(null, new AbortController().signal), error => error.code === 'login');
 assert.equal(missing.options.length, 0);
 for (const permission of [{data: false, error: null}, {data: true, error: {code: '42501'}}, {data: null, error: {code: 'FETCH_ERROR'}}]) {
  const h = accessHarness({permission});
  await assert.rejects(h.module.readAdminCourseMap(session(), new AbortController().signal));
  assert.deepEqual(h.calls, [['rpc', 'is_analytics_admin']]);
 }
});
test('an authorized read captures its token, uses no session persistence and requests only the private map row', async () => {
 const h = accessHarness(), account = session(), controller = new AbortController();
 const response = await h.module.readAdminCourseMap(account, controller.signal);
 account.access_token = 'another-tab-token';
 assert.equal(await h.options[0].accessToken(), 'a-captured-token');
 assert.deepEqual(h.options[0].auth, {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false});
 assert.deepEqual(h.calls, [['rpc', 'is_analytics_admin'], ['from', 'admin_course_maps'], ['select', 'id,title,content,version,updated_at'], ['eq', 'id', 'gre-cloze-signals']]);
 assert.equal(response.content.root.label, '测试根');
 assert.equal(h.signals.length, 2); assert.equal(h.signals[0], h.signals[1]);
 const previousFetch = globalThis.fetch; let requested;
 globalThis.fetch = async (...args) => {requested = args; return new Response();};
 try {await h.options[0].global.fetch('https://example.invalid', {cache: 'force-cache'}); assert.equal(requested[1].cache, 'no-store');}
 finally {globalThis.fetch = previousFetch;}
});
test('empty, malformed and RLS-denied rows have distinct safe failures', async () => {
 for (const [result, expected] of [[{data: null, error: null}, 'empty'], [{data: {...row(), content: {schemaVersion: 9}}, error: null}, 'invalid'], [{data: null, error: {code: '42501'}}, 'denied']]) {
  const h = accessHarness({result});
  await assert.rejects(h.module.readAdminCourseMap(session(), new AbortController().signal), error => error.code === expected);
 }
});
test('aborting a delayed permission check rejects promptly and cannot start a late content read', async () => {
 const role = deferred(), h = accessHarness({permission: role.promise}), controller = new AbortController();
 const pending = h.module.readAdminCourseMap(session(), controller.signal);
 controller.abort();
 await assert.rejects(pending, error => error.name === 'AbortError');
 role.resolve({data: true, error: null}); await tick();
 assert.deepEqual(h.calls, [['rpc', 'is_analytics_admin']]);
 const already = new AbortController(); already.abort();
 const untouched = accessHarness();
 await assert.rejects(untouched.module.readAdminCourseMap(session(), already.signal), error => error.name === 'AbortError');
 assert.equal(untouched.options.length, 0);
});
test('aborting a delayed content response does not return private content even if transport ignores cancellation', async () => {
 const data = deferred(), h = accessHarness({result: data.promise}), controller = new AbortController();
 const pending = h.module.readAdminCourseMap(session(), controller.signal); await tick(); controller.abort();
 await assert.rejects(pending, error => error.name === 'AbortError');
 data.resolve({data: row(), error: null}); await tick();
 assert.equal(h.signals[1].aborted, true);
});

function componentHarness() {
 const hooks = [], effects = [], calls = [];
 let cursor = 0, tree, props = {session: session('a'), onClose() {}}, mounted = true;
 const jsx = (type, next) => ({type, props: next ?? {}});
 const react = {
  useState(initial) {const i = cursor++; if (!(i in hooks)) hooks[i] = {value: typeof initial === 'function' ? initial() : initial}; return [hooks[i].value, next => {hooks[i].value = typeof next === 'function' ? next(hooks[i].value) : next;}];},
  useRef(initial) {const i = cursor++; return hooks[i] ?? (hooks[i] = {current: initial});},
  useEffect(run, deps) {const i = cursor++, old = hooks[i]; if (!old || deps.some((dep, index) => !Object.is(dep, old.deps[index]))) {hooks[i] = {deps, cleanup: old?.cleanup}; effects.push(() => {hooks[i].cleanup?.(); hooks[i].cleanup = run();});}},
 };
 class ErrorType extends Error {}
 const module = loadTs('community/ClozeLogicMap.tsx', {
  react, 'react/jsx-runtime': {jsx, jsxs: jsx, Fragment: 'fragment'},
  './clozeLogicMapModel': model, './clozeLogicMap.css': {},
  './adminCourseMapAccess': {CourseMapAccessError: ErrorType, readAdminCourseMap(account, signal) {const delayed = deferred(); calls.push({account, signal, ...delayed}); return delayed.promise;}},
 });
 function render(runEffects = true) {if (!mounted) return; cursor = 0; tree = module.default(props); if (runEffects) while (effects.length) effects.shift()(); return tree;}
 function nodes(node) {if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(nodes); return [node, ...nodes(node.props?.children)];}
 function text(node) {if (Array.isArray(node)) return node.map(text).join(''); if (node == null || typeof node === 'boolean') return ''; if (typeof node === 'object') return text(node.props?.children); return String(node);}
 render();
 return {calls, render, text: () => text(tree), find: (type, label) => nodes(tree).find(node => node.type === type && text(node).includes(label)),
  updateSession(next, runEffects = true) {props = {...props, session: next}; render(runEffects);},
  async flush() {for (let i = 0; i < 4; i++) {await tick(); render();}},
  unmount() {mounted = false; for (const hook of hooks) hook?.cleanup?.();},
 };
}
test('the panel immediately hides a loaded map on account change and ignores late earlier-account results', async () => {
 const view = componentHarness();
 try {
  view.calls[0].resolve({...row(), title: '账号甲私有标题'}); await view.flush(); assert.match(view.text(), /账号甲私有标题/);
  view.updateSession(session('b'), false); assert.doesNotMatch(view.text(), /账号甲私有标题/);
  view.render(); assert.equal(view.calls[0].signal.aborted, true);
  const b = view.calls[1]; view.updateSession(session('c')); assert.equal(b.signal.aborted, true);
  b.resolve({...row(), title: '账号乙迟到结果'}); await view.flush(); assert.doesNotMatch(view.text(), /账号乙迟到结果/);
  view.calls[2].resolve({...row(), title: '账号丙的导图'}); await view.flush(); assert.match(view.text(), /账号丙的导图/);
  view.updateSession(null, false); assert.doesNotMatch(view.text(), /账号丙的导图/); assert.match(view.text(), /请先登录管理员账号/);
 } finally {view.unmount();}
});
test('unmount cancels the active request; an error can be retried and disclosure buttons affect visible branches', async () => {
 const view = componentHarness();
 try {
  view.calls[0].reject(Error('unavailable')); await view.flush(); assert.match(view.text(), /读取失败/);
  view.find('button', '重新读取').props.onClick(); view.render(); assert.equal(view.calls[0].signal.aborted, true);
  view.calls[1].resolve(row()); await view.flush(); assert.match(view.text(), /规则甲/);
  const firstBranch = view.find('button', '第一分支'); assert.equal(firstBranch.props['aria-expanded'], true);
  firstBranch.props.onClick(); view.render(); assert.doesNotMatch(view.text(), /规则甲/);
  view.find('button', '全部展开').props.onClick(); view.render(); assert.match(view.text(), /原文第一行/);
  view.find('button', '全部收起').props.onClick(); view.render(); assert.doesNotMatch(view.text(), /第一分支/);
 } finally {view.unmount();}
 assert.equal(view.calls.at(-1).signal.aborted, true);
});
test('map keyboard events cannot reach background study shortcuts and preserve native activation and scrolling', () => {
 const view = componentHarness();
 try {
  const panel = view.find('section', '');
  for (const key of ['1', '2', '3', ' ', 'Enter', 'ArrowLeft', 'ArrowDown']) {
   let reachesBackground = true, prevented = false;
   panel.props.onKeyDown({key, stopPropagation() {reachesBackground = false;}, preventDefault() {prevented = true;}});
   assert.equal(reachesBackground, false, `${key} must not reach study shortcuts`);
   assert.equal(prevented, false, `${key} must keep its native button/scroll behavior`);
  }
  let prevented = false, stopped = false;
  panel.props.onKeyDown({key: 'Escape', stopPropagation() {stopped = true;}, preventDefault() {prevented = true;}});
  assert.equal(prevented, true); assert.equal(stopped, true);
  assert.equal(view.calls[0].signal.aborted, true);
 } finally {view.unmount();}
});
