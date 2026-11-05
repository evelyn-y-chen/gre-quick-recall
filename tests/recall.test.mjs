import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModel} from './helpers/load-model.mjs';
const m=loadModel('community/recallModel.ts'),merge=loadModel('community/practiceProgressMerge.ts');
const {mergeWorkspaceSnapshots}=loadModel('community/ratingMerge.ts');
let serial=0;const token=()=>`edit-${++serial}`;
const create=(ids=['a'],mode='strict',retry='all')=>m.createRecallRun(ids,{mode,retry},token);
const choose=(run,r)=>m.chooseRecallRating(run,r,token);
const answer=(run,r)=>m.advanceRecall(choose(run,r),token);
const snapshot=(run,key='lemnota-recall-words-v1')=>({version:1,rows:[],storage:{[key]:JSON.stringify(run),note:'keep this note','gre-quick-ratings-v1':'{"a":"unknown"}'}});

test('strict requires two consecutive familiar judgments, and unsure/unknown reset the streak',()=>{
 let run=create();run=answer(run,'familiar');assert.equal(run.results.a.done,false);assert.equal(run.results.a.streak,1);
 run=answer(run,'fuzzy');assert.equal(run.results.a.streak,0);
 run=answer(run,'familiar');assert.equal(run.results.a.done,false);
 run=answer(run,'unknown');assert.equal(run.results.a.streak,0);
 run=answer(answer(run,'familiar'),'familiar');assert.deepEqual(run.queue,[]);assert.equal(run.results.a.done,true);assert.equal(run.turn,6);assert.equal(m.isRecallRun(run),true);
});
test('lenient accepts fuzzy/familiar in any consecutive combination, but unknown resets',()=>{
 for(const pair of [['fuzzy','fuzzy'],['fuzzy','familiar'],['familiar','fuzzy'],['familiar','familiar']]){
  let run=create(['a'],'lenient');run=answer(answer(run,pair[0]),pair[1]);assert.equal(run.results.a.done,true);assert.deepEqual(run.queue,[]);
 }
 let run=answer(answer(create(['a'],'lenient'),'fuzzy'),'unknown');assert.equal(run.results.a.streak,0);assert.equal(run.queue.length,1);
});
test('changing a revealed judgment previews one attempt from the prior visit and survives reload',()=>{
 const original=answer(create(),'familiar');let run=choose(original,'familiar');assert.equal(m.recallResult(run).done,true);
 run=choose(run,'unknown');assert.equal(m.recallResult(run).done,false);assert.equal(m.recallResult(run).streak,0);
 run=choose(run,'fuzzy');assert.equal(m.recallResult(run).attempts,2);assert.deepEqual(run.results,original.results);
 const restored=m.readRecallRun(JSON.stringify(run),new Set(['a']));assert.deepEqual(restored,run);assert.equal(m.recallSummary(restored).answers,2);
 run=m.advanceRecall(restored,token);assert.equal(run.turn,2);assert.equal(run.results.a.attempts,2);assert.equal(run.results.a.rating,'fuzzy');
});
test('unknown returns after three intervening words, fuzzy after five, before unused words',()=>{
 for(const [rating,gap] of [['unknown',3],['fuzzy',5]]){
  let run=answer(create(['a','b','c','d','e','f','g','h','i']),rating);
  for(let i=0;i<gap;i++){assert.notEqual(run.queue[0],'a');run=answer(run,'familiar');}
  assert.equal(run.queue[0],'a');assert.equal(run.turn,gap+1);assert.equal(m.isRecallRun(run),true);
 }
});
test('the earliest due return wins, short queues return early and never duplicate a word',()=>{
 let run=answer(create(['a','b','c','d','e','f','g','h']),'fuzzy');
 run=answer(run,'unknown');for(let i=0;i<3;i++)run=answer(run,'familiar');assert.equal(run.queue[0],'b');run=answer(run,'familiar');assert.equal(run.queue[0],'a');
 const short=answer(create(),'unknown');assert.equal(short.queue[0],'a');assert.ok(short.due.a>short.turn);assert.equal(new Set(short.queue).size,short.queue.length);
});
test('unknown-only can defer fuzzy words without declaring them passed, then resume them',()=>{
 let run=answer(create(['a'],'strict','unknown'),'fuzzy');assert.deepEqual(run.queue,[]);assert.equal(run.results.a.done,false);assert.deepEqual(m.recallDeferred(run),['a']);assert.deepEqual(m.recallSummary(run),{answers:1,completed:0,remaining:1,deferred:1});
 run=m.resumeDeferredRecall(run,token);assert.equal(run.config.retry,'all');assert.deepEqual(run.queue,['a']);
 run=answer(answer(run,'familiar'),'familiar');assert.equal(run.results.a.done,true);assert.equal(m.isRecallRun(run),true);
});
test('empty or invalid saved state is refused without mutating it',()=>{
 const run=create(),copy=structuredClone(run);
 for(const bad of [{...run,queue:['a','a']},{...run,queue:['else']},{...run,selection:'green'},{...run,turn:3},{...run,lineage:[run.editId]}])assert.equal(m.readRecallRun(JSON.stringify(bad)),null);
 assert.equal(m.readRecallRun(JSON.stringify(run),new Set(['b'])),null);assert.deepEqual(run,copy);assert.throws(()=>create([]));
});
test('import and sync preserve exact proven corrections, older files cannot roll progress back',()=>{
 const old=create(['a','b']),revealed=choose(old,'familiar'),corrected=choose(revealed,'unknown'),advanced=m.advanceRecall(corrected,token);
 for(const current of [old,revealed,corrected]){
  for(const [a,b] of [[current,advanced],[advanced,current]]){
   const out=merge.mergeImportedPractice(snapshot(a),snapshot(b));assert.deepEqual(JSON.parse(out.storage[m.recallKey('words')]),advanced);assert.equal(out.storage.note,'keep this note');assert.equal(out.storage['gre-quick-ratings-v1'],'{"a":"unknown"}');
  }
 }
 const merged=mergeWorkspaceSnapshots(snapshot(old),snapshot(revealed),snapshot(corrected));assert.equal(JSON.parse(merged.storage[m.recallKey('words')]).selection,'unknown');
 assert.equal(merge.practiceProgressSummary(snapshot(corrected))[0].answers,1);
});
test('different rounds and divergent choices retain conflicts instead of losing either device branch',()=>{
 const old=create(),a=choose(old,'familiar'),b=choose(old,'unknown');
 assert.throws(()=>merge.mergeImportedPractice(snapshot(a),snapshot(b)),/分支/);
 assert.throws(()=>merge.mergeImportedPractice(snapshot(a),snapshot(create())),/分支/);
});
test('different modules merge independently without changing existing multiple-choice runs or notes',()=>{
 const a=create(),b=create(),base=snapshot(a),left=snapshot(answer(a,'unknown')),right=snapshot(a);base.storage['lemnota-recall-bb-v1']=JSON.stringify(b);left.storage['lemnota-recall-bb-v1']=JSON.stringify(b);right.storage['lemnota-recall-bb-v1']=JSON.stringify(answer(b,'familiar'));
 left.storage['lemnota-practice-words']='old multiple choice';right.storage['lemnota-practice-words']='old multiple choice';
 const out=mergeWorkspaceSnapshots(base,left,right);assert.equal(JSON.parse(out.storage[m.recallKey('words')]).turn,1);assert.equal(JSON.parse(out.storage[m.recallKey('bb')]).turn,1);assert.equal(out.storage['lemnota-practice-words'],'old multiple choice');
});
test('the flashcard reveals source columns separately, including BB comparisons and Zhang examples',()=>{
 const {recallFields}=loadModel('community/recallTerms.ts');
 const term={word:'noisome',meaning:'恶臭的',phonetic:'phonetic',english:'offensive to smell',synonyms:['malodorous'],exampleEnglish:'An example.',exampleChinese:'一个例句',sourceMeaning:'original',memory:'记法',related:'同组词',comparison:'对照',originalMemory:'原文记法',note:'个人笔记',origin:'Day 5'};
 const fields=recallFields(term),labels=fields.map(f=>f.label);for(const name of ['中文释义','音标','英文解释','英文例句','例句译文','等价词','同组词与释义','词义对照','原文记法','记忆方法','收集笔记','来源'])assert.ok(labels.includes(name),name);
 assert.equal(fields.find(f=>f.label==='英文解释').value,'offensive to smell');
});


test('scheduled flashcards preserve their review flag and cannot merge with an ordinary practice branch',()=>{
 const run={...create(),review:true},next=choose(run,'familiar');assert.equal(m.readRecallRun(JSON.stringify(next)).review,true);assert.equal(m.readRecallRun(JSON.stringify({...next,review:'yes'})),null);assert.throws(()=>m.mergeRecallRuns(run,{...next,review:false}),/分支/);
});

test('confirmed flashcard reviews share the original schedule, deduplicate retries and preserve A+ retry words',()=>{
 const review=loadModel('community/practiceReviewModel.ts'),aplus=loadModel('app/aPlusReviewModel.ts');
 const history={a:{level:2,due:'2026-11-05',lastDay:'2026-11-01',reviews:7}},event={id:'round:1',entryId:'a',correct:true,completed:false};
 assert.equal(review.recordRecallReview(history,event,'2026-11-05'),history);
 const passed=review.recordRecallReview(history,{...event,completed:true},'2026-11-05');assert.equal(passed.a.level,3);assert.equal(passed.a.due,'2026-11-12');
 const reread=review.readPracticeReviewHistory(JSON.stringify(passed),undefined,new Set(['a']),'2026-11-05');assert.equal(reread.a.recallEvent,event.id);assert.deepEqual(review.recordRecallReview(reread,{...event,completed:true},'2026-11-06'),reread);
 const failed=review.recordRecallReview(history,{...event,correct:false},'2026-11-05');assert.equal(failed.a.level,0);assert.equal(failed.a.due,'2026-11-06');assert.equal(review.recordRecallReview(failed,{...event,id:'round:2',completed:true},'2026-11-05'),failed);
 const a=aplus.recordAPlusRecallReview({a:{...history.a,retryWords:['kept']}},{...event,completed:true},'2026-11-05');assert.equal(a.a.level,3);assert.deepEqual(a.a.retryWords,['kept']);
});
