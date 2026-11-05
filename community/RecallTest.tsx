import {useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import SelectionChips from './SelectionChips';
import {studyStorage} from './storage';
import {getWorkspaceGeneration} from './api';
import {persistLearningWorkspace} from './workspacePersistence';
import {useTestAutosave,TestAudio} from './testExperience';
import {shuffle} from './practiceModel';
import type {RecallReviewEvent} from './practiceReviewModel';
import {recordPracticeWord,recordCompletedPractice} from './practiceCompletions';
import {chooseRecallRating,createRecallRun,readRecallRun,recallKey,recallResult,recallSummary,recallGap,recallDeferred,advanceRecall,resumeDeferredRecall,type RecallRun,type RecallConfig,type RecallRating} from './recallModel';
import {recallFields,recallLocation,type RecallTerm} from './recallTerms';
import SharedWordMemory,{useWordMemory} from '../app/SharedWordMemory';
import NotebookFrequencyBadge from '../app/NotebookFrequency';
import TestQuestionHistory,{readTestLookback,appendTestLookback,captureTestNotes,type TestQuestionSnapshot} from '../app/TestQuestionHistory';

const ratings:{id:RecallRating;label:string;key:string}[]=[{id:'unknown',label:'不认识',key:'1'},{id:'fuzzy',label:'模糊',key:'2'},{id:'familiar',label:'熟悉',key:'3'}];
const labelFor=(id:RecallRating)=>ratings.find(r=>r.id===id)!.label;
export function RecallTestSetup({scope,title,pool,selected,random,onActiveChange,reviewTerms=[],reviewStartRef,onReview}:{scope:string;title:string;pool:RecallTerm[];selected:RecallTerm[];random:boolean;onActiveChange:(active:boolean)=>void;reviewTerms?:RecallTerm[];reviewStartRef?:{current:(()=>void)|null};onReview?:(event:RecallReviewEvent)=>void|Promise<void>}){
 const [config,setConfig]=useState<RecallConfig>({mode:'strict',retry:'all'}),[active,setActive]=useState<RecallRun|null>(null),[refresh,setRefresh]=useState(0);
 const validIds=useMemo(()=>new Set(pool.map(t=>t.id)),[pool]);
 const saved=useMemo(()=>readRecallRun(studyStorage.getItem(recallKey(scope)),validIds),[scope,validIds,refresh]);
 const generation=useRef(getWorkspaceGeneration());
 function open(run:RecallRun){if(getWorkspaceGeneration()!==generation.current)return;setActive(run);onActiveChange(true);}
 function close(){setActive(null);setRefresh(n=>n+1);onActiveChange(false);}
 useEffect(()=>{
  if(!reviewStartRef)return;
  reviewStartRef.current=()=>{if(reviewTerms.length)open({...createRecallRun((random?shuffle(reviewTerms):reviewTerms).map(t=>t.id),config),review:true});};
  return()=>{reviewStartRef.current=null;};
 },[config,random,reviewTerms,reviewStartRef]);
 const summary=saved?recallSummary(saved):null;
 return <div className="recallSetup">
  {saved&&summary&&<div className="practiceResume"><span>上次{saved.review?'到期翻卡':'翻卡'}：已答 {summary.answers} 次 · 已过关 {summary.completed} / {saved.order.length}{summary.deferred?` · 暂缓 ${summary.deferred} 个模糊词`:''}</span><button type="button" onClick={()=>open(saved)}>{saved.queue.length?'继续上次翻卡':'查看上次翻卡结果'}</button></div>}
  <div className="recallRules"><p>先看英文回忆中文，选择后揭晓完整词条和笔记；揭晓后可以改选。判断只属于本轮，不改词表红黄绿。</p>
   <SelectionChips exclusive label="翻卡过关条件" options={[{id:'strict',label:'严格 · 返场后连续两次熟悉'},{id:'lenient',label:'宽松 · 返场后连续两次模糊或熟悉'}]} selected={[config.mode]} onChange={ids=>{const mode=ids.find(id=>id!==config.mode);if(mode)setConfig({...config,mode:mode as RecallConfig['mode']});}}/>
   <SelectionChips exclusive label="翻卡返场范围" options={[{id:'all',label:'重测不认识和模糊'},{id:'unknown',label:'只重测不认识'}]} selected={[config.retry]} onChange={ids=>{const retry=ids.find(id=>id!==config.retry);if(retry)setConfig({...config,retry:retry as RecallConfig['retry']});}}/>
   <p className="recallHint">第一次就选熟悉，直接过关、不再返场。不认识隔 3 个词返回，模糊隔 5 个词；熟悉未达过关次数时也隔 5 个词巩固。剩余词不足时提前返回。{config.retry==='unknown'?'模糊词暂不返场，单独保留，可稍后补测；不会计为已过关。':''}</p>
  </div>
  <p>本次范围 {selected.length} 个词条</p><button type="button" className="primary solid" disabled={!selected.length} onClick={()=>open(createRecallRun((random?shuffle(selected):selected).map(t=>t.id),config))}>开始翻卡自测</button>
  {active&&createPortal(<RecallTest initial={active} pool={pool} scope={scope} title={title} onClose={close} onReview={onReview}/>,document.body)}
 </div>;
}

export function RecallTest({initial,pool,scope,title,onClose,onReview}:{initial:RecallRun;pool:RecallTerm[];scope:string;title:string;onClose:()=>void;onReview?:(event:RecallReviewEvent)=>void|Promise<void>}){
 const [run,setRun]=useState(initial),live=useRef(initial),generation=useRef(getWorkspaceGeneration()),busy=useRef(false),alive=useRef(true);
 const [saving,setSaving]=useState(false),[message,setMessage]=useState(''),[historyAt,setHistoryAt]=useState<number|null>(null);
 const lookback=readTestLookback(run.lookback),memory=useWordMemory();
 const byId=useMemo(()=>new Map(pool.map(t=>[t.id,t])),[pool]),current=byId.get(run.queue[0]),preview=recallResult(run),summary=recallSummary(run),deferred=recallDeferred(run);
 const fields=current?recallFields(current):[],key=recallKey(scope);
 const attempt=preview?`本词第 ${preview.attempts} 次判断 · ${preview.done?(preview.attempts===1?'首遍熟悉，直接过关':'已过关'):`连续达标 ${preview.streak}/2，还需 ${2-preview.streak} 次`}`:'';
 function update(next:RecallRun){
  if(busy.current||getWorkspaceGeneration()!==generation.current)return;
  // Persist the exact click before React effects or page dismissal can run.
  studyStorage.setItem(key,JSON.stringify(next));live.current=next;setRun(next);
 }
 useEffect(()=>{alive.current=true;if(getWorkspaceGeneration()===generation.current)studyStorage.setItem(key,JSON.stringify(initial));const old=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{alive.current=false;document.body.style.overflow=old;};},[]);
 const autoSave=useTestAutosave(run,!saving,generation.current);
 const compactStatus=autoSave.status==='测试进度已自动保存到账号'?'已同步账号':autoSave.status==='测试进度已自动保存到本机'?'已存本机':autoSave.status==='正在自动保存测试进度…'?'保存中…':'同步待重试';
 const needsRetry=compactStatus==='同步待重试';
 async function close(){
  if(busy.current)return;busy.current=true;setSaving(true);setMessage('正在核对保存…');
  try{
   if(getWorkspaceGeneration()!==generation.current)throw Error('学习空间已切换，请在当前账号核对。');
   studyStorage.setItem(key,JSON.stringify(live.current));
   const result=await persistLearningWorkspace(generation.current);
   if(!alive.current)return;
   if(getWorkspaceGeneration()!==generation.current)throw Error('学习空间已切换，请在当前账号核对保存。');
   if(!result.synced){setMessage(result.message||'已保留本机进度，账号同步尚未完成，请稍后重试。');return;}
   onClose();
  }catch(error){if(alive.current)setMessage((error instanceof Error?error.message:'保存未完成。')+' 本页仍保留，请重试或先导出便笺。');}
  finally{busy.current=false;if(alive.current)setSaving(false);}
 }
 function choose(value:RecallRating){if(historyAt===null&&current)update(chooseRecallRating(live.current,value));}
 async function next(){
  if(busy.current||getWorkspaceGeneration()!==generation.current||historyAt!==null||!live.current.selection)return;
  const before=live.current,term=byId.get(before.queue[0]);if(!term)return;
  const result=recallResult(before)!,nextRun=advanceRecall(before);
  const receipt:TestQuestionSnapshot={id:before.sessionId+':'+before.turn,word:term.word,meaning:term.meaning,status:`第 ${result.attempts} 次判断 · ${result.done?(result.attempts===1?'首遍熟悉，直接过关':'已过关'):`连续达标 ${result.streak}/2`}`,steps:[{label:'翻卡自测',chosen:[labelFor(before.selection!)],correct:[term.meaning],options:[]}],notes:[...recallFields(term).filter(f=>f.label!=='中文释义').map(f=>({word:f.label,text:f.value.slice(0,3000)})),...captureTestNotes([term.word],memory)]};
  try{
   if(before.review){
    if(!onReview)throw Error('到期复习未连接，请保留本页后重新打开本模块。');
    busy.current=true;setSaving(true);
    await onReview({id:before.sessionId+':'+before.turn,entryId:term.id,correct:before.selection==='familiar'||before.config.mode==='lenient'&&before.selection==='fuzzy',completed:result.done});
    if(!alive.current)return;
    if(getWorkspaceGeneration()!==generation.current)throw Error('学习空间已切换，当前卡片保留。');
    busy.current=false;setMessage('');
   }
  recordPracticeWord(term.word,scope.startsWith('notebook-')?'notebook':scope);
  if(!nextRun.queue.length&&!recallDeferred(nextRun).length)recordCompletedPractice(nextRun.sessionId,scope.startsWith('notebook-')?'notebook':scope);
  update({...nextRun,lookback:appendTestLookback(before.lookback,receipt).slice(-20)});
  }catch(error){if(alive.current)setMessage((error instanceof Error?error.message:'复习保存失败。')+' 当前词尚未跳过，可再次点击下一词重试。');}
  finally{busy.current=false;if(alive.current)setSaving(false);}
 }
 useEffect(()=>{const handler=(e:KeyboardEvent)=>{
  if(e.repeat||e.isComposing||e.ctrlKey||e.metaKey||e.altKey||e.shiftKey||(e.target as HTMLElement)?.closest('input,textarea,select,[contenteditable=true]'))return;
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();void close();return;}
  if(historyAt!==null||!current)return;
  const option=ratings.find(r=>r.key===e.key);
  if(option){e.preventDefault();e.stopImmediatePropagation();choose(option.id);return;}
  if(e.key==='Enter'&&live.current.selection){e.preventDefault();e.stopImmediatePropagation();next();}
 };window.addEventListener('keydown',handler,true);return()=>window.removeEventListener('keydown',handler,true);});
 return <div className="practiceOverlay practiceFocus recallOverlay" role="dialog" aria-modal="true" aria-label={title+'翻卡自测'}><section className="practicePanel recallPanel" onKeyDown={event=>event.stopPropagation()}>
  <header><h2>{title} · {run.review?'到期翻卡':'翻卡自测'}</h2><div><button type="button" disabled={saving||!lookback.length} onClick={()=>setHistoryAt(lookback.length-1)}>上一词回看</button><button type="button" disabled={saving} onClick={()=>void close()}>{saving?'正在保存…':'保存并返回'}</button></div></header>
  <div className="testToolbar"><div className="testSaveStatus"><small role="status" title={autoSave.status}><span className="recallSaveFull">{autoSave.status}</span><span className="recallSaveCompact">{compactStatus}</span></small>{needsRetry&&<button type="button" onClick={autoSave.retry}>重试同步</button>}</div>{historyAt===null&&current&&<TestAudio word={current.word} questionKey={run.sessionId+':'+run.turn}/>}</div>
  {message&&<p role="status" className="recallHint">{message}</p>}
  {historyAt!==null?<TestQuestionHistory snapshots={lookback} index={historyAt} onIndex={setHistoryAt} onReturn={()=>setHistoryAt(null)}/>:current?<>
   <div className="practiceQuestionHeader"><p>{run.review?'到期复习 · ':''}已答 {summary.answers} 次 · 已过关 {summary.completed} / {run.order.length} · 首遍熟悉直接过关 · {run.config.mode==='strict'?'返场后连续两次熟悉':'返场后连续两次模糊或熟悉'}{summary.deferred?` · 暂缓 ${summary.deferred} 词`:''}</p><h3 className="practicePrompt">{current.word}</h3><NotebookFrequencyBadge word={current.word}/><p>{recallLocation(current)}</p></div>
   <div className={`recallBody${run.selection?' isRevealed':''}`}>
    {run.selection?<><section className="recallSource" aria-label="完整词条"><dl>{fields.map(f=><div key={f.label}><dt>{f.label}</dt><dd lang={['英文解释','英文例句'].includes(f.label)?'en':undefined}>{f.value}</dd></div>)}</dl></section><aside className="recallMemory" aria-label="共享记忆笔记"><SharedWordMemory word={current.word}/></aside></>:<div className="recallConcealed"><span aria-hidden="true">Aa</span><p>在心里回忆它的中文意思</p><small>选择下方任意判断，查看释义和完整笔记。</small>{run.due[current.id]>run.turn&&<small>剩余词不足间隔，提前巩固这一词。</small>}</div>}
   </div>
   <footer className="recallFooter"><div className="recallReceipt" role="status">{preview?<><strong>{attempt}</strong><small>{preview.done?'下一词后，此词将移出本轮。':run.config.retry==='unknown'&&run.selection==='fuzzy'?'本词暂不返场，可在本轮结束后补测。':`下一词后安排返场：隔 ${recallGap(run.selection!)} 个词。`} 揭晓后仍可改选。{run.review?'点下一词确认并更新到期复习。':''}</small></>:<small>本轮判断不改词表红黄绿 · 快捷键 1 / 2 / 3</small>}</div><div className="recallControls"><div className="recallRatings" role="group" aria-label="本轮熟悉程度">{ratings.map(r=><button type="button" key={r.id} disabled={saving} aria-pressed={run.selection===r.id} aria-keyshortcuts={r.key} className={'recallRating '+r.id} onClick={()=>choose(r.id)}><span>{r.label}</span><small>{r.key}</small></button>)}</div><button type="button" className="primary recallNext" disabled={saving||!run.selection} onClick={next}>下一词 ↵</button></div></footer>
  </>:<section className="recallDone"><span className="eyebrow">本轮小结</span><h3>{deferred.length?'本轮已走完':'本轮全部过关'}</h3><p>已答 {run.turn} 次 · 已过关 {summary.completed} / {run.order.length}</p>{deferred.length>0&&<><p>还有 {deferred.length} 个模糊词暂未重测，尚未过关。</p><button type="button" className="primary" disabled={saving} onClick={()=>update(resumeDeferredRecall(live.current))}>继续巩固模糊词</button></>}<p className="recallHint">本轮结果已随测试进度保存，词表原有红黄绿保持原样。</p><button type="button" disabled={saving} onClick={()=>void close()}>保存并返回设置</button></section>}
 </section></div>;
}
