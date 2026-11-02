import {compactMemoryText,wordMemoryKey} from './wordMemoryModel';

export type TestQuestionSnapshot={
 id:string;word:string;meaning:string;status?:string;
 steps:{label:string;chosen:string[];correct:string[];options:{text:string;chosen:boolean;correct:boolean}[]}[];
 notes:{word:string;text:string}[];
};
/** Bounded, additive question receipts; never used as live grading state. */
export function readTestLookback(value:unknown):TestQuestionSnapshot[]{
 if(!Array.isArray(value))return [];
 return value.filter((item):item is TestQuestionSnapshot=>!!item&&typeof item.id==='string'&&typeof item.word==='string'&&typeof item.meaning==='string'&&Array.isArray(item.steps)&&item.steps.every((step:any)=>typeof step?.label==='string'&&Array.isArray(step.chosen)&&step.chosen.every((s:unknown)=>typeof s==='string')&&Array.isArray(step.correct)&&step.correct.every((s:unknown)=>typeof s==='string')&&Array.isArray(step.options)&&step.options.every((option:any)=>typeof option?.text==='string'&&typeof option.chosen==='boolean'&&typeof option.correct==='boolean'))&&Array.isArray(item.notes)&&item.notes.every((note:any)=>typeof note?.word==='string'&&typeof note.text==='string')).slice(-50);
}
export function appendTestLookback(value:unknown,snapshot:TestQuestionSnapshot){return [...readTestLookback(value),snapshot].slice(-50);}
export function captureTestNotes(words:string[],store:{records:Record<string,{text:string}>;drafts:Record<string,{text:string}>}|null){
 return [...new Set(words)].slice(0,3).map(word=>{const key=wordMemoryKey(word);return {word,text:compactMemoryText(store?.drafts[key]?.text??store?.records[key]?.text??'').slice(0,3000)};});
}
export default function TestQuestionHistory({snapshots,index,onIndex,onReturn}:{snapshots:TestQuestionSnapshot[];index:number;onIndex:(index:number)=>void;onReturn:()=>void}){
 const item=snapshots[index];if(!item)return null;
 return <section className="testQuestionHistory" aria-label="上一词回看"><header><div><small>只读回看 · {index+1} / {snapshots.length}</small><h3>{item.word}</h3><p>{item.meaning}</p>{item.status&&<p className="testAttemptStatus">{item.status}</p>}</div><button type="button" onClick={onReturn}>返回当前题</button></header><p className="testHistoryHint">这里只回看，不重新计分，也不会修改当前题、红绿灯或复习进度。</p>{item.steps.map((step,i)=><section className="testHistoryStep" key={i}><h4>{step.label}</h4><p>你的选择：{step.chosen.join(' · ')||'未作答／已跳过'}</p><p><strong>正确答案：{step.correct.join(' · ')}</strong></p>{step.options.length>0&&<ol>{step.options.map((option,j)=><li key={j} className={option.correct?'isCorrect':option.chosen?'isWrong':undefined}><span>{String.fromCharCode(65+j)} · {option.text}</span><small>{option.correct?'正确答案':''}{option.chosen?(option.correct?' · 已选':'你的选择'):''}</small></li>)}</ol>}</section>)}<div className="testHistoryNotes" aria-label="当时的记忆笔记">{item.notes.map(note=><section key={note.word}><h4>{note.word} · 记忆笔记</h4><p style={{whiteSpace:'pre-wrap'}}>{note.text||'当时没有记忆笔记。'}</p></section>)}</div><footer><button type="button" disabled={index===0} onClick={()=>onIndex(index-1)}>再看上一词</button><button type="button" disabled={index===snapshots.length-1} onClick={()=>onIndex(index+1)}>回看下一词</button><button type="button" onClick={onReturn}>返回当前题</button></footer></section>;
}
