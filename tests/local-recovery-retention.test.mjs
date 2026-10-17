import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const code=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const snapshot=(text,reverse=false)=>({version:1,rows:[{key:'word-memory:candid',value:text,revision:1,updated_at:'2026-10-17T00:00:00Z'}],storage:reverse?{b:'2',a:'1'}:{a:'1',b:'2'}});
function fixture(){
 let now=Date.parse('2026-10-17T00:00:00Z'),fail=false;const data=new Map();
 class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
 const recovery={};new Function('exports','require','Date',code('community/workspaceRecovery.ts'))(recovery,()=>({validSnapshot:p=>p?.version===1&&Array.isArray(p.rows)&&p.storage}),Clock);
 const db={close(){},transaction(){let aborted=false,pending;const tx={objectStore(){return {get(key){const request={result:structuredClone(data.get(key))};queueMicrotask(()=>{request.onsuccess();queueMicrotask(()=>{if(!aborted){if(pending)data.set(...pending);tx.oncomplete();}});});return request;},put(value,key){if(fail)throw Error('quota');pending=[key,structuredClone(value)];}};},abort(){aborted=true;queueMicrotask(()=>tx.onabort());}};return tx;}};
 const indexedDB={open(){const request={result:db};queueMicrotask(()=>request.onsuccess());return request;}};
 const out={};new Function('exports','require','indexedDB','Date',code('community/localWorkspace.ts'))(out,name=>name==='./workspaceRecovery'?recovery:{validSnapshot:p=>p?.version===1&&Array.isArray(p.rows)&&p.storage},indexedDB,Clock);
 return {...out,recovery,data,advance(ms){now+=ms;},setFull(value){fail=value;}};
}
test('ordinary edits keep at most two different recovery copies, spaced by 15 minutes',async()=>{
 const f=fixture();let rev=await f.saveLocalWorkspace(snapshot('one'),0,'account:a');rev=await f.saveLocalWorkspace(snapshot('two'),rev,'account:a');
 assert.equal(f.data.get('account:a').history.length,1);
 for(let i=0;i<100;i++)rev=await f.saveLocalWorkspace(snapshot('edit-'+i),rev,'account:a');assert.equal(f.data.get('account:a').history.length,1);
 f.advance(16*60*1000);rev=await f.saveLocalWorkspace(snapshot('three'),rev,'account:a');f.advance(16*60*1000);await f.saveLocalWorkspace(snapshot('four'),rev,'account:a');
 const saved=f.data.get('account:a');assert.equal(saved.payload.rows[0].value,'four');assert.equal(saved.history.length,2);assert.deepEqual(saved.history.map(h=>h.payload.rows[0].value),['edit-99','three']);
});
test('imports checkpoint immediately and duplicate contents do not consume another slot',async()=>{
 const f=fixture(),one=snapshot('one'),two=snapshot('two');let rev=await f.saveLocalWorkspace(one,0);
 rev=await f.saveLocalWorkspace(two,rev,'local',{checkpoint:f.recovery.checkpoint(one,'before import')});
 const cp=f.recovery.checkpoint(snapshot('one',true),'same data, different order');
 await f.saveLocalWorkspace(snapshot('three'),rev,'local',{checkpoint:cp});
 const saved=f.data.get('local');assert.equal(saved.history.length,1);assert.equal(saved.history[0].reason,'same data, different order');assert.deepEqual(saved.payload,snapshot('three'));
});
test('old 20-copy histories compact on the next write without changing current or pending cloud data',async()=>{
 const f=fixture(),payload=snapshot('current'),base=snapshot('cloud');f.data.set('account:a',{revision:3,payload,history:Array.from({length:20},(_,n)=>f.recovery.checkpoint(snapshot('old-'+n),'before import'))});
 await f.saveLocalWorkspace(payload,3,'account:a',{cloudRevision:8,pending:true,basePayload:base});
 const saved=f.data.get('account:a');assert.equal(saved.history.length,2);assert.equal(saved.pending,true);assert.deepEqual(saved.basePayload,base);assert.deepEqual(saved.payload,payload);
});
test('quota and revision failures leave the previous payload and both checkpoints intact',async()=>{
 const f=fixture();let rev=await f.saveLocalWorkspace(snapshot('one'),0);rev=await f.saveLocalWorkspace(snapshot('two'),rev);const before=structuredClone(f.data.get('local'));
 f.setFull(true);await assert.rejects(f.saveLocalWorkspace(snapshot('three'),rev),/浏览器保存失败/);assert.deepEqual(f.data.get('local'),before);
 f.setFull(false);await assert.rejects(f.saveLocalWorkspace(snapshot('four'),0),/其他标签页/);assert.deepEqual(f.data.get('local'),before);
});
test('retention remains account-scoped and preserves exact note drafts',async()=>{
 const f=fixture(),a=snapshot('account a');a.storage['gre-shared-word-memory-drafts-v1']='{"candid":{"text":"not saved yet","revision":0}}';
 const rev=await f.saveLocalWorkspace(a,0,'account:a');await f.saveLocalWorkspace(snapshot('account b'),0,'account:b');await f.saveLocalWorkspace(snapshot('replacement'),rev,'account:a',{checkpoint:f.recovery.checkpoint(a,'before replace')});
 assert.deepEqual(f.data.get('account:a').history[0].payload,a);assert.equal(f.data.get('account:b').history,undefined);assert.equal(f.data.get('account:b').payload.rows[0].value,'account b');
});
