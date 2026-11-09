import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './helpers/load-ts.mjs';
const model=loadTs('app/notebookRecallModel.ts'),{validNotebookBatch}=loadTs('app/notebookModel.ts');
const {mergeImportedNotebook}=loadTs('community/notebookImport.ts');
const attempt=(result,index)=>({id:'attempt-'+index,answer:'My definition '+index,checked:true,result});
const word=(results=[])=>({id:'one',word:'cogent',meaning:'有说服力的',note:'原笔记',origin:'原来源',rating:'fuzzy',recalls:results.map(attempt)});
const batch=words=>({id:'recall-source',source:'Day8',date:'2026-11-08',words});
let number=0;const id=()=> 'new-'+(++number);

test('recall groups use explicit consecutive-error and error-rate thresholds without changing original ratings',()=>{
 for(const [results,group] of [[[],'unseen'],[['correct'],'passed'],[['incorrect'],'consolidate'],[['incorrect','incorrect'],'prone'],[['incorrect','incorrect','incorrect'],'focus'],[['incorrect','correct','incorrect'],'prone'],[['incorrect','correct','correct','correct'],'consolidate'],[['correct','correct','correct'],'passed'],[['partial'],'consolidate']]){
  const current=word(results),before=structuredClone(current),stats=model.notebookRecallStats(current);
  assert.equal(stats.group,group,results.join(','));assert.deepEqual(current,before);
 }
 const corrected=word(['incorrect','incorrect','correct']);assert.equal(model.notebookRecallStats(corrected).streak,0);
 const first=word(['incorrect']);const changed={...first,recalls:[{...first.recalls[0],result:'correct'}]};
 assert.equal(model.notebookRecallStats(changed).correct,1);assert.equal(model.notebookRecallStats(changed).incorrect,0,'Regrading the same attempt must not double count');
});

test('starting only wrong words preserves all old answers and references and creates one fresh attempt per chosen word',()=>{
 const first=word(['correct']),second={...word(['incorrect']),id:'two',word:'lucid'};
 const original=batch([first,second]),chosen=model.selectNotebookRecallWords(original.words,'wrong');
 assert.deepEqual(chosen.map(word=>word.id),['two']);const next=model.startNotebookRecall(original,['two','missing','two'],id);
 assert.deepEqual(next.recallRound.wordIds,['two']);assert.equal(next.words[0],first);
 assert.deepEqual(next.words[1].recalls.slice(0,-1),second.recalls);
 assert.deepEqual(next.words[1].recalls.at(-1),{id:next.words[1].recalls.at(-1).id,answer:'',checked:false});
 assert.equal(next.words[1].meaning,second.meaning);assert.equal(next.words[1].rating,'fuzzy');assert.ok(validNotebookBatch(next));
 assert.deepEqual(model.selectNotebookRecallWords(next.words,'wrong'),[],'The new blank attempt is not already wrong');
 assert.equal(model.startNotebookRecall(original,['missing'],id),original);
});

test('bulk checking treats untouched and whitespace-only answers as forgotten exactly once, within the selected scope',()=>{
 const blank=word(),spaces={...word(),id:'spaces',recalls:[{id:'whitespace',answer:'  \n ',checked:false}]},outside={...word(['correct']),id:'outside'};
 const source={...batch([blank,spaces,outside]),recallRound:{id:'round',wordIds:['one','spaces']}};
 const checked=model.checkNotebookRecall(source,id),again=model.checkNotebookRecall(checked,id);
 for(const current of checked.words.slice(0,2)){
  assert.equal(current.recalls.length,1);assert.equal(current.recalls[0].forgotten,true);assert.equal(current.recalls[0].result,'incorrect');assert.equal(current.recalls[0].revealed,true);
  assert.equal(model.notebookRecallStats(current).wrong,1);assert.equal(current.rating,'fuzzy');
 }
 assert.equal(checked.words[2],outside);assert.deepEqual(again,checked);assert.ok(validNotebookBatch(checked));
 assert.equal(source.words[0].recalls.length,0);
 const regraded={...checked,words:checked.words.map((w,i)=>i? w:{...w,recalls:[{...w.recalls[0],forgotten:undefined,result:'correct'}]})};
 assert.equal(model.checkNotebookRecall(regraded,id).words[0].recalls[0].result,'correct','Repeated checking preserves an explicit correction');
});

test('partial answers count as wrong for retries, streaks and accuracy while preserving the original judgment',()=>{
 const current=word(['correct','partial','incorrect','partial']),stats=model.notebookRecallStats(current);
 assert.equal(stats.correct,1);assert.equal(stats.wrong,3);assert.equal(stats.correctRate,.25);assert.equal(stats.streak,3);assert.equal(stats.group,'focus');
 assert.equal(current.recalls.at(-1).result,'partial');
 assert.deepEqual(model.selectNotebookRecallWords([current],'wrong'),[current]);
 assert.equal(model.notebookRecallStats(word(['partial','partial'])).group,'prone');
});

test('submission is explicit, idempotent and restorable; the next selected round becomes N+1 without replacing prior answers',()=>{
 const original=batch([word(['correct']),{...word(['partial']),id:'two',word:'lucid'}]);
 const saved=model.submitNotebookRecall(original,id,'2026-11-08T10:00:00Z');
 assert.ok(validNotebookBatch(saved));assert.ok(model.notebookRecallSubmitted(saved));
 assert.equal(model.submitNotebookRecall(saved,id),saved);
 assert.equal(saved.words[0].recalls.length,1);assert.equal(saved.words[1].recalls[0].result,'partial');
 const next=model.startNotebookRecall(saved,['two'],id);
 assert.equal(next.words[0],saved.words[0]);assert.equal(next.words[1].recalls.length,2);
 assert.deepEqual(next.words[1].recalls[0],saved.words[1].recalls[0]);assert.equal(next.words[1].recalls[1].answer,'');
 assert.equal(next.recallSubmission,undefined);assert.equal(model.notebookRecallSubmitted(next),false);
 assert.throws(()=>model.submitNotebookRecall(next,id),/未判断/);
 const invalid={...saved,words:[{...saved.words[0],recalls:[{...saved.words[0].recalls[0],submittedAt:'invalid'}]}]};assert.equal(validNotebookBatch(invalid),false);
});

test('60 rounds retain at most 20 full answers while preserving lifetime counts, numbering and consecutive errors',()=>{
 let current=word([]);for(let round=0;round<60;round++){
  current=model.appendNotebookRecall(current,id);
  current={...current,recalls:current.recalls.map((attempt,index)=>index===current.recalls.length-1?{...attempt,answer:'remembered '+round,checked:true,result:round>=57?'incorrect':'correct'}:attempt)};
 }
 assert.equal(current.recalls.length,20);assert.equal(current.recallArchive.attempts,40);
 const stats=model.notebookRecallStats(current);assert.equal(stats.correct,57);assert.equal(stats.incorrect,3);assert.equal(stats.streak,3);assert.equal(stats.group,'focus');
 assert.ok(validNotebookBatch(batch([current])));
 const hidden=model.hideNotebookRecallReferences({...batch([current]),recallPhase:'checking'});
 assert.equal(hidden.recallPhase,'writing');assert.deepEqual(model.notebookRecallStats(hidden.words[0]),stats);
});

test('round selection, reminder, archive and reveal fields survive backup import with old collections preserved',()=>{
 const saved={...model.startNotebookRecall(batch([word(['incorrect'])]),['one'],id),recallReminder:{id:'appointment',at:'2026-11-09T01:00:00.000Z',wordIds:['one'],label:'本轮错词'}};
 saved.words[0]={...saved.words[0],recallArchive:{attempts:3,correct:1,incorrect:2,partial:0,streak:2}};
 saved.words[0].recalls[0].revealed=true;assert.ok(validNotebookBatch(saved));
 const pack=value=>({version:1,rows:[{key:'vocab-notebook:'+value.id,value:JSON.stringify(value),revision:1,updated_at:'2026-11-08T00:00:00Z'}],storage:{}});
 const original=pack(batch([word()])),result=mergeImportedNotebook(original,pack(saved));
 assert.deepEqual(result.payload.rows[0],original.rows[0]);const restored=JSON.parse(result.payload.rows[1].value);
 assert.deepEqual(restored.recallReminder,saved.recallReminder);assert.deepEqual(restored.recallRound,saved.recallRound);assert.deepEqual(restored.words,saved.words);
 for(const invalid of [{...saved,recallReminder:{...saved.recallReminder,at:'invalid'}},{...saved,recallRound:{id:'round',wordIds:['one','one']}},{...saved,words:[{...saved.words[0],recallArchive:{attempts:0,correct:1,incorrect:0,partial:0,streak:0}}]}])assert.equal(validNotebookBatch(invalid),false);
});
