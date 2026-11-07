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

test('adjacent repeated spellings display once with every original gloss in its own column and recoverable source IDs',()=>{
 const {groupQingshanRows,qingshanRowLabel}=loadModel('app/qingshanCatalog.ts');
 const precise=qingshanDecks['qingshan-precise'].entries,rare=qingshanDecks['qingshan-rare'].entries;
 const before=JSON.stringify([precise,rare]),p=groupQingshanRows(precise),r=groupQingshanRows(rare);
 assert.deepEqual([p.length,r.length],[60,132]);
 const provocative=p.find(e=>e.word==='provocative');
 assert.equal(p.filter(e=>e.word==='provocative').length,1);assert.equal(provocative.commonMeaning,'adj. 煽动性的');
 assert.equal(provocative.specialMeaning,'adj.引起思考，引起感情的\nadj. 引起争议的\nadj.引起愤怒的');
 assert.equal(qingshanRowLabel(provocative),'第 29–31 行');
 for(const word of ['sound','block','promise','assume','contract','meet','appropriate','given','precipitate','reserve','obscure','critical','bear','arrest','stem','score','issue']){
  const entry=r.find(e=>e.word===word);assert.equal(r.filter(e=>e.word===word).length,1,word);
  const source=rare.filter(e=>e.word===word);assert.deepEqual(entry.sourceRows.map(e=>e.id),source.map(e=>e.id));assert.equal(entry.id,source[0].id);
  for(const field of ['commonMeaning','specialMeaning'])for(const row of source)if(row[field])assert.ok(entry[field].split('\n').includes(row[field]),word+' '+field);
 }
 assert.equal(r.find(e=>e.word==='block').commonMeaning,'n. 街区\nn. 块');assert.equal(r.find(e=>e.word==='meet').commonMeaning,'v. 遇见\nv. 满足');
 assert.deepEqual(p.flatMap(e=>e.sourceRows.map(row=>row.id)),precise.map(e=>e.id));assert.deepEqual(r.flatMap(e=>e.sourceRows.map(row=>row.id)),rare.map(e=>e.id));
 assert.equal(JSON.stringify([precise,rare]),before,'Display grouping must not rewrite original rows used by saved tests');
 assert.equal(p.filter(e=>e.word==='anecdote').length,2,'Different source pages keep their independent grouping and references');
});

test('combined display ratings retain all existing marks and conservatively show mixed source-row mastery',()=>{
 const {groupQingshanRows,qingshanDisplayRating}=loadModel('app/qingshanCatalog.ts');
 const sound=groupQingshanRows(qingshanDecks['qingshan-rare'].entries).find(e=>e.word==='sound');
 const [first,second]=sound.sourceRows.map(e=>e.id);
 for(const [ratings,expected] of [[{},undefined],[{[second]:'familiar'},'familiar'],[{[first]:'familiar',[second]:'fuzzy'},'fuzzy'],[{[first]:'unknown',[second]:'familiar'},'unknown']]){
  const before=JSON.stringify(ratings);assert.equal(qingshanDisplayRating(sound,ratings),expected);assert.equal(JSON.stringify(ratings),before);
 }
});
