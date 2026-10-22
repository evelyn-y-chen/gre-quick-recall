import type {Snapshot} from './database';
import {validNotebookBatch,NOTEBOOK_DRAFT_KEY,type NotebookBatch} from '../app/notebookModel';
import {wordMemoryKey} from '../app/wordMemoryModel';
import {mergeMissingImportedRatings} from './ratingMerge';
type Row=Snapshot['rows'][number];
export type NotebookImportReport={addedCollections:number;addedWords:number;duplicateCollections:number;historicalCopies:number;addedNotes:number;preservedNotes:number;addedRatings:number};
const parse=(raw:string):unknown=>{try{return JSON.parse(raw);}catch{return undefined;}};
// A deterministic content address makes a repeated historical import idempotent.
function canonical(value:unknown):string{
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
 return JSON.stringify(value)??'null';
}
function hash(value:unknown){let a=2166136261,b=5381;for(const c of canonical(value)){a=Math.imul(a^c.charCodeAt(0),16777619);b=Math.imul(b,33)^c.charCodeAt(0);}return (a>>>0).toString(16)+(b>>>0).toString(16);}
function batches(incoming:Snapshot){
 const seen=new Set<string>();const result:{row:Row;batch:NotebookBatch}[]=[];
 for(const row of incoming.rows){
  if(seen.has(row.key))throw Error('便笺中有重复记录，尚未导入。');seen.add(row.key);
  if(!row.key.startsWith('vocab-notebook:'))continue;
  const batch=parse(row.value);
  if(!validNotebookBatch(batch)||row.key!=='vocab-notebook:'+batch.id)throw Error('便笺中的生词收集格式不完整，尚未导入。');
  result.push({row,batch});
 }return result;
}
export function notebookImportSummary(incoming:Snapshot){const entries=batches(incoming);return {collections:entries.length,words:entries.reduce((n,b)=>n+b.batch.words.length,0)};}
/** Add historical collections and missing ratings. Existing records/drafts always win. */
export function mergeImportedNotebook(current:Snapshot,incoming:Snapshot):{payload:Snapshot;report:NotebookImportReport}{
 const entries=batches(incoming),rows=current.rows.map(r=>({...r})),byKey=new Map(rows.map(r=>[r.key,r]));
 if(byKey.size!==rows.length)throw Error('当前学习空间有重复记录，请先导出便笺核对。');
 const draftValue=parse(current.storage[NOTEBOOK_DRAFT_KEY]??'{}');
 const drafts=draftValue&&typeof draftValue==='object'&&!Array.isArray(draftValue)?draftValue as Record<string,{batch?:unknown}>:{};
 const report:NotebookImportReport={addedCollections:0,addedWords:0,duplicateCollections:0,historicalCopies:0,addedNotes:0,preservedNotes:0,addedRatings:0};
 const add=(row:Row)=>{rows.push(row);byKey.set(row.key,row);};
 for(const {row,batch} of entries){
  const existing=byKey.get(row.key),draft=drafts[batch.id]?.batch;
  if(existing&&canonical(parse(existing.value))===canonical(batch)&&(!draft||canonical(draft)===canonical(batch))){report.duplicateCollections++;continue;}
  if(!existing&&!draft){add({...row});report.addedCollections++;report.addedWords+=batch.words.length;continue;}
  const suffix=hash(batch);let index=0;
  for(;;){
   const id=`import-${batch.id.slice(0,40)}-${suffix}${index?'-'+index:''}`;
   const copy:NotebookBatch={...batch,id,source:`历史导入 · ${batch.source}`.slice(0,300)};
   const key='vocab-notebook:'+id,prior=byKey.get(key),pending=drafts[id]?.batch;
   if(prior&&canonical(parse(prior.value))===canonical(copy)&&(!pending||canonical(pending)===canonical(copy))){report.duplicateCollections++;break;}
   if(!prior&&!pending){add({...row,key,value:JSON.stringify(copy)});report.addedCollections++;report.historicalCopies++;report.addedWords+=batch.words.length;break;}
   index++;if(index>1000)throw Error('历史副本过多，请先核对收集；尚未导入。');
  }
 }
 const words=new Set(entries.flatMap(e=>e.batch.words.map(w=>wordMemoryKey(w.word))));
 for(const row of incoming.rows){
  const prefix=['word-memory:','a-plus-note:'].find(p=>row.key.startsWith(p));
  if(!prefix||!words.has(wordMemoryKey(row.key.slice(prefix.length))))continue;
  const existing=byKey.get(row.key);
  if(!existing){add({...row});report.addedNotes++;}
  else if(existing.value!==row.value){
   const key=`notebook-import-note:${encodeURIComponent(row.key)}:${hash(row.value)}`;
   if(!byKey.has(key))add({...row,key});report.preservedNotes++;
  }
 }
 const ratings=mergeMissingImportedRatings({...current,rows},incoming);report.addedRatings=ratings.added;
 return {payload:ratings.payload,report};
}
