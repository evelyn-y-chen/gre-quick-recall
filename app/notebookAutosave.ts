import {NOTEBOOK_DRAFT_KEY,validNotebookBatch,type NotebookBatch,type NotebookDraft} from './notebookModel';
import type {WorkspacePersistenceResult} from '../community/workspacePersistence';

export type NotebookSaveState={phase:'pending'|'saving'|'saved'|'error'|'conflict'|'incomplete';message:string};
type Ports={
 storage:{getItem:(key:string)=>string|null;setItem:(key:string,value:string)=>void};
 generation:number;getGeneration:()=>number;
 put:(batch:NotebookBatch,revision:number)=>Promise<{revision:number}>;
 persist:()=>Promise<WorkspacePersistenceResult>;
 saveMemory?:()=>Promise<boolean>;
 schedule:(fn:()=>void)=>number;cancel:(id:number)=>void;
 onState:(id:string,state:NotebookSaveState)=>void;
 onLocalSave:(batch:NotebookBatch,revision:number)=>void;
};
type Job={batch:NotebookBatch;revision:number;version:number;lastSaved?:string;timer?:number;task?:Promise<boolean>;conflict:boolean};

/** A separate queue for each collection. It outlives the editor while a save is
 * pending, but can never write after the owning workspace generation changes. */
export function createNotebookAutosaver(ports:Ports){
 const jobs=new Map<string,Job>();
 const current=()=>ports.generation===ports.getGeneration();
 function assertCurrent(){if(!current())throw Error('学习空间已切换，请在当前账号查看保存状态。');}
 function state(job:Job,next:NotebookSaveState){if(current())ports.onState(job.batch.id,next);}
 function clear(job:Job){if(job.timer!==undefined){ports.cancel(job.timer);job.timer=undefined;}}
 function retainRevision(batch:NotebookBatch,revision:number,text:string){
  assertCurrent();
  const raw=JSON.parse(ports.storage.getItem(NOTEBOOK_DRAFT_KEY)??'{}') as Record<string,NotebookDraft>;
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('生词本草稿索引无法读取，请保留本页并导出便笺。');
  const draft=raw[batch.id];
  if(draft&&validNotebookBatch(draft.batch,false)){
   // An acknowledgement for an older write must not erase a newer answer.
   if(JSON.stringify(draft.batch)===text)delete raw[batch.id];
   else raw[batch.id]={...draft,revision};
   ports.storage.setItem(NOTEBOOK_DRAFT_KEY,JSON.stringify(raw));
  }
  ports.onLocalSave(batch,revision);
 }
 async function writeLatest(job:Job){
  while(job.lastSaved!==JSON.stringify(job.batch)){
   assertCurrent();const batch=job.batch,text=JSON.stringify(batch);
   if(!validNotebookBatch(batch)){
    state(job,{phase:'incomplete',message:'草稿已保留；补全来源、日期和英文后自动保存。'});return false;
   }
   const result=await ports.put(batch,job.revision);assertCurrent();
   if(!Number.isSafeInteger(result.revision)||result.revision<=job.revision)throw Error('未能确认保存版本，草稿仍保留，请重试。');
   job.revision=result.revision;job.lastSaved=text;
   retainRevision(batch,result.revision,text);
  }
  return true;
 }
 function flush(id:string):Promise<boolean>{
  const job=jobs.get(id);if(!job||!current())return Promise.resolve(false);
  clear(job);if(job.task)return job.task;
  let completed=false;
  const task=Promise.resolve().then(async()=>{
   try{
    assertCurrent();state(job,{phase:'saving',message:'正在自动保存…'});
    while(true){
     const version=job.version;
     if(!await writeLatest(job))return false;
     const memorySaved=ports.saveMemory?await ports.saveMemory():true;assertCurrent();
     const result=await ports.persist();assertCurrent();
     // Keep the newest edits in formal local records even when an older upload
     // failed. Retrying the network remains one explicit attempt, not per key.
     if(!await writeLatest(job))return false;
     if(!result.synced){state(job,{phase:'error',message:result.message||'本机已保存，账号同步尚未完成，请重试。'});return false;}
     if(!memorySaved){state(job,{phase:'error',message:'生词本已保存，共享记忆笔记尚未全部保存；草稿仍保留，请重试。'});return false;}
     if(version!==job.version)continue;
     job.conflict=false;
     state(job,{phase:'saved',message:result.destination==='account'?'已自动保存到账号':'已自动保存到这台设备'});completed=true;return true;
    }
   }catch(error){
    job.conflict=!!error&&typeof error==='object'&&'conflict' in error&&error.conflict===true;
    state(job,{phase:job.conflict?'conflict':'error',message:(error instanceof Error?error.message:'自动保存未完成，请重试。')+' 未完成的修改仍保留。'});
    return false;
   }
  }).finally(()=>{
   if(job.task===task)job.task=undefined;
   if(job.conflict||job.lastSaved===JSON.stringify(job.batch))clear(job);
   // A new word may arrive after the final version check but before the
   // promise closes. Drain it now, since its explicit flush joined this task.
   else if(completed&&current())void flush(id);
  });
  job.task=task;return task;
 }
 function schedule(batch:NotebookBatch,revision:number){
  if(!current())return;
  let job=jobs.get(batch.id);
  if(!job){job={batch,revision,version:0,conflict:false};jobs.set(batch.id,job);}
  job.batch=batch;job.revision=Math.max(job.revision,revision);job.version++;
  clear(job);
  if(job.conflict){state(job,{phase:'conflict',message:'这次收集有保存冲突，新修改仍保留在草稿中，请核对后重试或另存。'});return;}
  state(job,{phase:'pending',message:'修改已保留，稍后自动保存…'});
  job.timer=ports.schedule(()=>{job!.timer=undefined;void flush(batch.id);});
 }
 return {schedule,flush,flushAll:()=>Promise.all([...jobs.keys()].map(flush))};
}
