import {useEffect,useState} from 'react';
import {subscribeStudyStorage,studyStorage} from './storage';
import {readLearningPlanStore} from './learningPlanStore';
import {agendaKey,readAgenda,pendingTaskWords} from './learningAgendaModel';
import {reviewDay} from './practiceReviewModel';
import type {PlannedList} from './listLearningPlanModel';
export default function PlanTaskBanner({unit,onBack,onDismiss}:{unit:PlannedList;onBack:()=>void;onDismiss:()=>void}){
 const [,refresh]=useState(0);
 useEffect(()=>{const unsubscribe=subscribeStudyStorage(()=>refresh(n=>n+1)),timer=setInterval(()=>refresh(n=>n+1),60000);return()=>{unsubscribe();clearInterval(timer);};},[]);
 const state=readLearningPlanStore(),today=reviewDay(),agenda=state?readAgenda(studyStorage.getItem(agendaKey(state.config.id)),state.config.id):null;
 const task=agenda?.tasks.find(t=>t.unitId===unit.id&&t.day===today);
 if(!state||!task)return null;
 const total=task.wordIds.length,remaining=pendingTaskWords(task,state,today).length;
 return <aside className="planTaskBanner" aria-label="原词表学习任务"><div><strong>{task.kind==='new'?'首次／继续学习':'复习一次'} · {unit.deckName} · {unit.label}</strong><p>{remaining?`本次已记录 ${total-remaining} / ${total} 词。照常标红黄绿，同色也可以再次确认。`:'这组本次任务已完成，记录已接入计划。'}仅查看释义或编辑笔记不会代替自测。</p><progress aria-label="本次任务进度" value={total-remaining} max={Math.max(1,total)}/></div><div><button onClick={onBack}>返回计划</button><button aria-label="收起任务提示" onClick={onDismiss}>×</button></div></aside>;
}
