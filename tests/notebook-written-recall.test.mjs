import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './helpers/load-ts.mjs';
const {validNotebookBatch,mergeNotebookCandidates,NOTEBOOK_RECALL_LIMIT}=loadTs('app/notebookModel.ts');
const {buildNotebookPractice}=loadTs('app/notebookPracticeModel.ts');
const {countNotebookFrequency}=loadTs('app/notebookFrequencyModel.ts');
const {mergeImportedNotebook}=loadTs('community/notebookImport.ts');
const word={id:'one',word:'cogent',meaning:'有说服力的',note:'原有笔记',origin:'阅读',rating:'fuzzy'};
const batch={id:'recall-batch',source:'阅读第1篇',date:'2026-11-07',words:[word]};
const attempt={id:'try-one',answer:'有道理？',checked:true,result:'partial'};

test('legacy notebooks remain valid and written recall requires bounded, uniquely identified, explicitly assessed data',()=>{
 assert.ok(validNotebookBatch(batch));
 const withRecalls=recalls=>({...batch,words:[{...word,recalls}]});
 assert.ok(validNotebookBatch(withRecalls([attempt])));
 assert.ok(validNotebookBatch(withRecalls([{id:'first',answer:'',checked:false}])));
 for(const recalls of [null,{},[null],[{...attempt,checked:false}],[{...attempt,result:'green'}],[{...attempt,answer:'x'.repeat(1001)}],[attempt,attempt],Array.from({length:NOTEBOOK_RECALL_LIMIT+1},(_,i)=>({...attempt,id:`try-${i}`}))]) assert.equal(validNotebookBatch(withRecalls(recalls)),false);
});

test('blank reference means no quiz answer; guessed or manually correct written answers never become quiz definitions',()=>{
 const words=mergeNotebookCandidates([],[{word:'cogent',meaning:'',note:'',origin:'阅读'}],()=> 'one');
 assert.equal(words[0].meaning,'');
 const draft={...batch,words:words.map(w=>({...w,recalls:[{...attempt,result:'correct'}]}))};
 assert.ok(validNotebookBatch(draft));const prepared=buildNotebookPractice([draft]);
 assert.equal(prepared.terms.length,0);assert.equal(prepared.missingMeanings,1);
 const referenced={...batch,words:[{...word,recalls:[attempt]}]};
 assert.equal(buildNotebookPractice([referenced]).terms[0].meaning,word.meaning);
 assert.deepEqual(countNotebookFrequency([referenced],null),{cogent:1});
 const merged=mergeNotebookCandidates(referenced.words,[{word:'COGENT',meaning:'令人信服的',origin:'全能词',note:''}],()=> 'unused');
 assert.deepEqual(merged[0].recalls,[attempt]);assert.equal(merged[0].rating,'fuzzy');assert.equal(merged[0].note,word.note);
});

test('export and additive historical import preserve every written answer without replacing existing collections',()=>{
 const saved={...batch,words:[{...word,recalls:[attempt,{id:'try-two',answer:'令人信服的',checked:true,result:'correct'}]}]};
 const incoming={version:1,rows:[{key:'vocab-notebook:'+batch.id,value:JSON.stringify(saved),revision:2,updated_at:'2026-11-07T00:00:00Z'}],storage:{}};
 const current={version:1,rows:[{key:'vocab-notebook:'+batch.id,value:JSON.stringify(batch),revision:3,updated_at:'2026-11-07T01:00:00Z'}],storage:{}};
 const result=mergeImportedNotebook(current,JSON.parse(JSON.stringify(incoming)));
 assert.deepEqual(result.payload.rows[0],current.rows[0]);
 const restored=JSON.parse(result.payload.rows[1].value);
 assert.deepEqual(restored.words[0].recalls,saved.words[0].recalls);
 assert.deepEqual(mergeImportedNotebook(result.payload,incoming).payload,result.payload);
});
