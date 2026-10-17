import {studyStorage} from "../community/storage";
import {appFetch} from "../community/api";
"use client";
import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from "react";
import {wordMemoryKey,mergeMemoryTexts,compactMemoryText,type WordMemory} from "./wordMemoryModel";
const DRAFT="gre-shared-word-memory-drafts-v1";
type Draft={text:string;revision:number};
type Store={records:Record<string,WordMemory>;drafts:Record<string,Draft>;conflicts:Record<string,Draft>;loading:boolean;ready:boolean;busy:boolean;status:string;edit:(word:string,text:string)=>void;save:()=>Promise<boolean>;ack:(word:string)=>void;refresh:()=>void};
const Context=createContext<Store|null>(null);
export function useWordMemory(){return useContext(Context);}
export function SharedWordMemoryProvider({children}:{children:ReactNode}){
 const [records,setRecords]=useState<Record<string,WordMemory>>({}),[drafts,setDrafts]=useState<Record<string,Draft>>({}),[conflicts,setConflicts]=useState<Record<string,Draft>>({});
 const [loaded,setLoaded]=useState(false),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[status,setStatus]=useState("");
 const draftRef=useRef<Record<string,Draft>>({}),busyRef=useRef(false),ready=useRef(false),active=useRef(true),requestId=useRef(0);
 function persist(next:Record<string,Draft>){draftRef.current=next;setDrafts({...next});try{studyStorage.setItem(DRAFT,JSON.stringify(next));}catch{setStatus("本机草稿保存失败，请尽快保存到当前工作区。");}}
 async function refresh(){if(busyRef.current)return;const id=++requestId.current;try{
  const response=await appFetch("/api/word-memory",{cache:"no-store"});if(!response.ok)throw Error();const data=await response.json();if(!active.current||id!==requestId.current)return;
  setRecords(data.memories);ready.current=true;setLoaded(true);setStatus("记忆方法按单词共享，保存后同步到所有模块。");
 }catch{if(active.current)setStatus("共享记忆读取失败，请点击重试。已有草稿保留。");}finally{if(active.current)setLoading(false);}}
 useEffect(()=>{active.current=true;try{const saved=JSON.parse(studyStorage.getItem(DRAFT)??"{}");const valid=Object.fromEntries(Object.entries(saved).filter(([k,v]:[string,any])=>k&&typeof v?.text==="string"&&Number.isInteger(v.revision)&&v.revision>=0));persist(valid as Record<string,Draft>);}catch{}void refresh();
 const visible=()=>{if(document.visibilityState==="visible"&&!busyRef.current)void refresh();};window.addEventListener("glee-memory-saved",visible);window.addEventListener("word-memory-source-saved",visible);window.addEventListener("focus",visible);document.addEventListener("visibilitychange",visible);
 return()=>{active.current=false;window.removeEventListener("glee-memory-saved",visible);window.removeEventListener("word-memory-source-saved",visible);window.removeEventListener("focus",visible);document.removeEventListener("visibilitychange",visible);};},[]);
 // Import local legacy notes once; retain their original records as backup.
 useEffect(()=>{if(loading||!ready.current)return;try{
 const next={...draftRef.current};let changed=false;
 function migrate(id:string,rawWord:string,text:string){const word=wordMemoryKey(rawWord);if(!word||!text)return;const marker="gre-memory-imported:"+id;if(studyStorage.getItem(marker)===text)return;
 if(!next[word]){next[word]={text:mergeMemoryTexts([records[word]?.text??"",text]),revision:records[word]?.revision??0};changed=true;}
 else if(next[word]){next[word]={...next[word],text:mergeMemoryTexts([next[word].text,text])};changed=true;}
 studyStorage.setItem(marker,text);}
 const keys=Array.from({length:studyStorage.length},(_,i)=>studyStorage.key(i));for(const key of keys){if(key?.startsWith("gre-a-plus-note-draft:"))migrate(key,key.slice("gre-a-plus-note-draft:".length),studyStorage.getItem(key)??"");}
 const words=JSON.parse(studyStorage.getItem("gre-quanneng-vocab-v1-words")??"[]");for(const w of words)migrate(`quanneng:${w.id}`,w.word,w.note??"");
 if(changed)persist(next);
 }catch{}},[loading,records]);
 function edit(word:string,text:string){const key=wordMemoryKey(word);if(!key||!ready.current)return;persist({...draftRef.current,[key]:{text,revision:draftRef.current[key]?.revision??records[key]?.revision??0}});}
 async function save(){if(busyRef.current||!ready.current)return false;requestId.current++;busyRef.current=true;setBusy(true);const snapshot={...draftRef.current};let saved=0;try{
  for(const [word,draft] of Object.entries(snapshot)){
   const response=await appFetch("/api/word-memory",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({word,...draft})});const data=await response.json();
   if(!response.ok){if(response.status===409&&data.current)setConflicts(c=>({...c,[word]:data.current}));throw Error(`${word}：${data.error??"保存失败"}`);}
   setRecords(r=>({...r,[word]:{...data,sources:r[word]?.sources??[]}}));setConflicts(c=>{const next={...c};delete next[word];return next;});
   const next={...draftRef.current};if(next[word]?.text===draft.text)delete next[word];else if(next[word])next[word]={...next[word],revision:data.revision};persist(next);saved++;
  }setStatus(`已保存 ${saved} 个单词的记忆方法，所有模块共用同一份。`);return true;
 }catch(error){setStatus(`${saved?`已保存 ${saved} 个词；`:""}${error instanceof Error?error.message:"保存失败"} 未保存草稿仍保留。`);return false;}finally{busyRef.current=false;setBusy(false);}}
 function ack(word:string){const key=wordMemoryKey(word),cloud=conflicts[key],draft=draftRef.current[key];if(cloud&&draft){persist({...draftRef.current,[key]:{...draft,revision:cloud.revision}});setConflicts(c=>{const next={...c};delete next[key];return next;});}}
 return <Context.Provider value={{records,drafts,conflicts,loading,ready:loaded,busy,status,edit,save,ack,refresh}}>{children}{Object.keys(drafts).length>0&&<div className="sharedMemorySaveBar" onKeyDown={e=>e.stopPropagation()}><span>{Object.keys(drafts).length} 个单词的记忆方法待保存</span><button type="button" disabled={loading||busy||!ready.current} onClick={save}>{busy?"保存中…":"保存全部记忆方法到当前工作区"}</button><small role="status">{status}</small></div>}</Context.Provider>;
}
export default function SharedWordMemory({word,revealed=true,editing=false,hideWord=true}:{word:string;revealed?:boolean;editing?:boolean;hideWord?:boolean}){
 const store=useWordMemory(),[open,setOpen]=useState(editing);useEffect(()=>{setOpen(editing);},[editing]);if(!store||!revealed)return null;
 const key=wordMemoryKey(word);if(!key)return null;const record=store.records[key],draft=store.drafts[key],text=draft?.text??compactMemoryText(record?.text??""),conflict=store.conflicts[key];
 return <section className={`sharedWordMemory ${open ? "is-editing" : ""}`} aria-label={`${word} 的记忆方法`} onKeyDown={e=>e.stopPropagation()}>
  <header>{!hideWord?<strong className="sharedMemoryWord">{word}</strong>:<span className="memoryLabel"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 14V2m0 0h9l-2 3 2 3H3"/></svg>笔记</span>}<button type="button" aria-expanded={open} disabled={!store.ready} onClick={()=>setOpen(!open)}>{open?"收起编辑":"编辑"}</button></header>
  {open?<><textarea aria-label={`${word} 的记忆方法`} placeholder="写下你的笔记…" rows={6} maxLength={40000} disabled={!store.ready||store.busy} value={text} onChange={e=>store.edit(word,e.target.value)}/><button type="button" disabled={!store.ready||store.busy||!Object.keys(store.drafts).length} onClick={store.save}>保存全部笔记</button></>:<p>{text||(store.loading?"读取中…":"点击编辑添加笔记")}</p>}
  {record?.sources.length?<details className="memorySources"><summary>来源 · {record.sources.length} 处</summary><small>{record.sources.join(" / ")}</small></details>:null}
  {conflict&&<div className="sharedMemoryConflict"><p>工作区新内容：{conflict.text||"（空）"}</p><button type="button" onClick={()=>store.ack(word)}>已核对，保留当前编辑后重试保存</button></div>}
  {!store.loading&&<small className="sharedMemoryStatus" role="status">{draft||conflict?store.status:""}</small>}
  {!store.loading&&store.status.includes("读取失败")&&<button type="button" onClick={store.refresh}>重新读取记忆方法</button>}
 </section>;
}
