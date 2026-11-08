"use client";
import {NOTEBOOK_RECALL_LIMIT,type NotebookWord,type NotebookRecallAttempt,type NotebookRecallResult} from "./notebookModel";
import {notebookRecallStats} from './notebookRecallModel';

const labels:Record<NotebookRecallResult,string>={correct:"正确",partial:"模糊",incorrect:"错误"};

/** Written answers belong to this collection, separate from reference meanings,
 * shared memory, test results and traffic-light ratings. */
export default function NotebookWrittenRecall({word,onChange,wholePage=false,referenceVisible=false,onNewAttempt}:{word:NotebookWord;onChange:(recalls:NotebookRecallAttempt[])=>void;wholePage?:boolean;referenceVisible?:boolean;onNewAttempt?:()=>void}) {
  const attempts=word.recalls??[],current=attempts.at(-1),number=(word.recallArchive?.attempts??0)+(attempts.length||1),stats=notebookRecallStats(word),result=current?.result??(current?.forgotten?'incorrect':undefined);
  function edit(answer:string) {
    const next:NotebookRecallAttempt={id:current?.id??crypto.randomUUID(),answer,checked:false};
    onChange(current?[...attempts.slice(0,-1),next]:[next]);
  }
  function check() {
    if(current && (current.answer.trim() || current.forgotten)) onChange([...attempts.slice(0,-1),{...current,checked:true,revealed:true}]);
  }
  function forget() {
    const next:NotebookRecallAttempt=current?.forgotten?{id:current.id,answer:current.answer,checked:false}:{id:current?.id??crypto.randomUUID(),answer:current?.answer??"",checked:true,revealed:true,forgotten:true,result:'incorrect'};
    onChange(current?[...attempts.slice(0,-1),next]:[next]);
  }
  function assess(result:NotebookRecallResult) {
    if(current?.checked) {const {forgotten,...rest}=current;onChange([...attempts.slice(0,-1),{...rest,result}]);}
  }
  return <div className={`notebookWrittenRecall${result?` recall-${result}`:''}`}>
    <div className="notebookRecallMark" aria-live="polite"><strong>{result?`${result==='correct'?'✓':result==='incorrect'?'×':'≈'} ${labels[result]}`:current?.checked?'待判断':'待回忆'}</strong><span className={`notebookRecallLevel level-${stats.group}`}>{stats.label}</span></div>
    <label>我写的释义 · 第 {number} 次
      <textarea aria-label={`${word.word} 第 ${number} 次回忆释义`} rows={2} maxLength={1000} value={current?.answer??""} placeholder="先凭记忆写，再核对…" onChange={e=>edit(e.target.value)}/>
    </label>
    <div className="notebookRecallActions">
      <button className="notebookRecallForgot" type="button" aria-label={`${word.word} 不记得`} aria-pressed={!!current?.forgotten} onClick={forget}>不记得</button>
      {!wholePage&&<button type="button" disabled={!current?.answer.trim()&&!current?.forgotten} onClick={check}>{current?.checked?"已核对 · 可重新判断":"核对释义"}</button>}
      {!wholePage&&current?.checked&&<button type="button" disabled={!onNewAttempt&&attempts.length>=NOTEBOOK_RECALL_LIMIT} onClick={()=>onNewAttempt?onNewAttempt():onChange([...attempts,{id:crypto.randomUUID(),answer:"",checked:false}])}>再写一次</button>}
    </div>
    {current?.forgotten&&<small>不记得已计为错误，参考释义已显示；可修改判断、输入答案或再点一次取消。</small>}
    {current?.checked&&(!wholePage||referenceVisible||current.revealed)&&<div className="notebookRecallComparison">
      {!wholePage&&<><strong>参考释义</strong><p>{word.meaning||"还没有参考释义。可打开韦氏／海词核对，也可在左侧补充。"}</p></>}
      <div role="group" aria-label={`${word.word} 第 ${number} 次核对结果`} className="notebookRecallResults">
        {(["correct","partial","incorrect"] as const).map(result=><button type="button" key={result} aria-pressed={(current.result??(current.forgotten?'incorrect':undefined))===result} onClick={()=>assess(result)}>{labels[result]}</button>)}
      </div>
      <small>{current.result?`本次记为${labels[current.result]}，可更改。`:"按意思自行判断，不要求与参考逐字一致。"}</small>
    </div>}
    {attempts.length>1&&<details className="notebookRecallHistory"><summary>最近 {attempts.length-1} 次回忆</summary><ol>{attempts.slice(0,-1).map((attempt,index)=><li key={attempt.id}><span>第 {(word.recallArchive?.attempts??0)+index+1} 次 · {attempt.forgotten?"不记得 · ":""}{attempt.result?labels[attempt.result]:attempt.checked?"已查看参考":"未核对"}</span><p>{attempt.answer|| (attempt.forgotten?"不记得":"未填写")}</p></li>)}</ol></details>}
    <small className="notebookRecallStats">过关 {stats.correct} 次 · 错误 {stats.incorrect} 次{stats.partial?` · 模糊 ${stats.partial} 次`:''} · 错误率 {Math.round(stats.rate*100)}%{stats.streak?` · 连续错 ${stats.streak} 次`:''}</small>
    {attempts.length>=NOTEBOOK_RECALL_LIMIT&&<small>保留最近 {NOTEBOOK_RECALL_LIMIT} 份完整答案；再次过关会继续累计次数。</small>}
  </div>;
}
