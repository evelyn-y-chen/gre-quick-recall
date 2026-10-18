import {projectListPlan,wordReview,type PlannedList} from './listLearningPlanModel';
import {validLearningPlanDay,type LearningPlanState} from './learningPlanModel';

export type AgendaTask={id:string;unitId:string;kind:'new'|'review';day:string;wordIds:string[];method?:'self'|'test';carriedFrom?:string};
export type LearningAgenda={version:1;planId:string;approvedOn:string;mode:'auto'|'manual';tasks:AgendaTask[];configKey?:string};
export const AGENDA_PREFIX='lemnota-learning-agenda:';
export const agendaKey=(planId:string)=>AGENDA_PREFIX+planId;
export function readAgenda(raw:string|null,planId:string):LearningAgenda|null{
 try{
  const a=JSON.parse(raw??'null');
  if(!a||a.version!==1||a.planId!==planId||!validLearningPlanDay(a.approvedOn)||!['auto','manual'].includes(a.mode)||a.configKey!==undefined&&typeof a.configKey!=='string'||!Array.isArray(a.tasks)||a.tasks.length>5000)return null;
  const ids=new Set<string>();
  for(const t of a.tasks){
   if(!t||typeof t.id!=='string'||t.id.length>500||ids.has(t.id)||typeof t.unitId!=='string'||t.unitId.length>400||!['new','review'].includes(t.kind)||t.method!==undefined&&!['self','test'].includes(t.method)||!validLearningPlanDay(t.day)||t.carriedFrom!==undefined&&!validLearningPlanDay(t.carriedFrom)||!Array.isArray(t.wordIds)||!t.wordIds.length||t.wordIds.length>50000||t.wordIds.some((w:unknown)=>typeof w!=='string'||!w||w.length>500))return null;
   ids.add(t.id);
  }
  return a;
 }catch{return null;}
}
export function pendingTaskWords(task:AgendaTask,state:LearningPlanState,today:string):string[]{
 if(state.taskChecks?.[task.id]===true)return [];
 const pending=[...new Set(task.wordIds)].filter(id=>![...Object.keys(state.answers[id]??{}),...(state.studied?.[id]??[])].some(day=>validLearningPlanDay(day)&&day>=(task.kind==='new'?state.config.startDay:task.day)&&day<=today));
 return !pending.length&&(state.taskChecks?.[task.id]===false||state.config.completionMode==='manual')?[...new Set(task.wordIds)]:pending;
}
export function validAgendaTasks(agenda:LearningAgenda,units:PlannedList[]):AgendaTask[]{
 const known=new Map(units.map(u=>[u.id,new Set(u.words.map(w=>w.id))]));
 return agenda.tasks.flatMap(t=>{
  const words=known.get(t.unitId);if(!words)return [];
  const wordIds=t.wordIds.filter(w=>words.has(w));return wordIds.length?[{...t,wordIds}]:[];
 });
}
export function missedAgendaTasks(agenda:LearningAgenda,state:LearningPlanState,units:PlannedList[],today:string){
 return validAgendaTasks(agenda,units).filter(t=>t.day<today&&pendingTaskWords(t,state,today).length);
}
export function agendaReady(agenda:LearningAgenda|null,state:LearningPlanState,units:PlannedList[],today:string){
 if(!agenda||agenda.approvedOn>today||missedAgendaTasks(agenda,state,units,today).length)return false;
 const valid=validAgendaTasks(agenda,units);
 if(agenda.mode==='auto'&&state.config.reviewMode!=='none'&&state.config.reviewMode!=='manual'){
  const assigned=new Set(valid.filter(t=>t.kind==='review'&&t.day>=today).flatMap(t=>t.wordIds));
  const due=projectListPlan(state,units,today).today;
  if(due.reviewIds.some(id=>due.required[id].some(word=>!assigned.has(word))))return false;
 }
 return agenda.approvedOn===today||valid.some(t=>t.day>=today);
}
/** No writes or fabricated answers: this is an editable proposal. */
export function proposeAgenda(state:LearningPlanState,units:PlannedList[],today:string,previous:LearningAgenda|null=null,reset=false):LearningAgenda{
 const tasks:AgendaTask[]=[],mode=previous?.mode??'auto';
 const retained=previous&&!reset?validAgendaTasks(previous,units).filter(t=>t.day>=today):[];
 tasks.push(...retained.map(t=>({...t,wordIds:[...t.wordIds]})));
 if(mode==='auto'){
  const seen=new Set(tasks.filter(t=>t.kind==='review').flatMap(t=>t.wordIds)),newUnits=new Set(tasks.filter(t=>t.kind==='new').map(t=>t.unitId));
  for(const day of projectListPlan(state,units,today).reservations)for(const kind of ['review','new'] as const)for(const id of kind==='review'?day.reviewIds:day.newIds){
   if(kind==='new'&&(newUnits.has(id)||previous&&!reset&&previous.configKey===JSON.stringify(state.config)))continue;
   const unit=units.find(u=>u.id===id)!;
   const wordIds=unit.words.filter(w=>{
    const progress=wordReview(state,w.id,today);
    return kind==='new'?!progress.firstDay:!!progress.due&&progress.due<=day.day&&!seen.has(w.id);
   }).map(w=>w.id);
   if(!wordIds.length)continue;
   if(kind==='review')for(const id of wordIds)seen.add(id);else newUnits.add(id);
   tasks.push({id:`${kind}:${id}:${day.day}`,unitId:id,kind,day:day.day,wordIds});
  }
 }
 if(previous)for(const old of missedAgendaTasks(previous,state,units,today)){
  const carry={...old,id:`carry:${old.id}`.slice(-500),day:today,carriedFrom:old.carriedFrom??old.day,wordIds:pendingTaskWords(old,state,today)};
  const duplicate=tasks.find(t=>t.unitId===carry.unitId&&t.kind===carry.kind&&t.day===today);
  if(duplicate){duplicate.wordIds=[...new Set([...duplicate.wordIds,...carry.wordIds])];duplicate.carriedFrom=carry.carriedFrom;}
  else tasks.push(carry);
 }
 if(mode==='auto'&&(!previous||reset||tasks.length>retained.length||tasks.some(t=>t.carriedFrom))&&state.config.dailyCap!==null){
  const capacity=state.config.dailyCap,loads=new Map<string,Set<string>>();
  loads.set(today,new Set(Object.entries(state.answers).filter(([,events])=>events[today]).map(([id])=>id)));
  tasks.sort((a,b)=>a.day.localeCompare(b.day)||Number(!!b.carriedFrom)-Number(!!a.carriedFrom)||(a.kind===b.kind?0:a.kind==='review'?-1:1));
  for(const task of tasks){
   const words=pendingTaskWords(task,state,today);if(words.length>capacity)continue;
   for(let attempts=0;attempts<3660;attempts++){
    const old=loads.get(task.day)??new Set<string>(),next=new Set([...old,...words]);
    if(next.size<=capacity){loads.set(task.day,next);break;}
    task.day=new Date(Date.parse(task.day+'T00:00:00Z')+86400000).toISOString().slice(0,10);
   }
  }
 }
 return {version:1,planId:state.config.id,approvedOn:today,mode,tasks,configKey:JSON.stringify(state.config)};
}

export function agendaForecast(agenda:LearningAgenda,state:LearningPlanState,units:PlannedList[],today:string){
 const proposed=proposeAgenda(state,units,today,agenda);
 const base=projectListPlan(state,units,today);
 const tasks=validAgendaTasks(proposed,units);
 const days=base.days.map(day=>{
  const active=tasks.filter(t=>t.day===day.day),pending=active.filter(t=>pendingTaskWords(t,state,today).length);
  const ids=(kind:'new'|'review')=>[...new Set(pending.filter(t=>t.kind===kind).map(t=>t.unitId))];
  const wordIds=new Set(pending.flatMap(t=>pendingTaskWords(t,state,today)));
  if(day.day===today)for(const [id,history] of Object.entries(state.answers))if(history[today])wordIds.add(id);
  const newIds=ids('new'),reviewIds=ids('review'),completedCount=active.length-pending.length;
  return {...day,newIds,reviewIds,newCount:newIds.length,reviewCount:reviewIds.length,completedCount,totalCount:completedCount+pending.length,wordCount:wordIds.size,blocked:[]};
 });
 const firstDays=new Map(units.flatMap(u=>u.words.map(w=>[w.id,wordReview(state,w.id,today).firstDay] as const)));
 for(const task of tasks)if(task.kind==='new')for(const id of task.wordIds)if(!firstDays.get(id))firstDays.set(id,task.day);
 const allAssigned=[...firstDays.values()].every(Boolean);
 const lastAssigned=tasks.filter(t=>t.kind==='new').map(t=>t.day).sort().at(-1)??null;
 const expectedFirstPassDay=allAssigned?[...firstDays.values()].filter((d):d is string=>!!d).sort().at(-1)??null:null;
 return {...base,days,expectedFirstPassDay,targetReachable:!!expectedFirstPassDay&&expectedFirstPassDay<=state.config.targetDay,delayDays:expectedFirstPassDay?Math.max(0,Math.round((Date.parse(expectedFirstPassDay)-Date.parse(state.config.targetDay))/86400000)):null};
}
export function agendaCapProblems(agenda:LearningAgenda,state:LearningPlanState,today:string){
 const cap=state.config.dailyCap;if(cap===null)return [];
 const days=new Map<string,Set<string>>();
 for(const t of agenda.tasks){const words=days.get(t.day)??new Set<string>();for(const id of pendingTaskWords(t,state,today))words.add(id);days.set(t.day,words);}
 if(days.has(today))for(const [id,history] of Object.entries(state.answers))if(history[today])days.get(today)!.add(id);
 return [...days].filter(([,words])=>words.size>cap).map(([day,words])=>({day,count:words.size,cap}));
}
