"use client";
import {NOTEBOOK_RECALL_LIMIT,type NotebookWord,type NotebookRecallAttempt,type NotebookRecallResult} from "./notebookModel";
import {notebookRecallStats,notebookRecallIsWrong} from './notebookRecallModel';

const labels:Record<NotebookRecallResult,string>={correct:"正确",partial:"模糊",incorrect:"错误"};

/** Written answers belong to this collection, separate from reference meanings,
 * shared memory, test results and traffic-light ratings. */
export default function NotebookWrittenRecall({word,onChange,wholePage=false,referenceVisible=false,onNewAttempt}:{word:NotebookWord;onChange:(recalls:NotebookRecallAttempt[])=>void;wholePage?:boolean;referenceVisible?:boolean;onNewAttempt?:()=>void}) {
  const attempts=word.recalls??[],current=attempts.at(-1),number=(word.recallArchive?.attempts??0)+(attempts.length||1),stats=notebookRecallStats(word),result=current?.result??(current?.forgotten?'incorrect':undefined);
  const submitted=!!current?.submittedAt,wrong=notebookRecallIsWrong(current);
  function edit(answer:string) {
    if(submitted)return;
    const next:NotebookRecallAttempt={id:current?.id??crypto.randomUUID(),answer,checked:false};
    onChange(current?[...attempts.slice(0,-1),next]:[next]);
  }
  function check() {
    if(current && (current.answer.trim() || current.forgotten)) onChange([...attempts.slice(0,-1),{...current,checked:true,revealed:true}]);
  }
  function assess(result:NotebookRecallResult) {
    if(current?.checked&&!submitted) {const {forgotten,...rest}=current;onChange([...attempts.slice(0,-1),{...rest,result}]);}
  }
  const answer=<label><span className="notebookFieldLabel">我写的释义 · 第 {number} 次</span>
    <textarea aria-label={`${word.word} 第 ${number} 次回忆释义`} rows={2} maxLength={1000} readOnly={submitted} value={current?.answer??""} placeholder="先凭记忆写，再核对…" onChange={e=>edit(e.target.value)}/>
  </label>;
  return <div className={`notebookWrittenRecall${result?` recall-${result}`:''}`}>
    {wrong?<details className="notebookWrongAnswer" key={`${current?.id}:${result}:${submitted}`}><summary>查看{ submitted?'':'／修改'}本次原答案（默认隐藏）</summary>{answer}</details>:answer}
    <div className="notebookRecallMark" aria-live="polite"><span>第 {number} 次</span><strong>{result?`${result==='correct'?'✓':result==='incorrect'?'×':'≈'} ${current?.forgotten?'不记得':labels[result]}${result==='partial'?' · 计错':''}`:current?.checked?'待判断':'待回忆'}{submitted?' · 已提交':''}</strong><span className={`notebookRecallLevel level-${stats.group}`}>{stats.label}</span></div>
    {!submitted&&!wholePage&&<div className="notebookRecallActions">
      {!wholePage&&<button type="button" disabled={!current?.answer.trim()&&!current?.forgotten} onClick={check}>{current?.checked?"已核对 · 可重新判断":"核对释义"}</button>}
      {!wholePage&&current?.checked&&<button type="button" disabled={!onNewAttempt&&attempts.length>=NOTEBOOK_RECALL_LIMIT} onClick={()=>onNewAttempt?onNewAttempt():onChange([...attempts,{id:crypto.randomUUID(),answer:"",checked:false}])}>再写一次</button>}
    </div>}
    {submitted&&onNewAttempt&&<button type="button" className="notebookNextAttempt" onClick={onNewAttempt}>再默写这个词 · 第 {number+1} 次</button>}
    {current?.checked&&(!wholePage||referenceVisible||current.revealed)&&<div className="notebookRecallComparison">
      {!wholePage&&<><strong>参考释义</strong><p>{word.meaning||"还没有参考释义。可打开韦氏／海词核对，也可在左侧补充。"}</p></>}
      <div role="group" aria-label={`${word.word} 第 ${number} 次核对结果`} className="notebookRecallResults">
        {(["correct","partial","incorrect"] as const).map(result=><button type="button" key={result} disabled={submitted} aria-pressed={(current.result??(current.forgotten?'incorrect':undefined))===result} onClick={()=>assess(result)}>{labels[result]}</button>)}
      </div>
    </div>}
    {!!attempts.length&&<details className="notebookRecallHistory" key={current?.id}><summary aria-label={`查看 ${word.word} 的回忆记录 · ${stats.attempts} 次`}>记录 {stats.attempts} 次 · 过关 {stats.correct} · 错 {stats.wrong} · 正确率 {stats.total?Math.round(stats.correctRate*100)+'%':'—'}</summary><small className="notebookRecallStats">过关 {stats.correct} 次 · 错误 {stats.wrong} 次{stats.partial?`（含模糊 ${stats.partial} 次）`:''} · 正确率 {stats.total?Math.round(stats.correctRate*100)+'%':'—'}{stats.streak?` · 连续错 ${stats.streak} 次`:''}</small><ol>{attempts.map((attempt,index)=><li key={attempt.id} data-result={attempt.result??(attempt.forgotten?'incorrect':'ungraded')}><span>第 {(word.recallArchive?.attempts??0)+index+1} 次 · {attempt.forgotten?"不记得 · ":""}{attempt.result?labels[attempt.result]+(attempt.result==='partial'?'（计错）':''):attempt.checked?"已查看参考":"未核对"}{attempt.submittedAt?' · 已提交':''}</span><p>{attempt.answer|| (attempt.forgotten?"不记得":"未填写")}</p></li>)}</ol>{word.recallArchive?.attempts? <p>另有 {word.recallArchive.attempts} 次较早记录仅保留累计统计；最近 {NOTEBOOK_RECALL_LIMIT} 次保留原答案。</p>:null}</details>}
    {attempts.length>=NOTEBOOK_RECALL_LIMIT&&<small>保留最近 {NOTEBOOK_RECALL_LIMIT} 份完整答案；再次过关会继续累计次数。</small>}
  </div>;
}
