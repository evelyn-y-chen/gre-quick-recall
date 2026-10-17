import {studyStorage} from "../community/storage";
import {readSavedRatings,writeSavedRatings} from "./ratingStorage";
"use client";
import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from "react";
import RatingCloudSync from "./RatingCloudSync";
import {type Ratings} from "./ratingSyncModel";
const key="gre-a-plus-word-marks-v1";
const Context=createContext<{ratings:Ratings;toggle:(word:string)=>void}|null>(null);
const normalize=(word:string)=>word.trim().toLowerCase();
export function APlusWordMarksProvider({children}:{children:ReactNode}){
 const [ratings,setRatings]=useState<Ratings>({}),[ready,setReady]=useState(false);
 useEffect(()=>{const stored=readSavedRatings(studyStorage,key);if(stored)setRatings(stored);setReady(true);},[]);
 useEffect(()=>{if(ready)try{writeSavedRatings(studyStorage,key,ratings);}catch{}},[ratings,ready]);
 function toggle(word:string){const w=normalize(word);setRatings(r=>({...r,[w]:r[w]==="unknown"?"familiar":"unknown"}));}
 return <Context.Provider value={{ratings,toggle}}><p className="aPlusMarkHint"><strong>操作提示</strong>　<strong>单击</strong>单词朗读 · 点击 <strong>▸ 笔记</strong>展开 · <strong>双击</strong>标亮“不熟悉” · <strong>再次双击</strong>取消 · <strong>Shift + Enter</strong>切换高亮。</p>{ready&&<RatingCloudSync module="a-plus-words" ratings={ratings} onLoad={setRatings} label="单词标亮自动保存"/>}{children}</Context.Provider>;
}
export function APlusWordMark({word,pronounce,onRead}:{word:string;pronounce:(word:string)=>void;onRead?:()=>void}){
 const ctx=useContext(Context),marked=ctx?.ratings[normalize(word)]==="unknown";
 const pending=useRef<ReturnType<typeof setTimeout>|null>(null);
 function cancel(){if(pending.current!==null){clearTimeout(pending.current);pending.current=null;}}
 useEffect(()=>()=>cancel(),[word]);
 return <button type="button" className={`aPlusWordChip${marked?" unfamiliar":""}`} aria-pressed={marked} aria-label={`${word}，单击朗读，双击${marked?"取消高亮":"标亮不熟悉"}`} title={`单击朗读 · 双击${marked?"取消高亮":"标亮不熟悉"} · Shift + Enter 切换高亮`}
  onClick={e=>{
   e.stopPropagation();
   if(e.detail===0){cancel();pronounce(word);onRead?.();return;}
   if(e.detail>2){cancel();return;}
   if(pending.current!==null||e.detail===2){cancel();ctx?.toggle(word);return;}
   pending.current=setTimeout(()=>{pending.current=null;pronounce(word);onRead?.();},320);
  }}
  onDoubleClick={e=>{e.preventDefault();e.stopPropagation();cancel();}}
  onKeyDown={e=>{e.stopPropagation();if(e.key==="Enter"&&e.shiftKey){e.preventDefault();if(!e.repeat){cancel();ctx?.toggle(word);}}}}
 >{word}{marked&&<span aria-label="不熟悉"> ●</span>}</button>;
}
