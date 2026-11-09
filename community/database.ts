import initSqlJs,{type Database} from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import {setRuntimeDatabase} from '../db/runtime';
import {exportStorage,loadStorage,setStorageListener,recordRowEdit} from './storage';
export type Snapshot={version:1;rows:{key:string;value:string;revision:number;updated_at:string}[];storage:Record<string,string>};
let db:Database;
let observedRows=new Map<string,string>();
let listener=()=>{};
export function onWorkspaceChange(fn:()=>void){listener=fn;setStorageListener(fn);}
export function validSnapshot(value:unknown):value is Snapshot{
 const v=value as Snapshot;
 return !!v&&v.version===1&&Array.isArray(v.rows)&&v.rows.every(r=>typeof r.key==='string'&&typeof r.value==='string'&&Number.isInteger(r.revision)&&r.revision>=1&&typeof r.updated_at==='string')&&!!v.storage&&typeof v.storage==='object'&&!Array.isArray(v.storage)&&Object.values(v.storage).every(x=>typeof x==='string');
}
export async function openWorkspace(snapshot?:Snapshot){
 if(snapshot&&!validSnapshot(snapshot))throw Error('学习记录格式无效，未载入。');
 const SQL=await initSqlJs({locateFile:()=>wasmUrl});
 const next=new SQL.Database();
 next.run('CREATE TABLE mind_map_state (key TEXT PRIMARY KEY NOT NULL,value TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
 if(snapshot)for(const row of snapshot.rows)next.run('INSERT INTO mind_map_state VALUES (?,?,?,?)',[row.key,row.value,row.revision,row.updated_at]);
 db?.close();db=next;observedRows=new Map(snapshot?.rows.map(row=>[row.key,row.value])??[]);loadStorage(snapshot?.storage);
 setRuntimeDatabase({prepare(query:string){let values:unknown[]=[];
  const execute=()=>{
   const writing=/^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(query),deleting=/^\s*DELETE\b/i.test(query);
   // RETURNING identifies only the rows actually written, including successful
   // conditional writes. Do not export/scan the full database per keystroke.
   const sql=writing?query.replace(/\s*;\s*$/,'').replace(/\s+RETURNING\b[\s\S]*$/i,'')+' RETURNING key,value,revision,updated_at':query;
   const statement=db.prepare(sql);try{
    statement.bind(values as any);const results=[];while(statement.step())results.push(statement.getAsObject());
    if(writing&&results.length){for(const row of results){const key=String(row.key),value=deleting?undefined:String(row.value);recordRowEdit(key,observedRows.get(key),value);if(value===undefined)observedRows.delete(key);else observedRows.set(key,value);}listener();}
    return results;
   }finally{statement.free();}
  };
  return {bind(...args:unknown[]){values=args;return this;},async run<T>(){execute();return {success:true} as T;},async first<T>(){return (execute()[0]??null) as T|null;}};
 }});
}
export function exportWorkspace():Snapshot{
 const results=db.exec('SELECT key,value,revision,updated_at FROM mind_map_state');
 const rows=results.length?results[0].values.map(r=>({key:String(r[0]),value:String(r[1]),revision:Number(r[2]),updated_at:String(r[3])})):[];
 return {version:1,rows,storage:exportStorage()};
}
