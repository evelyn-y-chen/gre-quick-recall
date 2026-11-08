import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './helpers/load-ts.mjs';
const {mergeNotebookRecallBatches}=loadTs('app/notebookRecallMerge.ts');
const {mergeWorkspaceSnapshots}=loadTs('community/ratingMerge.ts');
const attempt=(id,result)=>({id,answer:'My answer '+id,checked:!!result,...(result?{result}:{})});
const word=(id,recalls=[])=>({id,word:id,meaning:'Reference',note:'My note',origin:'Source',recalls});
const batch=words=>({id:'batch',source:'Day8',date:'2026-11-08',words,recallPhase:'writing'});
const snapshot=(b,revision=1)=>({version:1,storage:{'unrelated':'keep'},rows:[{key:'vocab-notebook:batch',value:JSON.stringify(b),revision,updated_at:'2026-11-08T10:00:00Z'},{key:'word-memory:other',value:'"Shared note"',revision:1,updated_at:'2026-11-08T10:00:00Z'}]});

test('compatible per-word progress merges despite object order and reveal differences, without losing any first-round answers',()=>{
 const base=batch([word('one',[attempt('first')]),word('two')]);
 const local=structuredClone(base),remote=structuredClone(base);
 local.words[0].recalls[0]={...attempt('first','correct'),revealed:true};local.words[1].recalls=[attempt('second','partial')];local.recallPhase='checking';
 remote.words[0].recalls[0]={revealed:false,...attempt('first','correct')};
 const merged=mergeNotebookRecallBatches(base,local,remote);
 assert.deepEqual(merged,local);assert.deepEqual(JSON.parse(mergeWorkspaceSnapshots(snapshot(base),snapshot(local,5),snapshot(remote,3)).rows[0].value),local);
 assert.equal(mergeWorkspaceSnapshots(snapshot(base),snapshot(local,5),snapshot(remote,3)).storage.unrelated,'keep');
});

test('different new rounds, actual note conflicts, changed answers and contradictory judgments remain conflicts',()=>{
 const base=batch([word('one',[attempt('first')])]);
 for(const change of [b=>b.words[0].note='Other note',b=>b.words[0].recalls[0].answer='Different answer',b=>b.words[0].recalls.push(attempt('independent-round','correct'))]){
  const local=structuredClone(base),remote=structuredClone(base);local.words[0].recalls[0]=attempt('first','correct');local.words[0].recalls.push(attempt('next-round','correct'));change(remote);
  assert.equal(mergeNotebookRecallBatches(base,local,remote),null);
  assert.throws(()=>mergeWorkspaceSnapshots(snapshot(base),snapshot(local),snapshot(remote)),/两台设备/);
 }
 const l=batch([word('one',[attempt('first','correct')])]),r=batch([word('one',[attempt('first','incorrect')])]);
 assert.equal(mergeNotebookRecallBatches(base,l,r),null);
});

test('an intentional deletion or compacted archive cannot silently resurrect old answers',()=>{
 const base=batch([word('one',[attempt('first','correct')])]),local=structuredClone(base),remote=structuredClone(base);
 local.words[0].recalls=[];remote.words[0].recalls.push(attempt('next','correct'));
 assert.equal(mergeNotebookRecallBatches(base,local,remote),null);
});
