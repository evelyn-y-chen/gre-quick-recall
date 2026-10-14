import {validSnapshot,type Snapshot} from './database';
export type LearningSlip={format:'gre-learning-slip';version:1;createdAt:string;payload:Snapshot};
export function makeSlip(payload:Snapshot):LearningSlip {
 if(!validSnapshot(payload))throw Error('学习记录格式不正确');
 return {format:'gre-learning-slip',version:1,createdAt:new Date().toISOString(),payload};
}
export function readSlip(value:unknown):Snapshot {
 const slip=value as Partial<LearningSlip>;
 const payload=slip?.format==='gre-learning-slip'&&slip.version===1?slip.payload:value;
 if(!validSnapshot(payload))throw Error('这不是可读取的学习便笺，原有记录没有改变。');
 const keys=payload.rows.map(row=>row.key);
 if(new Set(keys).size!==keys.length)throw Error('便笺中有重复记录，暂时无法导入。');
 return payload;
}
