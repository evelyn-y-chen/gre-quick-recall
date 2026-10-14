import {useEffect,useRef,useState} from 'react';
import type {Session} from '@supabase/supabase-js';
import {cloud,readCloudWorkspace,saveCloudWorkspace} from './cloud';
import {exportWorkspace,openWorkspace,onWorkspaceChange,type Snapshot} from './database';
import {readLocalWorkspace,saveLocalWorkspace} from './localWorkspace';
import {switchWorkspace} from './api';
import {workspacePlan} from './workspacePlan';

type Active={key:string;localRevision:number;cloudRevision:number;session:Session|null;readable:boolean};
export default function useLearningWorkspace(onRestore:()=>void){
 const [ready,setReady]=useState(false),[status,setStatus]=useState('正在读取学习记录…'),[generation,setGeneration]=useState(0),[session,setSession]=useState<Session|null>(null),[authReady,setAuthReady]=useState(!cloud),[emptyCloud,setEmptyCloud]=useState(false),[conflict,setConflict]=useState<Snapshot|null>(null);
 const active=useRef<Active|null>(null),dirty=useRef(false),version=useRef(0),localSavedVersion=useRef(0),alive=useRef(true),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),queue=useRef(Promise.resolve()),restore=useRef(onRestore);restore.current=onRestore;
 function serial<T>(task:()=>Promise<T>){const result=queue.current.then(task);queue.current=result.then(()=>{},()=>{});return result;}
 function message(value:string){if(alive.current)setStatus(value);}
 async function flushNow(){
  const a=active.current;if(!a||!dirty.current)return true;const payload=exportWorkspace(),change=version.current;
  try{
   a.localRevision=await saveLocalWorkspace(payload,a.localRevision,a.key,a.session?{cloudRevision:a.cloudRevision,pending:true}:{});localSavedVersion.current=change;
   if(a.session){
    if(!a.readable)throw Error('已保存到本机；请先读取账号云端记录，再同步。');
    a.cloudRevision=await saveCloudWorkspace(a.session,payload,a.cloudRevision);
    a.localRevision=await saveLocalWorkspace(payload,a.localRevision,a.key,{cloudRevision:a.cloudRevision,pending:false});
    setEmptyCloud(false);
   }
   dirty.current=version.current!==change;message(a.session?'已保存到账号，其他设备可继续':'已存到这台设备');
   if(dirty.current)timer.current=setTimeout(()=>void flush(),300);return true;
  }catch(e){message(e instanceof Error?e.message:'保存失败，请导出便笺。');return false;}
 }
 function flush(){clearTimeout(timer.current);return serial(flushNow);}
 function changed(){dirty.current=true;version.current++;message(active.current?.session?'正在保存到本机与账号…':'正在保存到当前浏览器…');clearTimeout(timer.current);timer.current=setTimeout(()=>void flush(),800);}
 async function activate(payload?:Snapshot){onWorkspaceChange(()=>{});await switchWorkspace(()=>openWorkspace(payload));restore.current();setGeneration(n=>n+1);onWorkspaceChange(changed);setReady(true);}
 async function open(next:Session|null){return serial(async()=>{
  await flushNow();setReady(false);onWorkspaceChange(()=>{});setConflict(null);setEmptyCloud(false);
  const key=next?'account:'+next.user.id:'local';
  try{
   const cache=await readLocalWorkspace(key);let payload=cache?.payload,localRevision=cache?.revision??0,cloudRevision=cache?.cloudRevision??0,readable=true,pending=!!cache?.pending;
   if(next){
    try{const remote=await readCloudWorkspace(next),plan=workspacePlan(cache,remote);payload=plan.payload;cloudRevision=plan.cloudRevision;pending=plan.pending;if(plan.conflict){const savedConflict=await readLocalWorkspace('conflict:'+next.user.id);await saveLocalWorkspace(plan.conflict,savedConflict?.revision??0,'conflict:'+next.user.id,{pending:true});}
    const preservedConflict=await readLocalWorkspace('conflict:'+next.user.id);setConflict(plan.conflict??(preservedConflict?.pending?preservedConflict.payload:null));if(payload)localRevision=await saveLocalWorkspace(payload,localRevision,key,{cloudRevision,pending});setEmptyCloud(!remote);message(plan.conflict?'本机与云端都有修改，已读取云端。本机未上传内容可另行导出或核对。':'已读取账号进度');}
    catch(e){readable=false;message(e instanceof Error?e.message:'账号读取失败，保留本机副本。');}
   }else message(cache?'已存到这台设备':'无需登录，记录自动保存在当前浏览器。');
   active.current={key,session:next,localRevision,cloudRevision,readable};dirty.current=pending;await activate(payload);
   if(pending)timer.current=setTimeout(()=>void flush(),800);
  }catch(e){message(e instanceof Error?e.message:'无法读取学习空间，请重试。');onWorkspaceChange(changed);setReady(false);}
 });}
 useEffect(()=>{
  alive.current=true;if(!cloud){setAuthReady(true);return;}
  const {data:{subscription}}=cloud.auth.onAuthStateChange((_event,next)=>{setSession(next);setAuthReady(true);});
  void cloud.auth.getSession().then(({data,error})=>{if(alive.current){if(error)message('登录状态读取失败，暂以游客使用。');setSession(data.session);setAuthReady(true);}});
  return()=>{subscription.unsubscribe();};
 },[]);
 useEffect(()=>{if(!authReady)return;const same=active.current?.key===(session?'account:'+session.user.id:'local');if(same){if(active.current)active.current.session=session;return;}void open(session);},[authReady,session?.user.id]);
 useEffect(()=>{if(active.current&&active.current.session?.user.id===session?.user.id)active.current.session=session;},[session]);
 useEffect(()=>{const leaving=(e:BeforeUnloadEvent)=>{if(dirty.current){void flush();e.preventDefault();e.returnValue='';}};const hidden=()=>{if(document.visibilityState==='hidden')void flush();};window.addEventListener('beforeunload',leaving);document.addEventListener('visibilitychange',hidden);return()=>{alive.current=false;clearTimeout(timer.current);onWorkspaceChange(()=>{});window.removeEventListener('beforeunload',leaving);document.removeEventListener('visibilitychange',hidden);};},[]);
 async function replace(payload:Snapshot){return serial(async()=>{const a=active.current;if(!a)throw Error('学习空间未就绪');setReady(false);try{a.localRevision=await saveLocalWorkspace(payload,a.localRevision,a.key,a.session?{cloudRevision:a.cloudRevision,pending:true}:{});await activate(payload);dirty.current=true;version.current++;const uploaded=await flushNow();if(uploaded&&a.session){const backup=await readLocalWorkspace('conflict:'+a.session.user.id);if(backup)await saveLocalWorkspace(backup.payload,backup.revision,'conflict:'+a.session.user.id,{pending:false});setConflict(null);}}finally{setReady(true);}});}
 async function importGuest(){if(!session||!emptyCloud)return;const guest=await readLocalWorkspace();if(!guest){message('没有可带入的游客记录，可以直接开始学习。');return;}await replace(guest.payload);}
 async function signOut(){const saved=await flush();if(!saved&&!window.confirm('云端尚未保存。退出后本机账号副本仍保留，是否继续？'))return;await cloud?.auth.signOut({scope:'local'});}
 return {ready:ready&&active.current?.key===(session?'account:'+session.user.id:'local'),status,generation,session,emptyCloud,conflict,flush,prepareLogin:async()=>{await flush();return !dirty.current||localSavedVersion.current===version.current;},reload:()=>open(session),replace,importGuest,signOut,setStatus};
}
