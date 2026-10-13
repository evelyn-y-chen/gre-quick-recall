import {studyStorage} from "../community/storage";
import {appFetch} from "../community/api";
"use client";
import SharedWordMemory from "./SharedWordMemory";
import {useEffect,useRef,useState} from "react";
import {entries,byId,makeQuestion,createSession,chooseMeaning,gradeQuestion,advanceSession,validSession,refreshAmbiguousQuestion,type Session,type Config} from "./aPlusTestModel";
import {dueReviewIds,reviewDay,REVIEW_INTERVALS,type ReviewHistory} from "./aPlusReviewModel";
const DRAFT="gre-a-plus-test-draft-v1";
export default function APlusTest({pronounce}:{pronounce:(word:string)=>void}) {
 const [session,setSession]=useState<Session|null>(null),[screen,setScreen]=useState<"setup"|"test">("setup");
 const [config,setConfig]=useState<Config>({lists:[1],order:"random",mode:"single"});
 const [history,setHistory]=useState<ReviewHistory>({}),[today,setToday]=useState(reviewDay);
 const [from,setFrom]=useState(1),[to,setTo]=useState(1);
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[status,setStatus]=useState("正在读取上次测试…"),[blocked,setBlocked]=useState(false);
 const current=useRef<Session|null>(null),revision=useRef(0),pending=useRef(false),busy=useRef(false),alive=useRef(true),conflict=useRef(false);
 const questionRef=useRef<HTMLElement|null>(null);
 function draft(){try{studyStorage.setItem(DRAFT,JSON.stringify({session:current.current,revision:revision.current}));}catch{if(alive.current)setStatus("无法保存本机草稿，请保持页面打开，等待工作区保存。");}}
 async function upload(){
  if(busy.current||conflict.current||!pending.current||!current.current)return;
  busy.current=true;if(alive.current)setSaving(true);
  try{
   while(pending.current&&current.current){
    const snapshot:Session=current.current;
    const response=await appFetch("/api/a-plus-test",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({session:snapshot,revision:revision.current})});
    const result=await response.json();
    if(!response.ok){if(response.status===409){conflict.current=true;if(alive.current)setBlocked(true);}throw Error(result.error??"保存失败，请重试");}
    revision.current=result.revision;if(alive.current&&result.history)setHistory(result.history);
    if(current.current===snapshot){pending.current=false;try{const saved=JSON.parse(studyStorage.getItem(DRAFT)??"null");if(JSON.stringify(saved?.session)===JSON.stringify(snapshot))studyStorage.removeItem(DRAFT);}catch{}}else draft();
   }
   if(alive.current)setStatus("测试进度、漏选记录与长期复习计划已保存到当前工作区。");
  }catch(error){if(alive.current)draft();if(alive.current)setStatus(error instanceof Error?error.message:"保存失败，本机草稿仍保留。");}
  finally{busy.current=false;if(alive.current)setSaving(false);}
 }
 useEffect(()=>{
  alive.current=true;
  void (async()=>{
   let local:{session:Session;revision:number}|null=null;
   try{const d=JSON.parse(studyStorage.getItem(DRAFT)??"null");if(d&&validSession(d.session)&&Number.isInteger(d.revision))local={...d,session:refreshAmbiguousQuestion(d.session)};}catch{}
   try{
    const r=await appFetch("/api/a-plus-test",{cache:"no-store"});if(!r.ok)throw Error();const data=await r.json();if(!alive.current)return;
    if(validSession(data.session))data.session=refreshAmbiguousQuestion(data.session);
    revision.current=data.revision;setHistory(data.history??{});
    if(local){current.current=local.session;setSession(local.session);pending.current=true;
     if(local.revision!==data.revision){revision.current=local.revision;conflict.current=true;setBlocked(true);setStatus("本机草稿与工作区版本不同，已保留本机内容。请先处理进度冲突。");}
     else{setStatus("已恢复本机测试草稿。");void upload();}
    }else if(validSession(data.session)){current.current=data.session;setSession(data.session);setStatus("已读取上次测试，可继续或开始新测试。");}
    else setStatus("选择范围和题型后开始。");
   }catch{if(alive.current){if(local){current.current=local.session;setSession(local.session);revision.current=local.revision;pending.current=true;}conflict.current=true;setBlocked(true);setStatus("工作区读取失败，草稿保留。请刷新页面重试。");}}
   finally{if(alive.current)setLoading(false);}
  })();
  return()=>{alive.current=false;};
 },[]);
 function update(next:Session){current.current=next;setSession(next);pending.current=true;draft();void upload();}
 async function useCloud(){
  setLoading(true);
  try{const r=await appFetch("/api/a-plus-test",{cache:"no-store"});if(!r.ok)throw Error();const d=await r.json();
   if(current.current)try{studyStorage.setItem(DRAFT+"-backup",JSON.stringify({session:current.current,revision:revision.current}));}catch{throw Error("无法备份本机记录，未切换工作区进度。");}
   revision.current=d.revision;setHistory(d.history??{});current.current=validSession(d.session)?refreshAmbiguousQuestion(d.session):null;setSession(current.current);pending.current=false;conflict.current=false;setBlocked(false);try{studyStorage.removeItem(DRAFT);}catch{}setScreen("setup");setStatus("已读取工作区进度，本机旧草稿另存为备份。");
  }catch(error){setStatus(error instanceof Error&&error.message?error.message:"读取失败，请稍后重试。");}finally{setLoading(false);}
 }
 useEffect(()=>{const timer=setInterval(()=>setToday(reviewDay()),60000);const focus=()=>setToday(reviewDay());window.addEventListener("focus",focus);return()=>{clearInterval(timer);window.removeEventListener("focus",focus);};},[]);
 const due=dueReviewIds(history,today).filter(id=>byId.has(id));
 const upcoming=Object.entries(history).filter(([,r])=>r.due>today).sort((a,b)=>a[1].due.localeCompare(b[1].due));
 function startReview(){
  if(!due.length||pending.current||saving||loading||blocked)return;
  const next=createSession({...config,lists:[...new Set(due.map(id=>byId.get(id)!.list))]},Math.random,due);
  if(config.order==="sequential")next.order=[...due];
  for(const id of next.order)next.progress[id].retryWords=history[id].retryWords;
  next.question=makeQuestion(next.order[0],config.mode,false,Math.random,history[next.order[0]].retryWords);
  update(next);setScreen("test");
 }
 function start(){if(!config.lists.length)return;update(createSession(config));setScreen("test");}
 useEffect(()=>{if(screen==="test")questionRef.current?.scrollIntoView({block:"start",behavior:"smooth"});},[screen,session?.question?.id]);
 const completed=session?session.order.filter(id=>session.progress[id].done).length:0;
 const errors=session?session.order.filter(id=>session.progress[id].hadError):[];
 const q=session?.question,entry=q?byId.get(q.entryId):null;
 return <section className="aPlusTest" onKeyDown={e=>e.stopPropagation()}>
  <div className="libraryHead"><div><p className="eyebrow">A+ GRE TEST</p><h1>A加等价词测试</h1><p>先辨词义，再找同义词。首轮全对直接完成；错词隔 5 题返场，连续全对 2 次才完成。</p></div></div>
  <div className="aPlusTestSync"><span role="status">{saving?"正在保存测试进度…":status}</span>{pending.current&&!saving&&!blocked&&<button type="button" onClick={upload}>重试保存</button>}</div>
  {blocked&&<p className="aPlusTestWarning">当前未覆盖工作区进度。可以查看本机记录，或保留本机备份后读取工作区版本。<button type="button" disabled={loading} onClick={useCloud}>备份本机并读取工作区</button></p>}
  {screen==="setup"?<>
   <section className="aPlusReviewPlan"><div><span className="eyebrow">间隔复习 · 北京时间</span><h2>今天复习 <strong>{due.length}</strong> 个词</h2><p>已纳入 {Object.keys(history).length} 词 · 逾期 {due.filter(id=>history[id].due<today).length} 词{upcoming.length?` · 下次 ${upcoming[0][1].due}`:""}</p></div><button type="button" className="solid" disabled={loading||saving||blocked||pending.current||!due.length} onClick={startReview}>{due.length?"开始到期复习":"今天暂无到期词"}</button><p className="aPlusReviewGuide">按 {REVIEW_INTERVALS.join("、")} 天逐步延长，之后每 30 天复习；答错或不确定回到次日，同日重复答对不连续升级。采用下方的顺序和题型设置，复习范围包含所有到期词。</p><p className="aPlusReviewGuide">开始到期复习会替换当前这一轮测试，长期复习计划保留。旧版仍保存着的已测词会从今天加入。</p>{due.length>0&&<details><summary>查看到期词</summary><div className="aPlusDueWords">{due.map(id=><span key={id}>{byId.get(id)!.word}<small>List {byId.get(id)!.list} · {history[id].due}</small></span>)}</div></details>}</section>
   {session&&<div className="aPlusResume"><span>上次测试：{session.order.length} 词 · 已完成 {completed} · {session.config.mode==="single"?"单选":"不定项"}</span><button type="button" className="solid" disabled={loading} onClick={()=>setScreen("test")}>{session.stage==="complete"?"查看测试结果":"继续上次测试"}</button></div>}
   <fieldset className="aPlusTestSetup" disabled={loading||blocked||saving}>
    <h2>选择范围</h2><div className="aPlusTestRange"><label>从 List<select value={from} onChange={e=>setFrom(Number(e.target.value))}>{Array.from({length:80},(_,i)=><option key={i+1}>{i+1}</option>)}</select></label><label>到 List<select value={to} onChange={e=>setTo(Number(e.target.value))}>{Array.from({length:80},(_,i)=><option key={i+1}>{i+1}</option>)}</select></label><button type="button" onClick={()=>setConfig({...config,lists:Array.from({length:Math.abs(to-from)+1},(_,i)=>Math.min(from,to)+i)})}>选中这个范围</button><button type="button" onClick={()=>setConfig({...config,lists:Array.from({length:80},(_,i)=>i+1)})}>全选</button><button type="button" onClick={()=>setConfig({...config,lists:[]})}>清空</button></div>
    <details><summary>单独勾选 List（已选 {config.lists.length} 个）</summary><div className="aPlusListChecks">{Array.from({length:80},(_,i)=>i+1).map(n=><label key={n}><input type="checkbox" checked={config.lists.includes(n)} onChange={e=>setConfig({...config,lists:e.target.checked?[...config.lists,n]:config.lists.filter(x=>x!==n)})}/>List {n}</label>)}</div></details>
    <div className="aPlusTestSettings"><label>出题顺序<select value={config.order} onChange={e=>setConfig({...config,order:e.target.value as Config["order"]})}><option value="sequential">顺序</option><option value="random">乱序</option></select></label><label>同义词题型<select value={config.mode} onChange={e=>setConfig({...config,mode:e.target.value as Config["mode"]})}><option value="single">单选 · 6 个词中仅 1 个正确</option><option value="multiple">不定项 · 6 个词中选出所有同义词</option></select></label></div>
    <p>已选 {entries.filter(e=>config.lists.includes(e.list)).length} 个核心词。中途任何一步出错，连续正确次数清零。剩余题目不足间隔时提前返场。</p>
    <button type="button" className="solid" disabled={!config.lists.length} onClick={start}>{session?"开始新测试（保留长期复习计划）":"开始测试"}</button>
   </fieldset>
  </>:session&&<>
   <div className="aPlusTestProgress"><strong>已完成 {completed} / {session.order.length}</strong><span>已答 {session.turn} 轮 · {errors.length} 个词曾出错</span><button type="button" onClick={()=>setScreen("setup")}>返回设置 / 暂停</button></div>
   <progress value={completed} max={session.order.length}/>
   <div ref={node=>{questionRef.current=node;}} className="aPlusQuestionAnchor">
   {q&&entry&&session.stage!=="complete"?<Question key={q.id} session={session} disabled={blocked} pronounce={pronounce} onMeaning={choice=>update(chooseMeaning(session,choice))} onGrade={(selected,uncertain)=>update(gradeQuestion(session,selected,uncertain))} onNext={()=>update(advanceSession(session))}/>:<div className="aPlusTestDone"><h2>本次测试完成</h2><p>{completed} 个词已完成；{session.order.length-errors.length} 个首次两步全对，{errors.length} 个经过返场巩固。</p><button type="button" onClick={()=>setScreen("setup")}>选择下一轮范围</button></div>}
   </div>
   {!!errors.length&&<details className="aPlusTestErrors" open={session.stage==="complete"}><summary>漏选与错题记录 · {errors.length} 个词</summary>{errors.map(id=>{const p=session.progress[id],e=byId.get(id)!;return <article key={id}><strong>{e.word}</strong><span>List {e.list} · {p.done?"已完成":`连续全对 ${p.correct}/2`} · 词义错误 {p.meaningErrors} 次</span><p>漏选：{Object.entries(p.missed).map(([w,n])=>`${w}（${n}次）`).join("、")||"无"}</p><p>误选：{Object.entries(p.extra).map(([w,n])=>`${w}（${n}次）`).join("、")||"无"}</p></article>;})}</details>}
  </>}
 </section>;
}
export function Question({session,disabled,pronounce,onMeaning,onGrade,onNext}:{session:Session;disabled:boolean;pronounce:(w:string)=>void;onMeaning:(m:string)=>void;onGrade:(words:string[],uncertain?:boolean)=>void;onNext:()=>void}) {
 const q=session.question!,e=byId.get(q.entryId)!,p=session.progress[e.id];
 const [meaning,setMeaning]=useState(""),[selected,setSelected]=useState<string[]>([]),[uncertain,setUncertain]=useState(false);
 const locked=useRef(false);
 const feedback=session.stage==="feedback",meaningStage=session.stage==="meaning",meaningOK=session.meaningChoice===e.meaning;
 const missed=q.options.filter(o=>o.correct&&!session.selected.includes(o.word)),extra=q.options.filter(o=>!o.correct&&session.selected.includes(o.word));
 const allOK=meaningOK&&!missed.length&&!extra.length;
 const canSubmit=!disabled&&(feedback|| (meaningStage?!!meaning:uncertain||selected.length>0));
 useEffect(()=>{locked.current=false;},[session.stage]);
 function submit(){
  if(!canSubmit||locked.current)return;locked.current=true;
  if(feedback)onNext();else if(meaningStage)onMeaning(meaning);else onGrade(selected,uncertain);
 }
 function handleEnter(event:KeyboardEvent){
  if(event.key!=="Enter"||event.repeat||event.isComposing||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return;
  const target=event.target as HTMLElement|null;
  if(target?.closest("textarea, select, input:not([type='radio']):not([type='checkbox']), [contenteditable='true'], [data-native-enter], a, summary"))return;
  if(target?.closest('[data-uncertain][aria-pressed="false"]'))return;
  if(!canSubmit)return;
  event.preventDefault();submit();
 }
 useEffect(()=>{window.addEventListener("keydown",handleEnter);return()=>window.removeEventListener("keydown",handleEnter);});
 return <article className="aPlusQuestion aPlusQuestionCompact" onKeyDown={event=>{event.stopPropagation();handleEnter(event.nativeEvent);}}>
  <div className="aPlusQuestionTop"><span>List {e.list} · #{e.number} · {p.attempts>(feedback?1:0)?"返场巩固":"首次测试"}</span><span className="aPlusTestModeBadge">{session.config.mode==="single"?"单选":"不定项"}</span></div>
  <div className="aPlusQuestionHeading"><h2>{e.word}<button data-native-enter type="button" aria-label={`朗读 ${e.word}`} onClick={()=>pronounce(e.word)}>▶</button></h2><div className="aPlusStepTrack" aria-label="测试步骤"><span className={meaningStage?"current":"finished"}>01 选释义</span><span className={!meaningStage?"current":""}>02 选同义词</span></div></div>
  {feedback&&<SharedWordMemory word={e.word}/>}
  {q.early&&<p className="aPlusTestHint">已无其他待测词，提前复习这一词。</p>}
  {meaningStage?<fieldset disabled={disabled}><legend>选择核心词的释义</legend><div className="aPlusMeaningChoices">{q.meanings.map((m,i)=><button type="button" key={m} className={meaning===m?"selected":""} aria-pressed={meaning===m} onClick={()=>setMeaning(m)}><b>{String.fromCharCode(65+i)}</b><span>{m}</span></button>)}</div><button type="button" data-uncertain className="aPlusUncertain" aria-pressed={meaning==="不确定"} onClick={()=>setMeaning("不确定")}>？ 不确定</button><p className="aPlusUncertainHint">不需要猜，确认后这一词会进入返场巩固。</p></fieldset>:<>
   <div className={`aPlusMeaningReceipt${feedback?(meaningOK?" correct":" incorrect"):""}`}><span>{feedback?(meaningOK?"释义正确":"释义需巩固"):"已选释义"}</span><strong>{feedback?e.meaning:session.meaningChoice}</strong>{feedback&&!meaningOK&&<small>你的选择：{session.meaningChoice}</small>}</div>
   <fieldset disabled={disabled}><legend>{feedback?"本题解析":session.config.mode==="single"?"选出唯一的同义词":"选出所有同义词（可能不止一个）"}</legend>
    {feedback&&<p className={`aPlusInlineResult${allOK?" correct":" incorrect"}`} role="status"><strong>{allOK?"两步全对":session.synonymUncertain||session.meaningChoice==="不确定"?"本轮不确定，待巩固":"本轮有误"}</strong><span>漏选 {missed.length} · 误选 {extra.length}</span></p>}
    <div className="aPlusSynChoices aPlusInlineChoices">{q.options.map((o,i)=>{
     const picked=feedback?session.selected.includes(o.word):selected.includes(o.word);
     const state=feedback?(o.correct?(picked?"correct":"missed"):(picked?"incorrect":"neutral")):(picked?"selected":"");
     return <div className={`aPlusChoiceTile ${state}`} key={o.word}>
      <label className="aPlusChoiceLabel"><input type={session.config.mode==="single"?"radio":"checkbox"} name={`syn-${q.id}`} checked={picked} disabled={feedback} onChange={()=>{setUncertain(false);setSelected(s=>session.config.mode==="single"?[o.word]:s.includes(o.word)?s.filter(w=>w!==o.word):[...s,o.word]);}}/><span className="aPlusChoiceLetter">{String.fromCharCode(65+i)}</span><strong>{o.word}</strong>{feedback&&<small className="aPlusChoiceResult">{o.correct?(picked?"选对":"漏选"):(picked?"误选":"干扰项")}</small>}</label>
      {feedback&&<div className="aPlusChoiceExplanation"><p className="aPlusChoiceGloss">{o.meaning}</p><button data-native-enter className="aPlusOptionSpeak" type="button" aria-label={`朗读 ${o.word}`} onClick={()=>pronounce(o.word)}>▶</button></div>}
     </div>;
    })}</div>
    {!feedback&&<><button type="button" data-uncertain className="aPlusUncertain" aria-pressed={uncertain} onClick={()=>{setUncertain(true);setSelected([]);}}>？ 不确定</button><p className="aPlusUncertainHint">不需要猜，提交后查看全部释义，并进入返场巩固。</p></>}
   </fieldset>
  </>}
  <div className="aPlusQuestionActions"><div>{feedback?<span>{p.done?"这一词已完成，不再返场。":`连续全对 ${p.correct}/2 · 隔 5 题返场${missed.length||extra.length?"，漏选和误选词会再次出现":""}`}</span>:<span>{meaningStage?"选好释义后确认":"选好后提交，释义会在各选项下展开"}</span>}<small><kbd>Enter</kbd> {feedback?"下一题":meaningStage?"确认释义":"提交答案"}</small></div><button type="button" className="solid" disabled={!canSubmit} onClick={submit}>{feedback?"继续下一题":meaningStage?"确认释义":uncertain?"不确定，查看解析":"提交答案"}<span aria-hidden="true"> ↵</span></button></div>
 </article>;
}
