import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './helpers/load-ts.mjs';
const {notebookBriefMeaning,validNotebookBatch,mergeNotebookCandidates}=loadTs('app/notebookModel.ts');
const {mergeImportedNotebook}=loadTs('community/notebookImport.ts');
const {buildNotebookPractice}=loadTs('app/notebookPracticeModel.ts');
const word={id:'word',word:'cogent',meaning:'【我的批注｜Day 8 · 第 1 题】\n有说服力的\n\n【其他参考】\n令人信服的',note:'完整笔记',origin:'Day 8 · 第1题',rating:'fuzzy',recalls:[{id:'try1',answer:'有道理',checked:false}]};
const batch={id:'day8',source:'Day8批注',date:'2026-11-07',words:[word]};
test('brief cue omits provenance and falls back without mutating full annotated meanings',()=>{
 assert.equal(notebookBriefMeaning(word),'有说服力的');
 assert.equal(notebookBriefMeaning({...word,meaning:'【来源】\n批注说明：另有旁注\n手写：释义'}),'释义');
 assert.equal(notebookBriefMeaning({...word,meaning:'【只有来源】'}),'');
 assert.equal(notebookBriefMeaning({...word,briefMeaning:''}),'');
 assert.equal(notebookBriefMeaning({...word,briefMeaning:'说得通'}),'说得通');
 assert.equal(notebookBriefMeaning({...word,meaning:'字'.repeat(1000)}).length,500);
});
test('bounded optional brief meanings preserve recall, ratings and full references through additive import',()=>{
 const saved={...batch,words:[{...word,briefMeaning:'说得通'}]};
 assert.ok(validNotebookBatch(batch));assert.ok(validNotebookBatch(saved));
 for(const briefMeaning of [null,42,{},'字'.repeat(501)])assert.equal(validNotebookBatch({...batch,words:[{...word,briefMeaning}]}),false);
 const row={key:'vocab-notebook:'+saved.id,value:JSON.stringify(saved),revision:1,updated_at:'2026-11-07T00:00:00Z'};
 const restored=mergeImportedNotebook({version:1,rows:[],storage:{}},{version:1,rows:[row],storage:{}}).payload;
 assert.deepEqual(JSON.parse(restored.rows[0].value),saved);
 const merged=mergeNotebookCandidates(saved.words,[{word:'cogent',meaning:'有理有据',note:'别的笔记',origin:'全能词'}],()=> 'unused');
 assert.equal(merged[0].briefMeaning,'说得通');assert.deepEqual(merged[0].recalls,word.recalls);assert.equal(merged[0].rating,word.rating);
 assert.equal(buildNotebookPractice([saved]).terms[0].meaning,buildNotebookPractice([batch]).terms[0].meaning,'A short cue must not silently replace quiz definitions');
});
