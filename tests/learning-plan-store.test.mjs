import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const TODAY='2026-10-17';
const config=(changes={})=>({id:'plan-1',deckIds:['words','bb'],startDay:TODAY,targetDay:'2026-11-17',dailyCap:20,...changes});
const occurrence=(deckId,entryId)=>({deckId,deckName:deckId,entryId,meaning:entryId});
const words=[
 {id:'alpha',word:'Alpha',occurrences:[occurrence('words','w1')]},
 {id:'beta',word:'beta',occurrences:[occurrence('words','w2'),occurrence('bb','b1')]},
 {id:'gamma',word:'gamma',occurrences:[occurrence('bb','b1')]},
 {id:'delta',word:'delta',occurrences:[occurrence('glee','g1')]},
];

// Execute the real store, model, normalization and workspace storage. Only the
// large catalog/database are replaced with small workspace-specific fixtures.
function harness(){
 const cache=new Map();let rows=[];
 class FixedDate extends Date{constructor(...args){super(...(args.length?args:['2026-10-17T04:00:00Z']));}static now(){return Date.parse('2026-10-17T04:00:00Z');}}
 const full=file=>path.resolve(file);
 const catalog={
  getLearningPlanCatalog(snapshot){const notebook=(snapshot?.rows??[]).filter(row=>row.key.startsWith('vocab-notebook:')).map(row=>JSON.parse(row.value));const available=[...words,...notebook.map(word=>({id:word.id,word:word.word,occurrences:[occurrence('notebook',word.id)]}))];return {decks:['words','bb','glee','notebook'].map(id=>({id,name:id,count:available.filter(w=>w.occurrences.some(o=>o.deckId===id)).length})),words:available};},
  selectPlanWords(entries,deckIds){return entries.flatMap(word=>{const occurrences=word.occurrences.filter(o=>deckIds.includes(o.deckId));return occurrences.length?[{...word,occurrences}]:[];});},
  getPlanRatingWords(module,id,source){const available=source??catalog.getLearningPlanCatalog();return available.words.filter(word=>word.occurrences.some(o=>o.deckId===module&&o.entryId===id)).map(word=>word.id);},
 };
 function load(file){file=full(file);if(cache.has(file))return cache.get(file);
  if(file.endsWith('/community/learningPlanCatalog.ts'))return catalog;
  if(file.endsWith('/community/database.ts'))return {exportWorkspace:()=>({version:1,rows:structuredClone(rows),storage:storage.exportStorage()})};
  const out={};cache.set(file,out);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','exports','Date',code)(name=>{assert.ok(name.startsWith('.'),'Unexpected external module '+name);return load(path.resolve(path.dirname(file),name+'.ts'));},out,FixedDate);return out;
 }
 const storage=load('community/storage.ts'),store=load('community/learningPlanStore.ts'),model=load('community/learningPlanModel.ts');
 return {...store,model,storage:storage.studyStorage,snapshot:storage.exportStorage,restore:storage.loadStorage,setRows(next){rows=next;}};
}
const answerKeys=h=>Object.keys(h.snapshot()).filter(key=>key.startsWith(h.PLAN_ANSWER_PREFIX));
function withoutThrow(task){try{return task();}catch{return undefined;}}

test('settings remain small and every word/day answer has an independent JSON-valued storage key',()=>{
 const h=harness();h.saveLearningPlanSettings(config());h.recordLearningPlanWords([' Alpha ','beta'],'green',TODAY);h.recordLearningPlanWords(['alpha'],'yellow','2026-10-18');
 const settings=JSON.parse(h.storage.getItem(h.LEARNING_PLAN_KEY));assert.equal(settings.version,1);assert.equal(settings.config.id,'plan-1');assert.equal(Object.hasOwn(settings,'answers'),false);
 assert.deepEqual(answerKeys(h).sort(),[h.planAnswerKey('plan-1','alpha',TODAY),h.planAnswerKey('plan-1','beta',TODAY),h.planAnswerKey('plan-1','alpha','2026-10-18')].sort());
 assert.equal(h.storage.getItem(h.planAnswerKey('plan-1','alpha',TODAY)),'"green"');
 assert.equal(h.storage.getItem(h.planAnswerKey('plan-1','alpha','2026-10-18')),'"yellow"');
 const before=h.readLearningPlanStore(),saved=h.snapshot();h.restore({});assert.equal(h.readLearningPlanStore(),null);h.restore(saved);assert.deepEqual(h.readLearningPlanStore(),before);
});

test('changing selected decks retains answers for words that were temporarily deselected',()=>{
 const h=harness();h.saveLearningPlanSettings(config());h.recordLearningPlanWords(['alpha'],'red',TODAY);h.recordLearningPlanWords(['gamma'],'green',TODAY);const history=h.readLearningPlanStore().answers;
 h.saveLearningPlanSettings(config({deckIds:['bb']}));assert.deepEqual(h.readLearningPlanStore().answers,history);
 h.saveLearningPlanSettings(config({deckIds:['words']}));assert.deepEqual(h.readLearningPlanStore().answers,history);
 assert.deepEqual(h.model.scheduleLearningPlan(h.readLearningPlanStore(),['alpha','beta'],TODAY).completedIds.sort(),['alpha','gamma']);
});

test('reading existing ratings does not count study; explicit changes count only matching selected words',()=>{
 const h=harness();h.storage.setItem('gre-quick-ratings-v1','{"w1":"familiar","w2":"fuzzy"}');h.saveLearningPlanSettings(config({deckIds:['words']}));
 h.readLearningPlanStore();assert.deepEqual(answerKeys(h),[]);
 h.recordLearningPlanRatings('words',{});assert.deepEqual(answerKeys(h),[]);
 h.recordLearningPlanRatings('words',{w2:'fuzzy',missing:'familiar'});assert.deepEqual(h.readLearningPlanStore().answers,{beta:{[TODAY]:'yellow'}});
 h.recordLearningPlanRatings('glee',{g1:'familiar'});assert.deepEqual(h.readLearningPlanStore().answers,{beta:{[TODAY]:'yellow'}});
 h.recordLearningPlanRatings('unknown',{w1:'familiar'});assert.deepEqual(h.readLearningPlanStore().answers,{beta:{[TODAY]:'yellow'}});
});

test('mixed single-word and pair ratings record each real word once with the lowest same-day rating',()=>{
 const h=harness();h.saveLearningPlanSettings(config());h.recordLearningPlanRatings('words',{w1:'familiar',w2:'fuzzy'});h.recordLearningPlanRatings('bb',{b1:'unknown'});h.recordLearningPlanWords(['alpha','alpha','beta','gamma'],'green',TODAY);
 assert.deepEqual(h.readLearningPlanStore().answers,{alpha:{[TODAY]:'green'},beta:{[TODAY]:'red'},gamma:{[TODAY]:'red'}});assert.equal(answerKeys(h).length,3);
 const before=h.snapshot();h.recordLearningPlanRatings('bb',{b1:'familiar'});assert.deepEqual(h.snapshot(),before);
});

test('paused and future-start plans retain history without recording new work',()=>{
 const h=harness();h.saveLearningPlanSettings(config());h.recordLearningPlanWords(['alpha'],'green',TODAY);h.pauseLearningPlan(true);const paused=h.snapshot();h.recordLearningPlanRatings('words',{w2:'unknown'});h.recordLearningPlanWords(['gamma'],'red',TODAY);assert.deepEqual(h.snapshot(),paused);
 h.pauseLearningPlan(false);h.saveLearningPlanSettings(config({startDay:'2026-10-18'}));const future=h.snapshot();h.recordLearningPlanRatings('words',{w2:'familiar'});h.recordLearningPlanWords(['gamma'],'green',TODAY);assert.deepEqual(h.snapshot(),future);
});

test('account storage replacement never carries another account plan or answers',()=>{
 const h=harness();h.saveLearningPlanSettings(config({id:'account-a'}));h.recordLearningPlanWords(['alpha'],'green',TODAY);const a=h.snapshot();
 h.restore({});h.saveLearningPlanSettings(config({id:'account-b'}));h.recordLearningPlanWords(['beta'],'yellow',TODAY);const b=h.snapshot();assert.deepEqual(h.readLearningPlanStore().answers,{beta:{[TODAY]:'yellow'}});assert.ok(!answerKeys(h).some(key=>key.includes('account-a:')));
 h.restore(a);assert.equal(h.readLearningPlanStore().config.id,'account-a');assert.deepEqual(h.readLearningPlanStore().answers,{alpha:{[TODAY]:'green'}});
 h.restore(b);assert.equal(h.readLearningPlanStore().config.id,'account-b');assert.deepEqual(h.readLearningPlanStore().answers,{beta:{[TODAY]:'yellow'}});
});

test('a stale study callback cannot write its previous plan into the next account',()=>{
 const h=harness();h.saveLearningPlanSettings(config({id:'account-a'}));const state=h.readLearningPlanStore();h.restore({});h.saveLearningPlanSettings(config({id:'account-b'}));const b=h.snapshot();
 withoutThrow(()=>h.recordLearningPlanWord(state,['alpha'],'alpha','green',TODAY));assert.deepEqual(h.snapshot(),b);
});

test('a stale unpaused callback cannot bypass the current paused setting',()=>{
 const h=harness();h.saveLearningPlanSettings(config());const state=h.readLearningPlanStore();h.pauseLearningPlan(true);const before=h.snapshot();
 withoutThrow(()=>h.recordLearningPlanWord(state,['alpha'],'alpha','green',TODAY));assert.deepEqual(h.snapshot(),before);
});

test('without an active plan, ordinary ratings never create plan or answer storage',()=>{
 const h=harness();h.storage.setItem('unrelated','keep');const before=h.snapshot();h.recordLearningPlanRatings('words',{w1:'familiar'});assert.equal(h.recordLearningPlanWords(['alpha'],'green',TODAY),false);assert.deepEqual(h.snapshot(),before);
});

test('invalid dates and unreadable settings are never replaced by empty/default plan data',()=>{
 const h=harness();h.saveLearningPlanSettings(config());h.recordLearningPlanWords(['alpha'],'red',TODAY);const before=h.snapshot();
 withoutThrow(()=>h.recordLearningPlanWords(['beta'],'green','2026-10-32'));assert.deepEqual(h.snapshot(),before);
 assert.throws(()=>h.saveLearningPlanSettings(config({startDay:'2026-02-30'})));assert.deepEqual(h.snapshot(),before);
 for(const raw of ['{broken','null','{"version":2}','{"version":1,"config":{"id":"x"},"paused":false}']){
  h.restore({...before,[h.LEARNING_PLAN_KEY]:raw});const corrupt=h.snapshot();assert.equal(h.readLearningPlanStore(),null);h.recordLearningPlanRatings('words',{w2:'familiar'});withoutThrow(()=>h.pauseLearningPlan(true));assert.deepEqual(h.snapshot(),corrupt);
 }
});

test('malformed daily records are skipped while their raw data and valid history stay untouched',()=>{
 const h=harness();h.saveLearningPlanSettings(config());h.recordLearningPlanWords(['alpha'],'green',TODAY);
 const raw={...h.snapshot(),
  [h.planAnswerKey('plan-1','beta','2026-02-30')]:'"red"',
  [h.planAnswerKey('plan-1','beta','2026-10-18')]:'green',
  ['lemnota-plan-answer:plan-1:bad%ZZ:2026-10-17']:'"red"',
  [h.planAnswerKey('different-plan','gamma',TODAY)]:'"red"',
 };
 h.restore(raw);assert.deepEqual(h.readLearningPlanStore().answers,{alpha:{[TODAY]:'green'}});assert.deepEqual(h.snapshot(),raw);
});
