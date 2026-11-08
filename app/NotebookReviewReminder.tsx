import {useEffect,useState} from 'react';
import {appFetch} from '../community/api';
import {subscribeNotebookChanges} from '../db/notebookStore';
import type {NotebookSummary} from './notebookModel';

/** Small saved-summary reads; never scan full notes on each input event. */
export default function NotebookReviewReminder({onOpen}:{onOpen:(id:string)=>void}){
 const [batches,setBatches]=useState<NotebookSummary[]>([]),[now,setNow]=useState(Date.now),[dismissed,setDismissed]=useState<string[]>([]);
 useEffect(()=>{
  let active=true,request=0;
  const refresh=async()=>{const id=++request;try{const response=await appFetch('/api/notebook',{cache:'no-store'});if(!response.ok)return;const data=await response.json();if(active&&id===request)setBatches(data.batches);}catch{/* Autosave displays any persistence error; this reminder must not block study. */}};
  const tick=()=>setNow(Date.now());
  const visible=()=>{if(document.visibilityState==='visible'){tick();void refresh();}};
  const stop=subscribeNotebookChanges(()=>{void refresh();});
  void refresh();window.addEventListener('focus',visible);document.addEventListener('visibilitychange',visible);
  return()=>{active=false;request++;stop();window.removeEventListener('focus',visible);document.removeEventListener('visibilitychange',visible);};
 },[]);
 useEffect(()=>{
  const future=batches.map(batch=>Date.parse(batch.recallReminder?.at??'')).filter(time=>Number.isFinite(time)&&time>now);
  if(!future.length)return;
  const timer=window.setTimeout(()=>setNow(Date.now()),Math.min(60_000,Math.max(50,Math.min(...future)-now)));
  return()=>window.clearTimeout(timer);
 },[batches,now]);
 const due=batches.filter(batch=>batch.recallReminder&&Date.parse(batch.recallReminder.at)<=now&&!dismissed.includes(batch.id+':'+batch.recallReminder.id)).sort((a,b)=>a.recallReminder!.at.localeCompare(b.recallReminder!.at));
 if(!due.length)return null;
 return <div className="communityModal notebookReminderOverlay" role="dialog" aria-modal="true" aria-labelledby="notebook-reminder-title"><section>
  <button type="button" className="modalClose" aria-label="稍后复习生词本" onClick={()=>setDismissed(previous=>[...previous,...due.map(batch=>batch.id+':'+batch.recallReminder!.id)])}>×</button>
  <p className="eyebrow">留给下一次的自己</p><h2 id="notebook-reminder-title">生词本到复习时间了</h2><p>这是你之前预约的过关，可以从上次批改的结果继续。</p>
  {due.map(batch=><div className="notebookReminderItem" key={batch.id}><strong>{batch.source}</strong><span>{batch.recallReminder!.label} · {batch.recallReminder!.wordIds.length} 词 · {new Date(batch.recallReminder!.at).toLocaleString()}</span><button type="button" className="primary" onClick={()=>{setDismissed(previous=>[...previous,batch.id+':'+batch.recallReminder!.id]);onOpen(batch.id);}}>现在过关</button></div>)}
  <small>关闭弹窗会保留预约；下次打开网站仍可看到。</small>
 </section></div>;
}
