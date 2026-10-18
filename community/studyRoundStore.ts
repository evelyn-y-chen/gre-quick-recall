import {exportStorage,studyStorage} from './storage';
import {checkedRound,completedRounds,readListRounds,roundKey,type ListRound} from './studyOverviewModel';
import type {PlannedList} from './listLearningPlanModel';
type Goal={id:string;unitId:string;kind:'new'|'review';day:string;done?:boolean};
export function goalRoundDone(goal:Goal){return readListRounds(exportStorage()).find(r=>r.goalId===goal.id)?.done;}
/** Link a manual table check to an existing matching daily goal, if present. */
export function pendingRoundGoal(unitId:string,round:number,today:string){
 const snapshot=exportStorage(),linked=new Set(readListRounds(snapshot).flatMap(r=>r.goalId?[r.goalId]:[]));
 for(const [key,raw] of Object.entries(snapshot))if(key.startsWith('lemnota-daily-goal:'))try{const g=JSON.parse(raw);if(g&&key==='lemnota-daily-goal:'+g.day+':'+g.id&&g.unitId===unitId&&g.day<=today&&!g.removed&&!linked.has(g.id)&&(round===1?g.kind==='new':g.kind==='review'))return g.id as string;}catch{}
}
/** The daily goal and master table share one completion, not two histories. */
export function completeGoalRound(goal:Goal,units:PlannedList[],today:string){
 const snapshot=exportStorage();delete snapshot['lemnota-daily-goal:'+goal.day+':'+goal.id];const old=readListRounds(snapshot).find(r=>r.goalId===goal.id),unit=units.find(u=>u.id===goal.unitId);if(!unit)return;
 if(!goal.done&&!old)return;
 let n=old?.round??1;
 if(!old){const rounds=completedRounds(snapshot,units,today).get(unit.id)??new Map<number,ListRound>();if(goal.kind==='review')n=Math.max(2,...[...rounds.keys()].map(n=>n+1));else if(rounds.get(1)?.done)n=Math.max(1,...[...rounds.keys()].map(n=>n+1));if(n>30)throw Error('这组已记录 30 轮，可在总表修改已有日期。');}
 const r=checkedRound(unit.id,n,goal.day,!!goal.done,today,goal.id);studyStorage.setItem(roundKey(unit.id,n),JSON.stringify(r));
}
