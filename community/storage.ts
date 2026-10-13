// Learning data is memory-only until the authenticated cloud save succeeds.
let values:Record<string,string>={};
let changed=()=>{};
export function setStorageListener(listener:()=>void){changed=listener;}
export function loadStorage(data:Record<string,string>={}){values={...data};}
export function exportStorage(){return {...values};}
export const studyStorage={
 get length(){return Object.keys(values).length;},
 key(i:number){return Object.keys(values)[i]??null;},
 getItem(key:string){return values[key]??null;},
 setItem(key:string,value:string){if(values[key]!==String(value)){values[key]=String(value);changed();}},
 removeItem(key:string){if(key in values){delete values[key];changed();}},
 clear(){values={};changed();}
};
