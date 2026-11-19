import {useEffect,useRef,useState} from 'react';
import {appFetch,getWorkspaceGeneration} from '../community/api';
import {studyStorage} from '../community/storage';
import {persistLearningWorkspace} from '../community/workspacePersistence';
import {planModalKeys} from '../community/plannerKeys';
import {CAPTURE_EVENT,CAPTURE_FLUSH_EVENT,CAPTURE_SAVED_EVENT,NOTEBOOK_DRAFT_KEY,validNotebookBatch,type NotebookDraft,type NotebookSummary} from './notebookModel';
import {captureInput,captureIntoBatch,emptyCapture,newCaptureCard,readCaptureDraft,receiveCapture,type CaptureCard} from './quickCaptureModel';
import './quickCapture.css';

export default function QuickCapture({identity,onSaved}:{identity:string;onSaved:(message:string)=>void}){
 const key=`inkling-quick-capture-v1:${identity}`;
 const [draft,setDraft]=useState(emptyCapture),[open,setOpen]=useState(false),[batches,setBatches]=useState<NotebookSummary[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const draftRef=useRef(draft),wordInput=useRef<HTMLInputElement>(null),form=useRef<HTMLFormElement>(null),busyRef=useRef(false),epoch=useRef(getWorkspaceGeneration()),loaded=useRef(false),editSequence=useRef(0);
 const card=draft.cards.find(c=>c.id===draft.active);
 function store(next:typeof draft){
  editSequence.current++;
  try{window.localStorage.setItem(key,JSON.stringify(next));}catch{throw Error('草稿尚未保存，请保持窗口打开并重试。');}
  draftRef.current=next;setDraft(next);
 }
 function update(changes:Partial<CaptureCard>){
  if(!card||busyRef.current)return;
  try{store({...draftRef.current,cards:draftRef.current.cards.map(c=>c.id===card.id?{...c,...changes}:c)});setMessage('');}catch(e){setMessage(String(e instanceof Error?e.message:e));}
 }
 async function loadBatches(){
  try{
   const response=await appFetch('/api/notebook',{cache:'no-store'});if(!response.ok)throw Error();
   const result=await response.json();if(epoch.current!==getWorkspaceGeneration())return;
   const list=new Map<string,NotebookSummary>((result.batches as NotebookSummary[]).map(b=>[b.id,b]));
   for(const saved of Object.values(JSON.parse(studyStorage.getItem(NOTEBOOK_DRAFT_KEY)??'{}')) as NotebookDraft[])if(validNotebookBatch(saved?.batch,false))list.set(saved.batch.id,{id:saved.batch.id,source:saved.batch.source,date:saved.batch.date,count:saved.batch.words.length,revision:saved.revision});
   setBatches([...list.values()].sort((a,b)=>b.date.localeCompare(a.date)));
  }catch{setMessage('收集列表读取未完成，可重试或新建收集。');}
 }
 function show(){
  try{
   const latest=readCaptureDraft(window.localStorage.getItem(key));
   if(!latest.cards.length){const next=newCaptureCard(latest.lastTarget);store({...latest,cards:[next],active:next.id});}else {draftRef.current=latest;setDraft(latest);}
   setOpen(true);void loadBatches();
  }catch(e){setMessage(e instanceof Error?e.message:'草稿读取失败。');setOpen(true);}
 }
 useEffect(()=>{
  function receive(){
   if(!loaded.current)return;
   try{
    const incoming=captureInput(location.hash);if(!incoming)return;
    if(busyRef.current){setMessage('正在收录，请稍后再打开这条收词链接。');return;}
    const latest=readCaptureDraft(window.localStorage.getItem(key)),next=receiveCapture(latest,incoming);
    store(next);history.replaceState(null,'',location.pathname+location.search);
    setOpen(true);setMessage(incoming.field==='meaning'&&!next.cards.find(c=>c.id===next.active)?.word?'释义已保留，请补充对应的英文。':'');void loadBatches();
   }catch(e){setMessage(e instanceof Error?e.message:'收词尚未完成。');setOpen(true);}
  }
  try{const latest=readCaptureDraft(window.localStorage.getItem(key));draftRef.current=latest;setDraft(latest);loaded.current=true;receive();}catch(e){setMessage(e instanceof Error?e.message:'草稿读取失败。');}
  const launch=()=>show();
  const changed=(e:StorageEvent)=>{if(e.key!==key||busyRef.current)return;try{const next=readCaptureDraft(e.newValue);draftRef.current=next;setDraft(next);}catch{setMessage('另一窗口的草稿未能读取，请保留当前内容。');}};
  function keys(e:KeyboardEvent){if(e.isComposing||e.repeat||!e.ctrlKey||!e.shiftKey||!['Digit1','Digit2'].includes(e.code))return;e.preventDefault();e.stopImmediatePropagation();show();}
  window.addEventListener('hashchange',receive);window.addEventListener(CAPTURE_EVENT,launch);window.addEventListener('storage',changed);window.addEventListener('keydown',keys,true);
  return()=>{window.removeEventListener('hashchange',receive);window.removeEventListener(CAPTURE_EVENT,launch);window.removeEventListener('storage',changed);window.removeEventListener('keydown',keys,true);};
 },[key]);
 useEffect(()=>{
  if(!open)return;
  const previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;document.body.style.overflow='hidden';wordInput.current?.focus();
  return()=>{document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus?.();};
 },[open]);
 async function paste(field:'word'|'meaning'){
  const sequence=editSequence.current;
  try{
   const text=await navigator.clipboard.readText();if(epoch.current!==getWorkspaceGeneration()||busyRef.current||sequence!==editSequence.current)return;
   store(receiveCapture(draftRef.current,{field,text:text.trim()}));setMessage('');
  }catch{setMessage('请在对应输入框按 ⌘V 粘贴。');}
 }
 async function save(){
  if(!card||busyRef.current||!form.current?.reportValidity())return;
  busyRef.current=true;setBusy(true);setMessage('正在收录并保存…');
  const current={...card};
  try{
   const pending:Promise<unknown>[]=[];window.dispatchEvent(new CustomEvent(CAPTURE_FLUSH_EVENT,{detail:pending}));await Promise.all(pending);
   if(epoch.current!==getWorkspaceGeneration())throw Error('学习空间已切换，请在当前账号重新收录。');
   const target=current.target||current.collectionId;
   const read=async():Promise<NotebookDraft|null>=>{
    const response=await appFetch(`/api/notebook?id=${encodeURIComponent(target)}`,{cache:'no-store'});
    let saved:NotebookDraft|null=null;if(response.ok)saved=await response.json();else if(response.status!==404)throw Error('收集未能读取，请重试。');
    const local=JSON.parse(studyStorage.getItem(NOTEBOOK_DRAFT_KEY)??'{}')[target] as NotebookDraft|undefined;
    if(local&&validNotebookBatch(local.batch,false))saved=local;
    return saved;
   };
   let saved:NotebookDraft|null=null;
   for(let attempt=0;attempt<3;attempt++){
    const latest=await read(),next=captureIntoBatch(current,latest);
    const response=await appFetch('/api/notebook',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(next)});
    if(response.status===409)continue;
    const result=await response.json();if(!response.ok)throw Error(result.error||'收录保存失败，请重试。');
    saved={batch:next.batch,revision:result.revision};break;
   }
   if(!saved)throw Error('收集仍在更新，请稍后重试，收词草稿已保留。');
   if(epoch.current!==getWorkspaceGeneration())throw Error('学习空间已切换，请在当前账号查看记录。');
   const response=await appFetch(`/api/notebook?id=${encodeURIComponent(saved.batch.id)}`,{cache:'no-store'}),check=await response.json();
   if(!response.ok||JSON.stringify(check.batch)!==JSON.stringify(saved.batch))throw Error('尚未确认写入结果，请重试，草稿仍保留。');
   const drafts=JSON.parse(studyStorage.getItem(NOTEBOOK_DRAFT_KEY)??'{}');
   if(drafts[target]&&JSON.stringify(drafts[target].batch)===JSON.stringify(saved.batch)){delete drafts[target];studyStorage.setItem(NOTEBOOK_DRAFT_KEY,JSON.stringify(drafts));}
   window.dispatchEvent(new CustomEvent(CAPTURE_SAVED_EVENT,{detail:saved}));
   // Retrying after a failed upload targets the same collection and merges the
   // same word, preventing duplicate collections or words after local success.
   store({...draftRef.current,cards:draftRef.current.cards.map(c=>c.id===current.id?{...c,target:saved!.batch.id}:c),lastTarget:saved.batch.id});
   const result=await persistLearningWorkspace(epoch.current);
   if(!result.synced)throw Error(result.message||'已保存到本机，账号同步尚未完成。请重试收录。');
   const latest=draftRef.current,cards=latest.cards.filter(c=>c.id!==current.id);
   store({...latest,cards,active:cards.at(-1)?.id??'',lastTarget:saved.batch.id});
   onSaved(`已收录 ${current.word} 到「${saved.batch.source}」${result.destination==='account'?'，已保存到账号':'，已保存到这台设备'}。`);
   setMessage('');setOpen(false);
  }catch(e){setMessage(e instanceof Error?e.message:'收录未完成，草稿仍保留。');}
  finally{busyRef.current=false;setBusy(false);}
 }
 if(!open)return null;
 return <div className="communityModal workspaceMenuOverlay quickCaptureOverlay"><section role="dialog" aria-modal="true" aria-labelledby="quick-capture-title" onKeyDown={e=>{planModalKeys(e,()=>setOpen(false),busy);if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){e.preventDefault();void save();}}}>
  <button className="modalClose" type="button" disabled={busy} aria-label="收起快速收词并保留草稿" onClick={()=>setOpen(false)}>×</button>
  <h2 id="quick-capture-title">快速收词</h2>
  {draft.cards.length>1&&<label>待收录<select value={draft.active} disabled={busy} onChange={e=>store({...draftRef.current,active:e.target.value})}>{draft.cards.map((c,i)=><option value={c.id} key={c.id}>{c.word||`待填写英文 ${i+1}`}</option>)}</select></label>}
  {card&&<form ref={form} onSubmit={e=>{e.preventDefault();void save();}}>
   <label>英文<div className="captureInputLine"><input ref={wordInput} required maxLength={300} value={card.word} placeholder="先复制单词，再填到这里" onChange={e=>update({word:e.target.value})} disabled={busy}/><button type="button" disabled={busy} onClick={()=>void paste('word')}>粘贴英文</button></div></label>
   <label>释义<textarea rows={4} maxLength={4000} value={card.meaning} placeholder="选填，可复制原文或海词释义" onChange={e=>update({meaning:e.target.value})} disabled={busy}/></label>
   <div className="captureActions"><button type="button" disabled={busy} onClick={()=>void paste('meaning')}>粘贴释义</button>{card.word.trim()&&<a href={`https://dict.cn/${encodeURIComponent(card.word.trim())}`} target="_blank" rel="noopener noreferrer" onClick={()=>update({origin:[...new Set([card.origin,'海词词典'].filter(Boolean))].join('\n')})}>海词查词 ↗</a>}</div>
   <label>收录到<select value={card.target} disabled={busy} onChange={e=>update({target:e.target.value})}><option value="">＋ 新建收集</option>{card.target&&!batches.some(b=>b.id===card.target)&&<option value={card.target}>上次收集（读取中）</option>}{batches.map(b=><option value={b.id} key={b.id}>{b.date} · {b.source}（{b.count} 词）</option>)}</select></label>
   {!card.target&&<div className="captureNewCollection"><label>收集名称<input maxLength={300} value={card.source} placeholder={`${card.date} 随手收词`} onChange={e=>update({source:e.target.value})} disabled={busy}/></label><label>日期<input type="date" required value={card.date} onChange={e=>update({date:e.target.value})} disabled={busy}/></label></div>}
   <details><summary>来源与快捷键</summary><label>释义来源<input maxLength={1000} value={card.origin} onChange={e=>update({origin:e.target.value})} disabled={busy}/></label><p>复制后按 Control＋Shift＋1 收英文，Control＋Shift＋2 收释义。电脑快捷键需要先配置对应的 Mac 快捷指令。</p><p>⌘Enter 收录并收起 · Esc 保留草稿并收起</p></details>
   <footer><span>输入自动保留草稿</span><button className="primary" disabled={busy} type="submit">{busy?'正在保存…':'收录并收起'}</button></footer>
  </form>}
  {message&&<p role="status">{message}</p>}<button type="button" hidden={!message.includes('列表')} onClick={()=>void loadBatches()}>重试读取收集</button>
 </section></div>;
}
