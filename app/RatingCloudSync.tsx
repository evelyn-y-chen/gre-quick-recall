import {studyStorage} from "../community/storage";
import {appFetch} from "../community/api";
"use client";
import {useEffect,useRef,useState} from "react";
import {validRatings,reconcileRatings,type Ratings} from "./ratingSyncModel";
export default function RatingCloudSync({module,ratings,onLoad,label="保存红黄绿到当前工作区"}:{module:string;ratings:Ratings;onLoad:(ratings:Ratings)=>void;label?:string}) {
 const key=`gre-rating-cloud-pending:${module}`;
 const latest=useRef(ratings);latest.current=ratings;
 const baseline=useRef(ratings),pending=useRef<Ratings>({}),initialized=useRef(false),mounted=useRef(true);
 const [loaded,setLoaded]=useState(false),[reading,setReading]=useState(false),[saving,setSaving]=useState(false),[count,setCount]=useState(0),[status,setStatus]=useState("正在读取工作区标记记录…");
 function keepDraft(){setCount(Object.keys(pending.current).length);try{studyStorage.setItem(key,JSON.stringify(pending.current));}catch{setStatus("本机无法保留草稿，请及时保存到当前工作区。");}}
 async function load(){
  setReading(true);
  try{
   const response=await appFetch(`/api/quick-ratings?module=${encodeURIComponent(module)}`,{cache:"no-store"});if(!response.ok)throw Error();
   const data=await response.json();if(!validRatings(data.ratings))throw Error();if(!mounted.current)return;
   const merged=reconcileRatings(latest.current,data.ratings,pending.current);
   pending.current=merged.pending;baseline.current=merged.ratings;onLoad(merged.ratings);keepDraft();setLoaded(true);
   setStatus(Object.keys(merged.pending).length?"本机有未上传的标记，点击保存即可同步。":"已读取工作区记录，新的标记可保存到当前工作区。");
  }catch{if(mounted.current)setStatus("工作区读取失败，本机标记仍保留，请重试读取。");}
  finally{if(mounted.current)setReading(false);}
 }
 useEffect(()=>{
  mounted.current=true;
  try{const saved=JSON.parse(studyStorage.getItem(key)??"{}");if(validRatings(saved))pending.current=saved;}catch{}
  initialized.current=true;keepDraft();void load();return()=>{mounted.current=false;};
 },[]);
 useEffect(()=>{
  if(!initialized.current)return;
  let changed=false;
  for(const [id,value] of Object.entries(ratings))if(baseline.current[id]!==value){pending.current[id]=value;changed=true;}
  baseline.current=ratings;
  if(changed){keepDraft();setStatus("有新的标记，记得保存到当前工作区。");}
 },[ratings]);
 async function save(){
  if(!loaded)return;const snapshot={...pending.current};if(!Object.keys(snapshot).length)return;
  setSaving(true);setStatus("正在上传标记记录…");
  try{
   const response=await appFetch("/api/quick-ratings",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({module,ratings:snapshot})});if(!response.ok)throw Error();
   if(!mounted.current)return;
   for(const [id,value] of Object.entries(snapshot))if(pending.current[id]===value)delete pending.current[id];
   // Clear only the exact uploaded values; newer edits remain pending.
   try{studyStorage.setItem(key,JSON.stringify(pending.current));}catch{}
   if(mounted.current){setCount(Object.keys(pending.current).length);setStatus("标记记录已保存到当前工作区。");}
  }catch{if(mounted.current)setStatus("上传失败，标记仍保留，请重试。");}
  finally{if(mounted.current)setSaving(false);}
 }
 return <div className="ratingCloudSync"><button type="button" className="solid" disabled={!loaded||saving||!count} onClick={save}>{saving?"上传中…":`${label}${count?`（${count}）`:""}`}</button>{!loaded&&!reading&&<button type="button" onClick={load}>重试读取</button>}<span role="status">{status}</span>{module==="lclj"&&<small>包括填空3000、阅读300和数学索引</small>}</div>;
}
