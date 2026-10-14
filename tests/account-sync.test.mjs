import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const ts=createRequire(import.meta.url)('typescript');
const compile=(file)=>ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const planModule={exports:{}};
new Function('exports','module',compile('community/workspacePlan.ts'))(planModule.exports,planModule);
const snapshot=(note)=>({version:1,rows:[],storage:{note}});
function harness(){
 const slots=[],effects=[],cache=new Map(),remote=new Map(),writes=[];
 let cursor=0,pending=[],authListener,change=()=>{},payload=snapshot('blank'),session=null,offline=false,result;
 const react={
  useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},
  useRef(initial){const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i];},
  useEffect(fn,deps){const i=cursor++,previous=effects[i];if(!previous||deps.some((value,n)=>!Object.is(value,previous.deps[n]))){pending.push(()=>{previous?.cleanup?.();effects[i]={deps,cleanup:fn()};});}}
 };
 const auth={onAuthStateChange(fn){authListener=fn;return {data:{subscription:{unsubscribe(){}}}};},async getSession(){return {data:{session}};},async signOut(){session=null;authListener('SIGNED_OUT',null);return {error:null};}};
 const imports={react,
  './cloud':{cloud:{auth},async readCloudWorkspace(s){if(offline)throw Error('offline');return structuredClone(remote.get(s.user.id)??null);},async saveCloudWorkspace(s,value,expected){if(offline)throw Error('offline');const latest=remote.get(s.user.id);if((latest?.revision??0)!==expected)throw Error('conflict');const revision=expected+1;remote.set(s.user.id,{revision,payload:structuredClone(value)});writes.push(s.user.id);return revision;}},
  './database':{exportWorkspace:()=>structuredClone(payload),async openWorkspace(next){payload=structuredClone(next??snapshot('blank'));},onWorkspaceChange(fn){change=fn;}},
  './localWorkspace':{async readLocalWorkspace(key='local'){return structuredClone(cache.get(key));},async saveLocalWorkspace(value,expected,key='local',metadata={}){if((cache.get(key)?.revision??0)!==expected)throw Error('cache conflict');cache.set(key,{revision:expected+1,payload:structuredClone(value),...metadata});return expected+1;}},
  './api':{async switchWorkspace(fn){await fn();}},'./workspacePlan':planModule.exports
 };
 const module={exports:{}};new Function('require','module','exports',compile('community/useLearningWorkspace.ts'))(name=>imports[name],module,module.exports);
 globalThis.window={addEventListener(){},removeEventListener(){},confirm:()=>true};globalThis.document={addEventListener(){},removeEventListener(){},visibilityState:'visible'};
 function render(){cursor=0;result=module.exports.default(()=>{});const tasks=pending;pending=[];tasks.forEach(fn=>fn());return result;}
 async function settle(){for(let i=0;i<14;i++){render();await new Promise(resolve=>setImmediate(resolve));}return render();}
 return {cache,remote,writes,settle,get workspace(){return result;},get note(){return payload.storage.note;},edit(note){payload=snapshot(note);change();},login(id){session={user:{id,email:id+'@example.test'},access_token:id};authListener('SIGNED_IN',session);},setOffline(value){offline=value;},dispose(){effects.forEach(e=>e?.cleanup?.());delete globalThis.window;delete globalThis.document;}};
}
test('login reads account data before writing, and logout restores the separate guest workspace',async()=>{
 const h=harness();try{
  await h.settle();h.edit('guest note');await h.workspace.flush();
  h.remote.set('A',{revision:3,payload:snapshot('account A')});h.login('A');await h.settle();
  assert.equal(h.note,'account A');assert.deepEqual(h.writes,[]);
  h.edit('A updated');await h.workspace.flush();assert.equal(h.remote.get('A').payload.storage.note,'A updated');
  await h.workspace.signOut();await h.settle();assert.equal(h.note,'guest note');
  h.login('B');await h.settle();assert.equal(h.note,'blank');assert.equal(h.workspace.emptyCloud,true);assert.equal(h.remote.has('B'),false);
 }finally{h.dispose();}
});
test('offline changes survive logout and a newer cloud version creates a recoverable conflict',async()=>{
 const h=harness();try{
  await h.settle();h.remote.set('A',{revision:2,payload:snapshot('base')});h.login('A');await h.settle();
  h.setOffline(true);h.edit('offline edit');assert.equal(await h.workspace.flush(),false);
  await h.workspace.signOut();await h.settle();h.setOffline(false);
  h.remote.set('A',{revision:3,payload:snapshot('other device')});h.login('A');await h.settle();
  assert.equal(h.note,'other device');assert.equal(h.workspace.conflict.storage.note,'offline edit');
  assert.equal(h.cache.get('conflict:A').payload.storage.note,'offline edit');assert.deepEqual(h.writes,[]);
  assert.equal(h.cache.get('account:A').payload.storage.note,'other device');
 }finally{h.dispose();}
});
test('the latest cloud version is cached for offline use, and a failed read blocks uploads',async()=>{
 const h=harness();try{
  await h.settle();h.remote.set('A',{revision:5,payload:snapshot('latest')});h.login('A');await h.settle();
  await h.workspace.signOut();await h.settle();h.setOffline(true);h.login('A');await h.settle();
  assert.equal(h.note,'latest');h.edit('offline later');assert.equal(await h.workspace.flush(),false);assert.deepEqual(h.writes,[]);
  h.setOffline(false);await h.workspace.reload();await h.settle();assert.equal(h.note,'offline later');
  await h.workspace.flush();assert.equal(h.remote.get('A').payload.storage.note,'offline later');
 }finally{h.dispose();}
});
