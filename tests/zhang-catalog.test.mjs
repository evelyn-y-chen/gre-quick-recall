import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModel} from './helpers/load-model.mjs';
const {zhangDecks,zhangSynonyms,zhangRatingKeys}=loadModel('app/zhangCatalog.ts');
const {getLearningPlanCatalog}=loadModel('community/learningPlanCatalog.ts');
const {buildPlannedLists}=loadModel('community/listLearningPlanModel.ts');
const {optionsFor}=loadModel('community/practiceModel.ts');
const {mergeImportedPractice,isPracticeStorageKey}=loadModel('community/practiceProgressMerge.ts');
test('source rows retain all 33 original word groups and five original day groups',()=>{
 const words=zhangDecks['zhang-words'].entries,pairs=zhangDecks['zhang-pairs'].entries;
 assert.equal(words.length,3283);assert.equal(pairs.length,905);
 assert.equal(new Set(words.map(e=>e.group)).size,33);assert.equal(new Set(pairs.map(e=>e.group)).size,5);
 for(const entries of [words,pairs]){assert.equal(new Set(entries.map(e=>e.id)).size,entries.length);for(const e of entries){assert.ok(e.meaning&&e.word&&e.page>=5);assert.ok(!/[\u4e00-\u9fff]/.test(e.word));}}
 assert.equal(words[0].english,'adj. habitually complaining');assert.equal(words[0].meaning,'抱怨的，发牢骚的');
 assert.equal(words.find(e=>e.word==='unconscionable').page,8);
 assert.ok(words.every(e=>!/[\u4e00-\u9fff]/.test(e.english)));
 assert.deepEqual(zhangSynonyms(pairs[0]),['abate','curtail','temper','ameliorate']);
 assert.equal(words.at(-1).group,'2025年最新真题词汇');
});
test('study lists preserve supplement and day labels, and same words share catalog identity',()=>{
 const catalog=getLearningPlanCatalog();
 assert.equal(buildPlannedLists(catalog.words,['zhang-words']).length,33);
 assert.deepEqual(buildPlannedLists(catalog.words,['zhang-pairs']).map(u=>u.label),['第一天任务','第二天任务','第三天任务','第四天任务','第五天任务']);
 const word=catalog.words.find(w=>w.id==='conjecture');assert.ok(word.occurrences.some(o=>o.deckId==='words'));assert.ok(word.occurrences.some(o=>o.deckId==='zhang-words'));
});
test('both new tests generate a unique correct answer and isolated restorable records',()=>{
 for(const id of ['zhang-words','zhang-pairs']){
 const terms=zhangDecks[id].entries.map(e=>({...e,synonyms:zhangSynonyms(e)})),links=terms.map(t=>[t.word,...t.synonyms]);
 for(const term of terms.filter((_,i)=>i%100===0)){const choices=optionsFor(term,terms,'en-zh',links,id==='zhang-pairs');assert.ok(choices.length>=2);assert.equal(choices.filter(c=>c.correct).length,1);}
 const key='lemnota-practice-review-'+id+'-v1';assert.ok(isPracticeStorageKey(key));
 const current={version:1,rows:[],storage:{unrelated:'keep',[zhangRatingKeys[id]]:'{}'}};
 const merged=mergeImportedPractice(current,{version:1,rows:[],storage:{[key]:'{}'}});assert.equal(merged.storage.unrelated,'keep');assert.equal(merged.storage[key],'{}');
 }
});
