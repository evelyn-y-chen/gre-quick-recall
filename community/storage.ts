// In-memory mirror; the workspace saves it to IndexedDB independently of cloud IO.
let values:Record<string,string>={};
let changed=()=>{};
const subscribers=new Set<(key?:string)=>void>();
function notify(key?:string){for(const listener of subscribers){try{listener(key);}catch{}}}
export function subscribeStudyStorage(listener:(key?:string)=>void){subscribers.add(listener);return()=>{subscribers.delete(listener);};}
export function setStorageListener(listener:()=>void){changed=listener;}
export function loadStorage(data:Record<string,string>={}){values={...data};notify();}
export function exportStorage(){return {...values};}
export const studyStorage={
 get length(){return Object.keys(values).length;},
 key(i:number){return Object.keys(values)[i]??null;},
 getItem(key:string){return values[key]??null;},
 setItem(key:string,value:string){if(values[key]!==String(value)){values[key]=String(value);changed();notify(key);}},
 removeItem(key:string){if(key in values){delete values[key];changed();notify(key);}},
 clear(){values={};changed();notify();}
};
