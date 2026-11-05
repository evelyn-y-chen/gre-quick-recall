import type {TestQuestionSnapshot} from '../app/TestQuestionHistory';
/** A self assessment belongs to this round, never to the word's traffic light. */
export type RecallRating='unknown'|'fuzzy'|'familiar';
export type RecallConfig={mode:'strict'|'lenient';retry:'all'|'unknown'};
export type RecallResult={attempts:number;streak:number;done:boolean;rating:RecallRating};
export type RecallRun={
 version:1;sessionId:string;editId:string;lineage:string[];revision:number;
 config:RecallConfig;review?:boolean;order:string[];queue:string[];due:Record<string,number>;
 results:Record<string,RecallResult>;turn:number;selection:RecallRating|null;lookback?:TestQuestionSnapshot[];
};
const rating=(v:unknown):v is RecallRating=>['unknown','fuzzy','familiar'].includes(String(v));
const obj=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const safe=(v:unknown):v is string=>typeof v==='string'&&!!v&&!['__proto__','constructor','prototype'].includes(v);
const int=(v:unknown)=>Number.isSafeInteger(v)&&(v as number)>=0;
const unique=(v:unknown):v is string[]=>Array.isArray(v)&&v.every(safe)&&new Set(v).size===v.length;
export function isRecallRun(v:unknown):v is RecallRun {
 if(!obj(v)||v.version!==1||!safe(v.sessionId)||!safe(v.editId)||!int(v.revision)||!unique(v.lineage)||v.lineage.length>64||v.lineage.includes(v.editId)||!obj(v.config)||!['strict','lenient'].includes(v.config.mode)||!['all','unknown'].includes(v.config.retry)||!unique(v.order)||!v.order.length||!unique(v.queue)||!obj(v.due)||!obj(v.results)||!int(v.turn)||v.selection!==null&&!rating(v.selection)||!v.queue.length&&v.selection!==null)return false;
 if(v.review!==undefined&&typeof v.review!=='boolean')return false;
 const ids=new Set(v.order);
 if(v.queue.some((id:string)=>!ids.has(id))||!Object.entries(v.due).every(([id,d])=>v.queue.includes(id)&&int(d)))return false;
 // Older rounds may still contain a one-visit familiar word waiting to return.
 // Keep those records readable; new first-visit familiar results pass immediately.
 if(!Object.entries(v.results).every(([id,r])=>ids.has(id)&&obj(r)&&int(r.attempts)&&r.attempts>0&&int(r.streak)&&r.streak<=2&&r.streak<=r.attempts&&typeof r.done==='boolean'&&(r.streak!==2||r.done)&&(!r.done||r.streak===2||r.attempts===1&&r.streak===1&&r.rating==='familiar')&&rating(r.rating)&&(!r.done||!v.queue.includes(id))))return false;
 if(Object.values(v.results).reduce((n:number,r:any)=>n+r.attempts,0)!==v.turn)return false;
 return v.order.every((id:string)=>v.queue.includes(id)||v.results[id]?.done||v.config.retry==='unknown'&&v.results[id]?.rating==='fuzzy');
}
export function readRecallRun(raw:string|null,validIds?:ReadonlySet<string>):RecallRun|null {
 try{const run:unknown=JSON.parse(raw??'null');return isRecallRun(run)&&(!validIds||run.order.every(id=>validIds.has(id)))?run:null;}catch{return null;}
}
export const recallKey=(scope:string)=>`lemnota-recall-${scope}-v1`;
export function createRecallRun(ids:string[],config:RecallConfig,token=()=>crypto.randomUUID()):RecallRun {
 if(!unique(ids)||!ids.length)throw Error('请选择至少一个词条。');
 return {version:1,sessionId:token(),editId:token(),lineage:[],revision:0,config:{...config},order:[...ids],queue:[...ids],due:{},results:{},turn:0,selection:null};
}
function edit(run:RecallRun,changes:Partial<RecallRun>,token:()=>string):RecallRun {
 return {...run,...changes,revision:run.revision+1,editId:token(),lineage:[...run.lineage,run.editId].slice(-64)};
}
export function chooseRecallRating(run:RecallRun,selection:RecallRating,token=()=>crypto.randomUUID()):RecallRun {
 return !run.queue.length||selection===run.selection?run:edit(run,{selection},token);
}
/** Preview from the previous visit; changing one's mind is not another attempt. */
export function recallResult(run:RecallRun):RecallResult|null {
 if(!run.queue.length||!run.selection)return null;
 const before=run.results[run.queue[0]],ok=run.selection==='familiar'||run.config.mode==='lenient'&&run.selection==='fuzzy';
 const streak=ok?(before?.streak??0)+1:0;
 return {attempts:(before?.attempts??0)+1,streak,done:!before&&run.selection==='familiar'||streak>=2,rating:run.selection};
}
export const recallGap=(rating:RecallRating)=>rating==='unknown'?3:5;
export function recallDeferred(run:RecallRun){return run.order.filter(id=>!run.queue.includes(id)&&!run.results[id]?.done);}
export function recallSummary(run:RecallRun){
 const preview=recallResult(run),id=run.queue[0];
 const completed=Object.entries(run.results).filter(([key,r])=>key!==id&&r.done).length+(preview?.done?1:run.results[id]?.done?1:0);
 return {answers:run.turn+(run.selection?1:0),completed,remaining:run.order.length-completed,deferred:recallDeferred(run).length};
}
/** Mature retries take priority over unseen words. With too few words, return early. */
function prioritize(queue:string[],due:Record<string,number>,turn:number){
 const retries=queue.filter(id=>due[id]!==undefined).sort((a,b)=>due[a]-due[b]);
 const next=retries.find(id=>due[id]<=turn)??queue.find(id=>due[id]===undefined)??retries[0];
 return next?[next,...queue.filter(id=>id!==next)]:[];
}
export function advanceRecall(run:RecallRun,token=()=>crypto.randomUUID()):RecallRun {
 const result=recallResult(run);if(!result)return run;
 const id=run.queue[0],queue=run.queue.slice(1),due={...run.due},turn=run.turn+1;
 delete due[id];
 if(!result.done&&!(run.config.retry==='unknown'&&result.rating==='fuzzy')){queue.push(id);due[id]=turn+recallGap(result.rating);}
 return edit(run,{results:{...run.results,[id]:result},queue:prioritize(queue,due,turn),due,turn,selection:null},token);
}
export function resumeDeferredRecall(run:RecallRun,token=()=>crypto.randomUUID()):RecallRun {
 if(run.queue.length||!recallDeferred(run).length)return run;
 return edit(run,{config:{...run.config,retry:'all'},queue:recallDeferred(run),selection:null},token);
}
/** A short edit lineage proves continuation, including corrections on the same card. */
export function mergeRecallRuns(a:RecallRun,b:RecallRun):RecallRun {
 if(JSON.stringify(a)===JSON.stringify(b))return a;
 if(a.sessionId===b.sessionId&&!!a.review===!!b.review&&JSON.stringify(a.order)===JSON.stringify(b.order)&&a.config.mode===b.config.mode){
  if(a.revision>b.revision&&a.lineage.includes(b.editId))return a;
  if(b.revision>a.revision&&b.lineage.includes(a.editId))return b;
 }
 throw Error('翻卡测试有不同的作答分支，已保留副本，请核对后继续，未自动覆盖。');
}
