import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './helpers/load-ts.mjs';
const {mergeImportedNotebook,notebookImportSummary}=loadTs('community/notebookImport.ts');
const empty=()=>({version:1,rows:[],storage:{}});
const row=(key,value)=>({key,value:JSON.stringify(value),revision:3,updated_at:'2026-10-17T00:00:00Z'});
const batch=(id='old')=>({id,source:'sample',date:'2026-10-17',words:[{id:'one',word:'recall',meaning:'记起',note:'a memory',origin:'sample'}]});
test('historical notebook import is additive and idempotent, preserving unrelated data byte for byte',()=>{
 const current=empty();current.rows.push(row('word-memory:other',{text:'current'}),row('quick-rating:bb:1','familiar'));current.storage.theme='night';
 const before=structuredClone(current),incoming=empty();incoming.rows.push(row('vocab-notebook:old',batch()),row('word-memory:recall',{text:'old'}),row('word-memory:unrelated',{text:'do not import'}),row('quick-rating:lclj:1','fuzzy'));
 const {payload,report}=mergeImportedNotebook(current,incoming);assert.equal(report.addedCollections,1);assert.equal(report.addedWords,1);assert.equal(report.addedRatings,1);assert.equal(report.addedNotes,1);
 for(const r of before.rows)assert.deepEqual(payload.rows.find(x=>x.key===r.key),r);assert.equal(payload.storage.theme,'night');assert.ok(!payload.rows.some(r=>r.key==='word-memory:unrelated'));
 assert.deepEqual(current,before);assert.deepEqual(mergeImportedNotebook(payload,incoming).payload,payload);assert.deepEqual(notebookImportSummary(incoming),{collections:1,words:1});
});
test('a different collection with the same ID and current draft survive; repeat import makes no extra copy',()=>{
 const incoming=empty();incoming.rows.push(row('vocab-notebook:old',batch()));
 const current=empty();const newer={...batch(),source:'newer'};current.rows.push(row('vocab-notebook:old',newer));current.storage['gre-vocabulary-notebook-drafts-v1']=JSON.stringify({old:{batch:{...newer,source:'unsaved'},revision:3}});
 const {payload,report}=mergeImportedNotebook(current,incoming);assert.equal(report.historicalCopies,1);assert.deepEqual(payload.rows[0],current.rows[0]);assert.equal(payload.storage['gre-vocabulary-notebook-drafts-v1'],current.storage['gre-vocabulary-notebook-drafts-v1']);assert.match(JSON.parse(payload.rows[1].value).source,/历史导入/);
 assert.deepEqual(mergeImportedNotebook(payload,incoming).payload,payload);
});
test('historical colors and notes never replace current colors or notes',()=>{
 const current=empty(),incoming=empty();current.rows.push(row('quick-rating:lclj:1','familiar'),row('word-memory:recall',{text:'new'}));current.storage['gre-lclj-quick-ratings-v1']='{"1":"familiar","3":"unknown"}';
 incoming.rows.push(row('vocab-notebook:old',batch()),row('quick-rating:lclj:1','unknown'),row('quick-rating:lclj:2','fuzzy'),row('word-memory:recall',{text:'old'}));
 const {payload,report}=mergeImportedNotebook(current,incoming);assert.deepEqual(JSON.parse(payload.storage['gre-lclj-quick-ratings-v1']),{'1':'familiar','2':'fuzzy','3':'unknown'});assert.deepEqual(payload.rows[1],current.rows[1]);assert.equal(report.preservedNotes,1);assert.ok(payload.rows.some(r=>r.key.startsWith('notebook-import-note:')));
});
test('malformed collections and duplicate row keys fail before mutating records',()=>{
 const current=empty(),incoming=empty();incoming.rows.push(row('vocab-notebook:old',{...batch(),words:[{}]}));assert.throws(()=>mergeImportedNotebook(current,incoming),/格式/);assert.deepEqual(current,empty());
 incoming.rows=[row('vocab-notebook:old',batch()),row('vocab-notebook:old',batch())];assert.throws(()=>mergeImportedNotebook(current,incoming),/重复/);
});
