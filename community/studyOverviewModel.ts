import {createLearningPlan,validLearningPlanDay,type LearningPlanRating} from './learningPlanModel';
import {wordReview,type PlannedList} from './listLearningPlanModel';
import {readPlanChecks,PLAN_CHECK_PREFIX} from './planTaskChecks';
export const ROUND_PREFIX='lemnota-list-round:';
export type ListRound={unitId:string;round:number;day:string;done:boolean;goalId?:string};
export const roundKey=(unitId:string,round:number)=>ROUND_PREFIX+encodeURIComponent(unitId)+':'+round;
const ranks={red:0,yellow:1,green:2};
export const plusDay=(day:string,n:number)=>new Date(Date.parse(day+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
export function readListRounds(storage:Record<string,string>):ListRound[]{return Object.entries(storage).flatMap(([key,raw])=>{if(!key.startsWith(ROUND_PREFIX))return [];try{const r=JSON.parse(raw) as ListRound;return r&&typeof r.unitId==='string'&&r.unitId.length<=600&&Number.isInteger(r.round)&&r.round>=1&&r.round<=30&&validLearningPlanDay(r.day)&&typeof r.done==='boolean'&&(r.goalId===undefined||typeof r.goalId==='string')&&key===roundKey(r.unitId,r.round)?[r]:[];}catch{return [];}});}
function datedAnswers(storage:Record<string,string>,today:string,known?:Set<string>,planId?:string){
 const answers:Record<string,Record<string,LearningPlanRating>>=Object.create(null);
 for(const [key,raw] of Object.entries(storage))try{
  const m=/^lemnota-plan-answer:([A-Za-z0-9_-]{1,100}):([^:]+):(\d{4}-\d{2}-\d{2})$/.exec(key);if(!m||planId&&m[1]!==planId||!validLearningPlanDay(m[3])||m[3]>today)continue;
  const id=decodeURIComponent(m[2]),color=JSON.parse(raw) as LearningPlanRating;if(encodeURIComponent(id)!==m[2]||known&&!known.has(id)||!Object.hasOwn(ranks,color))continue;
  const events=answers[id]??=Object.create(null);if(!events[m[3]]||ranks[color]<ranks[events[m[3]]])events[m[3]]=color;
 }catch{}
 return answers;
}
/** Read old confirmations without moving, deleting, or rewriting old plans. */
export function completedRounds(storage:Record<string,string>,units:PlannedList[],today:string){
 const datesGoals=new Map<string,string>(),explicit=readListRounds(storage),linkedGoals=new Set(explicit.flatMap(r=>r.goalId?[r.goalId]:[])),days=new Map<string,Set<string>>(),known=new Set(units.map(u=>u.id));
 const put=(id:string,day:string)=>{if(known.has(id)&&validLearningPlanDay(day)&&day<=today){const dates=days.get(id)??new Set<string>();dates.add(day);days.set(id,dates);}};
 const planIds=new Set(Object.keys(storage).filter(k=>k.startsWith(PLAN_CHECK_PREFIX)).map(k=>k.slice(PLAN_CHECK_PREFIX.length).split(':')[0]));
 for(const id of planIds)for(const c of readPlanChecks(storage,id).events)if(c.done)put(c.unitId,c.day);
 // Earlier automatic agendas can be completed by actual answers without a manual check.
 try{const saved=JSON.parse(storage['lemnota-learning-plan-v1']??'null'),config=saved?.config,agenda=JSON.parse(storage['lemnota-learning-agenda:'+config?.id]??'null');
  if(config&&config.completionMode!=='manual'&&agenda?.planId===config.id&&Array.isArray(agenda.tasks)){
   const explicitChecks=readPlanChecks(storage,config.id).checks,priorAnswers=datedAnswers(storage,today,undefined,config.id);
   for(const t of agenda.tasks)if(t&&known.has(t.unitId)&&validLearningPlanDay(t.day)&&t.day<=today&&explicitChecks[t.id]!==false&&Array.isArray(t.wordIds)&&t.wordIds.length&&t.wordIds.length<=50000){
    const threshold=t.kind==='new'?config.startDay:t.day;if(!validLearningPlanDay(threshold))continue;
    const completed=t.wordIds.map((word:unknown)=>typeof word==='string'?Object.keys(priorAnswers[word]??{}).filter(d=>d>=threshold).sort()[0]??null:null);
    if(completed.every((d:unknown)=>typeof d==='string'))put(t.unitId,(completed as string[]).sort().at(-1)!);
   }
  }
 }catch{}
 for(const [key,raw] of Object.entries(storage))if(key.startsWith('lemnota-daily-goal:'))try{const g=JSON.parse(raw);if(g&&key==='lemnota-daily-goal:'+g.day+':'+g.id&&g.done===true&&!g.removed&&!linkedGoals.has(g.id)){put(g.unitId,g.day);datesGoals.set(g.unitId+'|'+g.day,g.id);}}catch{}
 const result=new Map<string,Map<number,ListRound>>();
 for(const [id,dates] of days)result.set(id,new Map([...dates].sort().map((day,i)=>[i+1,{unitId:id,round:i+1,day,done:true,...datesGoals.has(id+'|'+day)?{goalId:datesGoals.get(id+'|'+day)}:{}}])));
 for(const r of explicit)if(known.has(r.unitId)&&r.day<=today){const rounds=result.get(r.unitId)??new Map();rounds.set(r.round,r);result.set(r.unitId,rounds);}
 return result;
}
export function studyOverview(storage:Record<string,string>,units:PlannedList[],today:string){
 const knownWords=new Set(units.flatMap(u=>u.words.map(w=>w.id))),answers=datedAnswers(storage,today,knownWords);
 const rounds=completedRounds(storage,units,today),studied:Record<string,string[]>=Object.create(null);
 for(const u of units)for(const r of rounds.get(u.id)?.values()??[])if(r.done)for(const w of u.words){const dates=studied[w.id]??=[];if(!dates.includes(r.day))dates.push(r.day);}
 const state={...createLearningPlan({id:'overview',deckIds:[...new Set(units.map(u=>u.deckId))].length?[...new Set(units.map(u=>u.deckId))]:['words'],startDay:today,targetDay:today,dailyCap:null}),answers,studied};
 const memory=new Map([...knownWords].map(id=>[id,wordReview(state,id,today)]));
 const rows=units.map(unit=>{const events=rounds.get(unit.id)??new Map<number,ListRound>(),done=[...events.values()].filter(r=>r.done),dated=unit.words.map(w=>memory.get(w.id)!).filter(w=>w.firstDay),due=done.length?(dated.map(w=>w.due).filter((d):d is string=>!!d).sort()[0]??null):null;return {unit,rounds:events,doneCount:done.length,recordedWords:dated.length,due};});
 // Each List appears once at its next due date. No hypothetical later rounds.
 const days=Array.from({length:7},(_,i)=>({day:plusDay(today,i),reviewIds:[] as string[],reviewWords:new Set<string>(),newIds:[] as string[]}));
 for(const row of rows)if(row.due){const index=Math.max(0,Math.round((Date.parse(row.due+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000));if(index<7){days[index].reviewIds.push(row.unit.id);for(const w of row.unit.words)if(memory.get(w.id)?.due&&memory.get(w.id)!.due!<=days[index].day)days[index].reviewWords.add(w.id);}}
 for(const row of rows){const first=row.rounds.get(1);if(first?.done&&first.day===today)days[0].newIds.push(row.unit.id);}
 return {rows,days,memory,rounds};
}
/** Updates are compact per-List/per-round keys, and cancellation is a tombstone. */
export function checkedRound(unitId:string,round:number,day:string,done:boolean,today:string,goalId?:string):ListRound{
 if(!unitId||unitId.length>600||!Number.isInteger(round)||round<1||round>30||!validLearningPlanDay(day)||day>today)throw Error('请选择今天或更早的实际学习日期。');
 return {unitId,round,day,done,...goalId?{goalId}:{}};
}
