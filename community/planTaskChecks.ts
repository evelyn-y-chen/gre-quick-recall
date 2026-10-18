import {studyStorage} from './storage';
import {validLearningPlanDay} from './learningPlanModel';
export const PLAN_CHECK_PREFIX='lemnota-plan-task-check:';
export type TaskCheck={taskId:string;unitId:string;day:string;done:boolean;wordIds:string[]};
export const taskCheckKey=(planId:string,taskId:string)=>`${PLAN_CHECK_PREFIX}${planId}:${encodeURIComponent(taskId)}`;
export function readPlanChecks(storage:Record<string,string>,planId:string){
 const checks:Record<string,boolean>=Object.create(null),studied:Record<string,string[]>=Object.create(null),prefix=PLAN_CHECK_PREFIX+planId+':';
 for(const [key,raw] of Object.entries(storage))if(key.startsWith(prefix))try{
  const c=JSON.parse(raw) as TaskCheck;
  if(!c||typeof c.taskId!=='string'||taskCheckKey(planId,c.taskId)!==key||typeof c.unitId!=='string'||!validLearningPlanDay(c.day)||typeof c.done!=='boolean'||!Array.isArray(c.wordIds)||c.wordIds.length>50000||!c.wordIds.every(w=>typeof w==='string'&&!!w&&w.length<=500))continue;
  checks[c.taskId]=c.done;
  if(c.done)for(const id of c.wordIds){const days=studied[id]??=[];if(!days.includes(c.day))days.push(c.day);}
 }catch{}
 return {checks,studied};
}
/** A checked List records a study encounter, never a red/yellow/green answer. */
export function writeTaskCheck(planId:string,check:TaskCheck){
 if(!validLearningPlanDay(check.day))throw Error('请检查完成日期。');
 studyStorage.setItem(taskCheckKey(planId,check.taskId),JSON.stringify(check));
}
