import type {PlannedWord} from './learningPlanCatalog';
import type {LearningPlanRating} from './learningPlanModel';
type Snapshot={rows:{key:string;value:string}[];storage:Record<string,string>};
const keys:Record<string,string>={words:'gre-quick-ratings-v1',equivalents:'gre-equivalent-quick-ratings-v1','a-plus':'gre-a-plus-equivalent-quick-ratings-v1',bb:'gre-bb-ratings-v1',glee:'gre-glee-1500-quick-ratings-v1',math:'gre-math-vocabulary-quick-ratings-v1',lclj:'gre-lclj-quick-ratings-v1'};
const ranks={red:0,yellow:1,green:2};
const parse=(raw:string|undefined)=>{try{return JSON.parse(raw??'null');}catch{return null;}};
/** Read existing source ratings without changing them or inventing old dates. */
export function existingPlanRatings(snapshot:Snapshot,words:PlannedWord[],deckIds:string[]):Record<string,LearningPlanRating>{
 const selected=new Set(deckIds),index=new Map<string,{id:string;slot?:number;role?:string}[]>(),result:Record<string,LearningPlanRating>=Object.create(null);
 for(const w of words)for(const o of w.occurrences)if(selected.has(o.deckId)){
  const key=`${o.deckId}:${o.entryId}`,entries=index.get(key)??[];entries.push({id:w.id,slot:o.slot,role:o.role});index.set(key,entries);
 }
 function put(id:string,color:LearningPlanRating){if(!result[id]||ranks[color]<ranks[result[id]])result[id]=color;}
 function accept(module:string,id:string,value:unknown){
  const color=value==='familiar'?'green':value==='fuzzy'?'yellow':value==='unknown'?'red':null;if(!color)return;
  let entry=id,direction='';const split=id.lastIndexOf(':'),suffix=id.slice(split+1);
  if((module==='a-plus'&&['word','equivalents','meaning'].includes(suffix))||(module==='equivalents'&&['left','right','meaning'].includes(suffix))||(module==='bb'&&['0','1'].includes(suffix))){entry=id.slice(0,split);direction=suffix;}
  for(const deck of module==='lclj'?['lclj-fill','lclj-reading','lclj-math']:[module])for(const item of index.get(`${deck}:${entry}`)??[]){
   if(module==='a-plus'&&direction==='word'&&item.role!=='core'||module==='a-plus'&&direction==='equivalents'&&item.role!=='equivalent')continue;
   if(module==='equivalents'&&['left','right'].includes(direction)&&item.slot!==(direction==='left'?0:1)||module==='bb'&&direction&&item.slot!==Number(direction))continue;
   put(item.id,color);
  }
 }
 // SQL is the baseline; pending/UI copies win for the same source target.
 for(const [module,key] of Object.entries(keys)){
  const values:Record<string,unknown>=Object.create(null),prefix=`quick-rating:${module}:`;
  for(const row of snapshot.rows)if(row.key.startsWith(prefix))values[row.key.slice(prefix.length)]=parse(row.value);
  for(const storageKey of [key,`gre-rating-cloud-pending:${module}`]){const saved=parse(snapshot.storage[storageKey]);if(saved&&typeof saved==='object'&&!Array.isArray(saved))Object.assign(values,saved);}
  for(const [id,value] of Object.entries(values))accept(module,id,value);
 }
 if(selected.has('notebook')){
  const batches=new Map<string,unknown>();for(const row of snapshot.rows)if(row.key.startsWith('vocab-notebook:'))batches.set(row.key.slice(15),parse(row.value));
  for(const [id,draft] of Object.entries(parse(snapshot.storage['gre-vocabulary-notebook-drafts-v1'])??{}))if(draft&&typeof draft==='object')batches.set(id,(draft as {batch?:unknown}).batch);
  for(const batch of batches.values())if(batch&&typeof batch==='object'&&Array.isArray((batch as {words?:unknown}).words))for(const item of (batch as {words:{id:string;rating?:string}[]}).words){
   const batchId=(batch as {id:string}).id;for(const target of index.get(`notebook:${batchId}:${item.id}`)??[]){const c=item.rating==='familiar'?'green':item.rating==='fuzzy'?'yellow':item.rating==='unknown'?'red':null;if(c)put(target.id,c);}
  }
 }
 return result;
}
