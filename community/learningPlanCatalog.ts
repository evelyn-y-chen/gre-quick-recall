import vocabulary from '../app/vocabulary.json';
import equivalents from '../app/equivalents.json';
import aplus from '../app/aPlusEquivalents.json';
import bb from '../app/bbEquivalents.json';
import glee from '../app/glee1500.json';
import fill from '../app/lcljFill.json';
import reading from '../app/lcljReading.json';
import mathIndex from '../app/lcljMath.json';
import {MATH_WORDS} from '../app/mathVocabulary';
import {equivalents as aPlusTerms} from '../app/aPlusTestModel';
import {NOTEBOOK_DRAFT_KEY,validNotebookBatch,type NotebookBatch} from '../app/notebookModel';
import {wordMemoryKey} from '../app/wordMemoryModel';

export type PlannedOccurrence={
 deckId:string;deckName:string;entryId:string;meaning:string;list?:number;category?:string;slot?:number;
 /** Equivalent terms inherit the source group's gloss, not an independent dictionary definition. */
 role?:'core'|'equivalent';
};
export type PlannedWord={id:string;word:string;occurrences:PlannedOccurrence[]};
export type PlanDeck={id:string;name:string;count:number};
type PlanSnapshot={rows:{key:string;value:string}[];storage:Record<string,string>};
type PlanCatalog={decks:PlanDeck[];words:PlannedWord[]};
const definitions=[
 ['words','全能词速刷'],['equivalents','等价词速刷'],['a-plus','A+ 等价词'],['bb','BB 六选二'],
 ['glee','GLEE 必备1500词'],['math','数学词汇'],['lclj-fill','填空高频3000词'],
 ['lclj-reading','阅读核心300词'],['lclj-math','数学词汇索引'],['notebook','生词本'],
] as const;
const names=new Map<string,string>(definitions);
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const parsed=(raw:string|undefined):unknown=>{try{return raw===undefined?undefined:JSON.parse(raw);}catch{return undefined;}};

/** Stable source IDs remain separate from the normalized word ID used for deduplication. */
export function getLearningPlanCatalog(snapshot?:PlanSnapshot):PlanCatalog{
 const words=new Map<string,PlannedWord>();
 const perDeck=new Map(definitions.map(([id])=>[id,new Set<string>()]));
 function add(deckId:typeof definitions[number][0],entryId:string,word:string,meaning:string,extra:Pick<PlannedOccurrence,'list'|'category'|'slot'|'role'>={}){
  const id=wordMemoryKey(word);if(!id)return;
  const occurrence:PlannedOccurrence={deckId,deckName:names.get(deckId)!,entryId,meaning,...extra};
  const previous=words.get(id);
  if(previous)previous.occurrences.push(occurrence);
  else words.set(id,{id,word:word.trim(),occurrences:[occurrence]});
  perDeck.get(deckId)!.add(id);
 }
 vocabulary.forEach(entry=>add('words',entry.id,entry.word,entry.meaning,{list:entry.list}));
 equivalents.forEach(entry=>{
  add('equivalents',entry.id,entry.left,entry.meaning,{list:entry.set,slot:0,role:'equivalent'});
  add('equivalents',entry.id,entry.right,entry.meaning,{list:entry.set,slot:1,role:'equivalent'});
 });
 aplus.forEach(entry=>{
  add('a-plus',entry.id,entry.word,entry.meaning,{list:entry.list,slot:0,role:'core'});
  aPlusTerms(entry).forEach((word,index)=>add('a-plus',entry.id,word,entry.meaning,{list:entry.list,slot:index+1,role:'equivalent'}));
 });
 bb.forEach(entry=>entry.words.forEach((word,slot)=>add('bb',entry.id,word.word,word.meaning,{list:entry.list,slot})));
 glee.forEach(entry=>add('glee',entry.id,entry.word,entry.meaning,{list:entry.list}));
 MATH_WORDS.forEach(entry=>add('math',entry.id,entry.term,entry.meaning,{category:entry.category}));
 fill.forEach(entry=>add('lclj-fill',entry.id,entry.word,entry.meaning,{list:entry.list}));
 reading.forEach((entry,index)=>add('lclj-reading',entry.id,entry.word,
  `本义：${entry.meaning}\n文中义：${entry.context}\n对应选项：${entry.equivalent}`,
  {list:Math.floor(index/50)+1,category:entry.category}));
 mathIndex.forEach(entry=>add('lclj-math',entry.id,entry.word,entry.meaning,{category:entry.category}));

 const batches=new Map<string,NotebookBatch>();
 for(const row of snapshot?.rows??[]){
  if(!row.key.startsWith('vocab-notebook:'))continue;
  const batch=parsed(row.value);
  if(validNotebookBatch(batch,false)&&row.key===`vocab-notebook:${batch.id}`)batches.set(batch.id,batch);
 }
 const drafts=parsed(snapshot?.storage[NOTEBOOK_DRAFT_KEY]);
 if(object(drafts))for(const draft of Object.values(drafts)){
  if(object(draft)&&validNotebookBatch(draft.batch,false)&&Number.isInteger(draft.revision)&&(draft.revision as number)>=0)batches.set(draft.batch.id,draft.batch);
 }
 for(const batch of batches.values())for(const word of batch.words){
  add('notebook',`${batch.id}:${word.id}`,word.word,word.meaning,{category:batch.source});
 }
 return {decks:definitions.map(([id,name])=>({id,name,count:perDeck.get(id)!.size})),words:[...words.values()]};
}

/** Keep catalog order and every selected occurrence, counting an exact word only once. */
export function selectPlanWords(words:PlannedWord[],deckIds:readonly string[]):PlannedWord[]{
 const selected=new Set(deckIds),out=new Map<string,PlannedWord>();
 for(const word of words){
  const occurrences=word.occurrences.filter(occurrence=>selected.has(occurrence.deckId));
  const id=wordMemoryKey(word.word);if(!id||!occurrences.length)continue;
  const previous=out.get(id);
  if(previous)previous.occurrences.push(...occurrences.map(occurrence=>({...occurrence})));
  else out.set(id,{id,word:word.word,occurrences:occurrences.map(occurrence=>({...occurrence}))});
 }
 return [...out.values()];
}

let staticCatalog:PlanCatalog|undefined;
/** Map a real rating target to normalized plan-word IDs. Highlight toggles are not ratings. */
export function getPlanRatingWords(module:string,id:string,catalog?:PlanCatalog):string[]{
 if(module==='a-plus-words'||!id)return [];
 const decks=module==='lclj'?['lclj-fill','lclj-reading','lclj-math']:[module];
 if(!decks.some(deck=>names.has(deck)))return [];
 let entryId=id,direction:string|undefined;
 if(module==='a-plus'||module==='equivalents'){
  const allowed=module==='a-plus'?['word','equivalents','meaning']:['left','right','meaning'];
  const colon=id.lastIndexOf(':'),suffix=id.slice(colon+1);
  if(colon>=0&&allowed.includes(suffix)){entryId=id.slice(0,colon);direction=suffix;}
 }else if(module==='bb'&&/:[01]$/.test(id)){
  entryId=id.slice(0,-2);direction=id.slice(-1);
 }
 const source=catalog??(staticCatalog??=getLearningPlanCatalog());
 return source.words.filter(word=>word.occurrences.some(occurrence=>{
  if(!decks.includes(occurrence.deckId)||occurrence.entryId!==entryId)return false;
  if(module==='a-plus'&&direction==='word')return occurrence.role==='core';
  if(module==='a-plus'&&direction==='equivalents')return occurrence.role==='equivalent';
  if(module==='equivalents'&&(direction==='left'||direction==='right'))return occurrence.slot===(direction==='left'?0:1);
  if(module==='bb'&&direction!==undefined)return occurrence.slot===Number(direction);
  return true;
 })).map(word=>word.id);
}
