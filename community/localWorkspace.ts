import {validSnapshot,type Snapshot} from './database';
import {appendCheckpoint,checkpoint as makeCheckpoint,recoveryIntervalMs,snapshotContent,type RecoveryCheckpoint} from './workspaceRecovery';
const databaseName='gre-personal-workspace-v1';
export type LocalWorkspaceMetadata={cloudRevision?:number;pending?:boolean;basePayload?:Snapshot;checkpoint?:RecoveryCheckpoint;checkpoints?:RecoveryCheckpoint[]};
export type SavedWorkspace={revision:number;payload:Snapshot;cloudRevision?:number;pending?:boolean;basePayload?:Snapshot;history?:RecoveryCheckpoint[]};
function connect():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const request=indexedDB.open(databaseName,1);request.onupgradeneeded=()=>request.result.createObjectStore('workspaces');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
export async function readLocalWorkspace(key="local"):Promise<SavedWorkspace|undefined>{
 const db=await connect();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('workspaces','readonly'),request=tx.objectStore('workspaces').get(key);request.onsuccess=()=>{const value=request.result;if(value&&(!validSnapshot(value.payload)||!Number.isInteger(value.revision)))reject(Error('浏览器记录损坏，请先导出备份再处理。'));else resolve(value);};request.onerror=()=>reject(request.error);});}finally{db.close();}
}
export async function saveLocalWorkspace(payload:Snapshot,expectedRevision:number,key="local",metadata:LocalWorkspaceMetadata={}):Promise<number>{
 if(!validSnapshot(payload))throw Error('备份格式不正确');
 const db=await connect();try{return await new Promise((resolve,reject)=>{
 const tx=db.transaction('workspaces','readwrite'),store=tx.objectStore('workspaces'),request=store.get(key);let conflict=false,savedRevision=expectedRevision+1;
 request.onsuccess=()=>{if((request.result?.revision??0)!==expectedRevision){conflict=true;tx.abort();return;}try{
  const {checkpoint,checkpoints,...savedMetadata}=metadata,previous:SavedWorkspace|undefined=request.result;
  const sameBase=previous?.basePayload===undefined&&savedMetadata.basePayload===undefined||!!previous?.basePayload&&!!savedMetadata.basePayload&&snapshotContent(previous.basePayload)===snapshotContent(savedMetadata.basePayload);
  if(previous&&snapshotContent(previous.payload)===snapshotContent(payload)&&previous.cloudRevision===savedMetadata.cloudRevision&&previous.pending===savedMetadata.pending&&sameBase&&!checkpoint&&!checkpoints?.length){savedRevision=expectedRevision;return;}
  let history=appendCheckpoint(previous?.history);
  const changed=previous&&snapshotContent(previous.payload)!==snapshotContent(payload);
  const last=history.at(-1),timeForCopy=!last||Date.now()-Date.parse(last.createdAt)>=recoveryIntervalMs;
  if(changed&&(key.startsWith('conflict:')||!checkpoint&&!checkpoints?.length&&timeForCopy))history=appendCheckpoint(history,makeCheckpoint(previous.payload,key.startsWith('conflict:')?'保留之前的本机冲突副本':'自动保存前的恢复副本（间隔至少 15 分钟）'));
  for(const item of checkpoints??[])history=appendCheckpoint(history,item);
  history=appendCheckpoint(history,checkpoint).filter(item=>snapshotContent(item.payload)!==snapshotContent(payload));
  store.put({revision:expectedRevision+1,payload,...savedMetadata,...(history.length?{history}:{})},key);
 }catch{tx.abort();}};
 tx.oncomplete=()=>resolve(savedRevision);tx.onabort=()=>reject(conflict?Object.assign(Error('其他标签页正在更新记录，本页修改仍保留，请稍后重试或导出便笺。'),{code:'LOCAL_WORKSPACE_CONFLICT'}):Error('浏览器保存失败，请导出备份后再离开。'));tx.onerror=()=>reject(tx.error);
 });}finally{db.close();}
}
