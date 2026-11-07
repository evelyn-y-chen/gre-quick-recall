"use client";
import {NOTEBOOK_RECALL_LIMIT,type NotebookWord,type NotebookRecallAttempt,type NotebookRecallResult} from "./notebookModel";

const labels:Record<NotebookRecallResult,string>={correct:"正确",partial:"模糊",incorrect:"错误"};

/** Written answers belong to this collection, separate from reference meanings,
 * shared memory, test results and traffic-light ratings. */
export default function NotebookWrittenRecall({word,onChange}:{word:NotebookWord;onChange:(recalls:NotebookRecallAttempt[])=>void}) {
  const attempts=word.recalls??[],current=attempts.at(-1),number=attempts.length||1;
  function edit(answer:string) {
    const next:NotebookRecallAttempt={id:current?.id??crypto.randomUUID(),answer,checked:false};
    onChange(current?[...attempts.slice(0,-1),next]:[next]);
  }
  function check() {
    if(current?.answer.trim()) onChange([...attempts.slice(0,-1),{...current,checked:true}]);
  }
  function assess(result:NotebookRecallResult) {
    if(current?.checked) onChange([...attempts.slice(0,-1),{...current,result}]);
  }
  return <div className="notebookWrittenRecall">
    <label>我写的释义 · 第 {number} 次
      <textarea aria-label={`${word.word} 第 ${number} 次回忆释义`} rows={2} maxLength={1000} value={current?.answer??""} placeholder="先凭记忆写，再核对…" onChange={e=>edit(e.target.value)}/>
    </label>
    <div className="notebookRecallActions">
      <button type="button" disabled={!current?.answer.trim()} onClick={check}>{current?.checked?"已核对 · 可重新判断":"核对释义"}</button>
      {current?.checked&&<button type="button" disabled={attempts.length>=NOTEBOOK_RECALL_LIMIT} onClick={()=>onChange([...attempts,{id:crypto.randomUUID(),answer:"",checked:false}])}>再写一次</button>}
    </div>
    {current?.checked&&<div className="notebookRecallComparison">
      <strong>参考释义</strong><p>{word.meaning||"还没有参考释义。可打开韦氏／海词核对，也可在左侧补充。"}</p>
      <div role="group" aria-label={`${word.word} 第 ${number} 次核对结果`} className="notebookRecallResults">
        {(["correct","partial","incorrect"] as const).map(result=><button type="button" key={result} aria-pressed={current.result===result} onClick={()=>assess(result)}>{labels[result]}</button>)}
      </div>
      <small>{current.result?`本次记为${labels[current.result]}，可更改。`:"按意思自行判断，不要求与参考逐字一致。"}</small>
    </div>}
    {attempts.length>1&&<details className="notebookRecallHistory"><summary>前 {attempts.length-1} 次回忆</summary><ol>{attempts.slice(0,-1).map((attempt,index)=><li key={attempt.id}><span>第 {index+1} 次 · {attempt.result?labels[attempt.result]:attempt.checked?"已查看参考":"未核对"}</span><p>{attempt.answer||"未填写"}</p></li>)}</ol></details>}
    {attempts.length>=NOTEBOOK_RECALL_LIMIT&&<small>已保留 {NOTEBOOK_RECALL_LIMIT} 次回忆；可另开收集继续记录。</small>}
  </div>;
}
