import {validSnapshot,type Snapshot} from './database';

export type RecoveryCheckpoint={id:string;createdAt:string;reason:string;payload:Snapshot};
export type RecoveryCopy=RecoveryCheckpoint&{kind:'checkpoint'|'device-copy'|'sync-base'};
export const recoveryLimit=2;
export const recoveryIntervalMs=15*60*1000;
// Metadata-only revisions are not a new learning copy. Keep comparison stable
// when row or storage-key insertion order differs across devices.
export function snapshotContent(payload:Snapshot){return JSON.stringify([payload.rows.map(r=>[r.key,r.value]).sort(([a],[b])=>a.localeCompare(b)),Object.entries(payload.storage).sort(([a],[b])=>a.localeCompare(b))]);}

export function validCheckpoint(value:unknown):value is RecoveryCheckpoint{
 const v=value as RecoveryCheckpoint;
 return !!v&&typeof v.id==='string'&&typeof v.createdAt==='string'&&Number.isFinite(Date.parse(v.createdAt))&&typeof v.reason==='string'&&validSnapshot(v.payload);
}
export function checkpoint(payload:Snapshot,reason:string):RecoveryCheckpoint{
 if(!validSnapshot(payload))throw Error('无法备份当前记录，已取消替换。');
 return {id:crypto.randomUUID(),createdAt:new Date().toISOString(),reason,payload};
}
export function appendCheckpoint(previous:unknown,next?:RecoveryCheckpoint):RecoveryCheckpoint[]{
 const history=Array.isArray(previous)?previous.filter(validCheckpoint):[];
 if(next&&!validCheckpoint(next))throw Error('恢复副本格式不正确，已取消替换。');
 const unique=new Map<string,RecoveryCheckpoint>();
 for(const item of [...history,...(next?[next]:[])]){const key=snapshotContent(item.payload);unique.delete(key);unique.set(key,item);}
 return [...unique.values()].slice(-recoveryLimit);
}
export function snapshotSummary(payload:Snapshot){
 const rows=payload.rows;
 const drafts=(()=>{try{const value=JSON.parse(payload.storage['gre-shared-word-memory-drafts-v1']??'{}');return value&&typeof value==='object'&&!Array.isArray(value)?Object.keys(value).length:0;}catch{return 0;}})();
 let latest='';for(const row of rows)if(Number.isFinite(Date.parse(row.updated_at))&&(!latest||Date.parse(row.updated_at)>Date.parse(latest)))latest=row.updated_at;
 return {rows:rows.length,notes:rows.filter(row=>row.key.startsWith('word-memory:')).length,drafts,latest};
}
