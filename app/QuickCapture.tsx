import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {appFetch,getWorkspaceGeneration} from '../community/api';
import {studyStorage} from '../community/storage';
import {persistLearningWorkspace} from '../community/workspacePersistence';
import {CAPTURE_EVENT,CAPTURE_FLUSH_EVENT,CAPTURE_SAVED_EVENT,NOTEBOOK_DRAFT_KEY,validNotebookBatch,type NotebookDraft,type NotebookSummary} from './notebookModel';
import {captureInput,capturesIntoBatch,emptyCapture,newCaptureCard,readCaptureDraft,receiveCapture,type CaptureCard,type CaptureInput} from './quickCaptureModel';
import {listenForCapture} from './captureTransfer';
import './quickCapture.css';

const knownAccountKey='inkling-quick-capture-had-account';

function pictureInPicture(){
 return (window as Window & {documentPictureInPicture?:{requestWindow(options:{width:number;height:number}):Promise<Window>}}).documentPictureInPicture;
}

export default function QuickCapture({identity,account,started,onLogin,onSaved}:{identity:string;account:string|null;started:boolean;onLogin:()=>void;onSaved:(message:string)=>void}){
 const key=`inkling-quick-capture-v1:${identity}`;
 const [draft,setDraft]=useState(emptyCapture),[open,setOpen]=useState(false),[batches,setBatches]=useState<NotebookSummary[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const draftRef=useRef(draft),wordInput=useRef<HTMLInputElement>(null),meaningInput=useRef<HTMLTextAreaElement>(null),form=useRef<HTMLFormElement>(null),busyRef=useRef(false),epoch=useRef(getWorkspaceGeneration()),loaded=useRef(false),editSequence=useRef(0);
 const [floating,setFloating]=useState<Window|null>(null),floatRef=useRef<Window|null>(null);
 const settings=useRef<HTMLDetailsElement>(null);
 const focusField=useRef<CaptureInput['field']>('word');
 const card=draft.cards.find(c=>c.id===draft.active);
 const completedCards=draft.cards.filter(c=>c.word.trim());
 const incompleteCards=draft.cards.some(c=>!c.word.trim()&&c.meaning.trim());
 const [needsAccount,setNeedsAccount]=useState(false);
 const blocked=!account&&needsAccount;
 const startedRef=useRef(started);startedRef.current=started;
 function store(next:typeof draft){
  editSequence.current++;
  try{window.localStorage.setItem(key,JSON.stringify(next));}catch{throw Error('草稿尚未保存，请保持窗口打开并重试。');}
  draftRef.current=next;setDraft(next);
 }
 function update(changes:Partial<CaptureCard>){
  if(!card||busyRef.current)return;
  try{store({...draftRef.current,cards:draftRef.current.cards.map(c=>c.id===card.id?{...c,...changes}:c)});setMessage('');}catch(e){setMessage(String(e instanceof Error?e.message:e));}
 }
 function startNext(){
  if(!card?.word.trim()||busyRef.current)return;
  const blank=draftRef.current.cards.find(item=>!item.word.trim()&&!item.meaning.trim());
  const next={...newCaptureCard(card.target),source:card.source,date:card.date,collectionId:card.collectionId};
  try{store({...draftRef.current,cards:blank?draftRef.current.cards:[...draftRef.current.cards,next],active:blank?.id??next.id});setMessage('');wordInput.current?.focus();}catch(e){setMessage(e instanceof Error?e.message:'未能保留草稿。');}
 }
 function changeDestination(changes:Partial<CaptureCard>){
  if(!card||busyRef.current)return;
  try{store({...draftRef.current,cards:draftRef.current.cards.map(item=>({...item,target:card.target,source:card.source,date:card.date,collectionId:card.collectionId,...changes}))});}catch(e){setMessage(e instanceof Error?e.message:'未能保留收录位置。');}
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
 function show(focus:'word'|'meaning'='word'){
  if(busyRef.current)return;
  focusField.current=focus;
  try{
   const latest=readCaptureDraft(window.localStorage.getItem(key));
   if(!latest.cards.length){const next=newCaptureCard(latest.lastTarget);store({...latest,cards:[next],active:next.id});}else {draftRef.current=latest;setDraft(latest);}
   setOpen(true);(focus==='word'?wordInput:meaningInput).current?.focus({preventScroll:true});void loadBatches();
  }catch(e){setMessage(e instanceof Error?e.message:'草稿读取失败。');setOpen(true);}
 }
 function closeFloating(){
  const current=floatRef.current;
  floatRef.current=null;setFloating(null);current?.close();
 }
 function dismiss(){setOpen(false);closeFloating();}
 async function floatCard(){
  const pip=pictureInPicture();if(!pip||floatRef.current)return;
  let child:Window|undefined;
  try{
   child=await pip.requestWindow({width:380,height:500});
   if(epoch.current!==getWorkspaceGeneration()){child.close();return;}
   child.document.title='Inkling 快速收词';
   child.document.documentElement.lang='zh-CN';
   child.document.documentElement.dataset.theme=document.documentElement.dataset.theme;
   for(const style of document.querySelectorAll('style,link[rel="stylesheet"]')){
    const clone=child.document.importNode(style,true);
    if(style instanceof HTMLLinkElement)(clone as HTMLLinkElement).href=style.href;
    child.document.head.append(clone);
   }
   const current=child;
   current.addEventListener('pagehide',()=>{
    if(floatRef.current===current){floatRef.current=null;setFloating(null);}
   },{once:true});
   floatRef.current=current;setFloating(current);
  }catch{child?.close();setMessage('浮窗未打开。你可以继续在这个页面收词。');}
 }
 useEffect(()=>()=>{const current=floatRef.current;floatRef.current=null;current?.close();},[]);
 useEffect(()=>{
  try{if(account)window.localStorage.setItem(knownAccountKey,'1');else setNeedsAccount(window.localStorage.getItem(knownAccountKey)==='1');}catch{}
 },[account]);
 useEffect(()=>{
  let canReceiveInThisTab=startedRef.current||!new URLSearchParams(location.hash.slice(1)).has('capture');
  function accept(incoming:CaptureInput){
   const latest=readCaptureDraft(window.localStorage.getItem(key));
   const next=receiveCapture(latest,incoming);
   focusField.current=incoming.field;
   store(next);setOpen(true);setMessage(incoming.field==='meaning'&&!next.cards.find(c=>c.id===next.active)?.word?'释义已保留，请补充对应的英文。':'');void loadBatches();
  }
  const canAccept=()=>!busyRef.current&&(canReceiveInThisTab||startedRef.current)&&epoch.current===getWorkspaceGeneration();
  const transfer=account?listenForCapture(identity,canAccept,incoming=>{
   if(!canAccept())return false;
   try{accept(incoming);return true;}catch{return false;}
  }):null;
  let cancelTransfer:(()=>void)|undefined;
  const clearHash=()=>history.replaceState(history.state,'',location.pathname+location.search);
  function receive(allowTransfer=false){
   if(!loaded.current)return;
   try{
    const incoming=captureInput(location.hash);if(!incoming)return;
    if(busyRef.current){setMessage('正在收录，请稍后再打开这条收词链接。');return;}
    if(!account){setNeedsAccount(true);show();return;}
    if(allowTransfer&&transfer&&!startedRef.current&&history.length===1){
     const hash=location.hash;
     cancelTransfer=transfer.send(incoming,accepted=>{
      if(location.hash!==hash||epoch.current!==getWorkspaceGeneration())return;
      if(accepted){clearHash();window.close();onSaved('已送到原来的 Inkling 收词卡。');}
      else {
       try{accept(incoming);clearHash();canReceiveInThisTab=true;}catch(e){setOpen(true);setMessage(e instanceof Error?e.message:'收词尚未完成。');}
      }
     });
    }else{accept(incoming);clearHash();canReceiveInThisTab=true;}
   }catch(e){setMessage(e instanceof Error?e.message:'收词尚未完成。');setOpen(true);}
  }
  const hashChanged=()=>{cancelTransfer?.();receive();};
  try{const latest=readCaptureDraft(window.localStorage.getItem(key));draftRef.current=latest;setDraft(latest);loaded.current=true;receive(true);}catch(e){setMessage(e instanceof Error?e.message:'草稿读取失败。');}
  const launch=()=>show();
  const changed=(e:StorageEvent)=>{if(e.key!==key||busyRef.current)return;try{const next=readCaptureDraft(e.newValue);editSequence.current++;draftRef.current=next;setDraft(next);}catch{setMessage('另一窗口的草稿未能读取，请保留当前内容。');}};
  const hotkey=(event:KeyboardEvent)=>{
   if(event.isComposing||event.repeat||event.ctrlKey||event.metaKey||!event.altKey||!event.shiftKey||!['KeyW','KeyM'].includes(event.code))return;
   if(document.querySelector('[role="dialog"][aria-modal="true"]'))return;
   event.preventDefault();event.stopImmediatePropagation();
   if(busyRef.current)return;
   const field=event.code==='KeyW'?'word':'meaning';
   const sequence=editSequence.current;
   void (async()=>{
    try{
     const text=await navigator.clipboard.readText();
     if(sequence===editSequence.current&&epoch.current===getWorkspaceGeneration()&&!busyRef.current)accept({field,text:text.trim()});
    }catch{if(epoch.current===getWorkspaceGeneration()){show(field);setMessage('请在对应输入框按 ⌘V 粘贴。');}}
   })();
  };
  window.addEventListener('hashchange',hashChanged);window.addEventListener(CAPTURE_EVENT,launch);window.addEventListener('storage',changed);
  window.addEventListener('keydown',hotkey,true);
  return()=>{cancelTransfer?.();transfer?.close();window.removeEventListener('hashchange',hashChanged);window.removeEventListener(CAPTURE_EVENT,launch);window.removeEventListener('storage',changed);window.removeEventListener('keydown',hotkey,true);};
 },[key]);
 useEffect(()=>{
  if(!open)return;
  const previous=document.activeElement as HTMLElement|null;
  return()=>{if(previous?.isConnected)previous.focus?.({preventScroll:true});};
 },[open]);
 useEffect(()=>{
  if(open)(focusField.current==='word'?wordInput:meaningInput).current?.focus({preventScroll:true});
 },[open,floating]);
 async function save(){
  if(!card||blocked||busyRef.current||!completedCards.length||!form.current?.reportValidity())return;
  if(incompleteCards){if(settings.current)settings.current.open=true;setMessage('有释义还没有对应的单词，请在「待收录」里补全。');return;}
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
    const latest=await read(),next=capturesIntoBatch(completedCards,current,latest);
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
   const savedIds=new Set(completedCards.map(item=>item.id));
   store({...draftRef.current,cards:draftRef.current.cards.map(c=>({...c,target:saved!.batch.id})),lastTarget:saved.batch.id});
   const result=await persistLearningWorkspace(epoch.current);
   if(!result.synced)throw Error(result.message||'已保存到本机，账号同步尚未完成。请重试收录。');
   const latest=draftRef.current,cards=latest.cards.filter(c=>!savedIds.has(c.id)&&!!(c.word.trim()||c.meaning.trim()));
   store({...latest,cards,active:cards.at(-1)?.id??'',lastTarget:saved.batch.id});
   onSaved(`已收录 ${completedCards.length} 条到「${saved.batch.source}」${result.destination==='account'?`，账号 ${account}`:'，已保存到这台设备'}。`);
   setMessage('');dismiss();
  }catch(e){setMessage(e instanceof Error?e.message:'收录未完成，草稿仍保留。');}
  finally{busyRef.current=false;setBusy(false);}
 }
 if(!open)return null;
 const destination=card?.target?batches.find(batch=>batch.id===card.target)?.source??'上次收集':card?.source.trim()||'新建收集';
 const panel=<div className={`communityModal quickCaptureOverlay${floating?' quickCaptureFloating':''}`}><section role="dialog" aria-labelledby="quick-capture-title" onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'&&!busy){e.preventDefault();dismiss();}if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){e.preventDefault();void save();}}}>
  <header>
   <div className="captureHeader">
    <h2 id="quick-capture-title">快速收词</h2>
    {pictureInPicture()&&<button className="captureFloat" type="button" disabled={busy} onClick={()=>floating?closeFloating():void floatCard()}>{floating?'移回 Inkling 页面':'浮到其他网页上 ↗'}</button>}
    <button className="captureClose" type="button" disabled={busy} aria-label="收起快速收词并保留草稿" onClick={dismiss}>×</button>
   </div>
   <p className="captureAccount">{account?`当前账号 · ${account}`:blocked?'请登录账号后收录':'当前为便笺模式 · 保存到这台设备'}{!account&&<button type="button" onClick={()=>{dismiss();onLogin();}}>登录</button>}</p>
  </header>
  <div className="captureBody">
  {card&&<form id="quick-capture-form" ref={form} onSubmit={e=>{e.preventDefault();void save();}}>
   <label>单词<input className="captureWord" ref={wordInput} maxLength={300} value={card.word} placeholder="输入或粘贴单词" onChange={e=>update({word:e.target.value})} disabled={busy}/></label>
   <div className="captureMeaning">
    <div className="captureMeaningLabel"><label htmlFor="quick-capture-meaning">释义</label>{card.word.trim()&&<a href={`https://dict.cn/${encodeURIComponent(card.word.trim())}`} target="_blank" rel="noopener noreferrer" onClick={()=>update({origin:[...new Set([card.origin,'海词词典'].filter(Boolean))].join('\n')})}>海词查词 ↗</a>}</div>
    <textarea id="quick-capture-meaning" ref={meaningInput} rows={2} maxLength={4000} value={card.meaning} placeholder="选填" onChange={e=>update({meaning:e.target.value})} disabled={busy}/>
   </div>
   <button type="button" className="captureNext" disabled={busy||!card.word.trim()} onClick={startNext}>下一个词</button>
   <details ref={settings} className="captureSettings">
    <summary>收录设置 <span title={destination}>{destination}</span></summary>
    {draft.cards.length>1&&<label>待收录<select value={draft.active} disabled={busy} onChange={e=>store({...draftRef.current,active:e.target.value})}>{draft.cards.map((c,i)=><option value={c.id} key={c.id}>{c.word||`待填写单词 ${i+1}`}</option>)}</select></label>}
    <label>本批收录到<select value={card.target} disabled={busy||blocked} onChange={e=>changeDestination({target:e.target.value,...(!e.target.value&&card.target?{collectionId:crypto.randomUUID()}:{})})}><option value="">＋ 新建收集</option>{card.target&&!batches.some(b=>b.id===card.target)&&<option value={card.target}>上次收集（暂无详情）</option>}{batches.map(b=><option value={b.id} key={b.id}>{b.date} · {b.source}（{b.count} 词）</option>)}</select></label>
    {!card.target&&<div className="captureNewCollection"><label>收集名称<input maxLength={300} value={card.source} placeholder={`${card.date} 随手收词`} onChange={e=>changeDestination({source:e.target.value})} disabled={busy||blocked}/></label><label>日期<input type="date" required value={card.date} onChange={e=>changeDestination({date:e.target.value})} onInvalid={()=>{if(settings.current)settings.current.open=true;}} disabled={busy||blocked}/></label></div>}
    <label>释义来源<input maxLength={1000} value={card.origin} onChange={e=>update({origin:e.target.value})} disabled={busy}/></label>
   </details>
  </form>}
  </div>
  {message&&<p className="captureMessage" role="status">{message}</p>}
  {message.includes('列表')&&<button type="button" onClick={()=>void loadBatches()}>重试读取收集</button>}
  {card&&<footer><span>{completedCards.length} 条待收录</span><button className="primary" disabled={busy||blocked||!completedCards.length} type="submit" form="quick-capture-form">{busy?'正在保存…':'完成并收录'}</button></footer>}
 </section></div>;
 return floating?createPortal(panel,floating.document.body):panel;
}
