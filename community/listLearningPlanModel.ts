import {validLearningPlan,validLearningPlanDay,type LearningPlanState,type LearningPlanRating} from './learningPlanModel';
import {selectPlanWords,type PlannedWord,type PlannedOccurrence} from './learningPlanCatalog';
import {reviewDay} from './practiceReviewModel';
export type PlannedList={id:string;deckId:string;deckName:string;label:string;words:PlannedWord[]};
type Round={firstDay:string|null;due:string|null;level:number;lastDay:string|null;required:string[]};
export type ListSchedule={day:string;completedIds:string[];completedNewIds:string[];completedReviewIds:string[];newIds:string[];reviewIds:string[];required:Record<string,string[]>;learnedCount:number;remainingNewCount:number;totalCount:number;completedWordCount:number;assignedWordCount:number;blocked:{id:string;wordCount:number;reason:'limit'|'remaining'}[];paused:boolean};
export type ListForecastDay={day:string;newCount:number;reviewCount:number;completedCount:number;totalCount:number;wordCount:number;newIds:string[];reviewIds:string[];blocked:ListSchedule['blocked']};
export type ListProjection={today:ListSchedule;days:ListForecastDay[];reservations:ListForecastDay[];expectedFirstPassDay:string|null;targetReachable:boolean;delayDays:number|null;simulationTruncated:boolean};
const date=(day:string)=>Date.parse(day+'T00:00:00Z')/86400000;
const plus=(day:string,n:number)=>new Date((date(day)+n)*86400000).toISOString().slice(0,10);
const rating=(value:unknown):value is LearningPlanRating=>value==='red'||value==='yellow'||value==='green';
const group=(o:PlannedOccurrence)=>o.groupId??(o.list!==undefined?`${o.volume?o.volume+'-':''}list-${o.list}`:'category-'+(o.category??'全部'));
/** Source List boundaries and source order are preserved, including BB volumes. */
export function buildPlannedLists(words:PlannedWord[],deckIds:string[]):PlannedList[]{
 const grouped=new Map<string,PlannedList>(),order=new Map<string,Map<string,number>>();
 for(const word of selectPlanWords(words,deckIds))for(const o of word.occurrences){
  const id=o.deckId+':'+group(o),label=o.list!==undefined?`${o.volume?({upper:'上',middle:'中',lower:'下'}[o.volume]??o.volume)+'册 · ':''}List ${String(o.list).padStart(2,'0')}`:o.category||'全部';
  let unit=grouped.get(id);if(!unit){unit={id,deckId:o.deckId,deckName:o.deckName,label,words:[]};grouped.set(id,unit);order.set(id,new Map());}
  if(!order.get(id)!.has(word.id)){unit.words.push(word);order.get(id)!.set(word.id,o.order??unit.words.length);}
 }
 for(const u of grouped.values())u.words.sort((a,b)=>order.get(u.id)!.get(a.id)!-order.get(u.id)!.get(b.id)!);
 // Map insertion order follows each source's List / volume order, not a label sort.
 return [...grouped.values()].sort((a,b)=>deckIds.indexOf(a.deckId)-deckIds.indexOf(b.deckId)||Math.min(...order.get(a.id)!.values())-Math.min(...order.get(b.id)!.values()));
}
function histories(state:LearningPlanState,today:string){
 return new Map(Object.entries(state.answers).map(([id,values])=>[id,Object.entries(values).filter(([day,value])=>validLearningPlanDay(day)&&day>=state.config.startDay&&day<=today&&rating(value)).sort(([a],[b])=>a.localeCompare(b))]));
}
export const COLOR_REVIEW_DAYS={red:[1],yellow:[2],green:[3,7,15,30]} as const;
/** Suggestions derived only from dated, real self-ratings. Early greens do not
 * fast-forward a review level; an uncertain answer can bring a date forward. */
export function wordReview(state:LearningPlanState,id:string,today:string){
 const events=Object.entries(state.answers[id]??{}).filter(([d,r])=>d>=state.config.startDay&&d<=today&&validLearningPlanDay(d)&&rating(r)).sort(([a],[b])=>a.localeCompare(b));
 let due:string|null=null,level=0,lastDay:string|null=null,color:LearningPlanRating|null=null;
 for(const [day,r] of events){
  if(!lastDay||r!=='green'||color!=='green'){level=0;due=plus(day,COLOR_REVIEW_DAYS[r][0]);}
  else if(due&&day>=due){level=Math.min(level+1,COLOR_REVIEW_DAYS.green.length-1);due=plus(day,COLOR_REVIEW_DAYS.green[level]);}
  lastDay=day;color=r;
 }
 return {firstDay:events[0]?.[0]??null,lastDay,due,level,color};
}
function roundFor(unit:PlannedList,history:ReturnType<typeof histories>,today:string,state:LearningPlanState):Round{
 const entries=unit.words.map(word=>({id:word.id,progress:wordReview(state,word.id,today)}));
 if(entries.some(w=>!w.progress.firstDay))return {firstDay:null,due:null,level:0,lastDay:null,required:entries.filter(w=>!w.progress.firstDay).map(w=>w.id)};
 const firstDay=entries.map(w=>w.progress.firstDay!).sort().at(-1)!;
 const due=entries.map(w=>w.progress.due!).sort()[0]??null;
 const lastDay=entries.some(w=>w.progress.lastDay===today)?today:entries.map(w=>w.progress.lastDay!).sort().at(-1)!;
 return {firstDay,due,level:Math.min(...entries.map(w=>w.progress.level)),lastDay,required:entries.filter(w=>w.progress.due!<=today).map(w=>w.id)};
}
function prepare(state:LearningPlanState,units:PlannedList[],today:string){
 if(!validLearningPlan(state)||!validLearningPlanDay(today))throw new RangeError('Invalid learning plan');
 const history=histories(state,today),progress=new Map(units.map(u=>[u.id,roundFor(u,history,today,state)]));
 const known=new Set(units.flatMap(u=>u.words.map(w=>w.id))),doneWords=new Set([...known].filter(id=>rating(state.answers[id]?.[today])));
 return {history,progress,doneWords,unseen:units.filter(u=>!progress.get(u.id)!.firstDay),due:units.filter(u=>progress.get(u.id)!.due).sort((a,b)=>progress.get(a.id)!.due!.localeCompare(progress.get(b.id)!.due!))};
}
const newBudget=(total:number,covered:number,completedToday:number,day:string,target:string,start:string)=>{
 const duration=Math.max(1,date(target)-date(start)+1),elapsed=Math.max(0,Math.min(duration,date(day)-date(start)+1));
 // Spread whole Lists across the requested period. Missed days may delay the
 // finish, but never turn the entire backlog into one giant catch-up day.
 return Math.max(0,Math.min(Math.ceil(total*elapsed/duration)-covered,Math.ceil(total/duration)-completedToday));
};
export function scheduleListPlan(state:LearningPlanState,units:PlannedList[],today=reviewDay()):ListSchedule{
 const {progress,doneWords,unseen,due}=prepare(state,units,today),active=!state.paused&&today>=state.config.startDay;
 const completedNewIds=units.filter(u=>progress.get(u.id)!.firstDay===today).map(u=>u.id),completedReviewIds=units.filter(u=>{const p=progress.get(u.id)!;return p.firstDay!==today&&p.lastDay===today&&!p.required.length;}).map(u=>u.id),completedIds=[...completedReviewIds,...completedNewIds];
 const required:Record<string,string[]>={},reviewIds:string[]=[],newIds:string[]=[],blocked:ListSchedule['blocked']=[],planned=new Set<string>();
 let capacity=state.config.dailyCap===null?Infinity:Math.max(0,state.config.dailyCap-doneWords.size);
 const take=(unit:PlannedList,target:string[])=>{
  const pending=progress.get(unit.id)!.required,ids=pending.filter(id=>!doneWords.has(id)&&!planned.has(id));required[unit.id]=pending;
  if(ids.length>capacity){blocked.push({id:unit.id,wordCount:ids.length,reason:state.config.dailyCap!==null&&ids.length>state.config.dailyCap?'limit':'remaining'});return false;}
  for(const id of ids)planned.add(id);capacity-=ids.length;target.push(unit.id);return true;
 };
 if(active){
  for(const unit of due)if(progress.get(unit.id)!.due!<=today)take(unit,reviewIds);
  if(!blocked.length){let budget=newBudget(units.length,units.length-unseen.length,completedNewIds.length,today,state.config.targetDay,state.config.startDay);const stopped=new Set<string>();
   for(const unit of unseen){if(!budget)break;if(stopped.has(unit.deckId))continue;if(take(unit,newIds))budget--;else stopped.add(unit.deckId);}
  }
 }
 return {day:today,completedIds,completedNewIds,completedReviewIds,newIds,reviewIds,required,learnedCount:units.length-unseen.length,remainingNewCount:unseen.length,totalCount:completedIds.length+reviewIds.length+newIds.length,completedWordCount:doneWords.size,assignedWordCount:planned.size,blocked,paused:state.paused};
}
/** Forecast only the NEXT review round produced by actual completed work. Future
 * new Lists are a separate reservation: they never create simulated reviews. */
export function projectListPlan(state:LearningPlanState,units:PlannedList[],today=reviewDay()):ListProjection{
 const actual=scheduleListPlan(state,units,today),{progress,unseen,due}=prepare(state,units,today);
 const days:ListForecastDay[]=Array.from({length:7},(_,i)=>({day:plus(today,i),newCount:0,reviewCount:0,completedCount:0,totalCount:0,wordCount:0,newIds:[],reviewIds:[],blocked:[]}));
 const reservations:ListForecastDay[]=[];
 const reservedNew=new Set<string>(),reservedReview=new Set<string>(),reservedWords=new Set<string>();
 const nextDates=new Map(units.flatMap(u=>u.words.map(w=>[w.id,wordReview(state,w.id,today).due] as const)));
 let expected:string|null=units.length&&!unseen.length?[...progress.values()].map(p=>p.firstDay!).sort().at(-1)!:null,truncated=false;
 for(let n=0;n<3660;n++){
  const day=plus(today,n),row=n<7?days[n]:undefined,completed=n===0?actual.completedWordCount:0;
  let capacity=state.config.dailyCap===null?Infinity:Math.max(0,state.config.dailyCap-completed);
  const assigned=new Set<string>(),reviewIds:string[]=[],newIds:string[]=[],blocked:ListSchedule['blocked']=[];
  const take=(unit:PlannedList,kind:'new'|'review')=>{
   const p=progress.get(unit.id)!,required=kind==='review'?unit.words.filter(w=>{const due=nextDates.get(w.id);return due&&due<=day&&!reservedReview.has(w.id);}).map(w=>w.id):p.required;
   if(kind==='review'&&!required.length)return true;
   const ids=required.filter(id=>!assigned.has(id)&&!(n===0&&rating(state.answers[id]?.[today]))&&!(kind==='new'&&reservedWords.has(id)));
   if(ids.length>capacity){blocked.push({id:unit.id,wordCount:ids.length,reason:state.config.dailyCap!==null&&ids.length>state.config.dailyCap?'limit':'remaining'});return false;}
   for(const id of ids)assigned.add(id);capacity-=ids.length;
   if(kind==='new'){reservedNew.add(unit.id);for(const id of required)reservedWords.add(id);newIds.push(unit.id);}else{for(const id of required)reservedReview.add(id);reviewIds.push(unit.id);}return true;
  };
  if(!state.paused&&day>=state.config.startDay){
   for(const unit of due)if(progress.get(unit.id)!.due!<=day)take(unit,'review');
   if(!blocked.length){let budget=newBudget(units.length,units.length-unseen.length+reservedNew.size,n===0?actual.completedNewIds.length:0,day,state.config.targetDay,state.config.startDay);const stopped=new Set<string>();
    for(const unit of unseen){if(!budget)break;if(reservedNew.has(unit.id)||stopped.has(unit.deckId))continue;if(take(unit,'new'))budget--;else stopped.add(unit.deckId);}
   }
   if(expected===null&&reservedNew.size===unseen.length&&units.length)expected=day;
  }
  if(!row&&(newIds.length||reviewIds.length))reservations.push({day,newCount:newIds.length,reviewCount:reviewIds.length,completedCount:0,totalCount:newIds.length+reviewIds.length,wordCount:assigned.size,newIds,reviewIds,blocked});
  if(row){row.newIds=newIds;row.reviewIds=reviewIds;row.newCount=newIds.length;row.reviewCount=reviewIds.length;row.completedCount=n===0?actual.completedIds.length:0;row.totalCount=row.completedCount+newIds.length+reviewIds.length;row.wordCount=assigned.size+completed;row.blocked=blocked;}
  if(n>=6&&(expected!==null||state.paused||!units.length))break;
  if(n>=6&&!assigned.size&&blocked.some(b=>b.reason==='limit'))break;
  if(n===3659)truncated=true;
 }
 const delayDays=expected===null?null:Math.max(0,date(expected)-date(state.config.targetDay));
 return {today:actual,days,reservations:[...days,...reservations],expectedFirstPassDay:expected,targetReachable:!units.length||expected!==null&&expected<=state.config.targetDay,delayDays,simulationTruncated:truncated};
}
