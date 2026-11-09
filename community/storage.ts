import {fieldClockKey,readFieldClocks,stampFieldChange,type FieldClocks} from './fieldMerge';
// In-memory mirror; the workspace saves it to IndexedDB independently of cloud IO.
let values:Record<string,string>={};
let clocks:FieldClocks={},clockDirty=false,lastEdit=0;
let changed=()=>{};
const subscribers=new Set<(key?:string)=>void>();
function notify(key?:string){for(const listener of subscribers){try{listener(key);}catch{}}}
export function subscribeStudyStorage(listener:(key?:string)=>void){subscribers.add(listener);return()=>{subscribers.delete(listener);};}
export function setStorageListener(listener:()=>void){changed=listener;}
export function loadStorage(data:Record<string,string>={}){values={...data};clocks=readFieldClocks(data[fieldClockKey]);clockDirty=false;lastEdit=0;for(const stamp of Object.values(clocks))lastEdit=Math.max(lastEdit,stamp.at);notify();}
function flushClocks(){if(clockDirty){values[fieldClockKey]=JSON.stringify(clocks);clockDirty=false;}}
export function recordRowEdit(key:string,before:string|undefined,after:string|undefined){recordEdit('rows',key,before,after);}
function recordEdit(namespace:'rows'|'storage',key:string,before:string|undefined,after:string|undefined){
 if(before===after||key===fieldClockKey)return;
 const at=Math.max(Date.now(),lastEdit+1);lastEdit=at;
 stampFieldChange(clocks,namespace,key,before,after,at,crypto.randomUUID());clockDirty=true;
}
export function exportStorage(){flushClocks();return {...values};}
export const studyStorage={
 get length(){flushClocks();return Object.keys(values).length;},
 key(i:number){flushClocks();return Object.keys(values)[i]??null;},
 getItem(key:string){if(key===fieldClockKey)flushClocks();return values[key]??null;},
 setItem(key:string,value:string){if(values[key]!==String(value)){recordEdit('storage',key,values[key],String(value));values[key]=String(value);changed();notify(key);}},
 removeItem(key:string){if(key in values){recordEdit('storage',key,values[key],undefined);delete values[key];changed();notify(key);}},
 clear(){for(const [key,value] of Object.entries(values))recordEdit('storage',key,value,undefined);values={};changed();notify();}
};
