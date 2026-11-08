import {useEffect,useMemo,useState} from 'react';
import type {NotebookBatch} from './notebookModel';
import {NOTEBOOK_RECALL_GROUPS,nextNotebookRecallTime,selectNotebookRecallWords,notebookRecallIsWrong,type NotebookRecallGroup} from './notebookRecallModel';

export default function NotebookRecallTools({batch,onStart,onUpdate}:{batch:NotebookBatch;onStart:(ids:string[])=>void;onUpdate:(batch:NotebookBatch)=>void}){
 const [scope,setScope]=useState<NotebookRecallGroup>('wrong'),[at,setAt]=useState(nextNotebookRecallTime),[message,setMessage]=useState('');
 useEffect(()=>setMessage(''),[batch.recallRound?.id]);
 const roundWords=useMemo(()=>batch.recallRound?batch.words.filter(word=>batch.recallRound!.wordIds.includes(word.id)):batch.words,[batch.words,batch.recallRound]);
 const selected=useMemo(()=>selectNotebookRecallWords(scope==='wrong'?roundWords:batch.words,scope),[batch.words,roundWords,scope]);
 const counts=useMemo(()=>Object.fromEntries([...NOTEBOOK_RECALL_GROUPS.map(group=>[group.id,selectNotebookRecallWords(batch.words,group.id).length]),['wrong',selectNotebookRecallWords(roundWords,'wrong').length]]),[batch.words,roundWords]);
 const judged=roundWords.filter(word=>word.recalls?.at(-1)?.result||word.recalls?.at(-1)?.forgotten);
 const correct=judged.filter(word=>word.recalls?.at(-1)?.result==='correct').length;
 const wrong=judged.filter(word=>notebookRecallIsWrong(word.recalls?.at(-1))).length;
 function schedule(){
  const time=new Date(at);
  if(!Number.isFinite(time.getTime())||time.getTime()<=Date.now()){setMessage('请选择未来的提醒时间。');return;}
  if(!selected.length){setMessage('这个范围还没有词，先选择要复习的词。');return;}
  const label=scope==='wrong'?'本轮错词':NOTEBOOK_RECALL_GROUPS.find(group=>group.id===scope)!.label;
  onUpdate({...batch,recallReminder:{id:crypto.randomUUID(),at:time.toISOString(),wordIds:selected.map(word=>word.id),label}});
  setMessage('提醒已加入自动保存；到时打开网站会弹窗，点击即可开始。');
 }
 return <section className="notebookRecallTools" aria-label="生词本过关与预约">
  <div className="notebookRecallOverview"><div><small>写完 → 核对 → 提交 → 再过一遍</small><h3>下一步怎么复习？</h3></div><p>当前范围 {roundWords.length} 词 · 正确 {correct} · 错误 {wrong}（含模糊） · 待批改 {roundWords.length-judged.length} · 正确率 {judged.length?Math.round(correct/judged.length*100)+'%':'—'}</p></div>
  <div className="notebookRecallQuick"><button type="button" disabled={!counts.wrong} onClick={()=>onStart(selectNotebookRecallWords(roundWords,'wrong').map(word=>word.id))}>只重过错词 · {counts.wrong}</button><button type="button" disabled={!batch.words.length} onClick={()=>onStart(batch.words.map(word=>word.id))}>全部再过 · {batch.words.length}</button></div>
  <details><summary>按薄弱程度选词，或预约下次过关</summary>
   <div className="notebookRecallScopes" role="group" aria-label="选择过关词的范围">{[{id:'wrong',label:'本轮错词'},...NOTEBOOK_RECALL_GROUPS].map(group=><button type="button" key={group.id} aria-pressed={scope===group.id} onClick={()=>{setScope(group.id as NotebookRecallGroup);setMessage('');}}>{group.label}<span>{counts[group.id]??0}</span></button>)}</div>
   <button type="button" className="solid" disabled={!selected.length} onClick={()=>onStart(selected.map(word=>word.id))}>开始所选 {selected.length} 词过关</button>
   <div className="notebookRecallSchedule"><label>下次过关时间<input aria-label="生词本下次过关时间" type="datetime-local" step={60} value={at} onInput={e=>setAt(e.currentTarget.value)} onChange={e=>setAt(e.target.value)}/></label><button type="button" disabled={!selected.length} onClick={schedule}>预约下次过关 · {selected.length} 词</button><small>按这台设备的时间提醒；网页关闭时不发送系统通知，下次打开会补提醒。</small></div>
   <details className="notebookRecallRules"><summary>这些分组怎么算？</summary><p>未核对：还没有判断记录。待巩固：最近一次错误或模糊，或至少 3 次判断后正确率不高于 75%。易错词：连续错 2 次，或至少 3 次判断后正确率不高于 50%。重点攻克：连续错 3 次及以上。其余已判断的词归为已过关；分组按较高优先级互斥计算，答对会清零连续错误。</p><p>模糊和不记得都计入错词及连续错误；只有正确计入过关和正确率。同一次修改判断会重新计算，不重复累计。每词保留最近 20 份完整回忆，更早的结果合并为计数；原答案可在该词的回忆记录中查看。</p></details>
  </details>
  {batch.recallReminder&&<div className="notebookRecallAppointment"><span>下次：{new Date(batch.recallReminder.at).toLocaleString()} · {batch.recallReminder.label} · {batch.recallReminder.wordIds.length} 词</span><button type="button" onClick={()=>{onUpdate({...batch,recallReminder:undefined});setMessage('已取消这次预约。');}}>取消预约</button></div>}
  {message&&<p role="status">{message}</p>}
 </section>;
}
