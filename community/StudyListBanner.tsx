import {useEffect,useRef,useState} from 'react';
import {studyStorage,exportStorage,subscribeStudyStorage} from './storage';
import {getWorkspaceGeneration} from './api';
import {persistLearningWorkspace} from './workspacePersistence';
import {pendingRoundGoal} from './studyRoundStore';
import {reviewDay} from './practiceReviewModel';
import {completedRounds,checkedRound,roundKey} from './studyOverviewModel';
import type {PlannedList} from './listLearningPlanModel';
export default function StudyListBanner({unit,onBack,onDismiss}:{unit:PlannedList;onBack:()=>void;onDismiss:()=>void}){
 const [,refresh]=useState(0),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),epoch=useRef(getWorkspaceGeneration()),lock=useRef(false);
 useEffect(()=>subscribeStudyStorage(()=>refresh(n=>n+1)),[]);
 const today=reviewDay(),rounds=completedRounds(exportStorage(),[unit],today).get(unit.id),todayRound=[...rounds?.values()??[]].find(r=>r.done&&r.day===today),n=todayRound?.round??([...rounds?.values()??[]].filter(r=>!r.done).sort((a,b)=>a.round-b.round)[0]?.round??Math.max(0,...rounds?.keys()??[])+1);
 async function check(){if(lock.current||epoch.current!==getWorkspaceGeneration()||reviewDay()!==today)return;lock.current=true;setBusy(true);try{const r=checkedRound(unit.id,n,today,!todayRound,today,todayRound?.goalId??pendingRoundGoal(unit.id,n,today));studyStorage.setItem(roundKey(unit.id,n),JSON.stringify(r));const result=await persistLearningWorkspace(epoch.current);setMessage(result.synced?'本轮完成已记入总表。':result.message??'本机已存，账号同步待重试。');}catch(e){setMessage(String(e));}finally{lock.current=false;setBusy(false);}}
 return <aside className="planTaskBanner" aria-label="当前学习的 List"><div><strong>{unit.deckName} · {unit.label}</strong><p>{todayRound?`今天的第 ${n} 轮已完成，可回总表修改日期。`:'学完这一组，可以记入总表；也可以回去补记过去的学习。'}{message&&<span role="status">{message}</span>}</p></div><div><button disabled={busy||n>30} aria-pressed={!!todayRound} onClick={()=>void check()}>{todayRound?'✓ 本轮已完成 · 取消':`○ 完成第 ${n} 轮`}</button><button onClick={onBack}>返回学习清单</button><button aria-label="收起任务提示" onClick={onDismiss}>×</button></div></aside>;
}
