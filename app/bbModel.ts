import {wordMemoryKey} from "./wordMemoryModel";
type Entry={id:string;volume:string;number:number;list:number;words:{word:string}[]};
export type BBOccurrence={id:string;entryId:string;volume:string;list:number;location:string};
export function bbOccurrences(entries:Entry[]){
 const groups=new Map<string,BBOccurrence[]>();
 for(const e of entries)e.words.forEach((w,i)=>{const key=wordMemoryKey(w.word);const items=groups.get(key)??[];items.push({id:`${e.id}:${i}`,entryId:e.id,volume:e.volume,list:e.list,location:`${e.volume}册 · List ${e.list} · 第 ${e.number} 组`});groups.set(key,items);});
 const result:Record<string,{ordinal:number;total:number;locations:BBOccurrence[]}>={};
 for(const items of groups.values())items.forEach((item,i)=>{result[item.id]={ordinal:i+1,total:items.length,locations:items};});
 return result;
}
