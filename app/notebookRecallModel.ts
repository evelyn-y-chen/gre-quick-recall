import {NOTEBOOK_RECALL_LIMIT,type NotebookWord,type NotebookBatch,type NotebookRecallArchive,type NotebookRecallAttempt} from './notebookModel';

export const NOTEBOOK_RECALL_GROUPS=[
 {id:'all',label:'全部词'}, {id:'unseen',label:'未核对'}, {id:'consolidate',label:'待巩固'},
 {id:'prone',label:'易错词'}, {id:'focus',label:'重点攻克'}, {id:'passed',label:'已过关'},
] as const;
export type NotebookRecallGroup=typeof NOTEBOOK_RECALL_GROUPS[number]['id']|'wrong';
const empty=():NotebookRecallArchive=>({correct:0,incorrect:0,partial:0,streak:0,attempts:0});
export const notebookRecallResult=(attempt:NotebookRecallAttempt|undefined)=>attempt?.result??(attempt?.forgotten?'incorrect':undefined);
export const notebookRecallIsWrong=(attempt:NotebookRecallAttempt|undefined)=>{const result=notebookRecallResult(attempt);return result==='incorrect'||result==='partial';};
function accumulate(base:NotebookRecallArchive,attempts:NotebookRecallAttempt[]):NotebookRecallArchive{
 const next={...base};
 for(const attempt of attempts){
  next.attempts++;
  const result=attempt.result??(attempt.forgotten?'incorrect':undefined);
  if(!result)continue;
  next[result]++;
  next.streak=result!=='correct'?next.streak+1:0;
 }
 return next;
}
const statsCache=new WeakMap<NotebookWord,ReturnType<typeof calculate>>();
function calculate(word:NotebookWord){
 const totals=accumulate(word.recallArchive??empty(),word.recalls??[]),total=totals.correct+totals.incorrect+totals.partial;
 const last=[...(word.recalls??[])].reverse().find(attempt=>attempt.result||attempt.forgotten);
 const lastResult=notebookRecallResult(last),wrong=totals.incorrect+totals.partial,rate=total?wrong/total:0,correctRate=total?totals.correct/total:0;
 const group:Exclude<NotebookRecallGroup,'all'|'wrong'>=!total?'unseen':totals.streak>=3?'focus':totals.streak>=2||(total>=3&&rate>=.5)?'prone':lastResult==='incorrect'||lastResult==='partial'||(total>=3&&rate>=.25)?'consolidate':'passed';
 return {...totals,total,wrong,rate,correctRate,group,label:NOTEBOOK_RECALL_GROUPS.find(item=>item.id===group)!.label,lastResult};
}
export function notebookRecallStats(word:NotebookWord){
 let stats=statsCache.get(word);if(!stats){stats=calculate(word);statsCache.set(word,stats);}return stats;
}
export function selectNotebookRecallWords(words:NotebookWord[],group:NotebookRecallGroup){
 return words.filter(word=>group==='all'||(group==='wrong'?notebookRecallIsWrong(word.recalls?.at(-1)):notebookRecallStats(word).group===group));
}
/** Keep the last 20 full answers and compact older results into four counters. */
export function appendNotebookRecall(word:NotebookWord,newId:()=>string):NotebookWord{
 const attempts=word.recalls??[],discard=attempts.slice(0,Math.max(0,attempts.length+1-NOTEBOOK_RECALL_LIMIT));
 return {...word,...(discard.length?{recallArchive:accumulate(word.recallArchive??empty(),discard)}:{}),recalls:[...attempts.slice(discard.length),{id:newId(),answer:'',checked:false}]};
}
export function startNotebookRecall(batch:NotebookBatch,ids:string[],newId:()=>string):NotebookBatch{
 const chosen=new Set(ids),wordIds=batch.words.filter(word=>chosen.has(word.id)).map(word=>word.id);
 if(!wordIds.length)return batch;
 return {...batch,recallPhase:'writing',recallRound:{id:newId(),wordIds},recallSubmission:undefined,recallReminder:undefined,words:batch.words.map(word=>chosen.has(word.id)?appendNotebookRecall(word,newId):word)};
}
export function notebookRecallSubmitted(batch:NotebookBatch){
 const saved=batch.recallSubmission;if(!saved)return false;
 const words=new Map(batch.words.map(word=>[word.id,word]));
 return saved.wordIds.every(id=>{const last=words.get(id)?.recalls?.at(-1);return last?.submittedAt===saved.at&&!!notebookRecallResult(last);});
}
/** A blank answer means forgotten only when the learner checks the round. */
export function checkNotebookRecall(batch:NotebookBatch,newId:()=>string):NotebookBatch{
 const scope=batch.recallRound?new Set(batch.recallRound.wordIds):null;
 return {...batch,recallPhase:'checking',words:batch.words.map(word=>{
  if(scope&&!scope.has(word.id))return word;
  const attempts=word.recalls??[],last=attempts.at(-1);
  const checked=last&&(last.answer.trim()||last.checked&&notebookRecallResult(last))
   ?{...last,checked:true,revealed:true}
   :{id:last?.id??newId(),answer:last?.answer??'',checked:true,revealed:true,forgotten:true,result:'incorrect' as const};
  return {...word,recalls:last?[...attempts.slice(0,-1),checked]:[checked]};
 })};
}
/** Commit the selected round once; starting the next round appends new answers. */
export function submitNotebookRecall(batch:NotebookBatch,newId:()=>string,at=new Date().toISOString()):NotebookBatch{
 if(notebookRecallSubmitted(batch))return batch;
 const scope=batch.recallRound?new Set(batch.recallRound.wordIds):null,words=batch.words.filter(word=>!scope||scope.has(word.id));
 if(!words.length)throw Error('本次还没有可提交的单词。');
 const pending=words.filter(word=>!notebookRecallResult(word.recalls?.at(-1)));
 if(pending.length)throw Error(`还有 ${pending.length} 个词未判断，请先核对并选择正确、模糊或错误。`);
 const ids=new Set(words.map(word=>word.id));
 return {...batch,recallPhase:'checking',recallSubmission:{id:newId(),at,wordIds:[...ids]},words:batch.words.map(word=>{
  if(!ids.has(word.id))return word;const attempts=word.recalls!,last=attempts.at(-1)!;
  return {...word,recalls:[...attempts.slice(0,-1),{...last,checked:true,result:notebookRecallResult(last),submittedAt:at}]};
 })};
}
export function hideNotebookRecallReferences(batch:NotebookBatch):NotebookBatch{
 return {...batch,recallPhase:'writing',words:batch.words.map(word=>{
  const attempts=word.recalls??[],last=attempts.at(-1);
  return last?.revealed?{...word,recalls:[...attempts.slice(0,-1),{...last,revealed:false}]}:word;
 })};
}
export function nextNotebookRecallTime(now=new Date()){
 const next=new Date(now);next.setDate(next.getDate()+1);next.setHours(9,0,0,0);
 const pad=(n:number)=>String(n).padStart(2,'0');
 return `${next.getFullYear()}-${pad(next.getMonth()+1)}-${pad(next.getDate())}T${pad(next.getHours())}:${pad(next.getMinutes())}`;
}
