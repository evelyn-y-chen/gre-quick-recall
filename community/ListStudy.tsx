import {useEffect,useRef,useState} from 'react';
import SharedWordMemory from '../app/SharedWordMemory';
import {getWorkspaceGeneration} from './api';
import {persistLearningWorkspace} from './workspacePersistence';
import {readLearningPlanStore,recordLearningPlanWord} from './learningPlanStore';
import {scheduleListPlan,type PlannedList} from './listLearningPlanModel';
import type {LearningPlanRating} from './learningPlanModel';
import {reviewDay} from './practiceReviewModel';
import {planModalKeys} from './plannerKeys';

export default function ListStudy({unit,units,today,onClose}:{unit:PlannedList;units:PlannedList[];today:string;onClose:()=>void}){
 const [currentId,setCurrentId]=useState(()=>{const state=readLearningPlanStore();return state?scheduleListPlan(state,units,today).required[unit.id]?.[0]??'':'';}),[revealed,setRevealed]=useState(false),[answered,setAnswered]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const epoch=useRef(getWorkspaceGeneration()),openedDay=useRef(today),mounted=useRef(true),lock=useRef(false);
 useEffect(()=>{const old=document.body.style.overflow;document.body.style.overflow='hidden';mounted.current=true;return()=>{mounted.current=false;document.body.style.overflow=old;};},[]);
 const state=readLearningPlanStore(),schedule=state?scheduleListPlan(state,units,today):null,current=unit.words.find(w=>w.id===currentId),allIds=[...new Set(units.flatMap(u=>u.words.map(w=>w.id)))];
 const meanings=current?[...new Map(current.occurrences.map(o=>[o.meaning,o])).values()]:[];
 async function answer(rating:LearningPlanRating){
  if(lock.current||!current||!revealed)return;lock.current=true;setBusy(true);
  try{
   if(epoch.current!==getWorkspaceGeneration())throw Error('学习空间已切换，请返回当前计划。');
   if(reviewDay()!==openedDay.current)throw Error('新的一天开始了，请返回查看重新安排的今天任务。');
   const fresh=readLearningPlanStore();if(!fresh)throw Error('学习计划已变更，请返回。');
   if(fresh.paused)throw Error('计划已暂停，请返回继续计划。');
   const tasks=scheduleListPlan(fresh,units,today);
   if(!tasks.newIds.includes(unit.id)&&!tasks.reviewIds.includes(unit.id)&&!tasks.completedIds.includes(unit.id))throw Error('今天的任务已更新，请返回查看最新安排。');
   recordLearningPlanWord(fresh,allIds,current.id,rating,today);
   const saved=await persistLearningWorkspace(epoch.current);if(!mounted.current||epoch.current!==getWorkspaceGeneration())return;
   setAnswered(true);setMessage(saved.synced?'这次自测已记录。同词的其他 List 也会沿用。':saved.message??'已保存到本机，账号同步尚未完成。');
  }catch(e){if(mounted.current)setMessage(e instanceof Error?e.message:'保存未完成，请保持本页并重试。');}
  finally{lock.current=false;if(mounted.current)setBusy(false);}
 }
 function next(){
  const fresh=readLearningPlanStore();if(!fresh){onClose();return;}
  const tasks=scheduleListPlan(fresh,units,reviewDay());setCurrentId(tasks.required[unit.id]?.[0]??'');setRevealed(false);setAnswered(false);setMessage('');
 }
 function speak(){if(!current||typeof speechSynthesis==='undefined')return;speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(current.word);utterance.lang='en-US';speechSynthesis.speak(utterance);}
 return <div className="learningPlanOverlay learningStudyOverlay" role="dialog" aria-modal="true" aria-label="今日学习任务" onKeyDown={e=>planModalKeys(e,onClose,busy)}><section className="learningStudyPanel"><header><div><p className="eyebrow">{unit.deckName} · {unit.label}</p><h2>{current?'这一组，一个词一个词来':schedule?.completedIds.includes(unit.id)?'这一组已完成':'本组任务已更新'}</h2></div><button autoFocus disabled={busy} onClick={onClose}>保存并返回</button></header>
 <p className="learningPlanFine">完整 {unit.words.length} 词 · 本轮待自测 {schedule?.required[unit.id]?.length??0} 词 · 重复词沿用真实记录</p>
 {current?<><div className="learningStudyWord"><button className="enWord" onClick={speak} aria-label={`朗读 ${current.word}`}>{current.word} <span aria-hidden="true">▶</span></button><p>单击朗读；查看释义不会自动计为完成。</p></div><div className="learningStudyContent">{revealed?<><div className="learningStudyMeanings">{meanings.map((o,i)=><div key={i}><p>{o.meaning||'来源未提供释义'}</p><small>{o.deckName}{o.volume?` · ${{upper:'上册',middle:'中册',lower:'下册'}[o.volume]??o.volume}`:''}{o.list?` · List ${o.list}`:''}{o.category?` · ${o.category}`:''}{o.role==='equivalent'?' · 原词表同组释义':''}</small></div>)}</div><details className="learningStudySources"><summary>查看全部 {current.occurrences.length} 处来源</summary>{current.occurrences.map((o,i)=><p key={i}>{o.deckName}{o.volume?` · ${o.volume}册`:''}{o.list?` · List ${o.list}`:''}{o.category?` · ${o.category}`:''}</p>)}</details><SharedWordMemory key={current.id} word={current.word} hideWord/></>:<button className="learningReveal" onClick={()=>setRevealed(true)}>先回想一下，再看释义 ↓</button>}</div><footer>{message&&<p role="status">{message}</p>}{answered?<button className="primary" disabled={busy} onClick={next}>下一个词 →</button>:<div className="learningAnswerButtons">{([{rating:'red',text:'没想起'},{rating:'yellow',text:'有点模糊'},{rating:'green',text:'想起来了'}] as const).map(r=><button key={r.rating} className={r.rating} disabled={!revealed||busy} onClick={()=>void answer(r.rating)}><i/>{r.text}</button>)}</div>}<small>全组实际自测后计入完成，并产生下一轮复习。</small></footer></>:<div className="learningPlanDone"><span aria-hidden="true">✓</span><p>{schedule?.completedIds.includes(unit.id)?'这一组的积累已经留下。回到计划，继续或休息都可以。':'请返回计划，查看当前日期和剩余任务。'}</p><button className="primary" onClick={onClose}>返回我的计划</button></div>}</section></div>;
}
