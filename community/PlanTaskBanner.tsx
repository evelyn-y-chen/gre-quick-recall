import {useEffect,useRef,useState} from 'react';
import {subscribeStudyStorage,studyStorage} from './storage';
import {readLearningPlanStore} from './learningPlanStore';
import {agendaKey,readAgenda,pendingTaskWords} from './learningAgendaModel';
import {writeTaskCheck} from './planTaskChecks';
import {persistLearningWorkspace} from './workspacePersistence';
import {getWorkspaceGeneration} from './api';
import {reviewDay} from './practiceReviewModel';
import type {PlannedList} from './listLearningPlanModel';
export default function PlanTaskBanner({unit,onBack,onDismiss}:{unit:PlannedList;onBack:()=>void;onDismiss:()=>void}){
 const [,refresh]=useState(0),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),generation=useRef(getWorkspaceGeneration()),lock=useRef(false),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;const unsubscribe=subscribeStudyStorage(()=>refresh(n=>n+1)),timer=setInterval(()=>refresh(n=>n+1),60000);return()=>{mounted.current=false;unsubscribe();clearInterval(timer);};},[]);
 const state=readLearningPlanStore(),today=reviewDay(),agenda=state?readAgenda(studyStorage.getItem(agendaKey(state.config.id)),state.config.id):null;
 const task=agenda?.tasks.find(t=>t.unitId===unit.id&&t.day===today);
 if(!state||!task)return null;
 const total=task.wordIds.length,remaining=pendingTaskWords(task,state,today).length,done=remaining===0;
 async function check(){if(lock.current||generation.current!==getWorkspaceGeneration()||readLearningPlanStore()?.config.id!==state!.config.id||today!==reviewDay())return;lock.current=true;setBusy(true);try{writeTaskCheck(state!.config.id,{taskId:task!.id,unitId:unit.id,day:today,done:!done,wordIds:task!.wordIds});const result=await persistLearningWorkspace(generation.current);if(mounted.current)setMessage(result.synced?'已保存。':result.message??'本机已存，账号同步待重试。');}catch(e){if(mounted.current)setMessage(String(e));}finally{lock.current=false;if(mounted.current)setBusy(false);}}
 return <aside className="planTaskBanner" aria-label="原词表学习任务"><div><strong>{task.kind==='new'?'新学／继续学习':'复习一次'} · {unit.deckName} · {unit.label}</strong><p>{done?'这组本次任务已完成。':state.config.completionMode==='manual'?'学完后可以亲手勾选，回到清单也能调整。':`本次已记录 ${total-remaining} / ${total} 词。照常标红黄绿，同色也可以再次确认。`}</p>{message&&<p role="status">{message}</p>}<progress aria-label="本次任务进度" value={total-remaining} max={Math.max(1,total)}/></div><div><button disabled={busy||state.paused} aria-pressed={done} onClick={()=>void check()}>{done?'✓ 已完成 · 点击取消':'○ 标记这一组完成'}</button><button onClick={onBack}>返回计划</button><button aria-label="收起任务提示" onClick={onDismiss}>×</button></div></aside>;
}
