import {REVIEW_INTERVALS,reviewDay} from './practiceReviewModel';

export type LearningPlanRating='red'|'yellow'|'green';
export type LearningPlanConfig={id:string;deckIds:string[];startDay:string;targetDay:string;dailyCap:number};
export type LearningPlanState={version:1;config:LearningPlanConfig;paused:boolean;answers:Record<string,Record<string,LearningPlanRating>>};
export type LearningPlanSchedule={
 day:string;totalWords:number;learnedCount:number;remainingNewCount:number;
 completedIds:string[];completedNewIds:string[];completedReviewIds:string[];
 newIds:string[];reviewIds:string[];remainingCapacity:number;totalCount:number;paused:boolean;
};
export type LearningPlanForecastDay={day:string;newCount:number;reviewCount:number;completedCount:number;totalCount:number};
export type LearningPlanProjection={
 today:LearningPlanSchedule;days:LearningPlanForecastDay[];expectedFirstPassDay:string|null;
 targetReachable:boolean;delayDays:number|null;simulationTruncated:boolean;
 assumption:'all-future-answers-green';simulatedTasks:number;
};
export const MAX_LEARNING_PLAN_WORDS=50_000;
export const LEARNING_PLAN_INTERVALS=REVIEW_INTERVALS;
const MAX_SIMULATED_TASKS=MAX_LEARNING_PLAN_WORDS*(LEARNING_PLAN_INTERVALS.length+1);
const DAY_MS=86_400_000;
const ratingRank:Record<LearningPlanRating,number>={red:0,yellow:1,green:2};
const isObject=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const isRating=(value:unknown):value is LearningPlanRating=>value==='red'||value==='yellow'||value==='green';

export function validLearningPlanDay(value:unknown):value is string{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||value.startsWith('0000'))return false;
 const parsed=Date.parse(value+'T00:00:00Z');
 return Number.isFinite(parsed)&&new Date(parsed).toISOString().slice(0,10)===value;
}
function dayNumber(day:string){if(!validLearningPlanDay(day))throw new RangeError('Invalid learning plan day');return Date.parse(day+'T00:00:00Z')/DAY_MS;}
function dayString(day:number){const value=new Date(day*DAY_MS).toISOString().slice(0,10);return validLearningPlanDay(value)?value:null;}
function validConfig(value:unknown):value is LearningPlanConfig{
 if(!isObject(value))return false;
 return typeof value.id==='string'&&value.id.length>0&&value.id.length<=100&&/^[A-Za-z0-9_-]+$/.test(value.id)
  &&Array.isArray(value.deckIds)&&value.deckIds.length>0&&value.deckIds.length<=100
  &&value.deckIds.every(id=>typeof id==='string'&&id.length>0&&id.length<=120)
  &&validLearningPlanDay(value.startDay)&&validLearningPlanDay(value.targetDay)&&value.targetDay>=value.startDay
  &&Number.isSafeInteger(value.dailyCap)&&Number(value.dailyCap)>=1&&Number(value.dailyCap)<=10_000;
}
export function validLearningPlan(value:unknown):value is LearningPlanState{
 if(!isObject(value)||value.version!==1||!validConfig(value.config)||typeof value.paused!=='boolean'||!isObject(value.answers))return false;
 return Object.entries(value.answers).every(([wordId,events])=>wordId.length>0&&wordId.length<=2_000&&isObject(events)
  &&Object.entries(events).every(([day,rating])=>validLearningPlanDay(day)&&isRating(rating)));
}
export function createLearningPlan(config:LearningPlanConfig):LearningPlanState{
 if(!validConfig(config))throw new RangeError('Invalid learning plan configuration');
 return {version:1,config:{id:config.id,deckIds:[...new Set(config.deckIds)],startDay:config.startDay,targetDay:config.targetDay,dailyCap:config.dailyCap},paused:false,answers:{}};
}
export function loadLearningPlan(saved:string|null):LearningPlanState|null{
 if(saved===null)return null;
 try{
  const value:unknown=JSON.parse(saved);if(!validLearningPlan(value))return null;
  const result=createLearningPlan(value.config);result.paused=value.paused;
  for(const [id,events] of Object.entries(value.answers))Object.defineProperty(result.answers,id,{value:{...events},enumerable:true,writable:true,configurable:true});
  return result;
 }catch{return null;}
}
function selectedIds(wordIds:readonly string[]){
 const result:string[]=[],seen=new Set<string>();
 for(const id of wordIds){if(typeof id!=='string'||!id||id.length>2_000)throw new RangeError('Invalid learning plan word');if(!seen.has(id)){seen.add(id);result.push(id);}}
 if(result.length>MAX_LEARNING_PLAN_WORDS)throw new RangeError('Learning plan supports up to 50000 unique words');
 return result;
}
function assertState(state:LearningPlanState){if(!state||state.version!==1||!validConfig(state.config)||!isObject(state.answers)||typeof state.paused!=='boolean')throw new RangeError('Invalid learning plan');}
function ownEvents(state:LearningPlanState,id:string){return Object.hasOwn(state.answers,id)?state.answers[id]:undefined;}

type WordProgress={id:string;index:number;firstDay:string;level:number;due:number|null};
type Prepared={ids:string[];progress:WordProgress[];unseen:string[];completedIds:string[];completedNewIds:string[];completedReviewIds:string[];completedNewSelected:number;firstPassDay:string|null};
function afterAnswer(old:WordProgress|undefined,id:string,index:number,day:string,rating:LearningPlanRating):WordProgress{
 const date=dayNumber(day);
 if(!old||rating!=='green')return {id,index,firstDay:old?.firstDay??day,level:0,due:date+LEARNING_PLAN_INTERVALS[0]};
 // Early practice contributes a real word/day, while keeping the existing date.
 if(old.due===null||old.due>date)return old;
 const level=Math.min(old.level+1,LEARNING_PLAN_INTERVALS.length);
 return {...old,level,due:level===LEARNING_PLAN_INTERVALS.length?null:date+LEARNING_PLAN_INTERVALS[level]};
}
function prepare(state:LearningPlanState,wordIds:readonly string[],today:string):Prepared{
 assertState(state);dayNumber(today);const ids=selectedIds(wordIds),progress:WordProgress[]=[],unseen:string[]=[];
 let firstPassDay:string|null=null;
 for(let index=0;index<ids.length;index++){
  const id=ids[index],events=ownEvents(state,id);let current:WordProgress|undefined;
  if(events)for(const day of Object.keys(events).filter(day=>day<=today&&validLearningPlanDay(day)&&isRating(events[day])).sort())current=afterAnswer(current,id,index,day,events[day]);
  if(current){progress.push(current);if(firstPassDay===null||current.firstDay>firstPassDay)firstPassDay=current.firstDay;}else unseen.push(id);
 }
 const completedIds:string[]=[],completedNewIds:string[]=[],completedReviewIds:string[]=[];
 // Keep the day's actual workload when settings temporarily deselect a deck.
 for(const [id,events] of Object.entries(state.answers))if(isObject(events)&&isRating(events[today])){
  completedIds.push(id);(Object.keys(events).some(day=>day<today&&validLearningPlanDay(day)&&isRating(events[day]))?completedReviewIds:completedNewIds).push(id);
 }
 return {ids,progress,unseen,completedIds,completedNewIds,completedReviewIds,completedNewSelected:progress.filter(word=>word.firstDay===today).length,firstPassDay:unseen.length||!ids.length?null:firstPassDay};
}
function remainingNewBudget(remaining:number,completedNew:number,day:number,start:number,target:number){
 const days=Math.max(1,target-Math.max(day,start)+1);
 // Anchor this day's budget before its first answers, then subtract those
 // answers. Re-rendering after every card must not replenish the same budget.
 return Math.max(0,Math.ceil((remaining+completedNew)/days)-completedNew);
}
function schedulePrepared(state:LearningPlanState,p:Prepared,today:string):LearningPlanSchedule{
 const date=dayNumber(today),active=!state.paused&&today>=state.config.startDay,completed=new Set(p.completedIds);
 let capacity=Math.max(0,state.config.dailyCap-p.completedIds.length);
 const reviewIds=active?p.progress.filter(word=>word.due!==null&&word.due<=date&&!completed.has(word.id))
  .sort((a,b)=>a.due!-b.due!||a.index-b.index).slice(0,capacity).map(word=>word.id):[];
 capacity-=reviewIds.length;
 const budget=remainingNewBudget(p.unseen.length,p.completedNewSelected,date,dayNumber(state.config.startDay),dayNumber(state.config.targetDay));
 const newIds=active?p.unseen.slice(0,Math.min(capacity,budget)):[];capacity-=newIds.length;
 return {day:today,totalWords:p.ids.length,learnedCount:p.progress.length,remainingNewCount:p.unseen.length,
  completedIds:[...p.completedIds],completedNewIds:[...p.completedNewIds],completedReviewIds:[...p.completedReviewIds],newIds,reviewIds,
  remainingCapacity:capacity,totalCount:p.completedIds.length+reviewIds.length+newIds.length,paused:state.paused};
}
export function scheduleLearningPlan(state:LearningPlanState,wordIds:readonly string[],today=reviewDay()):LearningPlanSchedule{
 return schedulePrepared(state,prepare(state,wordIds,today),today);
}
export function recordLearningPlanAnswer(state:LearningPlanState,wordIds:readonly string[],wordId:string,rating:LearningPlanRating,today=reviewDay()):LearningPlanState{
 assertState(state);dayNumber(today);if(!isRating(rating))throw new RangeError('Invalid learning plan rating');
 // Ordinary self-study may exceed the plan's cap; record the real work without
 // assigning additional tasks. Paused, not-started and unselected plans stay put.
 if(state.paused||today<state.config.startDay||!selectedIds(wordIds).includes(wordId))return state;
 const previous=ownEvents(state,wordId)??{},old=previous[today];
 if(isRating(old)&&ratingRank[old]<=ratingRank[rating])return state;
 return {...state,answers:{...state.answers,[wordId]:{...previous,[today]:rating}}};
}

/** Heap ordering is shared with today's stable due-date / catalog-order policy. */
class ReviewHeap{
 private entries:WordProgress[]=[];
 get size(){return this.entries.length;}
 peek(){return this.entries[0];}
 private before(a:WordProgress,b:WordProgress){return a.due!<b.due!||a.due===b.due&&a.index<b.index;}
 push(value:WordProgress){const a=this.entries;let i=a.length;a.push(value);while(i>0){const parent=(i-1)>>1;if(!this.before(a[i],a[parent]))break;[a[parent],a[i]]=[a[i],a[parent]];i=parent;}}
 pop(){const a=this.entries,first=a[0],last=a.pop();if(a.length&&last){a[0]=last;let i=0;while(true){const left=i*2+1,right=left+1;let next=i;if(left<a.length&&this.before(a[left],a[next]))next=left;if(right<a.length&&this.before(a[right],a[next]))next=right;if(next===i)break;[a[i],a[next]]=[a[next],a[i]];i=next;}}return first;}
}
export function projectLearningPlan(state:LearningPlanState,wordIds:readonly string[],today=reviewDay()):LearningPlanProjection{
 const p=prepare(state,wordIds,today),schedule=schedulePrepared(state,p,today),date=dayNumber(today),start=dayNumber(state.config.startDay),target=dayNumber(state.config.targetDay);
 const days:LearningPlanForecastDay[]=Array.from({length:7},(_,offset)=>({day:dayString(date+offset)??today,newCount:offset===0?p.completedNewIds.length:0,reviewCount:offset===0?p.completedReviewIds.length:0,completedCount:offset===0?p.completedIds.length:0,totalCount:offset===0?p.completedIds.length:0}));
 let expected=p.firstPassDay,simulatedTasks=0,truncated=false;
 if(!state.paused&&p.ids.length){
  const heap=new ReviewHeap();for(const word of p.progress)if(word.due!==null)heap.push({...word});
  const order=new Map(p.ids.map((id,index)=>[id,index]));let unseen=0,day=Math.max(date,start);
  // Future answers are hypothetical greens only. Each word has at most seven
  // remaining tasks, so work is bounded by catalog size rather than a deadline.
  while(day<=date+6||unseen<p.unseen.length){
   if(simulatedTasks>=MAX_SIMULATED_TASKS){truncated=true;break;}
   const dayText=dayString(day);if(!dayText){truncated=true;break;}
   let slots=Math.max(0,state.config.dailyCap-(day===date?p.completedIds.length:0)),newCount=0,reviewCount=0;
   while(slots>0&&heap.size&&heap.peek().due!<=day){
    const old=heap.pop()!,next=afterAnswer(old,old.id,old.index,dayText,'green');
    if(next.due!==null)heap.push(next);slots--;reviewCount++;simulatedTasks++;
   }
   let newBudget=remainingNewBudget(p.unseen.length-unseen,day===date?p.completedNewSelected:0,day,start,target);
   while(slots>0&&newBudget>0&&unseen<p.unseen.length){
    const id=p.unseen[unseen++],next=afterAnswer(undefined,id,order.get(id)!,dayText,'green');
    heap.push(next);slots--;newBudget--;newCount++;simulatedTasks++;
   }
   if(unseen===p.unseen.length&&expected===null)expected=dayText;
   const offset=day-date;if(offset>=0&&offset<7){days[offset].newCount+=newCount;days[offset].reviewCount+=reviewCount;days[offset].totalCount+=newCount+reviewCount;}
   if(unseen===p.unseen.length&&day>=date+6)break;
   // No first-pass work remains: show the rest of the week, then stop even
   // though consolidation still has later due dates. Empty days need no loop.
   const nextDue=heap.peek()?.due??Infinity;
   if(unseen===p.unseen.length&&nextDue>day+1)day=Math.min(nextDue,date+6);
   else day++;
   if(!Number.isFinite(day))break;
  }
 }
 const expectedNumber=expected===null?null:dayNumber(expected),delayDays=expectedNumber===null?(p.ids.length?null:0):Math.max(0,expectedNumber-target);
 return {today:schedule,days,expectedFirstPassDay:expected,targetReachable:p.ids.length===0||expectedNumber!==null&&expectedNumber<=target,
  delayDays,simulationTruncated:truncated,assumption:'all-future-answers-green',simulatedTasks};
}
