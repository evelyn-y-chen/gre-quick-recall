import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './helpers/load-ts.mjs';
const {fieldClockKey,readFieldClocks,stampFieldChange}=loadTs('community/fieldMerge.ts');
const {mergeWorkspaceSnapshots}=loadTs('community/ratingMerge.ts');
const recall=loadTs('community/recallModel.ts');
const id='vocab-notebook:shared';
const word=(id)=>({id,word:id,meaning:'原释义',note:'原笔记',origin:'来源'});
const batch={id:'shared',source:'同一收集',date:'2026-11-09',words:[word('one'),word('two')]};
const snapshot=()=>({version:1,rows:[{key:id,value:JSON.stringify(batch),revision:1,updated_at:'2026-11-09T04:00:00Z'}],storage:{}});
function edited(before,fn,at,token=String(at)){
 const result=structuredClone(before);fn(result);const clocks=readFieldClocks(before.storage[fieldClockKey]),b=new Map(before.rows.map(row=>[row.key,row]));
 for(const row of result.rows){stampFieldChange(clocks,'rows',row.key,b.get(row.key)?.value,row.value,at,token);if(row.value!==b.get(row.key)?.value){row.revision++;row.updated_at=new Date(at).toISOString();}b.delete(row.key);}
 for(const [key,row] of b)stampFieldChange(clocks,'rows',key,row.value,undefined,at,token);
 for(const key of new Set([...Object.keys(before.storage),...Object.keys(result.storage)]))stampFieldChange(clocks,'storage',key,before.storage[key],result.storage[key],at,token);
 result.storage[fieldClockKey]=JSON.stringify(clocks);return result;
}
function editBatch(s,fn){const value=JSON.parse(s.rows[0].value);fn(value);s.rows[0].value=JSON.stringify(value);}
const read=s=>JSON.parse(s.rows.find(row=>row.key===id).value);

test('1 pm tablet edits and 2 pm edits from a noon computer version both survive per word and field',()=>{
 const base=snapshot(),one=edited(base,s=>editBatch(s,b=>{b.words[0].meaning='一点改的释义';b.words.push(word('added-at-one'));}),1000),two=edited(base,s=>editBatch(s,b=>{b.words[0].note='两点改的笔记';b.words[1].meaning='两点改的另一词';b.words.push(word('added-at-two'));}),2000);
 const merged=mergeWorkspaceSnapshots(base,one,two),value=read(merged);
 assert.equal(value.words[0].meaning,'一点改的释义');assert.equal(value.words[0].note,'两点改的笔记');assert.equal(value.words[1].meaning,'两点改的另一词');
 assert.deepEqual(value.words.map(w=>w.id),['one','two','added-at-one','added-at-two']);
 assert.deepEqual(read(mergeWorkspaceSnapshots(base,two,one)),value);
 // A stale live tab edits yet another field after the composite was saved.
 const three=edited(two,s=>editBatch(s,b=>b.words[1].note='三点的笔记'),3000);
 const final=read(mergeWorkspaceSnapshots(two,three,merged));assert.equal(final.words[0].meaning,'一点改的释义');assert.equal(final.words[1].note,'三点的笔记');assert.equal(final.words.length,4);
});
test('same-field latest edit wins by edit time, not upload time; an explicit revert is an edit',()=>{
 const base=snapshot(),older=edited(base,s=>editBatch(s,b=>b.words[0].meaning='一点'),1000),newer=edited(base,s=>editBatch(s,b=>b.words[0].meaning='两点'),2000);
 assert.equal(read(mergeWorkspaceSnapshots(base,newer,older)).words[0].meaning,'两点');
 assert.equal(read(mergeWorkspaceSnapshots(base,older,newer)).words[0].meaning,'两点');
 const reverted=edited(newer,s=>editBatch(s,b=>b.words[0].meaning='原释义'),3000);
 assert.equal(read(mergeWorkspaceSnapshots(base,reverted,older)).words[0].meaning,'原释义');
});
test('removed words do not resurrect from a stale device editing a different word',()=>{
 const base=snapshot(),removed=edited(base,s=>editBatch(s,b=>b.words.splice(0,1)),3000),other=edited(base,s=>editBatch(s,b=>b.words[1].note='另一个词的后续编辑'),4000);
 const merged=read(mergeWorkspaceSnapshots(base,removed,other));assert.deepEqual(merged.words.map(w=>w.id),['two']);assert.equal(merged.words[0].note,'另一个词的后续编辑');
});

test('absence in an old device snapshot cannot remove a new word without a recorded deletion',()=>{
 const base=snapshot(),added=edited(base,s=>editBatch(s,b=>b.words.push(word('new-word'))),1000);
 const stale=edited(base,s=>editBatch(s,b=>b.words[0].note='旧页面后续修改'),2000);
 const result=read(mergeWorkspaceSnapshots(added,stale,added));assert.equal(result.words.length,3);assert.equal(result.words[2].id,'new-word');
});
test('a newer edit of a deleted word restores it; repeated merge is idempotent',()=>{
 const base=snapshot(),removed=edited(base,s=>editBatch(s,b=>b.words.splice(0,1)),1000),newer=edited(base,s=>editBatch(s,b=>b.words[0].note='后改的这个词'),2000);
 const merged=mergeWorkspaceSnapshots(base,removed,newer);assert.equal(read(merged).words.length,2);assert.equal(read(merged).words[0].note,'后改的这个词');
 assert.deepEqual(mergeWorkspaceSnapshots(base,merged,merged),merged);
});
test('different keys inside shared notes/settings merge; the same key keeps its newer edit',()=>{
 const base={version:1,rows:[],storage:{settings:'{"font":20,"theme":"cream"}',note:'原笔记'}};
 const one=edited(base,s=>{s.storage.settings='{"font":22,"theme":"cream"}';s.storage.note='一点的笔记';},1000);
 const two=edited(base,s=>{s.storage.settings='{"font":20,"theme":"sage"}';s.storage.note='两点的笔记';},2000);
 const merged=mergeWorkspaceSnapshots(base,one,two);assert.deepEqual(JSON.parse(merged.storage.settings),{font:22,theme:'sage'});assert.equal(merged.storage.note,'两点的笔记');
});
test('independent self-assessment answers merge without producing an invalid queue or losing passed words',()=>{
 let n=0;const token=()=>`token-${++n}`,run=recall.createRecallRun(['one','two'],{mode:'strict',retry:'all'},token),key='lemnota-recall-words-v1';
 const base={version:1,rows:[],storage:{[key]:JSON.stringify(run)}};
 const a=recall.advanceRecall(recall.chooseRecallRating(run,'familiar',token),token);
 const b=recall.advanceRecall(recall.chooseRecallRating({...run,queue:['two','one']},'familiar',token),token);
 const one=edited(base,s=>s.storage[key]=JSON.stringify(a),1000),two=edited(base,s=>s.storage[key]=JSON.stringify(b),2000);
 const merged=JSON.parse(mergeWorkspaceSnapshots(base,one,two).storage[key]);assert.ok(recall.isRecallRun(merged));assert.equal(merged.results.one.done,true);assert.equal(merged.results.two.done,true);assert.equal(merged.turn,2);assert.deepEqual(merged.queue,[]);
});
test('same recall attempt keeps answer and judgment together, while separate attempts are retained in time order',()=>{
 const base=snapshot();editBatch(base,b=>b.words[0].recalls=[{id:'attempt',answer:'旧答案',checked:false}]);
 const one=edited(base,s=>editBatch(s,b=>b.words[0].recalls[0]={id:'attempt',answer:'一点答案',checked:true,result:'correct'}),1000);
 const two=edited(base,s=>editBatch(s,b=>b.words[0].recalls[0]={id:'attempt',answer:'两点答案',checked:false}),2000);
 assert.deepEqual(read(mergeWorkspaceSnapshots(base,one,two)).words[0].recalls,[{id:'attempt',answer:'两点答案',checked:false}]);
});

test('concurrent rounds beyond twenty keep valid full history and count compacted judgments once',()=>{
 const model=loadTs('app/notebookRecallModel.ts'),validate=loadTs('app/notebookModel.ts').validNotebookBatch;
 const base=snapshot();editBatch(base,b=>b.words[0].recalls=Array.from({length:20},(_,i)=>({id:'attempt-'+i,answer:'answer',checked:true,result:'correct'})));
 const append=(id,result)=>s=>editBatch(s,b=>{b.words[0]=model.appendNotebookRecall(b.words[0],()=>id);Object.assign(b.words[0].recalls.at(-1),{answer:'new answer',checked:true,result});});
 const one=edited(base,append('one-new','incorrect'),1000),two=edited(base,append('two-new','correct'),2000),merged=mergeWorkspaceSnapshots(base,one,two),value=read(merged);
 assert.equal(validate(value,false),true);assert.equal(value.words[0].recalls.length,20);assert.equal(model.notebookRecallStats(value.words[0]).total,22);assert.equal(model.notebookRecallStats(value.words[0]).incorrect,1);
 const again=read(mergeWorkspaceSnapshots(base,two,merged));assert.equal(again.words[0].recalls.length,20);assert.equal(model.notebookRecallStats(again.words[0]).total,22);
});
