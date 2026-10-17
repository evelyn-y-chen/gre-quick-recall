import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import {loadTs} from './helpers/load-ts.mjs';

const compile=file=>ts.transpileModule(fs.readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const model={};new Function('exports',compile('../app/ratingSyncModel.ts'))(model);
const clone=value=>JSON.parse(JSON.stringify(value));

// Real component + model; only hooks, in-memory API, browser timers and the
// persistence boundary are substituted. No account or browser data is read.
function ratingView(options={}){
 let hooks=[],effects=[],cursor=0,dirty=false,tree,generation=1,mounted=true;
 let ratings=clone(options.local??{}),db=clone(options.db??{}),persistResult=options.persistResult??{destination:'account',synced:true};
 const timers=new Map(),gets=[],puts=[],persists=[],loaded=[],durable=[];let nextTimer=0;
 const storage={};new Function('exports',compile('../community/storage.ts'))(storage);
 storage.loadStorage({'gre-quick-ratings-v1':JSON.stringify(ratings),...(options.storage??{})});
 const react={
  useRef(initial){const i=cursor++;return hooks[i]??(hooks[i]={current:initial});},
  useState(initial){const i=cursor++;if(!(i in hooks))hooks[i]=typeof initial==='function'?initial():initial;return [hooks[i],value=>{const next=typeof value==='function'?value(hooks[i]):value;if(!Object.is(next,hooks[i])){hooks[i]=next;dirty=true;}}];},
  useEffect(effect,deps){const i=cursor++,old=hooks[i];if(!old||!deps||deps.some((value,n)=>!Object.is(value,old.deps?.[n]))){hooks[i]={deps,cleanup:old?.cleanup};effects.push(()=>{hooks[i].cleanup?.();hooks[i].cleanup=effect();});}},
 };
 const jsx=(type,props)=>({type,props:props??{}});
 const setTimeout=(fn,delay)=>{assert.equal(delay,200);const id=++nextTimer;timers.set(id,fn);return id;};
 const clearTimeout=id=>timers.delete(id);
 function deferred(record){return new Promise((resolve,reject)=>Object.assign(record,{resolve,reject}));}
 const api={getWorkspaceGeneration:()=>generation,async appFetch(url,init){
  if(init?.method==='PUT'){
   const record={generation,body:JSON.parse(init.body)};puts.push(record);
   if(options.deferPut)return deferred(record);
   Object.assign(db,record.body.ratings);return Response.json({saved:true});
  }
  const record={generation,value:clone(db)};gets.push(record);
  return options.deferGet?deferred(record):Response.json({ratings:record.value});
 }};
 const persistence={async persistLearningWorkspace(expected){
  assert.equal(expected,generation,'Bridge must only be called for the current workspace');
  const record={generation:expected,db:clone(db),storage:storage.exportStorage()};persists.push(record);
  const result=options.deferPersist?await deferred(record):persistResult;
  if(result.synced)durable.push(record);return result;
 }};
 const dependencies={'../community/ratingMerge':loadTs('community/ratingMerge.ts'),'./ratingStorage':loadTs('app/ratingStorage.ts'),'react':react,'react/jsx-runtime':{jsx,jsxs:jsx},'../community/storage':storage,'../community/api':api,'../community/workspacePersistence':persistence,'./ratingSyncModel':model};
 const component={};new Function('require','exports','setTimeout','clearTimeout',compile('../app/RatingCloudSync.tsx'))(name=>{assert.ok(name in dependencies,name);return dependencies[name];},component,setTimeout,clearTimeout);
 function render(){if(!mounted)return;for(let n=0;n<15;n++){cursor=0;dirty=false;tree=component.default({module:'words',ratings,onLoad(value){loaded.push(clone(value));ratings=value;storage.studyStorage.setItem('gre-quick-ratings-v1',JSON.stringify(value));dirty=true;}});while(effects.length)effects.shift()();if(!dirty)return;}throw Error('Hook host did not settle');}
 function nodes(node){if(node==null||typeof node!=='object')return [];return Array.isArray(node)?node.flatMap(nodes):[node,...nodes(node.props?.children)];}
 function text(node){if(node==null||typeof node==='boolean')return '';if(Array.isArray(node))return node.map(text).join('');return typeof node==='object'?text(node.props?.children):String(node);}
 async function settle(){for(let n=0;n<8;n++){render();await new Promise(resolve=>setImmediate(resolve));}render();}
 render();
 return {
  gets,puts,persists,loaded,durable,settle,
  get ratings(){return clone(ratings);},get db(){return clone(db);},get timerCount(){return timers.size;},
  status:()=>text(nodes(tree).find(node=>node.props?.role==='status')),
  pending:()=>JSON.parse(storage.studyStorage.getItem('gre-rating-cloud-pending:words')??'{}'),
  snapshot:()=>storage.exportStorage(),
  async edit(next){ratings={...ratings,...next};storage.studyStorage.setItem('gre-quick-ratings-v1',JSON.stringify(ratings));await settle();},
  async flush(){const pending=[...timers.values()];timers.clear();for(const fn of pending)fn();await settle();},
  async retry(){const button=nodes(tree).find(node=>node.type==='button'&&text(node).startsWith('重试'));assert.ok(button,'Expected a retry button');assert.equal(!!button.props.disabled,false);button.props.onClick();await settle();},
  async releaseGet(index=0,status=200){const record=gets[index];record.resolve(Response.json(status===200?{ratings:record.value}:{error:'failure'},{status}));await settle();},
  async releasePut(index=0,status=200){const record=puts[index];if(status===200)Object.assign(db,record.body.ratings);record.resolve(Response.json(status===200?{saved:true}:{error:'failure'},{status}));await settle();},
  async releasePersist(index=0,result={destination:'account',synced:true}){persists[index].resolve(result);await settle();},
  setPersistResult(value){persistResult=value;},
  switchWorkspace(next={}){generation++;storage.loadStorage(next);},
  close(){mounted=false;for(const hook of hooks)hook?.cleanup?.();},
 };
}

test('newer workspace storage ratings survive an older SQL snapshot and auto-converge',async()=>{
 const view=ratingView({local:{word:'familiar'},db:{word:'unknown'}});
 try{await view.settle();assert.deepEqual(view.ratings,{word:'familiar'});assert.deepEqual(view.pending(),{word:'familiar'});assert.equal(view.puts.length,0);await view.flush();assert.deepEqual(view.db,{word:'familiar'});assert.deepEqual(view.pending(),{});assert.match(view.status(),/已同步到账号/);assert.equal(view.durable.length,1);}finally{view.close();}
});

test('empty SQL keeps existing local ratings, and an empty workspace never uploads an empty overwrite',async()=>{
 const populated=ratingView({local:{one:'fuzzy'}}),empty=ratingView();
 try{await populated.settle();await populated.flush();assert.deepEqual(populated.db,{one:'fuzzy'});await empty.settle();await empty.flush();assert.equal(empty.puts.length,0);assert.deepEqual(empty.ratings,{});}finally{populated.close();empty.close();}
});

test('clicks auto-save after debounce, and HTTP 200 alone never claims account sync',async()=>{
 const view=ratingView({deferPersist:true});
 try{await view.settle();await view.edit({one:'unknown'});await view.edit({one:'familiar',two:'fuzzy'});assert.equal(view.timerCount,1);assert.equal(view.puts.length,0);await view.flush();assert.equal(view.puts.length,1);assert.deepEqual(view.puts[0].body.ratings,{one:'familiar',two:'fuzzy'});assert.doesNotMatch(view.status(),/已同步到账号/);assert.deepEqual(view.pending(),{one:'familiar',two:'fuzzy'});await view.releasePersist();assert.deepEqual(view.pending(),{});assert.match(view.status(),/已同步到账号/);}finally{view.close();}
});

test('ratings changed during PUT and persistence remain pending for a following batch',async()=>{
 const view=ratingView({deferPut:true,deferPersist:true});
 try{await view.settle();await view.edit({one:'unknown'});await view.flush();await view.edit({one:'familiar',two:'fuzzy'});assert.equal(view.puts.length,1);await view.releasePut();assert.equal(view.persists.length,1);await view.releasePersist();assert.deepEqual(view.pending(),{one:'familiar',two:'fuzzy'});assert.equal(view.timerCount,1);await view.flush();assert.deepEqual(view.puts[1].body.ratings,{one:'familiar',two:'fuzzy'});await view.releasePut(1);await view.releasePersist(1);assert.deepEqual(view.pending(),{});assert.deepEqual(view.db,{one:'familiar',two:'fuzzy'});}finally{view.close();}
});

test('API failure preserves pending ratings and offers an explicit successful retry',async()=>{
 const view=ratingView({deferPut:true});
 try{await view.settle();await view.edit({one:'familiar'});await view.flush();await view.releasePut(0,500);assert.deepEqual(view.pending(),{one:'familiar'});assert.equal(view.timerCount,0);assert.match(view.status(),/保存尚未完成/);await view.retry();await view.releasePut(1);assert.deepEqual(view.pending(),{});assert.match(view.status(),/已同步到账号/);}finally{view.close();}
});

test('account upload failure confirms only local persistence, retains pending and retries',async()=>{
 const view=ratingView({persistResult:{destination:'account',synced:false,message:'已保存到本机，账号同步待重试。'}});
 try{await view.settle();await view.edit({one:'fuzzy'});await view.flush();assert.deepEqual(view.pending(),{one:'fuzzy'});assert.match(view.status(),/已保存到本机/);assert.doesNotMatch(view.status(),/已同步到账号/);assert.equal(view.timerCount,0);view.setPersistResult({destination:'account',synced:true});await view.retry();assert.deepEqual(view.pending(),{});assert.match(view.status(),/已同步到账号/);}finally{view.close();}
});

test('guest persistence reports this device and uses the same automatic flow',async()=>{
 const view=ratingView({persistResult:{destination:'device',synced:true}});
 try{await view.settle();await view.edit({one:'familiar'});await view.flush();assert.match(view.status(),/已保存到这台设备/);assert.doesNotMatch(view.status(),/已同步到账号/);assert.deepEqual(view.pending(),{});}finally{view.close();}
});

test('editing after a failed first read clearly waits for retry and then auto-saves',async()=>{
 const view=ratingView({deferGet:true});
 try{await view.releaseGet(0,500);await view.edit({one:'familiar'});assert.match(view.status(),/标记已暂存.*重试读取/);assert.doesNotMatch(view.status(),/^正在自动保存/);assert.equal(view.puts.length,0);assert.equal(view.timerCount,0);assert.deepEqual(view.pending(),{one:'familiar'});await view.retry();await view.releaseGet(1);await view.flush();assert.deepEqual(view.db,{one:'familiar'});assert.deepEqual(view.pending(),{});assert.match(view.status(),/已同步到账号/);}finally{view.close();}
});

test('stale generation GET cannot hydrate or overwrite a different workspace',async()=>{
 const view=ratingView({local:{one:'familiar'},db:{one:'unknown'},deferGet:true});
 try{view.switchWorkspace({'new-space':'safe'});await view.releaseGet();assert.equal(view.loaded.length,0);assert.deepEqual(view.snapshot(),{'new-space':'safe'});assert.equal(view.puts.length,0);}finally{view.close();}
});

test('stale generation PUT never calls persistence or clears the next workspace pending',async()=>{
 const view=ratingView({deferPut:true});
 try{await view.settle();await view.edit({one:'familiar'});await view.flush();view.switchWorkspace({'gre-rating-cloud-pending:words':'{"other":"fuzzy"}'});await view.releasePut();assert.equal(view.persists.length,0);assert.deepEqual(view.pending(),{other:'fuzzy'});await view.edit({late:'unknown'});assert.equal(view.puts.length,1);assert.deepEqual(view.pending(),{other:'fuzzy'});}finally{view.close();}
});

test('unmount during persistence never clears a saved draft or announces completion',async()=>{
 const view=ratingView({deferPersist:true});
 await view.settle();await view.edit({one:'familiar'});await view.flush();const status=view.status();view.close();await view.releasePersist();assert.deepEqual(view.pending(),{one:'familiar'});assert.equal(view.status(),status);
});
