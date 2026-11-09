import type {Snapshot} from './database';
const content=(snapshot:Snapshot)=>JSON.stringify({rows:snapshot.rows.map(({key,value})=>({key,value})).sort((a,b)=>a.key.localeCompare(b.key)),storage:Object.fromEntries(Object.entries(snapshot.storage).sort(([a],[b])=>a.localeCompare(b)))});
/** A successful HTTP/RPC reply is not the receipt: read the committed payload. */
export function verifyCloudReceipt(expected:Snapshot,revision:number,receipt:{payload:Snapshot;revision:number}|null){
 if(!receipt||receipt.revision<revision)throw Error('云端尚未确认这次保存，修改仍保留在本机，请重试同步。');
 if(receipt.revision>revision)throw Object.assign(Error('保存核验时另一台设备又有更新，正在合并最新内容。'),{code:'WORKSPACE_CONFLICT'});
 if(content(expected)!==content(receipt.payload))throw Error('云端保存核验未通过，修改仍保留在本机，暂未确认保存成功。');
}
