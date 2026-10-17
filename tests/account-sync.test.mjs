import test from 'node:test';
import {loadTs} from './helpers/load-ts.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const ts=createRequire(import.meta.url)('typescript');
const compile=(file)=>ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const validation={exports:{}};new Function('require','module','exports',compile('community/database.ts'))(()=>({}),validation,validation.exports);
const recovery={exports:{}};new Function('require','module','exports',compile('community/workspaceRecovery.ts'))(()=>validation.exports,recovery,recovery.exports);
const planModule={exports:{}};
planModule.exports=loadTs('community/workspacePlan.ts');
const snapshot=(note)=>({version:1,rows:[],storage:{note}});
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
function harness(sharedRemote=new Map()){
 const slots=[],effects=[],cache=new Map(),remote=sharedRemote,writes=[];
 let cursor=0,pending=[],authListener,change=()=>{},payload=snapshot('blank'),session=null,offline=false,result,localFailure=()=>false,saveGate=null,readGate=null,apiQueue=Promise.resolve(),apiGeneration=0;
 const persistence={exports:{}};new Function('exports','module',compile('community/workspacePersistence.ts'))(persistence.exports,persistence);
 const react={
  useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},
  useRef(initial){const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i];},
  useEffect(fn,deps){const i=cursor++,previous=effects[i];if(!previous||deps.some((value,n)=>!Object.is(value,previous.deps[n]))){pending.push(()=>{previous?.cleanup?.();effects[i]={deps,cleanup:fn()};});}}
 };
 const auth={onAuthStateChange(fn){authListener=fn;return {data:{subscription:{unsubscribe(){}}}};},async getSession(){return {data:{session}};},async signOut(){session=null;authListener('SIGNED_OUT',null);return {error:null};}};
 const imports={react,
  './cloud':{cloud:{auth},async readCloudWorkspace(s){if(readGate){const held=readGate;readGate=null;held.entered.resolve();await held.release.promise;}if(offline)throw Error('offline');return structuredClone(remote.get(s.user.id)??null);},async saveCloudWorkspace(s,value,expected){if(saveGate){const held=saveGate;saveGate=null;held.entered.resolve();await held.release.promise;}if(offline)throw Error('offline');const latest=remote.get(s.user.id);if((latest?.revision??0)!==expected)throw Object.assign(Error('conflict'),{code:'WORKSPACE_CONFLICT'});const revision=expected+1;remote.set(s.user.id,{revision,payload:structuredClone(value)});writes.push(s.user.id);return revision;}},
  './database':{exportWorkspace:()=>structuredClone(payload),async openWorkspace(next){payload=structuredClone(next??snapshot('blank'));},onWorkspaceChange(fn){change=fn;}},
  './localWorkspace':{async readLocalWorkspace(key='local'){return structuredClone(cache.get(key));},async saveLocalWorkspace(value,expected,key='local',metadata={}){if(localFailure(key))throw Error('local save failure');if((cache.get(key)?.revision??0)!==expected)throw Error('cache conflict');const {checkpoint,checkpoints,...rest}=metadata;let history=recovery.exports.appendCheckpoint(cache.get(key)?.history);for(const item of checkpoints??[])history=recovery.exports.appendCheckpoint(history,item);history=recovery.exports.appendCheckpoint(history,checkpoint);cache.set(key,{revision:expected+1,payload:structuredClone(value),...rest,...(history.length?{history:structuredClone(history)}:{})});return expected+1;}},
  './api':{awaitWorkspaceApiIdle:()=>apiQueue,getWorkspaceGeneration:()=>apiGeneration,async switchWorkspace(fn){apiGeneration++;const next=apiQueue.then(fn);apiQueue=next.catch(()=>{});await next;}},'./workspacePlan':planModule.exports,'./ratingMerge':loadTs('community/ratingMerge.ts'),'./workspacePersistence':persistence.exports,'./workspaceRecovery':recovery.exports
 };
 const browser={addEventListener(){},removeEventListener(){},confirm:()=>true},document={addEventListener(){},removeEventListener(){},visibilityState:'visible'};
 const module={exports:{}};new Function('require','module','exports','window','document',compile('community/useLearningWorkspace.ts'))(name=>imports[name],module,module.exports,browser,document);
 function render(){cursor=0;result=module.exports.default(()=>{});const tasks=pending;pending=[];tasks.forEach(fn=>fn());return result;}
 async function settle(){for(let i=0;i<14;i++){render();await new Promise(resolve=>setImmediate(resolve));}return render();}
 function hold(){const entered=deferred(),release=deferred();return {entered,release};}
 return {cache,remote,writes,settle,render,get workspace(){return result;},get note(){return payload.storage.note;},get snapshot(){return structuredClone(payload);},get apiGeneration(){return apiGeneration;},persist:(generation=apiGeneration)=>persistence.exports.persistLearningWorkspace(generation),edit(note){payload=snapshot(note);change();},editSnapshot(next){payload=structuredClone(next);change();},queueEdit(note,gate=Promise.resolve()){const epoch=apiGeneration;const next=apiQueue.then(async()=>{await gate;if(epoch!==apiGeneration)throw Error('stale API write');payload=snapshot(note);change();});apiQueue=next.catch(()=>{});return next;},holdCloud(){const gate=hold();saveGate=gate;return {entered:gate.entered.promise,release:gate.release.resolve};},holdRead(){const gate=hold();readGate=gate;return {entered:gate.entered.promise,release:gate.release.resolve};},failLocal(fn){localFailure=fn;},login(id){session={user:{id,email:id+'@example.test'},access_token:id};authListener('SIGNED_IN',session);},setOffline(value){offline=value;},dispose(){effects.forEach(e=>e?.cleanup?.());}};
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

test('reload never replaces unsaved memory when the browser save fails',async()=>{
 const h=harness();try{
  await h.settle();h.edit('saved baseline');await h.workspace.flush();
  h.edit('new red-yellow-green ratings');h.failLocal(()=>true);
  await h.workspace.reload();await h.settle();
  assert.equal(h.note,'new red-yellow-green ratings');assert.equal(h.cache.get('local').payload.storage.note,'saved baseline');
  assert.equal(h.workspace.ready,true);assert.match(h.workspace.status,/尚未保存到本机/);
  await assert.rejects(h.persist(),/local save failure/);
  h.failLocal(()=>false);assert.equal(await h.workspace.flush(),true);assert.equal(h.cache.get('local').payload.storage.note,h.note);
 }finally{h.dispose();}
});

test('edits arriving during a reload upload are durably saved before memory is replaced',async()=>{
 const h=harness();try{
  await h.settle();h.remote.set('A',{revision:2,payload:snapshot('baseline')});h.login('A');await h.settle();
  h.edit('ratings version N');const held=h.holdCloud(),reload=h.workspace.reload();await held.entered;h.render();
  assert.equal(h.workspace.ready,false);
  h.edit('ratings version N+1');held.release();await reload;await h.settle();
  assert.equal(h.note,'ratings version N+1');assert.equal(h.cache.get('account:A').payload.storage.note,h.note);
  assert.equal(h.remote.get('A').payload.storage.note,h.note);assert.equal(h.cache.get('account:A').pending,false);
 }finally{h.dispose();}
});

test('a failed conflict backup preserves the current pending snapshot instead of activating remote',async()=>{
 const h=harness();try{
  await h.settle();h.remote.set('A',{revision:2,payload:snapshot('baseline')});h.login('A');await h.settle();
  h.setOffline(true);h.edit('valuable offline ratings');assert.equal(await h.workspace.flush(),false);
  h.setOffline(false);h.remote.set('A',{revision:3,payload:snapshot('other device')});h.failLocal(key=>key.startsWith('conflict:'));
  await h.workspace.reload();await h.settle();
  assert.equal(h.note,'valuable offline ratings');assert.equal(h.cache.get('account:A').payload.storage.note,h.note);
  assert.equal(h.cache.has('conflict:A'),false);assert.equal(h.workspace.ready,true);
  h.edit('valuable offline ratings plus another rating');assert.equal(await h.workspace.flush(),false);
  assert.equal(h.cache.get('account:A').payload.storage.note,h.note);assert.equal(h.remote.get('A').payload.storage.note,'other device');
  h.failLocal(()=>false);await h.workspace.reload();await h.settle();
  assert.equal(h.note,'other device');assert.equal(h.workspace.conflict.storage.note,'valuable offline ratings plus another rating');
 }finally{h.dispose();}
});

test('flush waits for the queued rating PUT before checking dirty state and capturing its snapshot',async()=>{
 const h=harness();try{
  await h.settle();h.remote.set('A',{revision:2,payload:snapshot('baseline')});h.login('A');await h.settle();
  const gate=deferred(),write=h.queueEdit('queued rating',gate.promise),saved=h.workspace.flush();
  gate.resolve();await write;assert.equal(await saved,true);
  assert.equal(h.cache.get('account:A').payload.storage.note,'queued rating');assert.equal(h.remote.get('A').payload.storage.note,'queued rating');
 }finally{h.dispose();}
});

test('a late API write during cloud reading aborts replacement and retains the live snapshot',async()=>{
 const h=harness();try{
  await h.settle();h.remote.set('A',{revision:2,payload:snapshot('baseline')});h.login('A');await h.settle();
  const held=h.holdRead(),reload=h.workspace.reload();await held.entered;
  await h.queueEdit('late rating');held.release();await reload;await h.settle();
  assert.equal(h.note,'late rating');assert.equal(h.workspace.ready,true);assert.match(h.workspace.status,/记录又有更新/);
  assert.equal((await h.persist()).synced,true);assert.equal(h.remote.get('A').payload.storage.note,'late rating');
 }finally{h.dispose();}
});

test('the rating persistence bridge saves to the active account and reports offline pending honestly',async()=>{
 const h=harness();try{
  await assert.rejects(h.persist(),/尚未准备好/);await h.settle();
  h.edit('guest rating');assert.deepEqual(await h.persist(),{destination:'device',synced:true});
  h.remote.set('A',{revision:2,payload:snapshot('account baseline')});h.login('A');await h.settle();
  h.edit('account rating');assert.deepEqual(await h.persist(),{destination:'account',synced:true});assert.equal(h.remote.get('A').payload.storage.note,'account rating');
  h.setOffline(true);h.edit('offline rating');const pending=await h.persist();assert.equal(pending.destination,'account');assert.equal(pending.synced,false);assert.match(pending.message,/已保存到本机.*账号同步/);
  assert.equal(h.cache.get('account:A').payload.storage.note,'offline rating');assert.equal(h.cache.get('account:A').pending,true);
  h.setOffline(false);assert.equal((await h.persist()).synced,true);assert.equal(h.remote.get('A').payload.storage.note,'offline rating');
 }finally{h.dispose();}
 await assert.rejects(h.persist(),/尚未准备好/);
});

test('a queued persistence request cannot write its former account into the next workspace',async()=>{
 const h=harness();try{
  await h.settle();h.remote.set('A',{revision:2,payload:snapshot('A baseline')});h.remote.set('B',{revision:4,payload:snapshot('B baseline')});h.login('A');await h.settle();
  const oldGeneration=h.apiGeneration;h.edit('A pending');const held=h.holdCloud(),saving=h.workspace.flush();await held.entered;
  h.login('B');h.render();const stale=h.persist(oldGeneration).then(()=>null,error=>error);
  held.release();await saving;await h.settle();assert.match((await stale).message,/学习空间已切换/);
  assert.equal(h.note,'B baseline');assert.equal(h.remote.get('A').payload.storage.note,'A pending');assert.equal(h.remote.get('B').payload.storage.note,'B baseline');
  await assert.rejects(h.persist(oldGeneration),/学习空间已切换/);
 }finally{h.dispose();}
});

test('a missing local copy plus failed account read cannot activate a misleading empty account',async()=>{
 const h=harness();try{
  await h.settle();h.edit('guest records');await h.workspace.flush();h.setOffline(true);h.login('A');await h.settle();
  assert.equal(h.note,'guest records');assert.equal(h.workspace.ready,false);assert.match(h.workspace.status,/没有该账号的本机副本/);
  assert.equal(h.remote.has('A'),false);assert.equal(h.cache.has('account:A'),false);
 }finally{h.dispose();}
});

test('logout refuses to discard the current account when its latest edits cannot be saved locally',async()=>{
 const h=harness();try{
  await h.settle();h.remote.set('A',{revision:2,payload:snapshot('baseline')});h.login('A');await h.settle();
  h.edit('unsaved account rating');h.failLocal(()=>true);await h.workspace.signOut();await h.settle();
  assert.equal(h.workspace.session.user.id,'A');assert.equal(h.note,'unsaved account rating');assert.match(h.workspace.status,/已保留当前账号和记录/);
  h.failLocal(()=>false);await h.workspace.signOut();await h.settle();
  assert.equal(h.workspace.session,null);assert.equal(h.remote.get('A').payload.storage.note,'unsaved account rating');
 }finally{h.dispose();}
});

const ratingSnapshot=(values,at)=>{const payload={version:1,rows:[],storage:{'gre-quick-ratings-v1':JSON.stringify(values)}};loadTs('community/ratingMerge.ts').stampRatingChanges({getItem:k=>payload.storage[k]??null,setItem:(k,v)=>payload.storage[k]=v},'words',values,at);return payload;};
test('two signed-in devices automatically combine changes to different words instead of replacing',async()=>{
 const shared=new Map([['A',{revision:1,payload:ratingSnapshot({},1)}]]),phone=harness(shared),tablet=harness(shared);
 try{await phone.settle();phone.login('A');await phone.settle();await tablet.settle();tablet.login('A');await tablet.settle();
  phone.editSnapshot(ratingSnapshot({one:'familiar'},100));tablet.editSnapshot(ratingSnapshot({two:'familiar'},200));
  assert.equal(await phone.workspace.flush(),true);assert.equal(await tablet.workspace.flush(),true);
  assert.deepEqual(JSON.parse(shared.get('A').payload.storage['gre-quick-ratings-v1']),{two:'familiar',one:'familiar'});
  await phone.workspace.reload();await phone.settle();assert.deepEqual(JSON.parse(phone.snapshot.storage['gre-quick-ratings-v1']),{two:'familiar',one:'familiar'});
  // A further edit must not erase the remote word that was absent from the live UI.
  tablet.editSnapshot(ratingSnapshot({two:'familiar',three:'fuzzy'},300));assert.equal(await tablet.workspace.flush(),true);
  assert.deepEqual(JSON.parse(shared.get('A').payload.storage['gre-quick-ratings-v1']),{two:'familiar',three:'fuzzy',one:'familiar'});
  await phone.workspace.reload();await phone.settle();await tablet.workspace.reload();await tablet.settle();
  const merged={two:'familiar',three:'fuzzy',one:'familiar'};assert.deepEqual(JSON.parse(phone.snapshot.storage['gre-quick-ratings-v1']),merged);assert.deepEqual(JSON.parse(tablet.snapshot.storage['gre-quick-ratings-v1']),merged);
 }finally{phone.dispose();tablet.dispose();}
});
test('offline pending ratings merge after another device updates the account',async()=>{
 const h=harness();try{await h.settle();h.remote.set('A',{revision:1,payload:ratingSnapshot({},1)});h.login('A');await h.settle();
  h.setOffline(true);h.editSnapshot(ratingSnapshot({one:'familiar'},100));assert.equal(await h.workspace.flush(),false);
  assert.ok(h.cache.get('account:A').basePayload);h.setOffline(false);h.remote.set('A',{revision:2,payload:ratingSnapshot({two:'familiar'},200)});
  await h.workspace.reload();await h.settle();assert.deepEqual(JSON.parse(h.snapshot.storage['gre-quick-ratings-v1']),{one:'familiar',two:'familiar'});
  assert.equal(h.workspace.conflict,null);assert.equal(await h.workspace.flush(),true);assert.deepEqual(JSON.parse(h.remote.get('A').payload.storage['gre-quick-ratings-v1']),{one:'familiar',two:'familiar'});
 }finally{h.dispose();}
});

test('ratings-only import waits for queued writes before capturing existing progress',async()=>{
 const h=harness();try{await h.settle();h.remote.set('A',{revision:1,payload:ratingSnapshot({},1)});h.login('A');await h.settle();
  h.editSnapshot(ratingSnapshot({one:'familiar'},100));await h.workspace.flush();
  const incoming=ratingSnapshot({two:'familiar'},200);await h.workspace.mergeRatings(incoming);await h.settle();
  assert.deepEqual(JSON.parse(h.remote.get('A').payload.storage['gre-quick-ratings-v1']),{one:'familiar',two:'familiar'});
 }finally{h.dispose();}
});
test('a note conflict keeps a durable local pending copy and never replaces the remote note',async()=>{
 const h=harness();try{await h.settle();h.remote.set('A',{revision:1,payload:snapshot('baseline')});h.login('A');await h.settle();h.edit('local changed');h.remote.set('A',{revision:2,payload:snapshot('remote changed')});
  assert.equal(await h.workspace.flush(),false);assert.equal(h.cache.get('account:A').pending,true);assert.equal(h.cache.get('account:A').payload.storage.note,'local changed');assert.equal(h.remote.get('A').payload.storage.note,'remote changed');
 }finally{h.dispose();}
});


test('replacement atomically keeps the live notes, drafts and ratings as an undo checkpoint',async()=>{
 const h=harness();try{await h.settle();h.remote.set('A',{revision:1,payload:snapshot('old account')});h.login('A');await h.settle();
 const valuable={version:1,rows:[{key:'word-memory:example',value:'new BB note',revision:1,updated_at:'2026-10-17'}],storage:{'gre-bb-ratings-v1':'{"bb-one":"familiar"}','gre-shared-word-memory-drafts-v1':'{"other":{"text":"unfinished note","revision":0}}'}};
 h.editSnapshot(valuable);await h.workspace.replace(snapshot('imported old file'));await h.settle();
 assert.equal(h.note,'imported old file');assert.deepEqual(h.cache.get('account:A').history.at(-1).payload,valuable);
 h.edit('one more change');await h.workspace.flush();assert.deepEqual(h.cache.get('account:A').history.at(-1).payload,valuable);
 assert.equal(h.workspace.undoAvailable,true);await h.workspace.undo();await h.settle();assert.deepEqual(h.snapshot,valuable);
 assert.equal(h.cache.get('account:A').history.at(-1).payload.storage.note,'one more change');
 }finally{h.dispose();}
});
test('if the checkpoint cannot be stored replacement is cancelled before memory or cloud changes',async()=>{
 const h=harness();try{await h.settle();h.remote.set('A',{revision:1,payload:snapshot('old account')});h.login('A');await h.settle();h.edit('unsaved BB notes');h.failLocal(()=>true);
 await assert.rejects(h.workspace.replace(snapshot('stale file')),/local save failure/);await h.settle();assert.equal(h.note,'unsaved BB notes');assert.equal(h.remote.get('A').payload.storage.note,'old account');assert.deepEqual(h.writes,[]);
 }finally{h.dispose();}
});
test('reading a different cloud copy preserves the previous account cache even after conflict is resolved',async()=>{
 const h=harness();try{await h.settle();h.remote.set('A',{revision:1,payload:snapshot('first copy')});h.login('A');await h.settle();h.cache.set('conflict:A',{revision:1,pending:false,payload:snapshot('older retained copy')});h.remote.set('A',{revision:2,payload:snapshot('other device')});
 await h.workspace.reload();await h.settle();assert.equal(h.note,'other device');assert.equal(h.cache.get('account:A').history.at(-1).payload.storage.note,'first copy');assert.equal(h.cache.get('conflict:A').payload.storage.note,'older retained copy');assert.equal(h.workspace.undoAvailable,true);await h.workspace.undo();await h.settle();assert.equal(h.note,'first copy');
 }finally{h.dispose();}
});


test('undo belongs to its account and cannot restore another account history',async()=>{
 const h=harness();try{await h.settle();h.remote.set('A',{revision:1,payload:snapshot('A notes')});h.login('A');await h.settle();await h.workspace.replace(snapshot('wrong import'));await h.settle();assert.equal(h.workspace.undoAvailable,true);
 h.remote.set('B',{revision:1,payload:snapshot('B notes')});h.login('B');await h.settle();assert.equal(h.workspace.undoAvailable,false);await assert.rejects(h.workspace.undo(),/没有可撤销/);assert.equal(h.note,'B notes');
 }finally{h.dispose();}
});


test('opening the account preserves a displaced sync baseline even if the visible copy matches cloud',async()=>{
 const h=harness();try{await h.settle();const lost=snapshot('valuable previous baseline'),current=snapshot('visible overwritten copy');h.cache.set('account:A',{revision:8,cloudRevision:1,pending:true,payload:current,basePayload:lost});h.remote.set('A',{revision:1,payload:current});h.login('A');await h.settle();
 assert.equal(h.note,'visible overwritten copy');assert.ok(h.cache.get('account:A').history.some(item=>item.payload.storage.note==='valuable previous baseline'));
 }finally{h.dispose();}
});

test('edits are protected on device while an earlier cloud upload is stalled',async()=>{
 const h=harness();let held;try{await h.settle();h.remote.set('A',{revision:1,payload:ratingSnapshot({},1)});h.login('A');await h.settle();
 h.editSnapshot(ratingSnapshot({one:'familiar'},100));held=h.holdCloud();const saving=h.workspace.flush();await held.entered;
 const ratings=Object.fromEntries(Array.from({length:300},(_,i)=>['bb-'+i,'familiar']));h.editSnapshot(ratingSnapshot(ratings,200));await h.settle();
 assert.equal(Object.keys(JSON.parse(h.cache.get('account:A').payload.storage['gre-quick-ratings-v1'])).length,300);assert.equal(h.cache.get('account:A').pending,true);
 const manual=h.workspace.syncNow();h.render();assert.equal(h.workspace.syncing,true);assert.match(h.workspace.status,/正在同步/);
 held.release();await saving;await manual;await h.settle();
 assert.equal(Object.keys(JSON.parse(h.remote.get('A').payload.storage['gre-quick-ratings-v1'])).length,301);assert.equal(h.cache.get('account:A').pending,false);assert.match(h.workspace.status,/账号同步已确认/);
 }finally{held?.release();h.dispose();}
});
test('manual sync gives immediate feedback and coalesces repeat clicks even with no new edits',async()=>{
 const h=harness();let held;try{await h.settle();h.remote.set('A',{revision:7,payload:snapshot('existing records')});h.login('A');await h.settle();
 held=h.holdRead();const first=h.workspace.syncNow();h.render();assert.equal(h.workspace.syncing,true);assert.match(h.workspace.status,/正在同步/);await held.entered;
 const second=h.workspace.syncNow();assert.equal(first,second);held.release();assert.equal(await first,true);await h.settle();assert.equal(h.workspace.syncing,false);assert.match(h.workspace.status,/账号同步已确认.*版本 7/);assert.deepEqual(h.writes,[]);
 }finally{held?.release();h.dispose();}
});
test('manual sync reports connection failure instead of silently succeeding when there are no changes',async()=>{
 const h=harness();try{await h.settle();h.remote.set('A',{revision:2,payload:snapshot('saved records')});h.login('A');await h.settle();h.setOffline(true);
 assert.equal(await h.workspace.syncNow(),false);await h.settle();assert.equal(h.workspace.syncing,false);assert.match(h.workspace.status,/账号同步尚未确认/);assert.equal(h.cache.get('account:A').payload.storage.note,'saved records');assert.deepEqual(h.writes,[]);
 }finally{h.dispose();}
});
