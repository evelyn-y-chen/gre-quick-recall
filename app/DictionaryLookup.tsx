import {appFetch} from "../community/api";
"use client";
import { useEffect, useRef, useState } from "react";
import DictionaryLinks from "./DictionaryLinks";
import {applyDictionaryDefinition,dictionarySources,type DictionarySource} from './dictionaryDefinition';

type Entry = { phonetic: string; zh: string; en: string };
export function dictionaryBucket(word: string) { let h=0; for(const c of word) h=(h*31+c.charCodeAt(0))>>>0; return (h%256).toString(16).padStart(2,"0"); }
export default function DictionaryLookup({word, meaning, origin='', onApply}: {word:string;meaning:string;origin?:string;onApply:(text:string,origin:string)=>void}) {
 const [entry,setEntry]=useState<Entry|null>(null),[selected,setSelected]=useState<string[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const [source,setSource]=useState<DictionarySource>('merriam'),[pasted,setPasted]=useState(''),[reading,setReading]=useState(false);
 const identity=useRef({word,source});identity.current={word,source};const clipboardSequence=useRef(0);
 const sequence=useRef(0);
 useEffect(()=>{sequence.current++;clipboardSequence.current++;setEntry(null);setSelected([]);setBusy(false);setPasted('');setReading(false);setMessage("");},[word]);
 useEffect(()=>()=>{sequence.current++;clipboardSequence.current++;},[]);
 function selectSource(value:DictionarySource){clipboardSequence.current++;setSource(value);setPasted('');setReading(false);setMessage('');}
 async function pasteFromClipboard(){
  const current=++clipboardSequence.current,target={word,source};setReading(true);setMessage('');
  try{
   if(!navigator.clipboard?.readText)throw Error('manual');
   const text=await navigator.clipboard.readText();
   if(current!==clipboardSequence.current||identity.current.word!==target.word||identity.current.source!==target.source)return;
   if(text.length>4000){setMessage('复制的内容超过 4000 字，请只选择需要的释义后手动粘贴。');return;}
   setPasted(text);setMessage(text.trim()?'已读取，核对下方释义与来源，再选择追加或替换。':'剪贴板没有文字，可以在下方手动粘贴。');
  }catch{if(current===clipboardSequence.current&&identity.current.word===target.word&&identity.current.source===target.source)setMessage('浏览器没有提供剪贴板读取权限。请长按下方输入框粘贴，或使用键盘粘贴。');}
  finally{if(current===clipboardSequence.current)setReading(false);}
 }
 async function lookup(){
  const key=word.trim().toLowerCase();if(!key)return;
  const current=++sequence.current;setBusy(true);setEntry(null);setSelected([]);setMessage("");
  try{
   const response=await appFetch(`/dictionary-v1/${dictionaryBucket(key)}.json`,{signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw new Error("词典暂时无法读取，请重试。");
   const data=await response.json();const found=(Object.prototype.hasOwnProperty.call(data,key)?data[key]:undefined) as Entry|undefined;
   if(current!==sequence.current)return;
   if(!found){setMessage("词典未收录这个拼写，可尝试原形，或手动填写释义。");return;}
   setEntry(found);setMessage("勾选需要的中文和英文释义，再填入生词。");
  }catch{if(current===sequence.current)setMessage("查词未完成，请检查网络后重试；也可以继续手动填写。");}
  finally{if(current===sequence.current)setBusy(false);}
 }
 const options=entry ? [...entry.zh.split("\n").filter(Boolean).map(t=>({id:"zh:"+t,text:t,lang:"中文"})),...entry.en.split("\n").filter(Boolean).map(t=>({id:"en:"+t,text:t,lang:"English"}))] : [];
 function apply(text:string,provider:DictionarySource,append:boolean){try{const next=applyDictionaryDefinition(meaning,origin,text,provider,append);onApply(next.meaning,next.origin);setMessage('释义和来源已填入，记忆笔记保持原样。请保存本次收集。');}catch(e){setMessage(e instanceof Error?e.message:'填入未完成，原内容没有改变。');}}
 return <div className="dictionaryLookup"><DictionaryLinks word={word} onSelect={selectSource}/>
  <section className="dictionaryPaste" aria-label="复制词典释义后填入">
   <strong>复制释义 → 填入生词</strong><p>先选择来源，在上方词典页面复制需要的释义，再回到这里粘贴。不会自动抓取网页。</p>
   <div className="dictionaryActions" role="group" aria-label="粘贴释义的来源">{(['merriam','dictcn'] as const).map(value=><button type="button" key={value} aria-pressed={source===value} onClick={()=>selectSource(value)}>{value==='merriam'?'韦氏词典':'海词词典'}</button>)}</div>
   <button type="button" disabled={!word.trim()||reading} onClick={()=>void pasteFromClipboard()}>{reading?'正在读取…':'从剪贴板粘贴'}</button>
   <label>粘贴的释义<textarea rows={4} maxLength={4000} value={pasted} placeholder="也可以直接长按或使用键盘粘贴" onChange={e=>{clipboardSequence.current++;setReading(false);setPasted(e.target.value);}}/></label>
   <small>将记录来源：{dictionarySources[source]} · {pasted.length}/4000</small>
   <div className="dictionaryActions"><button type="button" disabled={!word.trim()||!pasted.trim()||reading} onClick={()=>apply(pasted,source,true)}>追加粘贴的释义</button><button type="button" disabled={!word.trim()||!pasted.trim()||reading} onClick={()=>apply(pasted,source,false)}>用粘贴内容替换释义</button></div>
   <small>追加会保留原释义与来源；替换只修改释义及其来源，不修改记忆笔记。填入后仍需保存收集。</small>
  </section>
  {message&&<p role="status">{message}</p>}
  <button type="button" disabled={!word.trim()||busy} onClick={lookup}>{busy?"查词中…":"查词典 · 中英双语"}</button>{entry&&<div className="dictionaryResults">{entry.phonetic&&<p>/{entry.phonetic}/</p>}{!entry.en&&<p>此词暂无英文释义，可选用中文释义。</p>}{!entry.zh&&<p>此词暂无中文释义，可选用英文释义。</p>}{options.map((o,i)=><label key={o.id+String(i)}><input type="checkbox" checked={selected.includes(o.id)} onChange={e=>setSelected(s=>e.target.checked?[...s,o.id]:s.filter(x=>x!==o.id))}/><span><small>{o.lang}</small>{o.text}</span></label>)}<div className="dictionaryActions"><button type="button" disabled={!selected.length} onClick={()=>apply(options.filter(x=>selected.includes(x.id)).map(x=>x.text).join('\n'),'ecdict',true)}>追加所选释义</button><button type="button" disabled={!selected.length} onClick={()=>apply(options.filter(x=>selected.includes(x.id)).map(x=>x.text).join('\n'),'ecdict',false)}>用所选替换释义</button></div><small>词典来源：<a href="https://github.com/skywind3000/ECDICT" target="_blank" rel="noreferrer">ECDICT</a> · <a href={import.meta.env.BASE_URL+"dictionary-v1/LICENSE.txt"} target="_blank" rel="noreferrer">授权说明</a></small></div>}</div>;
}
