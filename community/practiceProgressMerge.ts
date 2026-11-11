import type {Snapshot} from './database';
import {isRecallRun,mergeRecallRuns,recallSummary} from './recallModel';

type Result={streak:number;errors:number;done:boolean};
type Run={sessionId?:string;queue:string[];direction:string;pair:boolean;review?:boolean;results:Record<string,Result>;phase:string;turn:number;[key:string]:unknown};
type Review={level:number;due:string;lastDay:string;reviews:number};
const safe=(key:string)=>!!key&&!['__proto__','constructor','prototype'].includes(key);
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const parse=(raw:string|undefined):unknown=>{try{return raw===undefined?undefined:JSON.parse(raw);}catch{return undefined;}};
const canonical=(value:unknown):string=>JSON.stringify(object(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):Array.isArray(value)?value.map(canonical):value);
const same=(a:unknown,b:unknown)=>canonical(a)===canonical(b);
const whole=(n:unknown)=>Number.isSafeInteger(n)&&(n as number)>=0;
const date=(value:unknown)=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const scope='(?:qingshan-precise|qingshan-rare|zhang-jijing|zhang-words|zhang-pairs|words|bb|a-plus|notebook-[A-Za-z0-9_-]+)';
export const isPracticeRunKey=(key:string)=>new RegExp('^lemnota-practice-'+scope+'$').test(key);
export const isPracticeReviewKey=(key:string)=>new RegExp('^lemnota-practice-review-'+scope+'-v1$').test(key);
export const isRecallStorageKey=(key:string)=>new RegExp('^lemnota-recall-'+scope+'-v1$').test(key);
export const isPracticeStorageKey=(key:string)=>isPracticeRunKey(key)||isPracticeReviewKey(key)||isRecallStorageKey(key);
function run(value:unknown):value is Run {
 return object(value)&&Array.isArray(value.queue)&&value.queue.every(id=>typeof id==='string'&&safe(id))&&new Set(value.queue).size===value.queue.length&&whole(value.turn)&&['meaning','synonym','feedback'].includes(String(value.phase))&&['en-zh','zh-en'].includes(String(value.direction))&&typeof value.pair==='boolean'&&Array.isArray(value.options)&&object(value.results)&&Object.entries(value.results).every(([id,r])=>safe(id)&&object(r)&&whole(r.streak)&&whole(r.errors)&&typeof r.done==='boolean')&&(value.sessionId===undefined||typeof value.sessionId==='string'&&!!value.sessionId);
}
function review(value:unknown):value is Review {
 return object(value)&&whole(value.level)&&(value.level as number)<6&&date(value.due)&&(value.lastDay===''||date(value.lastDay))&&whole(value.reviews);
}
function history(value:unknown):value is Record<string,Review> {
 return object(value)&&Object.entries(value).every(([id,r])=>safe(id)&&review(r));
}
const conflict=()=>Error('测试记录存在两条不同的作答分支，已保留当前进度。请保留便笺后核对，未自动覆盖。');
/** Only choose a provable continuation of the same session, never the larger count alone. */
function continuation(earlier:Run,later:Run):boolean {
 if(!earlier.sessionId||earlier.sessionId!==later.sessionId||earlier.direction!==later.direction||earlier.pair!==later.pair||!!earlier.review!==!!later.review||later.turn<earlier.turn)return false;
 if(later.queue.some(id=>!earlier.queue.includes(id)))return false;
 for(const [id,before] of Object.entries(earlier.results)){
  const after=later.results[id];if(!after||after.errors<before.errors||before.done&&!after.done||after.errors===before.errors&&after.streak<before.streak)return false;
 }
 // An unchanged turn cannot have advanced a different current word.
 if(later.turn===earlier.turn){
  if(!same(earlier.queue,later.queue))return false;
  const phase={meaning:0,synonym:1,feedback:2};
  if(phase[later.phase as keyof typeof phase]<phase[earlier.phase as keyof typeof phase])return false;
  if(later.phase===earlier.phase&&!same(earlier.results,later.results))return false;
 }
 return true;
}
function mergeRun(local:Run,remote:Run):Run {
 if(same(local,remote))return local;
 const localLater=continuation(remote,local),remoteLater=continuation(local,remote);
 if(!localLater&&!remoteLater)throw conflict();
 if(localLater&&remoteLater){
  // Option repair and unsubmitted selection changes have no graded progress.
  if(local.turn!==remote.turn||!same(local.results,remote.results))throw conflict();
  return local;
 }
 return localLater?local:remote;
}
function mergeHistory(base:Record<string,Review>,local:Record<string,Review>,remote:Record<string,Review>):Record<string,Review> {
 const result:Record<string,Review>={};
 for(const id of new Set([...Object.keys(base),...Object.keys(local),...Object.keys(remote)])){
  const b=base[id],l=local[id],r=remote[id];let value:Review|undefined;
  if(same(l,b))value=r;else if(same(r,b)||same(l,r))value=l;
  else if(!l)value=r;else if(!r)value=l;
  else if(l.lastDay>r.lastDay&&l.reviews>=r.reviews)value=l;
  else if(r.lastDay>l.lastDay&&r.reviews>=l.reviews)value=r;
  else throw conflict();
  if(value)result[id]=value;
 }
 return result;
}
/** Resolver for concurrent snapshot changes. Invalid or ambiguous records remain conflicts. */
export function mergePracticeStorage(key:string,base:string|undefined,local:string|undefined,remote:string|undefined):{value:string|undefined}|undefined {
 if(!isPracticeStorageKey(key))return undefined;
 const b=parse(base),l=parse(local),r=parse(remote);
 if(isRecallStorageKey(key)){
  if(!isRecallRun(l)||!isRecallRun(r))throw conflict();
  return {value:JSON.stringify(mergeRecallRuns(l,r))};
 }
 if(isPracticeRunKey(key)){
  if(!run(l)||!run(r))throw conflict();
  return {value:JSON.stringify(mergeRun(l,r))};
 }
 if(!history(l)||!history(r)||(base!==undefined&&!history(b)))throw conflict();
 return {value:JSON.stringify(mergeHistory(history(b)?b:{},l,r))};
}

const choiceStage:Record<string,number>={meaning:0,synonym:1,synonyms:1,feedback:2,complete:3};
// A+ increments turn on submit; the general test increments on Next.
const aPlusStage:Record<string,number>={feedback:0,meaning:1,synonyms:2,complete:3};
function currentBranch<T extends {turn:number}>(local:T,remote:T,preferred:T,position:(run:T)=>number){
 const difference=local.turn-remote.turn||position(local)-position(remote);
 return difference>0?local:difference<0?remote:preferred;
}
function retainPassed<T extends {done:boolean}>(merged:Record<string,T>,...branches:Record<string,T>[]):Record<string,T>{
 const results={...merged};
 for(const branch of branches)for(const [id,result] of Object.entries(branch))if(safe(id)&&(!results[id]||result.done&&!results[id].done))results[id]=result;
 return results;
}
/** Keep the visible question together, even as results for different words merge. */
export function normalizeClockedPractice(key:string,raw:string|undefined,local:string|undefined,remote:string|undefined,preferred=raw):string|undefined {
 if(raw===undefined||!isPracticeStorageKey(key))return raw;
 const value=parse(raw),l=parse(local),r=parse(remote);
 if(!object(value))return raw;
 if(isRecallStorageKey(key)&&!isRecallRun(value)&&Array.isArray(value.order)&&Array.isArray(value.queue)&&object(value.results)&&object(value.config)){
  const order=value.order as string[],results=value.results as Record<string,{attempts:number;done:boolean;rating:string}>,config=value.config;
  const queue=[...new Set([...value.queue,...order])].filter(id=>!results[id]?.done&&!(config.retry==='unknown'&&results[id]?.rating==='fuzzy'));
  const repaired={...value,queue,turn:Object.values(results).reduce((sum,item)=>sum+item.attempts,0),due:Object.fromEntries(Object.entries(object(value.due)?value.due:{}).filter(([id])=>queue.includes(id))),selection:queue.length&&queue[0]===value.queue[0]?value.selection:null};
  if(isRecallRun(repaired))return JSON.stringify(repaired);
 }
 if(isPracticeRunKey(key)){
  const whole=parse(preferred);
  if(!run(value)||!run(whole)||!run(l)||!run(r)||!l.sessionId||l.sessionId!==r.sessionId)return preferred;
  const active=currentBranch(l,r,whole,run=>choiceStage[run.phase]),head=active.queue[0];
  const results=retainPassed(value.results,l.results,r.results);
  const keepFeedback=active.phase==='feedback'&&!!active.results[head]&&(!results[head]?.done||active.results[head].done);
  if(keepFeedback)results[head]=active.results[head];
  const queue=[...new Set([...active.queue,...l.queue,...r.queue])].filter(id=>!results[id]?.done||id===head&&keepFeedback);
  const question=queue[0]===head&&(active.phase!=='feedback'||keepFeedback)?{}:{options:[],selected:null,phase:'meaning',meaningOK:false,meaningSelection:null,feedbackStep:undefined,uncertain:false};
  const counts=object(value.attemptCounts)?value.attemptCounts:{};
  return JSON.stringify({...active,queue,results,lookback:value.lookback,attemptCounts:keepFeedback&&object(active.attemptCounts)?{...counts,[head]:active.attemptCounts[head]}:value.attemptCounts,...question});
 }
 return raw;
}

export const aPlusSessionRow='a-plus-test-session:v1';
export const aPlusTestDraft='gre-a-plus-test-draft-v1';
type APlusRun={id:string;turn:number;stage:string;progress:Record<string,{done:boolean}>;[key:string]:unknown};
function aPlusRun(value:unknown):value is APlusRun{
 return object(value)&&typeof value.id==='string'&&whole(value.turn)&&typeof value.stage==='string'&&Object.hasOwn(aPlusStage,value.stage)&&object(value.progress)&&Object.values(value.progress).every(p=>object(p)&&typeof p.done==='boolean');
}
export function normalizeClockedAPlus(raw:string|undefined,local:string|undefined,remote:string|undefined,preferred:string|undefined){
 const merged=parse(raw),l=parse(local),r=parse(remote),active=parse(preferred);
 if(!aPlusRun(active)||!object(merged)||!aPlusRun(l)||!aPlusRun(r))return preferred;
 const sameRound=l.id===r.id;
 const question=sameRound?currentBranch(l,r,active,run=>aPlusStage[run.stage]):active;
 const progress=sameRound&&aPlusRun(merged)?retainPassed(merged.progress,l.progress,r.progress):question.progress;
 return JSON.stringify({...question,progress,reviewHistory:merged.reviewHistory,lookback:sameRound?merged.lookback:question.lookback});
}

export function practiceProgressSummary(snapshot:Snapshot){
 return Object.entries(snapshot.storage).flatMap(([key,raw])=>{
  const value=parse(raw);
  if(isRecallStorageKey(key)&&isRecallRun(value)){
   const summary=recallSummary(value),scope=key.slice('lemnota-recall-'.length,-3);
   const label=scope==='qingshan-precise'?'青山精准释义':scope==='qingshan-rare'?'青山熟词僻义':scope==='words'?'全能词':scope==='bb'?'BB 六选二':scope==='a-plus'?'A+ 等价词':scope==='zhang-jijing'?'张巍镇考机经词7.0':scope==='zhang-words'?'张巍镇考3000词':scope==='zhang-pairs'?'张巍等价词':'生词本';
   return [{key,label:label+' · 翻卡自测'+(value.review?'（到期复习）':''),remaining:summary.remaining,answers:summary.answers,completed:summary.completed}];
  }
  return isPracticeRunKey(key)&&run(value)?[{key,label:key.endsWith('qingshan-precise')?'青山精准释义':key.endsWith('qingshan-rare')?'青山熟词僻义':key.endsWith('zhang-jijing')?'张巍镇考机经词7.0':key.endsWith('zhang-words')?'张巍镇考3000词':key.endsWith('zhang-pairs')?'张巍等价词':key.endsWith('words')?'全能词':key.endsWith('bb')?'BB 六选二':key.endsWith('a-plus')?'A+ 等价词':'生词本',remaining:value.queue.length,answers:value.turn,completed:Object.values(value.results).filter(r=>r.done).length}]:[];
 });
}
/** Restore only test sessions and their review schedules; notes/ratings/settings stay current. */
export function mergeImportedPractice(current:Snapshot,incoming:Snapshot):Snapshot {
 const storage={...current.storage};let found=false;
 for(const [key,raw] of Object.entries(incoming.storage)){
  if(!isPracticeStorageKey(key))continue;
  const incomingValue=parse(raw);
  if(isRecallStorageKey(key)?!isRecallRun(incomingValue):isPracticeRunKey(key)?!run(incomingValue):!history(incomingValue))throw Error('便笺里的测试记录格式不完整，当前进度未改变。');
  found=true;
  if(storage[key]===undefined||same(parse(storage[key]),incomingValue)){storage[key]=raw;continue;}
  const merged=mergePracticeStorage(key,undefined,raw,storage[key]);
  if(merged?.value!==undefined)storage[key]=merged.value;
 }
 if(!found)throw Error('这份便笺没有可恢复的测试进度。');
 return {version:1,rows:current.rows,storage};
}
