import type { GleeMindMap } from "./gleeMindMaps";
import type { GleeTableList } from "./gleeTableLists";
export const memoryWordKey=(word:string)=>word.trim().toLowerCase().replace(/\s+/g," ");
export type SharedGleeMemory={text:string;sources:string[]};
// A live view of GLEE, never a second stored copy of its memory methods.
export function buildSharedGleeMemory(maps:GleeMindMap[],tables:GleeTableList[]):Record<string,SharedGleeMemory>{
 const index=new Map<string,{notes:Set<string>;sources:Set<string>}>();
 function add(word:string,memory:string|undefined,source:string){
  if(!memory?.trim())return;const key=memoryWordKey(word);
  const item=index.get(key)??{notes:new Set<string>(),sources:new Set<string>()};
  item.notes.add(memory.trim());item.sources.add(source);index.set(key,item);
 }
 for(const map of maps)for(const branch of map.branches)for(const item of branch.words)add(item.word,item.memory,`GLEE List ${map.list} · Part ${map.part}`);
 for(const table of tables)for(const item of table.words)add(item.word,item.memory,`GLEE List ${table.list} · 词汇表`);
 return Object.fromEntries([...index].map(([key,item])=>[key,{text:[...item.notes].join("\n\n"),sources:[...item.sources]}]));
}

export function findGleeMemoryLocation(maps:GleeMindMap[],tables:GleeTableList[],word:string){
 const key=memoryWordKey(word);
 const matches=maps.flatMap(map=>map.branches.flatMap(branch=>branch.words.filter(item=>memoryWordKey(item.word)===key).map(item=>({kind:"map" as const,map,item}))));
 const map=matches.find(match=>match.item.memory?.trim())??matches[0];
 if(map)return map;
 for(const table of tables){const item=table.words.find(item=>memoryWordKey(item.word)===key);if(item)return {kind:"table" as const,table,item};}
 return null;
}
