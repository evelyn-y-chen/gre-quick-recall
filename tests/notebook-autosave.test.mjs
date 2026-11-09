import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './helpers/load-ts.mjs';
const {createNotebookAutosaver}=loadTs('app/notebookAutosave.ts');
const {NOTEBOOK_DRAFT_KEY}=loadTs('app/notebookModel.ts');
const copy=value=>JSON.parse(JSON.stringify(value));
const fixture=(id='collection-one')=>({id,source:'阅读第1篇',date:'2026-11-07',words:[{id:'word-one',word:'cogent',meaning:'有说服力的',note:'原有笔记',origin:'阅读',rating:'fuzzy'}]});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const turns=async()=>{for(let n=0;n<12;n++)await Promise.resolve();};
function environment({putGate,network,memory,stateHook}={}){
 let generation=1,timerId=0;const values=new Map(),timers=new Map(),records=new Map(),writes=[],states=[],acknowledged=[],uploads=[];
 const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
 const saver=createNotebookAutosaver({storage,generation:1,getGeneration:()=>generation,schedule:fn=>{const id=++timerId;timers.set(id,fn);return id;},cancel:id=>timers.delete(id),
  put:async(batch,revision)=>{writes.push({batch:copy(batch),revision});if(putGate)await putGate(batch,revision,writes.length);const existing=records.get(batch.id);if((existing?.revision??0)!==revision)throw Object.assign(Error('保存冲突'),{conflict:true});records.set(batch.id,{batch:copy(batch),revision:revision+1});return {revision:revision+1};},
  persist:async()=>{uploads.push(copy([...records.values()]));return network?network():{destination:'account',synced:true};},saveMemory:memory,
  onState:(id,state)=>{states.push({id,...state});stateHook?.(id,state);},onLocalSave:(batch,revision)=>acknowledged.push({batch:copy(batch),revision,drafts:JSON.parse(values.get(NOTEBOOK_DRAFT_KEY)??'{}')}),
 });
 function edit(batch,revision=records.get(batch.id)?.revision??0){const drafts=JSON.parse(values.get(NOTEBOOK_DRAFT_KEY)??'{}');drafts[batch.id]={batch,revision};values.set(NOTEBOOK_DRAFT_KEY,JSON.stringify(drafts));saver.schedule(batch,revision);}
 return {saver,edit,records,writes,states,values,uploads,acknowledged,timers,seed(batch,revision=7){records.set(batch.id,{batch:copy(batch),revision});},drafts:()=>JSON.parse(values.get(NOTEBOOK_DRAFT_KEY)??'{}'),fireTimers(){const pending=[...timers.values()];timers.clear();for(const fn of pending)fn();},switch(){generation++;}};
}

test('a new word flushed during the completion callback is saved immediately without a later typing timer',async()=>{
 const batch=fixture(),latest={...batch,words:[...batch.words,{id:'word-two',word:'lucid',meaning:'清楚的',note:'',origin:'阅读'}]};
 let env,added=false;env=environment({stateHook:(_id,state)=>{if(state.phase==='saved'&&!added){added=true;env.edit(latest);env.saver.flush(batch.id);}}});
 env.seed(batch);env.edit(batch);await env.saver.flush(batch.id);await turns();
 assert.equal(env.writes.length,2);assert.deepEqual(env.records.get(batch.id).batch,latest);assert.deepEqual(env.drafts(),{});assert.equal(env.timers.size,0);
});

test('a typing pause automatically commits the latest row, written answer and assessment before confirming account sync',async()=>{
 const gate=deferred(),env=environment({network:()=>gate.promise}),batch=fixture();env.seed(batch);
 env.edit({...batch,source:'新的来源'});const latest={...batch,entryDraft:{word:'lucid',meaning:''},words:[{...batch.words[0],recalls:[{id:'try-one',answer:'令人信服的',checked:true,result:'correct'}]}]};env.edit(latest);
 assert.equal(env.timers.size,1);env.fireTimers();await turns();
 assert.equal(env.writes.length,1);assert.deepEqual(env.records.get(batch.id).batch,latest);assert.deepEqual(env.drafts(),{});
 assert.ok(!env.states.some(state=>state.phase==='saved'),'A local commit alone must not claim account sync');
 gate.resolve({destination:'account',synced:true});assert.equal(await env.saver.flush(batch.id),true);
 assert.match(env.states.at(-1).message,/保存到账号/);
});

test('an older acknowledgement retains edits typed during the write, updates their revision and saves them next',async()=>{
 const gate=deferred(),env=environment({putGate:(_b,_r,n)=>n===1?gate.promise:undefined}),batch=fixture();env.seed(batch);
 env.edit({...batch,source:'first'});const task=env.saver.flush(batch.id);await turns();
 const latest={...batch,source:'latest',words:[{...batch.words[0],meaning:'我继续输入的释义',recalls:[{id:'try-two',answer:'我自己的回忆',checked:false}]}]};env.edit(latest,7);
 assert.equal(env.saver.flush(batch.id),task,'Manual save and another timer share the in-flight task');
 gate.resolve();assert.equal(await task,true);
 assert.deepEqual(env.writes.map(write=>write.revision),[7,8]);
 assert.deepEqual(env.acknowledged[0].drafts[batch.id],{batch:latest,revision:8});assert.deepEqual(env.drafts(),{});
 assert.deepEqual(env.records.get(batch.id),{batch:latest,revision:9});
  assert.equal(env.timers.size,0,'A finished write must not leave an obsolete typing timer to save again');
});

test('edits made during a failed upload are kept in formal device records; retry skips duplicate local writes',async()=>{
 const gate=deferred();let fail=true;const env=environment({network:()=>fail?gate.promise:{destination:'account',synced:true}}),batch=fixture();env.seed(batch);
 env.edit(batch);const task=env.saver.flush(batch.id);await turns();
 const newer={...batch,entryDraft:{word:'pellucid',meaning:'清晰的'}};env.edit(newer,8);
 gate.resolve({destination:'account',synced:false,message:'本机已保存，等待网络恢复'});assert.equal(await task,false);
 assert.deepEqual(env.records.get(batch.id).batch,newer);assert.equal(env.states.at(-1).phase,'error');assert.equal(env.uploads.length,1);
 const count=env.writes.length;fail=false;assert.equal(await env.saver.flush(batch.id),true);assert.equal(env.writes.length,count);assert.equal(env.uploads.length,2);
});

test('leaving the editor drains every collection without mixing their contents or clearing another collection draft',async()=>{
 const env=environment(),a=fixture(),b=fixture('collection-two');env.seed(a);env.seed(b,3);
 env.edit({...a,source:'first collection'});env.edit({...b,source:'second collection'},3);
 assert.deepEqual(await env.saver.flushAll(),[true,true]);assert.equal(env.timers.size,0);
 assert.equal(env.records.get(a.id).batch.source,'first collection');assert.equal(env.records.get(b.id).batch.source,'second collection');assert.deepEqual(env.drafts(),{});
});

test('a workspace switch cannot delete the new workspace drafts or publish a stale account success',async()=>{
 const gate=deferred(),env=environment({putGate:()=>gate.promise}),batch=fixture();env.seed(batch);env.edit(batch);const task=env.saver.flush(batch.id);await turns();
 env.switch();const other=JSON.stringify({other:{batch:fixture('other'),revision:2}});env.values.set(NOTEBOOK_DRAFT_KEY,other);
 gate.resolve();assert.equal(await task,false);assert.equal(env.values.get(NOTEBOOK_DRAFT_KEY),other);assert.equal(env.uploads.length,0);assert.ok(!env.states.some(state=>state.phase==='saved'));
 env.edit(fixture('new-account'));assert.equal(env.timers.size,0);
});

test('revision conflicts keep every answer and do not automatically overwrite after another edit',async()=>{
 const env=environment(),batch=fixture();env.seed({...batch,source:'newer remote'},9);env.edit(batch,7);
 assert.equal(await env.saver.flush(batch.id),false);assert.equal(env.states.at(-1).phase,'conflict');assert.deepEqual(env.drafts()[batch.id].batch,batch);
 env.edit({...batch,source:'still typing'},7);assert.equal(env.timers.size,0);assert.equal(env.records.get(batch.id).batch.source,'newer remote');
});

test('incomplete rows remain drafts until corrected, then autosave without requiring a manual click',async()=>{
 const env=environment(),batch=fixture(),invalid={...batch,words:[{...batch.words[0],word:''}]};env.edit(invalid);
 assert.equal(await env.saver.flush(batch.id),false);assert.equal(env.states.at(-1).phase,'incomplete');assert.equal(env.writes.length,0);assert.deepEqual(env.drafts()[batch.id].batch,invalid);
 env.edit(batch);env.fireTimers();assert.equal(await env.saver.flush(batch.id),true);assert.equal(env.records.get(batch.id).revision,1);
});

test('a failed shared note does not discard collection edits or falsely confirm that all notes saved',async()=>{
 let noteSaved=false;const env=environment({memory:async()=>noteSaved}),batch=fixture();env.edit(batch);
 assert.equal(await env.saver.flush(batch.id),false);assert.equal(env.records.get(batch.id).batch.words[0].note,'原有笔记');assert.match(env.states.at(-1).message,/共享记忆笔记尚未/);
 noteSaved=true;assert.equal(await env.saver.flush(batch.id),true);assert.equal(env.writes.length,1);
});
