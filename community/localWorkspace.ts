import {validSnapshot,type Snapshot} from './database';
import {appendCheckpoint,checkpoint as makeCheckpoint,type RecoveryCheckpoint} from './workspaceRecovery';
const databaseName='gre-personal-workspace-v1';
export type SavedWorkspace={revision:number;payload:Snapshot;cloudRevision?:number;pending?:boolean;basePayload?:Snapshot;history?:RecoveryCheckpoint[]};
function connect():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const request=indexedDB.open(databaseName,1);request.onupgradeneeded=()=>request.result.createObjectStore('workspaces');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
export async function readLocalWorkspace(key="local"):Promise<SavedWorkspace|undefined>{
 const db=await connect();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('workspaces','readonly'),request=tx.objectStore('workspaces').get(key);request.onsuccess=()=>{const value=request.result;if(value&&(!validSnapshot(value.payload)||!Number.isInteger(value.revision)))reject(Error('浏览器记录损坏，请先导出备份再处理。'));else resolve(value);};request.onerror=()=>reject(request.error);});}finally{db.close();}
}
export async function saveLocalWorkspace(payload:Snapshot,expectedRevision:number,key="local",metadata:{cloudRevision?:number;pending?:boolean;basePayload?:Snapshot;checkpoint?:RecoveryCheckpoint;checkpoints?:RecoveryCheckpoint[]}={}):Promise<number>{
 if(!validSnapshot(payload))throw Error('备份格式不正确');
 const db=await connect();try{return await new Promise((resolve,reject)=>{
 const tx=db.transaction('workspaces','readwrite'),store=tx.objectStore('workspaces'),request=store.get(key);let conflict=false;
 request.onsuccess=()=>{if((request.result?.revision??0)!==expectedRevision){conflict=true;tx.abort();return;}try{const {checkpoint,checkpoints,...savedMetadata}=metadata;let history=appendCheckpoint(request.result?.history);if(key.startsWith('conflict:')&&request.result?.payload&&JSON.stringify(request.result.payload)!==JSON.stringify(payload))history=appendCheckpoint(history,makeCheckpoint(request.result.payload,'保留之前的本机冲突副本'));for(const item of checkpoints??[])history=appendCheckpoint(history,item);history=appendCheckpoint(history,checkpoint);store.put({revision:expectedRevision+1,payload,...savedMetadata,...(history.length?{history}:{})},key);}catch{tx.abort();}};
 tx.oncomplete=()=>resolve(expectedRevision+1);tx.onabort=()=>reject(Error(conflict?'其他标签页已经更新记录，请导出本页备份后刷新，避免覆盖。':'浏览器保存失败，请导出备份后再离开。'));tx.onerror=()=>reject(tx.error);
 });}finally{db.close();}
}
