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

test('jijing 7.0 retains all source DAY groups, complete fields, stable IDs and phrase boundaries',()=>{
 const entries=zhangDecks['zhang-jijing'].entries;
 assert.equal(entries.length,1450);assert.equal(new Set(entries.map(e=>e.id)).size,1450);
 assert.deepEqual(Array.from({length:7},(_,i)=>entries.filter(e=>e.list===i+1).length),[210,210,210,210,210,210,190]);
 assert.equal(entries[0].word,'noisome');assert.equal(entries[0].meaning,'令人讨厌的，恶臭的');assert.equal(entries[0].synonyms,'malodorous');
 assert.equal(entries.at(-1).word,'at odds with');assert.ok(entries.find(e=>e.word==='keep abreast of'));
 assert.equal(entries.filter(e=>e.sourceExample).length,1408);
 for(const e of entries){assert.ok(e.meaning&&e.english&&e.page>=3&&e.page<=189);assert.ok(!/[\u4e00-\u9fff]/.test(e.english));assert.ok(!/[\u4e00-\u9fff]/.test(e.word));assert.ok(!/MicrosoftYaHei|cid:/.test(JSON.stringify(e)));}
 const catalog=getLearningPlanCatalog();assert.deepEqual(buildPlannedLists(catalog.words,['zhang-jijing']).map(u=>u.label),Array.from({length:7},(_,i)=>'DAY '+(i+1)));
 assert.ok(catalog.words.find(w=>w.id==='noisome').occurrences.some(o=>o.deckId==='zhang-jijing'));
 const terms=entries.map(e=>({...e,synonyms:zhangSynonyms(e)})),links=terms.map(e=>[e.word,...e.synonyms]);
 for(const term of terms.filter((_,i)=>i%75===0)){const choices=optionsFor(term,terms,'en-zh',links);assert.ok(choices.length>=2);assert.equal(choices.filter(c=>c.correct).length,1);}
 for(const key of ['lemnota-practice-zhang-jijing','lemnota-practice-review-zhang-jijing-v1'])assert.ok(isPracticeStorageKey(key));
 assert.equal(zhangRatingKeys['zhang-jijing'],'gre-zhang-jijing-ratings-v1');
});
