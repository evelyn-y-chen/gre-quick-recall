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
const layoutModel = loadTs('community/clozeMapLayout.ts');
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

test('question associations are bounded, closed and preserve literal classroom text', () => {
 const sample=content();sample.questions=[{id:'q1',stem:'原题 <b>literal</b> ____',options:[{label:'A',text:'option'}],answer:'A',notes:['板书原句'],source:{course:'测试课堂',page:63,exercise:'1'}}];
 sample.root.children[0].questionIds=['q1'];
 const parsed=model.parseClozeLogicContent(sample);
 assert.equal(model.questionsForNode(parsed,parsed.root.children[0])[0].stem,'原题 <b>literal</b> ____');
 const variants=[];
 const change=fn=>{const v=structuredClone(sample);fn(v);variants.push(v);};
 change(v=>v.root.questionIds=['missing']);
 change(v=>v.root.questionIds=['q1','q1']);
 change(v=>v.questions.push(v.questions[0]));
 change(v=>v.questions[0].source.page=0);
 change(v=>v.questions[0].source.url='https://untrusted.invalid');
 change(v=>v.questions[0].options.push({label:'A',text:'duplicate'}));
 change(v=>v.questions[0].html='<script>');
 for(const v of variants)assert.equal(model.parseClozeLogicContent(v),null);
 parsed.questions[0].notes.push('edit');assert.deepEqual(sample.questions[0].notes,['板书原句']);
});
test('classroom image references accept private IDs only and reject URLs, duplicates and extra fields',()=>{
 const sample=classroomRow().content;sample.questions[0].images=[{id:'day7-p63-q1-a',caption:'课堂原笔记'}];
 assert.equal(model.parseClozeLogicContent(sample).questions[0].images[0].id,'day7-p63-q1-a');
 for(const images of [[{id:'https://example.invalid/a.jpg'}],[{id:'x'},{id:'x'}],[{id:'x',url:'https://example.invalid'}],[{id:'x',caption:''}]]){
  const raw=structuredClone(sample);raw.questions[0].images=images;assert.equal(model.parseClozeLogicContent(raw),null);
 }
});
test('private image parsing allows bounded raster data and rejects executable or malformed media',()=>{
 const raw={id:'photo-1',mime_type:'image/jpeg',data_base64:'/9j/2Q==',width:100,height:80};
 assert.equal(model.parseAdminCourseImage(raw).mimeType,'image/jpeg');
 for(const change of [{mime_type:'image/svg+xml'},{data_base64:'data:image/png;base64,abc'},{data_base64:'abc'},{width:0},{height:12001},{id:'../outside'}])assert.equal(model.parseAdminCourseImage({...raw,...change}),null);
});

test('editing a node preserves its questions and descendants without mutating the loaded tree',()=>{
 const root=content().root;root.children[0].questionIds=['q1'];
 const changed=model.updateLogicNode(root,'a',{label:'新标题',details:['课堂规则']});
 assert.equal(root.children[0].label,'第一分支');assert.equal(changed.children[0].label,'新标题');
 assert.deepEqual(changed.children[0].questionIds,['q1']);assert.equal(changed.children[0].children,root.children[0].children);
 assert.equal(model.updateLogicNode(root,'missing',{label:'无'}),null);
 assert.equal(model.updateLogicNode(root,'a',{label:' '}),null);
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
test('private classroom screenshots verify administrator access and request one bounded image without caching',async()=>{
 const result={data:{id:'photo-1',mime_type:'image/jpeg',data_base64:'/9j/2Q==',width:100,height:80},error:null};
 const h=accessHarness({result}),account=session();const image=await h.module.readAdminCourseImage(account,'photo-1',new AbortController().signal);
 assert.equal(image.id,'photo-1');assert.deepEqual(h.calls.filter(x=>x[0]==='from'),[['from','admin_course_images']]);
 assert.deepEqual(h.calls.filter(x=>x[0]==='eq'),[['eq','id','photo-1'],['eq','map_id','gre-cloze-signals']]);
 account.access_token='changed';assert.equal(await h.options[0].accessToken(),'a-captured-token');assert.equal(h.options[0].auth.persistSession,false);
 const previousFetch=globalThis.fetch;let init;globalThis.fetch=async(_url,options)=>{init=options;return new Response();};
 try{await h.options[0].global.fetch('https://example.invalid',{cache:'force-cache'});assert.equal(init.cache,'no-store');}finally{globalThis.fetch=previousFetch;}
});
test('denied and cancelled screenshot reads cannot query the private image table',async()=>{
 const h=accessHarness({permission:{data:false,error:null}});await assert.rejects(h.module.readAdminCourseImage(session(),'photo-1',new AbortController().signal),e=>e.code==='denied');assert.deepEqual(h.calls,[['rpc','is_analytics_admin']]);
 const invalid=accessHarness();await assert.rejects(invalid.module.readAdminCourseImage(session(),'../outside',new AbortController().signal),e=>e.code==='invalid');assert.equal(invalid.options.length,0);
 const role=deferred(),late=accessHarness({permission:role.promise}),controller=new AbortController();const pending=late.module.readAdminCourseImage(session(),'photo-1',controller.signal);controller.abort();await assert.rejects(pending,e=>e.name==='AbortError');role.resolve({data:true,error:null});await tick();assert.deepEqual(late.calls,[['rpc','is_analytics_admin']]);
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

function saveHarness({permission={data:true,error:null},result={data:{...row(),version:2},error:null}}={}) {
 const calls=[],configs=[];
 const module=loadTs('community/adminCourseMapAccess.ts',{
  '@supabase/supabase-js':{createClient(_url,_key,config){configs.push(config);const chain={
   update(payload){calls.push(['update',payload]);return chain;},eq(key,value){calls.push(['eq',key,value]);return chain;},select(columns){calls.push(['select',columns]);return chain;},abortSignal(signal){calls.push(['signal',signal]);return chain;},maybeSingle(){return Promise.resolve(result);},
  };return {rpc(name){calls.push(['rpc',name]);return {abortSignal(){return Promise.resolve(permission);}};},from(table){calls.push(['from',table]);return chain;}};}},
  './publicCloud.json':{default:{url:'https://example.invalid',publishableKey:'test'}},'./clozeLogicMapModel':model,
 });return {module,calls,configs};
}
test('administrator edits update only content with both ID and version conditions',async()=>{
 const h=saveHarness(),account=session(),input=row();
 const saved=await h.module.saveAdminCourseMap(account,input,new AbortController().signal);
 assert.equal(saved.version,2);
 assert.deepEqual(h.calls.filter(x=>x[0]==='update'),[['update',{content:input.content}]]);
 assert.deepEqual(h.calls.filter(x=>x[0]==='eq'),[['eq','id','gre-cloze-signals'],['eq','version',1]]);
 account.access_token='changed';assert.equal(await h.configs[0].accessToken(),'a-captured-token');
 assert.equal(h.configs[0].auth.persistSession,false);
});
test('denied, missing, invalid and cancelled edits cannot start a write',async()=>{
 const denied=saveHarness({permission:{data:false,error:null}});
 await assert.rejects(denied.module.saveAdminCourseMap(session(),row(),new AbortController().signal),e=>e.code==='denied');
 assert.deepEqual(denied.calls,[['rpc','is_analytics_admin']]);
 const missing=saveHarness();await assert.rejects(missing.module.saveAdminCourseMap(null,row(),new AbortController().signal),e=>e.code==='login');assert.equal(missing.configs.length,0);
 const invalid=saveHarness();await assert.rejects(invalid.module.saveAdminCourseMap(session(),{...row(),content:{}},new AbortController().signal),e=>e.code==='invalid');assert.equal(invalid.configs.length,0);
 const aborted=new AbortController();aborted.abort();const cancelled=saveHarness();await assert.rejects(cancelled.module.saveAdminCourseMap(session(),row(),aborted.signal),e=>e.name==='AbortError');assert.equal(cancelled.configs.length,0);
});
test('concurrent edits report a conflict and never blindly retry over newer content',async()=>{
 const h=saveHarness({result:{data:null,error:null}});
 await assert.rejects(h.module.saveAdminCourseMap(session(),row(),new AbortController().signal),e=>e.code==='conflict');
 assert.equal(h.calls.filter(x=>x[0]==='update').length,1);
});
test('changing account cancels a pending permission check before it can write',async()=>{
 const role=deferred(),h=saveHarness({permission:role.promise}),controller=new AbortController();
 const pending=h.module.saveAdminCourseMap(session(),row(),controller.signal);controller.abort();
 await assert.rejects(pending,e=>e.name==='AbortError');role.resolve({data:true,error:null});await tick();
 assert.deepEqual(h.calls,[['rpc','is_analytics_admin']]);
});

function componentHarness() {
 const hooks = [], effects = [], calls = [], saves = [], imageCalls = [];
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
  './clozeLogicMapModel': model, './clozeMapLayout': layoutModel, './clozeLogicMap.css': {},
  './adminCourseMapAccess': {CourseMapAccessError: ErrorType, readAdminCourseMap(account, signal) {const delayed = deferred(); calls.push({account, signal, ...delayed}); return delayed.promise;}, saveAdminCourseMap(account, map, signal) {const delayed = deferred(); saves.push({account,map,signal,...delayed}); return delayed.promise;}, readAdminCourseImage(account, imageId, signal) {const delayed = deferred(); imageCalls.push({account,imageId,signal,...delayed}); return delayed.promise;}},
 });
 function render(runEffects = true) {if (!mounted) return; cursor = 0; tree = module.default(props); if (runEffects) while (effects.length) effects.shift()(); return tree;}
 function nodes(node) {if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(nodes); return [node, ...nodes(node.props?.children)];}
 function text(node) {if (Array.isArray(node)) return node.map(text).join(''); if (node == null || typeof node === 'boolean') return ''; if (typeof node === 'object') return text(node.props?.children); return String(node);}
 render();
 return {calls, saves, imageCalls, render, text: () => text(tree), find: (type, label) => nodes(tree).find(node => node.type === type && text(node).includes(label)), byClass: name=>nodes(tree).find(node=>node.props?.className?.split(' ').includes(name)), byLabel: label=>nodes(tree).find(node=>node.props?.['aria-label']===label), conflictError:()=>Object.assign(new ErrorType('请读取最新版本'),{code:'conflict'}),
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

function classroomRow(){const input=row();input.content.questions=[{id:'q1',stem:'课堂原题 ____',options:[{label:'A',text:'alpha'}],answer:'A',source:{course:'测试课',page:63,exercise:'1'}}];input.content.root.children[0].children[0].questionIds=['q1'];return input;}
test('clicking a marked word opens its source question; the answer stays hidden until requested',async()=>{
 const view=componentHarness();try{
  view.calls[0].resolve(classroomRow());await view.flush();
  view.find('button','规则甲').props.onClick();view.render();
  assert.match(view.text(),/课堂原题 ____/);assert.match(view.text(),/测试课/);assert.match(view.text(),/alpha/);
  assert.equal(view.find('button','查看答案').props['aria-expanded'],false);
  view.find('button','查看答案').props.onClick();view.render();assert.equal(view.find('button','收起答案').props['aria-expanded'],true);
  view.updateSession(null,false);assert.doesNotMatch(view.text(),/课堂原题 ____/);
 }finally{view.unmount();}
});
test('editing is explicit and cancellation performs no write; saves retain question associations',async()=>{
 const view=componentHarness();try{
  const input=classroomRow();view.calls[0].resolve(input);await view.flush();
  view.find('button','规则甲').props.onClick();view.render();view.find('button','编辑节点').props.onClick();view.render();
  view.find('input','').props.onChange({target:{value:'草稿名称'}});view.render();
  assert.equal(view.saves.length,0);view.find('button','取消').props.onClick();view.render();assert.equal(view.saves.length,0);
  view.find('button','编辑节点').props.onClick();view.render();view.find('input','').props.onChange({target:{value:'课堂修改'}});view.render();
  const pending=view.find('form','').props.onSubmit({preventDefault(){}});view.render();
  assert.equal(view.saves.length,1);assert.equal(input.content.root.children[0].children[0].label,'规则甲');
  const changed=view.saves[0].map.content.root.children[0].children[0];assert.equal(changed.label,'课堂修改');assert.deepEqual(changed.questionIds,['q1']);
  view.saves[0].resolve({...view.saves[0].map,version:2});await pending;await view.flush();assert.match(view.text(),/课堂修改/);assert.equal(view.find('form',''),undefined);
 }finally{view.unmount();}
});
test('a pending edit is cancelled on account change and cannot replace the next account map',async()=>{
 const view=componentHarness();try{
  view.calls[0].resolve(row());await view.flush();view.find('button','编辑节点').props.onClick();view.render();
  view.find('input','').props.onChange({target:{value:'旧账号草稿'}});view.render();const pending=view.find('form','').props.onSubmit({preventDefault(){}});view.render();
  view.updateSession(session('b'),false);assert.doesNotMatch(view.text(),/旧账号草稿/);view.render();assert.equal(view.saves[0].signal.aborted,true);
  view.calls[1].resolve({...row(),title:'新账号导图'});view.saves[0].resolve({...view.saves[0].map,version:2});await pending;await view.flush();
  assert.match(view.text(),/新账号导图/);assert.doesNotMatch(view.text(),/旧账号草稿/);
 }finally{view.unmount();}
});
test('a version conflict keeps the draft and rereads before the user can explicitly save again',async()=>{
 const view=componentHarness();try{
  view.calls[0].resolve(row());await view.flush();view.find('button','编辑节点').props.onClick();view.render();view.find('input','').props.onChange({target:{value:'保留的草稿'}});view.render();
  const pending=view.find('form','').props.onSubmit({preventDefault(){}});view.saves[0].reject(view.conflictError());await pending;await view.flush();
  assert.equal(view.find('input','').props.value,'保留的草稿');assert.equal(view.saves.length,1);
  const refresh=view.find('button','读取最新版本并核对').props.onClick();view.render();const latest=row();latest.version=3;latest.content.root.children[1].label='其他设备修改';
  view.calls[1].resolve(latest);await refresh;await view.flush();assert.equal(view.find('input','').props.value,'保留的草稿');assert.equal(view.saves.length,1);
  const retry=view.find('form','').props.onSubmit({preventDefault(){}});assert.equal(view.saves[1].map.version,3);assert.equal(view.saves[1].map.content.root.children[1].label,'其他设备修改');
  view.saves[1].resolve({...view.saves[1].map,version:4});await retry;await view.flush();
 }finally{view.unmount();}
});

test('SVG contains only graphics and native HTML nodes share its transformed stage',async()=>{
 const view=componentHarness();try{
  view.calls[0].resolve(row());await view.flush();
  assert.equal(view.find('foreignObject',''),undefined);
  const stage=view.byClass('clozeMapStage'),node=view.byClass('clozeMapHtmlNode');
  assert.match(stage.props.style.transform,/^translate\(.+px, .+px\) scale\(.+\)$/);
  assert.equal(typeof node.props.style.left,'number');assert.equal(typeof node.props.style.top,'number');
  assert.equal(view.find('svg','').props['aria-hidden'],'true');
  assert.equal(view.find('button','第一分支').props.type,'button');
 }finally{view.unmount();}
});

test('touch taps retain the native node target; only a real drag captures and consumes its click',async()=>{
 const view=componentHarness();try{
  view.calls[0].resolve(classroomRow());await view.flush();
  let captures=0,releases=0;
  const surface={setPointerCapture(){captures++;},hasPointerCapture(){return captures>releases;},releasePointerCapture(){releases++;}};
  const event=(x,y,interactive=true)=>({button:0,pointerId:1,pointerType:'touch',clientX:x,clientY:y,currentTarget:surface,target:{closest(){return interactive?{matches(){return false;}}:null;}}});
  const region=()=>view.byLabel('可平移缩放的填空标志词导图');
  region().props.onPointerDown(event(40,40));region().props.onPointerUp(event(40,40));assert.equal(captures,0);
  let blocked=false;region().props.onClickCapture({detail:1,preventDefault(){blocked=true;},stopPropagation(){}});assert.equal(blocked,false);
  view.find('button','规则甲').props.onClick({detail:1});view.render();assert.match(view.text(),/课堂原题 ____/);
  region().props.onPointerDown(event(40,40,false));region().props.onPointerMove(event(65,70,false));region().props.onPointerUp(event(65,70,false));assert.equal(captures,1);assert.equal(releases,1);
  blocked=false;region().props.onClickCapture({detail:0,preventDefault(){blocked=true;},stopPropagation(){}});assert.equal(blocked,false,'keyboard activation must remain available after a drag');
  region().props.onClickCapture({detail:1,preventDefault(){blocked=true;},stopPropagation(){}});assert.equal(blocked,true,'the drag click must be consumed');
  region().props.onPointerDown(event(10,10));region().props.onPointerUp(event(10,10));blocked=false;
  region().props.onClickCapture({detail:1,preventDefault(){blocked=true;},stopPropagation(){}});assert.equal(blocked,false,'the next independent tap must be available immediately');
 }finally{view.unmount();}
});

test('a background mouse release outside the viewport cannot turn later hover into a drag',async()=>{
 const view=componentHarness();try{
  view.calls[0].resolve(row());await view.flush();
  let captured=false,captures=0,releases=0;
  const surface={setPointerCapture(){captured=true;captures++;},hasPointerCapture(){return captured;},releasePointerCapture(){captured=false;releases++;}};
  const event=(x,buttons)=>({button:0,buttons,pointerId:9,pointerType:'mouse',clientX:x,clientY:1,currentTarget:surface,target:{closest(){return null;}}});
  const region=()=>view.byLabel('可平移缩放的填空标志词导图');
  region().props.onPointerDown(event(1,1));assert.equal(captures,1,'background captures before reaching the movement threshold');
  region().props.onPointerUp(event(-5,0));assert.equal(releases,1);
  const initial=view.byClass('clozeMapStage').props.style.transform;
  region().props.onPointerMove(event(90,0));view.render();assert.equal(view.byClass('clozeMapStage').props.style.transform,initial);
  region().props.onPointerDown(event(1,1));
  region().props.onPointerMove(event(90,0));view.render();assert.equal(view.byClass('clozeMapStage').props.style.transform,initial,'a missing release is defensively cleared when no mouse button is held');
  assert.equal(releases,2);
 }finally{view.unmount();}
});

function illustratedClassroomRow(){
 const value=classroomRow();value.content.questions[0].images=[{id:'image-one',caption:'课堂笔记原图'}];
 value.content.questions.push({id:'q2',stem:'第二道课堂原题',images:[{id:'image-two'}],source:{course:'测试课堂',page:2}});
 value.content.root.children[0].children[0].questionIds.push('q2');return value;
}
const classroomImage=(id,data='cHJpdmF0ZS1pbWFnZQ==')=>({id,mimeType:'image/png',data,width:1000,height:1400});

test('classroom images load only for the opened question and default to the screenshot reader',async()=>{
 const view=componentHarness();try{
  view.calls[0].resolve(illustratedClassroomRow());await view.flush();assert.equal(view.imageCalls.length,0);
  view.find('button','规则甲').props.onClick({detail:0});view.render();assert.equal(view.imageCalls.length,1);assert.equal(view.imageCalls[0].imageId,'image-one');
  assert.doesNotMatch(view.text(),/课堂原题 ____/);view.imageCalls[0].resolve(classroomImage('image-one'));await view.flush();
  assert.match(view.find('img','').props.src,/^data:image\/png;base64,/);
  view.byLabel('展开课堂截图').props.onClick();view.render();assert.match(view.byClass('clozeMapWorkspace').props.className,/isReadingImage/);
  view.find('button','原尺寸').props.onClick();view.render();assert.equal(view.byClass('clozeMapImageOpen').props.style.width,1000);
  view.find('button','文字版').props.onClick();view.render();assert.equal(view.find('img',''),undefined);assert.equal(view.imageCalls[0].signal.aborted,true);assert.match(view.text(),/课堂原题 ____/);
 }finally{view.unmount();}
});

test('switching questions or accounts hides image bytes immediately and ignores cancelled responses',async()=>{
 const view=componentHarness();try{
  view.calls[0].resolve(illustratedClassroomRow());await view.flush();view.find('button','规则甲').props.onClick({detail:0});view.render();
  view.imageCalls[0].resolve(classroomImage('image-one','b2xkLWFjY291bnQ='));await view.flush();assert.ok(view.find('img',''));
  view.find('button','题 2').props.onClick();view.render(false);assert.equal(view.find('img',''),undefined);view.render();assert.equal(view.imageCalls[0].signal.aborted,true);
  assert.equal(view.imageCalls[1].imageId,'image-two');view.updateSession(session('b'),false);assert.equal(view.find('img',''),undefined);view.render();assert.equal(view.imageCalls[1].signal.aborted,true);
  view.imageCalls[1].resolve(classroomImage('image-two'));view.calls[1].resolve({...row(),title:'新账号导图'});await view.flush();assert.equal(view.find('img',''),undefined);assert.match(view.text(),/新账号导图/);
 }finally{view.unmount();}
});

test('a failed screenshot can retry and closing the reader cancels its pending image request',async()=>{
 const view=componentHarness();try{
  view.calls[0].resolve(illustratedClassroomRow());await view.flush();view.find('button','规则甲').props.onClick({detail:0});view.render();
  view.imageCalls[0].reject(Error('截图读取失败'));await view.flush();assert.match(view.text(),/截图读取失败/);
  view.find('button','重新读取截图').props.onClick();view.render();assert.equal(view.imageCalls.length,2);assert.equal(view.imageCalls[0].signal.aborted,true);
  view.byLabel('关闭侧栏').props.onClick();view.render();assert.equal(view.imageCalls[1].signal.aborted,true);
  view.imageCalls[1].resolve(classroomImage('image-one'));await view.flush();assert.equal(view.find('img',''),undefined);
 }finally{view.unmount();}
});

test('fullscreen calls the browser API and an unsupported browser retains the full viewport view',async()=>{
 const view=componentHarness(),before=globalThis.document;
 try{
  let requested=0,exited=0;const host={requestFullscreen(){requested++;return Promise.resolve();}};
  view.byClass('clozeMapOverlay').props.ref.current=host;
  globalThis.document={fullscreenElement:null,exitFullscreen(){exited++;return Promise.resolve();}};
  await view.find('button','全屏').props.onClick();assert.equal(requested,1);
  globalThis.document.fullscreenElement=host;await view.find('button','全屏').props.onClick();assert.equal(exited,1);
  globalThis.document.fullscreenElement=null;delete host.requestFullscreen;await view.find('button','全屏').props.onClick();view.render();assert.match(view.text(),/已铺满当前浏览器窗口/);
 }finally{globalThis.document=before;view.unmount();}
});

function controlledClickTimers(){
 const originalSet=globalThis.setTimeout,originalClear=globalThis.clearTimeout,timers=new Map();let now=0,nextId=0;
 globalThis.setTimeout=(run,delay)=>{const id=++nextId;timers.set(id,{run,at:now+delay});return id;};
 globalThis.clearTimeout=id=>timers.delete(id);
 return {advance(ms){now+=ms;for(const [id,timer] of [...timers].sort((a,b)=>a[1].at-b[1].at)){if(timer.at<=now&&timers.has(id)){timers.delete(id);timer.run();}}},count:()=>timers.size,restore(){globalThis.setTimeout=originalSet;globalThis.clearTimeout=originalClear;}};
}
function nodePointerEvent(type='mouse'){
 return {button:0,buttons:1,pointerId:1,pointerType:type,clientX:100,clientY:100,target:{closest(){return {matches(){return false;}};}},currentTarget:{setPointerCapture(){},hasPointerCapture(){return false;},releasePointerCapture(){}}};
}
test('a full physical double-click sequence keeps the first hit target still and focuses that same branch',async()=>{
 const view=componentHarness(),clock=controlledClickTimers();try{
  view.calls[0].resolve(row());await view.flush();view.find('button','第一分支').props.onClick({detail:0});view.render();
  const before={...view.byClass('clozeMapStage').props.style},region=()=>view.byLabel('可平移缩放的填空标志词导图');
  region().props.onPointerDown(nodePointerEvent());region().props.onPointerUp(nodePointerEvent());
  view.find('button','第一分支').props.onClick({detail:1,nativeEvent:{pointerType:'mouse'}});view.render();
  assert.equal(view.find('button','第一分支').props['aria-expanded'],false);assert.deepEqual(view.byClass('clozeMapStage').props.style,before,'the first click must not reflow the physical second-click target');
  clock.advance(100);view.render();assert.deepEqual(view.byClass('clozeMapStage').props.style,before);
  region().props.onPointerDown(nodePointerEvent());region().props.onPointerUp(nodePointerEvent());
  view.find('button','第一分支').props.onClick({detail:2,nativeEvent:{pointerType:'mouse'}});view.render();
  view.find('button','第一分支').props.onDoubleClick({detail:2,preventDefault(){}});view.render();
  assert.equal(view.find('button','第一分支').props['aria-expanded'],true);assert.equal(view.find('button','第一分支').props['aria-pressed'],true);assert.equal(view.find('button','第二分支').props['aria-pressed'],false);
  assert.match(view.text(),/规则甲/);assert.equal(clock.count(),0);
  clock.advance(500);view.render();assert.equal(view.find('button','第一分支').props['aria-expanded'],true,'no delayed single-click may collapse the focused branch');
 }finally{view.unmount();clock.restore();}
});
test('mouse single clicks wait once while touch and keyboard node activation remain immediate',async()=>{
 const view=componentHarness(),clock=controlledClickTimers();try{
  view.calls[0].resolve(row());await view.flush();view.find('button','第一分支').props.onClick({detail:0});view.render();
  view.find('button','第一分支').props.onClick({detail:1,nativeEvent:{pointerType:'mouse'}});view.render();
  clock.advance(259);view.render();assert.equal(view.find('button','第一分支').props['aria-expanded'],false);
  clock.advance(1);view.render();assert.equal(view.find('button','第一分支').props['aria-expanded'],true);assert.equal(clock.count(),0);
  view.byLabel('可平移缩放的填空标志词导图').props.onPointerDown(nodePointerEvent('touch'));
  view.find('button','第一分支').props.onClick({detail:1,nativeEvent:{pointerType:'touch'}});view.render();assert.equal(view.find('button','第一分支').props['aria-expanded'],false);assert.equal(clock.count(),0);
  view.find('button','第一分支').props.onClick({detail:0});view.render();assert.equal(view.find('button','第一分支').props['aria-expanded'],true);assert.equal(clock.count(),0);
 }finally{view.unmount();clock.restore();}
});
test('account changes and unmount cancel pending mouse node actions',async()=>{
 const view=componentHarness(),clock=controlledClickTimers();try{
  view.calls[0].resolve(row());await view.flush();view.find('button','第一分支').props.onClick({detail:1,nativeEvent:{pointerType:'mouse'}});assert.equal(clock.count(),1);
  view.updateSession(session('b'));assert.equal(clock.count(),0);clock.advance(500);view.render();assert.doesNotMatch(view.text(),/第一分支/);
  view.calls[1].resolve(row());await view.flush();view.find('button','第一分支').props.onClick({detail:1,nativeEvent:{pointerType:'mouse'}});assert.equal(clock.count(),1);
  view.unmount();assert.equal(clock.count(),0);
 }finally{view.unmount();clock.restore();}
});
