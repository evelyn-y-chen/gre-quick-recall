import {appFetch} from "../community/api";
"use client";
import { useEffect, useRef, useState } from "react";

type Entry = { phonetic: string; zh: string; en: string };
export function dictionaryBucket(word: string) { let h=0; for(const c of word) h=(h*31+c.charCodeAt(0))>>>0; return (h%256).toString(16).padStart(2,"0"); }
export default function DictionaryLookup({word, meaning, onApply}: {word:string;meaning:string;onApply:(text:string)=>void}) {
 const [entry,setEntry]=useState<Entry|null>(null),[selected,setSelected]=useState<string[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const sequence=useRef(0);
 useEffect(()=>{sequence.current++;setEntry(null);setSelected([]);setBusy(false);setMessage("");},[word]);
 useEffect(()=>()=>{sequence.current++;},[]);
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
 function apply(append:boolean){const text=options.filter(x=>selected.includes(x.id)).map(x=>x.text).join("\n");const next=append&&meaning.trim()?meaning.trim()+"\n"+text:text;if(next.length>4000){setMessage("释义超过 4000 字，请减少勾选或编辑原释义。");return;}onApply(next);setMessage("释义已填入，可以继续修改。记得保存本次收集。");}
 return <div className="dictionaryLookup"><button type="button" disabled={!word.trim()||busy} onClick={lookup}>{busy?"查词中…":"查词典 · 中英双语"}</button>{message&&<p role="status">{message}</p>}{entry&&<div className="dictionaryResults">{entry.phonetic&&<p>/{entry.phonetic}/</p>}{!entry.en&&<p>此词暂无英文释义，可选用中文释义。</p>}{!entry.zh&&<p>此词暂无中文释义，可选用英文释义。</p>}{options.map((o,i)=><label key={o.id+String(i)}><input type="checkbox" checked={selected.includes(o.id)} onChange={e=>setSelected(s=>e.target.checked?[...s,o.id]:s.filter(x=>x!==o.id))}/><span><small>{o.lang}</small>{o.text}</span></label>)}<div className="dictionaryActions"><button type="button" disabled={!selected.length} onClick={()=>apply(true)}>追加所选释义</button><button type="button" disabled={!selected.length} onClick={()=>apply(false)}>用所选替换释义</button></div><small>词典来源：<a href="https://github.com/skywind3000/ECDICT" target="_blank" rel="noreferrer">ECDICT</a> · <a href={import.meta.env.BASE_URL+"dictionary-v1/LICENSE.txt"} target="_blank" rel="noreferrer">授权说明</a></small></div>}</div>;
}
