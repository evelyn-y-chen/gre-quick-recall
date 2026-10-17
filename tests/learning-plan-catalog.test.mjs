import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {dirname,resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';

// Load the real adapter, source datasets, normalizer and A+ cleanup function.
// There is no browser storage, account, database or network dependency.
const cache=new Map();
function load(file){
 if(cache.has(file))return cache.get(file).exports;
 if(extname(file)==='.json')return JSON.parse(readFileSync(file,'utf8'));
 const module={exports:{}};cache.set(file,module);
 const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 new Function('require','module','exports',code)(name=>{
  assert.ok(name.startsWith('.'),'Unexpected external dependency '+name);
  const path=resolve(dirname(file),name);
  return load(existsSync(path)?path:path+'.ts');
 },module,module.exports);
 return module.exports;
}
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const {getLearningPlanCatalog:getCatalog,selectPlanWords:select,getPlanRatingWords:ratingWords}=load(resolve(root,'community/learningPlanCatalog.ts'));
const {NOTEBOOK_DRAFT_KEY}=load(resolve(root,'app/notebookModel.ts'));
const aplus=load(resolve(root,'app/aPlusEquivalents.json'));
const bb=load(resolve(root,'app/bbEquivalents.json'));
const pairs=load(resolve(root,'app/equivalents.json'));
const reading=load(resolve(root,'app/lcljReading.json'));
const mathIndex=load(resolve(root,'app/lcljMath.json'));
const {MATH_WORDS}=load(resolve(root,'app/mathVocabulary.ts'));
const catalog=getCatalog();
const item=(word,id,meaning='完整释义')=>({id,word,meaning,note:'独立笔记',origin:'测试来源'});
const batch=(id,words)=>({id,source:'我的收藏',date:'2026-10-17',words});
const saved=value=>({key:'vocab-notebook:'+value.id,value:JSON.stringify(value)});
const occurrences=(data,word,deck)=>data.words.find(w=>w.id===word)?.occurrences.filter(o=>o.deckId===deck)??[];

test('all nine source decks expose distinct word counts and exact multi-deck duplicates retain their sources',()=>{
 assert.deepEqual(catalog.decks.map(d=>d.id),['words','equivalents','a-plus','bb','glee','math','lclj-fill','lclj-reading','lclj-math','notebook']);
 assert.ok(catalog.decks.filter(d=>d.id!=='notebook').every(d=>d.count>0));
 assert.equal(catalog.decks.find(d=>d.id==='notebook').count,0);
 const words=select(catalog.words,['words']),ap=select(catalog.words,['a-plus']);
 const combined=select(catalog.words,['words','a-plus']);
 assert.ok(combined.length<words.length+ap.length,'cross-deck repeated spellings occupy one task');
 assert.equal(new Set(combined.map(w=>w.id)).size,combined.length);
 const abandon=combined.find(w=>w.id==='abandon');
 assert.ok(abandon.occurrences.some(o=>o.deckId==='words'));
 assert.ok(abandon.occurrences.some(o=>o.deckId==='a-plus'));
 assert.ok(combined.every(w=>w.occurrences.every(o=>['words','a-plus'].includes(o.deckId))));
 assert.deepEqual(combined.map(w=>w.id),catalog.words.filter(w=>w.occurrences.some(o=>['words','a-plus'].includes(o.deckId))).map(w=>w.id));
 assert.equal(catalog.decks.find(d=>d.id==='words').count,words.length);
 assert.equal(catalog.decks.find(d=>d.id==='a-plus').count,ap.length);
 assert.deepEqual(select(catalog.words,[]),[]);
});

test('different meanings remain complete under one word, and A+ aliases are clearly group meanings',()=>{
 const abate=select(catalog.words,['words','equivalents','a-plus']).find(w=>w.id==='abate');
 assert.ok(new Set(abate.occurrences.map(o=>o.meaning)).size>1,'same spelling must not erase different source glosses');
 for(const id of ['a-plus-075','a-plus-549','a-plus-563','a-plus-045']){
  const source=aplus.find(e=>e.id===id);
  const aliases=catalog.words.flatMap(w=>w.occurrences.filter(o=>o.deckId==='a-plus'&&o.entryId===id&&o.role==='equivalent').map(o=>({word:w.id,...o})));
  assert.ok(aliases.length);
  assert.ok(aliases.every(o=>o.meaning===source.meaning&&o.list===source.list));
  assert.ok(aliases.every(o=>!o.word.includes('（')));
 }
 assert.deepEqual(new Set(ratingWords('a-plus','a-plus-075:equivalents',catalog)),new Set(['lackluster','stale']));
 assert.deepEqual(ratingWords('a-plus','a-plus-075:word',catalog),['banal']);
 assert.deepEqual(new Set(ratingWords('a-plus','a-plus-075:meaning',catalog)),new Set(['banal','lackluster','stale']));
 assert.equal(catalog.words.some(w=>w.id==='lackluster stale'&&w.occurrences.some(o=>o.entryId==='a-plus-075')),false);
 const anathema=aplus.find(e=>e.id==='a-plus-045');
 assert.equal(occurrences(catalog,'repellent','a-plus').find(o=>o.entryId===anathema.id).meaning,anathema.meaning);
});

test('BB words are separate tasks with their own glosses and map to both group and per-word IDs',()=>{
 const source=bb[0],expected=source.words.map(w=>w.word.trim().toLowerCase());
 assert.equal(new Set(expected).size,2);
 for(let slot=0;slot<2;slot++){
  const occurrence=occurrences(catalog,expected[slot],'bb').find(o=>o.entryId===source.id&&o.slot===slot);
  assert.ok(occurrence);
  assert.equal(occurrence.meaning,source.words[slot].meaning);
  assert.deepEqual(ratingWords('bb',source.id+':'+slot,catalog),[expected[slot]]);
 }
 assert.deepEqual(new Set(ratingWords('bb',source.id,catalog)),new Set(expected));
});

test('directional equivalents select one side, Chinese cues select the whole group, and highlights never count',()=>{
 const pair=pairs.find(e=>e.id==='e0001');
 assert.deepEqual(ratingWords('equivalents',pair.id+':left',catalog),[pair.left]);
 assert.deepEqual(ratingWords('equivalents',pair.id+':right',catalog),[pair.right]);
 assert.deepEqual(new Set(ratingWords('equivalents',pair.id+':meaning',catalog)),new Set([pair.left,pair.right]));
 assert.deepEqual(new Set(ratingWords('equivalents',pair.id,catalog)),new Set([pair.left,pair.right]));
 assert.deepEqual(ratingWords('a-plus-words','abandon',catalog),[]);
 const marked=getCatalog({rows:[],storage:{'gre-a-plus-word-marks-v1':JSON.stringify({abandon:'familiar',banal:'unknown'})}});
 assert.deepEqual(marked,catalog,'cancelled highlighting must not change the learning catalog or imply knowledge');
 assert.deepEqual(ratingWords('a-plus-words','banal',marked),[]);
 assert.deepEqual(ratingWords('not-a-module',pair.id,catalog),[]);
 assert.deepEqual(ratingWords('words','not-a-real-id',catalog),[]);
});

test('the mathematical sources stay distinct and reading keeps full contextual meaning',()=>{
 const ordinary=MATH_WORDS[0],index=mathIndex[0];
 assert.deepEqual(ratingWords('math',ordinary.id,catalog),[ordinary.term.toLowerCase()]);
 assert.deepEqual(ratingWords('lclj',index.id,catalog),[index.word.toLowerCase()]);
 assert.deepEqual(ratingWords('math',index.id,catalog),[]);
 assert.deepEqual(ratingWords('lclj',ordinary.id,catalog),[]);
 const first=reading[0],occurrence=occurrences(catalog,first.word.toLowerCase(),'lclj-reading').find(o=>o.entryId===first.id);
 assert.equal(occurrence.meaning,`本义：${first.meaning}\n文中义：${first.context}\n对应选项：${first.equivalent}`);
 assert.equal(occurrence.list,1);
 assert.equal(occurrence.category,first.category);
 const last=reading.at(-1);
 assert.equal(occurrences(catalog,last.word.toLowerCase(),'lclj-reading').find(o=>o.entryId===last.id).list,7);
 assert.deepEqual(ratingWords('lclj',first.id,catalog),[first.word.toLowerCase()]);
});

test('notebook drafts replace their batch only, preserve full notes and use stable batch plus word IDs',()=>{
 const longMeaning='【阅读来源】\n不同词义一；词义二。\n'+('不可截断的释义。'.repeat(80));
 const cloud=batch('one',[item('old notebook-only sentinel','old')]);
 const other=batch('two',[item('Notebook new sentinel','same-spelling','另一批次的释义')]);
 const draft={batch:{...batch('one',[item(' Notebook NEW sentinel ','stable-id',longMeaning),item('Draft second sentinel','second')]),source:'',date:''},revision:2};
 const snapshot={rows:[saved(cloud),saved(other),{key:'word-memory:private note',value:'"排除"'}],storage:{[NOTEBOOK_DRAFT_KEY]:JSON.stringify({one:draft,broken:{batch:{words:[]},revision:-1}})}};
 const before=JSON.stringify(snapshot),data=getCatalog(snapshot),words=select(data.words,['notebook']);
 assert.equal(words.length,2);
 assert.equal(data.decks.find(d=>d.id==='notebook').count,2);
 assert.equal(words.some(w=>w.id==='old notebook-only sentinel'),false);
 const shared=words.find(w=>w.id==='notebook new sentinel');
 assert.equal(shared.occurrences.length,2);
 assert.equal(shared.occurrences.find(o=>o.entryId==='one:stable-id').meaning,longMeaning);
 assert.ok(shared.occurrences.some(o=>o.entryId==='two:same-spelling'));
 assert.deepEqual(ratingWords('notebook','one:stable-id',data),['notebook new sentinel']);
 const reordered=structuredClone(snapshot),stored=JSON.parse(reordered.storage[NOTEBOOK_DRAFT_KEY]);stored.one.batch.words.reverse();reordered.storage[NOTEBOOK_DRAFT_KEY]=JSON.stringify(stored);
 assert.equal(occurrences(getCatalog(reordered),'notebook new sentinel','notebook').find(o=>o.entryId.startsWith('one:')).entryId,'one:stable-id');
 assert.equal(JSON.stringify(snapshot),before,'catalog building must be read-only');
});

test('normalization only folds exact formatting variants, not stems, synonyms, hyphens or phrases',()=>{
 const words=[item(' Planner sentinel ','a','第一义'),item('PLANNER   SENTINEL','b','第二义'),item('Planner sentinels','c'),item('Planner-sentinel','d'),item('Plan sentinel','e'),item('Planner café','f'),item('Planner cafe\u0301','g')];
 const selected=select(getCatalog({rows:[saved(batch('exact',words))],storage:{}}).words,['notebook']);
 assert.equal(selected.length,5);
 assert.deepEqual(selected.map(w=>w.id),['planner sentinel','planner sentinels','planner-sentinel','plan sentinel','planner café']);
 assert.deepEqual(selected.find(w=>w.id==='planner sentinel').occurrences.map(o=>o.meaning),['第一义','第二义']);
 const selectedAgain=select(selected,['notebook']);selectedAgain[0].occurrences[0].meaning='调用方修改';
 assert.equal(selected[0].occurrences[0].meaning,'第一义','filtered catalogs should not mutate the source occurrence objects');
});
