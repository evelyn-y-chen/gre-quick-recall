import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModel} from './helpers/load-model.mjs';
const {qingshanDecks,qingshanRatingKeys}=loadModel('app/qingshanCatalog.ts');
const {getLearningPlanCatalog}=loadModel('community/learningPlanCatalog.ts');
const {buildPlannedLists}=loadModel('community/listLearningPlanModel.ts');
const {optionsFor}=loadModel('community/practiceModel.ts');
const {recallFields}=loadModel('community/recallTerms.ts');
const {isPracticeStorageKey,mergeImportedPractice,practiceProgressSummary}=loadModel('community/practiceProgressMerge.ts');
const recall=loadModel('community/recallModel.ts');

test('both Qingshan source tables retain every row, original page and separate meaning columns',()=>{
 const precise=qingshanDecks['qingshan-precise'],rare=qingshanDecks['qingshan-rare'];
 assert.deepEqual([precise.commonLabel,precise.specialLabel],['词典释义','精准释义']);
 assert.deepEqual([rare.commonLabel,rare.specialLabel],['常见释义','重要僻义']);
 assert.deepEqual([1,2].map(n=>precise.entries.filter(e=>e.list===n).length),[43,19]);
 assert.deepEqual([1,2,3,4].map(n=>rare.entries.filter(e=>e.list===n).length),[46,48,49,6]);
 assert.deepEqual(precise.entries.filter(e=>e.word==='provocative').map(e=>e.commonMeaning),['adj. 煽动性的','','']);
 assert.equal(rare.entries.filter(e=>e.word==='sound').length,2);
 assert.equal(rare.entries.find(e=>e.word==='block'&&!e.specialMeaning).commonMeaning,'n. 块');
 assert.equal(rare.entries.find(e=>e.word==='meet').specialMeaning,'');
 assert.equal(precise.entries.at(-1).word,'universal');assert.equal(rare.entries.at(-1).specialMeaning,'v. 发起');
 for(const table of [precise,rare]){
  assert.equal(new Set(table.entries.map(e=>e.id)).size,table.entries.length);
  for(const e of table.entries){assert.ok(e.word&&e.meaning);assert.ok(!/[\u4e00-\u9fff]/.test(e.word));assert.equal(e.page,e.list+1);assert.equal(e.group,`原表第 ${e.list} 页`);assert.ok(!/kaoshiguo|EasyTV|一手更新/.test(JSON.stringify(e)));}
 }
});
test('new modules share catalog word identities, retain page groups and expose both source glosses to flashcards',()=>{
 const catalog=getLearningPlanCatalog();
 for(const [deck,table] of Object.entries(qingshanDecks)){
  const pages=[...new Set(table.entries.map(e=>e.group))];assert.deepEqual(buildPlannedLists(catalog.words,[deck]).map(u=>u.label),pages);
  const term=table.entries[0];assert.ok(catalog.words.find(w=>w.id===term.word).occurrences.some(o=>o.deckId===deck));
  const fields=recallFields({...term,commonMeaningLabel:table.commonLabel,specialMeaningLabel:table.specialLabel});
  assert.equal(fields.find(f=>f.label===table.commonLabel).value,term.commonMeaning);assert.equal(fields.find(f=>f.label===table.specialLabel).value,term.meaning);
 }
 const experimental=catalog.words.find(w=>w.id==='experimental');assert.ok(experimental.occurrences.some(o=>o.deckId==='qingshan-precise'));assert.ok(experimental.occurrences.some(o=>o.deckId==='qingshan-rare'));
});
test('Qingshan tests have unambiguous answers and independently restorable choice, flashcard and review records',()=>{
 for(const [deck,table] of Object.entries(qingshanDecks)){
  const terms=table.entries;
  for(const term of terms.filter((_,i)=>i%9===0))for(const direction of ['en-zh','zh-en']){
   const choices=optionsFor(term,terms,direction,[]);assert.ok(choices.length>=2);assert.equal(choices.filter(c=>c.correct).length,1);
   assert.ok(choices.filter(c=>!c.correct).every(c=>c.word.toLowerCase()!==term.word.toLowerCase()));
  }
  const run=recall.createRecallRun(terms.slice(0,2).map(t=>t.id),{mode:'strict',retry:'all'}),key=recall.recallKey(deck),reviewKey='lemnota-practice-review-'+deck+'-v1';
  for(const name of [key,reviewKey,'lemnota-practice-'+deck])assert.equal(isPracticeStorageKey(name),true);
  const current={version:1,rows:[],storage:{unrelated:'keep',[qingshanRatingKeys[deck]]:'{}'}};
  const result=mergeImportedPractice(current,{version:1,rows:[],storage:{[key]:JSON.stringify(run),[reviewKey]:'{}'}});
  assert.equal(result.storage.unrelated,'keep');assert.equal(result.storage[qingshanRatingKeys[deck]],'{}');assert.equal(practiceProgressSummary(result)[0].remaining,2);assert.match(practiceProgressSummary(result)[0].label,new RegExp(table.title));
 }
});
