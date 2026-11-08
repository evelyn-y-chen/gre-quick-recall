import {validNotebookBatch,type NotebookBatch,type NotebookRecallAttempt} from './notebookModel';

const canonical=(value:unknown):string=>JSON.stringify(value&&typeof value==='object'?Array.isArray(value)?value.map(item=>JSON.parse(canonical(item))):Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,JSON.parse(canonical(v))])):value??null);
const same=(a:unknown,b:unknown)=>canonical(a)===canonical(b);
const without=(value:object,keys:string[])=>Object.fromEntries(Object.entries(value).filter(([key])=>!keys.includes(key)));
function mergeAttempt(base:NotebookRecallAttempt|undefined,local:NotebookRecallAttempt,remote:NotebookRecallAttempt){
 const l=without(local,['revealed']),r=without(remote,['revealed']),b=base&&without(base,['revealed']);
 let chosen:NotebookRecallAttempt;
 if(same(l,r))chosen=local;
 else if(base&&same(l,b))chosen=remote;
 else if(base&&same(r,b))chosen=local;
 else {
  const extendsAttempt=(old:NotebookRecallAttempt,next:NotebookRecallAttempt)=>old.id===next.id&&old.answer===next.answer&&
   Object.entries(without(old,['revealed','checked','result','forgotten','submittedAt'])).every(([key,value])=>same(value,(next as any)[key]))&&
   (!old.checked||next.checked)&&(!old.result||old.result===next.result)&&(!old.forgotten||!!next.forgotten)&&(!old.submittedAt||old.submittedAt===next.submittedAt);
  if(extendsAttempt(local,remote))chosen=remote;else if(extendsAttempt(remote,local))chosen=local;else return null;
 }
 return {...chosen,...(local.revealed!==undefined?{revealed:local.revealed}:{})};
}
/** Only reconcile provably compatible recall progress; text conflicts stay explicit. */
export function mergeNotebookRecallBatches(base:NotebookBatch|undefined,local:NotebookBatch,remote:NotebookBatch):NotebookBatch|null{
 if(!validNotebookBatch(local,false)||!validNotebookBatch(remote,false)||!same(without(local,['words','recallPhase','recallSubmission']),without(remote,['words','recallPhase','recallSubmission'])))return null;
 if(local.words.length!==remote.words.length)return null;
 const remoteWords=new Map(remote.words.map(word=>[word.id,word])),baseWords=new Map(base?.words.map(word=>[word.id,word])??[]);
 const words=[];
 for(const word of local.words){
  const other=remoteWords.get(word.id);if(!other||!same(without(word,['recalls']),without(other,['recalls'])))return null;
  const l=word.recalls??[],r=other.recalls??[],contains=(a:NotebookRecallAttempt[],b:NotebookRecallAttempt[])=>{let at=0;for(const item of a)if(item.id===b[at]?.id)at++;return at===b.length;};
  if((baseWords.get(word.id)?.recalls??[]).some(attempt=>!l.some(a=>a.id===attempt.id)||!r.some(a=>a.id===attempt.id)))return null;
  const order=contains(l,r)?l:contains(r,l)?r:null;if(!order)return null;
  const lm=new Map(l.map(a=>[a.id,a])),rm=new Map(r.map(a=>[a.id,a])),bm=new Map(baseWords.get(word.id)?.recalls?.map(a=>[a.id,a])??[]),recalls=[];
  for(const item of order){const a=lm.get(item.id),b=rm.get(item.id),merged=a&&b?mergeAttempt(bm.get(item.id),a,b):a??b;if(!merged)return null;recalls.push(merged);}
  words.push({...word,...(recalls.length?{recalls}:{})});
 }
 const submission=local.recallSubmission??remote.recallSubmission;
 if(local.recallSubmission&&remote.recallSubmission&&!same(local.recallSubmission,remote.recallSubmission))return null;
 const merged={...local,words,...(submission?{recallSubmission:submission}:{}),recallPhase:local.recallPhase??remote.recallPhase};
 return validNotebookBatch(merged,false)?merged:null;
}
