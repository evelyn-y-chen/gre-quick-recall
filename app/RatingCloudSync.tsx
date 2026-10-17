"use client";
import {useEffect,useRef,useState} from "react";
import {studyStorage} from "../community/storage";
import {appFetch,getWorkspaceGeneration} from "../community/api";
import {persistLearningWorkspace} from "../community/workspacePersistence";
import {stampRatingChanges} from "../community/ratingMerge";
import {writeSavedRatings} from "./ratingStorage";
import {validRatings,reconcileRatings,type Ratings} from "./ratingSyncModel";

type Ticket={generation:number;lifecycle:number};
export default function RatingCloudSync({module,ratings,onLoad,label="红黄绿自动保存"}:{module:string;ratings:Ratings;onLoad:(ratings:Ratings)=>void;label?:string}) {
 const key=`gre-rating-cloud-pending:${module}`;
 const latest=useRef(ratings);latest.current=ratings;
 const workspaceGeneration=useRef(getWorkspaceGeneration());
 const baseline=useRef(ratings),pending=useRef<Ratings>({}),initialized=useRef(false),mounted=useRef(false),loaded=useRef(false);
 const lifecycle=useRef(0),readSequence=useRef(0),saveSequence=useRef(0),inFlight=useRef<number|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const [reading,setReading]=useState(true),[saving,setSaving]=useState(false),[retry,setRetry]=useState(false),[count,setCount]=useState(0),[status,setStatus]=useState("正在读取红黄绿记录…");
 function ticket():Ticket{return {generation:workspaceGeneration.current,lifecycle:lifecycle.current};}
 function current(value:Ticket){return mounted.current&&value.lifecycle===lifecycle.current&&value.generation===getWorkspaceGeneration();}
 function keepDraft(){setCount(Object.keys(pending.current).length);writeSavedRatings(studyStorage,key,pending.current);}
 function captureChanges(){
  const changes:Ratings={};
  for(const [id,value] of Object.entries(latest.current))if(baseline.current[id]!==value){pending.current[id]=value;changes[id]=value;}
  stampRatingChanges(studyStorage,module,changes);
  baseline.current=latest.current;
  return Object.keys(changes).length>0;
 }
 function scheduleSave(){
  if(!mounted.current||!loaded.current||inFlight.current!==null||!Object.keys(pending.current).length)return;
  if(timer.current!==null)clearTimeout(timer.current);
  const requested=ticket();
  if(!current(requested))return;
  timer.current=setTimeout(()=>{timer.current=null;if(current(requested))void save();},200);
 }
 async function load(){
  const requested=ticket(),sequence=++readSequence.current;
  if(!current(requested))return;
  setReading(true);setRetry(false);
  try{
   const response=await appFetch(`/api/quick-ratings?module=${encodeURIComponent(module)}`,{cache:"no-store"});if(!response.ok)throw Error("读取失败");
   const data=await response.json();if(!validRatings(data.ratings))throw Error("记录格式无效");
   if(!current(requested)||sequence!==readSequence.current)return;
   captureChanges();
   const merged=reconcileRatings(latest.current,data.ratings,pending.current);
   pending.current=merged.pending;baseline.current=merged.ratings;onLoad(merged.ratings);keepDraft();loaded.current=true;
   setStatus(Object.keys(merged.pending).length?"正在自动保存红黄绿…":"标记后自动保存，登录后同步到账号。");
   scheduleSave();
  }catch{if(current(requested)&&sequence===readSequence.current){setRetry(true);setStatus("暂时无法读取记录，已有标记仍保留，请重试。");}}
  finally{if(current(requested)&&sequence===readSequence.current)setReading(false);}
 }
 async function save(){
  if(!loaded.current||inFlight.current!==null)return;
  if(!current(ticket()))return;
  captureChanges();
  const snapshot={...pending.current};if(!Object.keys(snapshot).length)return;
  const requested=ticket(),sequence=++saveSequence.current;inFlight.current=sequence;
  if(timer.current!==null){clearTimeout(timer.current);timer.current=null;}
  setSaving(true);setRetry(false);setStatus("正在自动保存红黄绿…");
  let completed=false;
  try{
   const response=await appFetch("/api/quick-ratings",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({module,ratings:snapshot})});
   if(!response.ok)throw Error("保存失败");
   if(!current(requested))return;
   // The local API updates in-memory SQL. The bridge confirms durable storage.
   const result=await persistLearningWorkspace(requested.generation);
   if(!current(requested))return;
   if(!result.synced){setRetry(true);setStatus(result.message??(result.destination==="account"?"已保存到本机，账号同步待重试。":"本机保存尚未完成，请重试。"));return;}
   captureChanges();
   for(const [id,value] of Object.entries(snapshot))if(pending.current[id]===value)delete pending.current[id];
   keepDraft();completed=true;
   setStatus(Object.keys(pending.current).length
    ?result.destination==="account"?"正在继续同步最新标记…":"正在继续保存最新标记…"
    :result.destination==="account"?"红黄绿已同步到账号。":"红黄绿已保存到这台设备。");
  }catch{if(current(requested)){setRetry(true);setStatus("保存尚未完成，标记仍保留，请重试。");}}
  finally{
   if(inFlight.current===sequence)inFlight.current=null;
   if(current(requested)){
    setSaving(false);
    // A newer batch is retried automatically; an unchanged failed batch waits
    // for the explicit retry button instead of looping on a failed connection.
    const newer=Object.entries(pending.current).some(([id,value])=>snapshot[id]!==value);
    if(completed||newer)scheduleSave();
   }
  }
 }
 useEffect(()=>{
  mounted.current=true;lifecycle.current++;workspaceGeneration.current=getWorkspaceGeneration();loaded.current=false;inFlight.current=null;initialized.current=true;
  try{const saved=JSON.parse(studyStorage.getItem(key)??"{}");pending.current=validRatings(saved)?saved:{};}catch{pending.current={};}
  keepDraft();void load();
  return()=>{mounted.current=false;lifecycle.current++;if(timer.current!==null){clearTimeout(timer.current);timer.current=null;}};
 },[]);
 useEffect(()=>{
  if(!initialized.current||!current(ticket()))return;
  if(captureChanges()){
   keepDraft();
   setStatus(loaded.current?"正在自动保存红黄绿…":"标记已暂存，读取成功后将自动同步；读取失败时请重试读取。");
   scheduleSave();
  }
 },[ratings]);
 return <div className="ratingCloudSync" aria-busy={reading||saving}>
  <span className="ratingAutoSaveLabel">{label}{count?`（${count}）`:""}</span>
  <span role="status">{status}</span>
  {retry&&<button type="button" disabled={reading||saving} onClick={()=>void(loaded.current?save():load())}>重试{loaded.current?"同步":"读取"}</button>}
  {module==="lclj"&&<small>包括填空3000、阅读300和数学索引</small>}
 </div>;
}
