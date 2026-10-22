import {useEffect,useRef,useState} from 'react';
import type {Session} from '@supabase/supabase-js';
import {cloud,readCloudWorkspace,saveCloudWorkspace} from './cloud';
import {exportWorkspace,openWorkspace,onWorkspaceChange,type Snapshot} from './database';
import {readLocalWorkspace,saveLocalWorkspace} from './localWorkspace';
import {awaitWorkspaceApiIdle,getWorkspaceGeneration,switchWorkspace} from './api';
import {workspacePlan} from './workspacePlan';
import {mergeWorkspaceSnapshots,mergeImportedRatings} from './ratingMerge';
import {mergeImportedNotebook} from './notebookImport';
import {registerWorkspacePersistence,type WorkspacePersistenceResult} from './workspacePersistence';
import {checkpoint,appendCheckpoint,type RecoveryCheckpoint} from './workspaceRecovery';

type Active={key:string;localRevision:number;cloudRevision:number;session:Session|null;readable:boolean;base?:Snapshot;cloudPayload?:Snapshot;replaceCloud?:boolean};
type Expected={active:Active;key:string;generation:number};
export default function useLearningWorkspace(onRestore:()=>void){
 const [ready,setReady]=useState(false),[status,setStatus]=useState('正在读取学习记录…'),[generation,setGeneration]=useState(0),[session,setSession]=useState<Session|null>(null),[authReady,setAuthReady]=useState(!cloud),[emptyCloud,setEmptyCloud]=useState(false),[conflict,setConflict]=useState<Snapshot|null>(null);
 const [syncing,setSyncing]=useState(false);const manualSync=useRef<Promise<boolean>|null>(null),localQueue=useRef(Promise.resolve());
 const [undoPoint,setUndoPoint]=useState<{key:string;point:RecoveryCheckpoint}|null>(null);
 const active=useRef<Active|null>(null),dirty=useRef(false),version=useRef(0),localSavedVersion=useRef(0),localSavedKey=useRef<string|null>(null),lastFailure=useRef(''),alive=useRef(true),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),queue=useRef(Promise.resolve()),restore=useRef(onRestore),unregister=useRef<(()=>void)|null>(null);restore.current=onRestore;
 function serial<T>(task:()=>Promise<T>){const result=queue.current.then(task);queue.current=result.then(()=>{},()=>{});return result;}
 function localSerial<T>(task:()=>Promise<T>){const result=localQueue.current.then(task);localQueue.current=result.then(()=>{},()=>{});return result;}
 function message(value:string){if(alive.current)setStatus(value);}
 function assertExpected(expected?:Expected){if(expected&&(active.current!==expected.active||active.current?.key!==expected.key||getWorkspaceGeneration()!==expected.generation))throw Error('学习空间已切换，请在当前账号重新保存。');}
 function locallySaved(){const a=active.current;return !a||!dirty.current||localSavedKey.current===a.key&&localSavedVersion.current===version.current;}
 async function protectDevice(){
  const a=active.current,epoch=getWorkspaceGeneration();if(!a||!alive.current)return;
  await awaitWorkspaceApiIdle();if(active.current!==a||getWorkspaceGeneration()!==epoch||!alive.current)return;
  const payload=exportWorkspace(),change=version.current;
  await localSerial(async()=>{if(active.current!==a||getWorkspaceGeneration()!==epoch||!alive.current||localSavedKey.current===a.key&&localSavedVersion.current>=change)return;
   a.localRevision=await saveLocalWorkspace(payload,a.localRevision,a.key,a.session?{cloudRevision:a.cloudRevision,pending:true,basePayload:a.cloudPayload}:{});
   localSavedVersion.current=change;localSavedKey.current=a.key;
  });
 }
 function protectSoon(){void protectDevice().catch(e=>{lastFailure.current=e instanceof Error?e.message:'本机保存失败';message('本机保存尚未完成，请保持本页并导出便笺。'+lastFailure.current);});}
 function pausePersistence(){unregister.current?.();unregister.current=null;}
 function connectPersistence(){
  pausePersistence();const a=active.current;if(!a||!alive.current)return;
  const expected={active:a,key:a.key,generation:getWorkspaceGeneration()};
  unregister.current=registerWorkspacePersistence({key:a.key,generation:expected.generation,persist:()=>serial(async():Promise<WorkspacePersistenceResult>=>{
   assertExpected(expected);const synced=await flushStable(expected);assertExpected(expected);
   if(!locallySaved())throw Error(lastFailure.current||'本机保存尚未完成，请保持本页并重试，或先导出便笺。');
   return {destination:a.session?'account':'device',synced,...(!synced?{message:a.session?'已保存到本机，账号同步尚未完成。'+lastFailure.current:lastFailure.current}: {})};
  })});
 }
 async function flushNow(expected?:Expected){
  // A rating PUT may still be queued even though the UI has already changed.
  // Wait for its database write before capturing the snapshot and dirty version.
  assertExpected(expected);await awaitWorkspaceApiIdle();assertExpected(expected);
  const a=active.current;if(!a||!dirty.current)return true;const payload=exportWorkspace(),change=version.current;
  try{
   await localSerial(async()=>{if(localSavedKey.current===a.key&&localSavedVersion.current>change)return;a.localRevision=await saveLocalWorkspace(payload,a.localRevision,a.key,a.session?{cloudRevision:a.cloudRevision,pending:true,basePayload:a.cloudPayload}:{});localSavedVersion.current=change;localSavedKey.current=a.key;});
   let uploaded=a.session&&a.cloudPayload&&!a.replaceCloud?mergeWorkspaceSnapshots(a.base,payload,a.cloudPayload):payload;
   if(a.session){
    if(!a.readable)throw Error('请先读取账号云端记录，再重试同步。');
    let revision=a.cloudRevision;
    for(let attempt=0;;attempt++){
     try{revision=await saveCloudWorkspace(a.session,uploaded,revision);break;}catch(e){
      if(!(e&&typeof e==='object'&&'code' in e&&e.code==='WORKSPACE_CONFLICT')||attempt>=2||a.replaceCloud)throw e;
      const remote=await readCloudWorkspace(a.session);if(!remote)throw Error('账号记录已在其他设备清空，已保留本机副本，请核对后重试。');
      uploaded=mergeWorkspaceSnapshots(a.base,payload,remote.payload);revision=remote.revision;
     }
    }
    a.cloudRevision=revision;a.cloudPayload=uploaded;a.base=payload;a.replaceCloud=false;
    await localSerial(async()=>{if(version.current!==change||!alive.current)return;a.localRevision=await saveLocalWorkspace(uploaded,a.localRevision,a.key,{cloudRevision:a.cloudRevision,pending:false});});
    setEmptyCloud(false);
   }
   dirty.current=version.current!==change;lastFailure.current='';message(dirty.current?'新修改已保留，继续同步…':a.session?'已保存到账号，其他设备可继续':'已存到这台设备');
   return true;
  }catch(e){lastFailure.current=e instanceof Error?e.message:'保存失败，请导出便笺。';message(locallySaved()&&a.session?'已保存到本机，账号同步尚未完成。'+lastFailure.current:lastFailure.current);return false;}
 }
 async function flushStable(expected?:Expected){
  // A later edit during network IO must be saved too before a reload can replace
  // memory. A failed cloud upload is safe to leave pending only after local save.
  while(true){const before=version.current,synced=await flushNow(expected);assertExpected(expected);if(synced&&dirty.current)continue;if(locallySaved())return synced&&!dirty.current;if(version.current===before)return false;}
 }
 function flush(){clearTimeout(timer.current);return serial(()=>flushStable());}
 function changed(){dirty.current=true;version.current++;protectSoon();message(active.current?.session?'正在保存到本机与账号…':'正在保存到当前浏览器…');clearTimeout(timer.current);timer.current=setTimeout(()=>void flush(),800);}
 function syncNow(){
  if(manualSync.current)return manualSync.current;
  const expected=active.current;if(!expected)return Promise.resolve(false);
  setSyncing(true);message(expected.session?'正在同步并核对账号记录…':'正在保存到这台设备…');
  const task=serial(async()=>{
   if(active.current!==expected)throw Error('学习空间已切换，请在当前账号重试同步。');
   const synced=await flushStable();if(!synced)return false;
   if(expected.session){
    const remote=await readCloudWorkspace(expected.session);
    if(!remote){message('账号尚无云端记录；当前没有待上传的修改。');return true;}
    if(remote.revision!==expected.cloudRevision){message('本机已保存，账号还有其他设备的更新。请点「检查账号同步」核对并读取。');return true;}
    message('账号同步已确认 · '+new Date().toLocaleTimeString()+' · 版本 '+remote.revision+'（当前无待上传修改）');
   }else message('已保存到这台设备 · '+new Date().toLocaleTimeString());
   return true;
  }).catch(e=>{message((locallySaved()?'本机记录已保全；':'请保持本页并先导出便笺；')+'账号同步尚未确认。'+(e instanceof Error?e.message:'请检查网络后重试。'));return false;}).finally(()=>{manualSync.current=null;if(alive.current)setSyncing(false);});
  manualSync.current=task;return task;
 }
 async function activate(payload:Snapshot|undefined,next:Active,expectedActive:Active|null,expectedVersion:number){
  await switchWorkspace(async()=>{
   // Also check after the API queue drains: an already-running write can finish
   // between the previous save and this exclusive workspace replacement.
   if(!alive.current||active.current!==expectedActive||version.current!==expectedVersion)throw Error('保存期间记录又有更新，已保留当前内容，请重试读取。');
   onWorkspaceChange(()=>{});await openWorkspace(payload);
  });
  active.current=next;localSavedKey.current=next.key;localSavedVersion.current=version.current;
  restore.current();setGeneration(n=>n+1);onWorkspaceChange(changed);connectPersistence();setReady(true);
 }
 async function open(next:Session|null){return serial(async()=>{
  clearTimeout(timer.current);setReady(false);pausePersistence();const previous=active.current;
  try{
   await flushStable();
   if(!locallySaved())throw Error('当前记录尚未保存到本机，已保留本页内容。请重试保存或先导出便笺，再读取其他记录。');
   const stableVersion=version.current,key=next?'account:'+next.user.id:'local';
   const cache=await readLocalWorkspace(key);let nextUndo=appendCheckpoint(cache?.history).filter(item=>['合并红黄绿前','导入或替换记录前','读取账号进度前'].includes(item.reason)).at(-1);let payload=cache?.payload,localRevision=cache?.revision??0,cloudRevision=cache?.cloudRevision??0,readable=true,pending=!!cache?.pending,nextConflict:Snapshot|null=null,nextEmpty=false,cloudPayload:Snapshot|undefined=undefined,basePayload:Snapshot|undefined=cache?.basePayload,nextMessage=cache?'已存到这台设备':'无需登录，记录自动保存在当前浏览器。';
   if(next){
    let remote:Awaited<ReturnType<typeof readCloudWorkspace>>=null;
    try{remote=await readCloudWorkspace(next);}catch(e){readable=false;nextMessage=e instanceof Error?e.message:'账号读取失败，保留本机副本。';if(!cache)throw Error('账号云端读取失败，当前设备没有该账号的本机副本。已保留当前内容，请检查网络后重试。');}
    if(readable){
     cloudPayload=remote?.payload;basePayload=cache?.pending?cache.basePayload:cloudPayload;
     const plan=workspacePlan(cache,remote);
     // Saving the conflict is a prerequisite to replacing the sole account cache.
     // Any failure aborts the transition without activating the remote snapshot.
     if(plan.conflict){await localSerial(async()=>{const savedConflict=await readLocalWorkspace('conflict:'+next.user.id);await saveLocalWorkspace(plan.conflict!,savedConflict?.revision??0,'conflict:'+next.user.id,{pending:true});});}
     const preservedConflict=await readLocalWorkspace('conflict:'+next.user.id);nextConflict=plan.conflict??(preservedConflict?.pending?preservedConflict.payload:null);
     payload=plan.payload;cloudRevision=plan.cloudRevision;pending=plan.pending;
     if(payload){const before=cache&&JSON.stringify(cache.payload)!==JSON.stringify(payload)?checkpoint(cache.payload,'读取账号进度前'):undefined;const baseline=cache?.basePayload&&JSON.stringify(cache.basePayload)!==JSON.stringify(payload)&&JSON.stringify(cache.basePayload)!==JSON.stringify(cache.payload)?checkpoint(cache.basePayload,'读取账号进度前的同步基线'):undefined;localRevision=await localSerial(async()=>{if(version.current!==stableVersion)throw Error('保存期间记录又有更新，已保留当前内容，请重试读取。');return saveLocalWorkspace(payload!,localRevision,key,{cloudRevision,pending,...(pending?{basePayload:cloudPayload}:{}),...(baseline?{checkpoints:[baseline]}:{}),...(before?{checkpoint:before}:{})});});if(before)nextUndo=before;if(previous?.key===key)previous.localRevision=localRevision;}
     nextEmpty=!remote;nextMessage=plan.conflict?'本机与云端都有修改，已读取云端。本机未上传内容可另行导出或核对。':'已读取账号进度';
    }else{const preservedConflict=await readLocalWorkspace('conflict:'+next.user.id);nextConflict=preservedConflict?.pending?preservedConflict.payload:null;}
   }
   const candidate={key,session:next,localRevision,cloudRevision,readable,base:pending?basePayload??cloudPayload:payload,cloudPayload};
   await activate(payload,candidate,previous,stableVersion);setUndoPoint(nextUndo?{key,point:nextUndo}:null);dirty.current=pending;setConflict(nextConflict);setEmptyCloud(nextEmpty);message(nextMessage);
   if(pending)timer.current=setTimeout(()=>void flush(),800);
  }catch(e){message(e instanceof Error?e.message:'无法读取学习空间，请重试。');onWorkspaceChange(changed);if(previous){connectPersistence();setGeneration(n=>n+1);setReady(true);}else setReady(false);}
 });}
 useEffect(()=>{
  alive.current=true;if(!cloud){setAuthReady(true);return;}
  const {data:{subscription}}=cloud.auth.onAuthStateChange((_event,next)=>{setSession(next);setAuthReady(true);});
  void cloud.auth.getSession().then(({data,error})=>{if(alive.current){if(error)message('登录状态读取失败，暂以游客使用。');setSession(data.session);setAuthReady(true);}});
  return()=>{subscription.unsubscribe();};
 },[]);
 useEffect(()=>{if(!authReady)return;const same=active.current?.key===(session?'account:'+session.user.id:'local');if(same){if(active.current)active.current.session=session;return;}void open(session);},[authReady,session?.user.id]);
 useEffect(()=>{if(active.current&&active.current.session?.user.id===session?.user.id)active.current.session=session;},[session]);
 useEffect(()=>{const leaving=(e:BeforeUnloadEvent)=>{if(dirty.current){protectSoon();void flush();e.preventDefault();e.returnValue='';}};const hidden=()=>{if(document.visibilityState==='hidden'){protectSoon();void flush();}};window.addEventListener('beforeunload',leaving);document.addEventListener('visibilitychange',hidden);return()=>{alive.current=false;pausePersistence();clearTimeout(timer.current);onWorkspaceChange(()=>{});window.removeEventListener('beforeunload',leaving);document.removeEventListener('visibilitychange',hidden);};},[]);
 async function replace(source:Snapshot|(()=>Snapshot),options?:{merge?:boolean;expectedGeneration?:number}){return serial(async()=>{if(options?.expectedGeneration!==undefined&&options.expectedGeneration!==getWorkspaceGeneration())throw Error('学习空间已切换，请在当前账号重新选择便笺。');const a=active.current;if(!a)throw Error('学习空间未就绪');setReady(false);pausePersistence();try{await awaitWorkspaceApiIdle();if(options?.expectedGeneration!==undefined&&options.expectedGeneration!==getWorkspaceGeneration())throw Error('学习空间已切换，请重新选择便笺。');const payload=typeof source==='function'?source():source;const change=version.current;const before=checkpoint(exportWorkspace(),options?.merge?'合并红黄绿前':'导入或替换记录前');await localSerial(async()=>{if(version.current!==change)throw Error('记录又有更新，已保留当前内容，请重试导入。');a.localRevision=await saveLocalWorkspace(payload,a.localRevision,a.key,{...(a.session?{cloudRevision:a.cloudRevision,pending:true}:{}),checkpoint:before});});if(!options?.merge){a.base=payload;a.cloudPayload=undefined;a.replaceCloud=true;}await activate(payload,a,a,change);setUndoPoint({key:a.key,point:before});dirty.current=true;version.current++;const uploaded=await flushStable();if(uploaded&&a.session){const backup=await readLocalWorkspace('conflict:'+a.session.user.id);if(backup)await saveLocalWorkspace(backup.payload,backup.revision,'conflict:'+a.session.user.id,{pending:false});setConflict(null);}}finally{onWorkspaceChange(changed);connectPersistence();setReady(true);}});}
 async function undo(){const a=active.current,point=undoPoint;if(!a||!point||point.key!==a.key)throw Error('当前学习空间没有可撤销的导入或替换。');return replace(()=>{if(active.current!==a)throw Error('学习空间已切换，已取消恢复。');return point.point.payload;});}
 async function importGuest(){if(!session||!emptyCloud)return;const guest=await readLocalWorkspace();if(!guest){message('没有可带入的游客记录，可以直接开始学习。');return;}await replace(guest.payload);}
 async function signOut(){const saved=await flush();if(!locallySaved()){message('本机保存尚未完成，已保留当前账号和记录。请重试保存或先导出便笺，再退出账号。');return;}if(!saved&&!window.confirm('云端尚未同步，本机账号副本已保留。是否继续退出？'))return;await cloud?.auth.signOut({scope:'local'});}
 return {ready:ready&&active.current?.key===(session?'account:'+session.user.id:'local'),status,generation,session,emptyCloud,conflict,syncing,syncNow,undoAvailable:!!undoPoint&&undoPoint.key===active.current?.key,undo,flush,prepareLogin:async()=>{await flush();return locallySaved();},reload:()=>open(session),replace,mergeRatings:async(payload:Snapshot,expectedGeneration?:number)=>replace(()=>mergeImportedRatings(exportWorkspace(),payload),{merge:true,expectedGeneration}),mergeNotebook:async(payload:Snapshot,expectedGeneration:number)=>replace(()=>mergeImportedNotebook(exportWorkspace(),payload).payload,{merge:true,expectedGeneration}),importGuest,signOut,setStatus};
}
