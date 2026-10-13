import {simplifyReviewedMemory} from "../../reviewedWordMemory";
import {GET as gleeContent} from "../mind-map/route";
import bbEntries from "../../bbEquivalents.json";
import lectures from "../../aPlusLectureNotes.json";
import {addMemorySeed,compactMemoryText,mergeMemoryTexts,wordMemoryKey,type WordMemory} from "../../wordMemoryModel";
import {getRuntimeDatabase} from "../../../db/runtime";
import {ensureMindMapSchema} from "../../../db/mindMapStore";
const prefix="word-memory:";
export async function GET(){try{
 await ensureMindMapSchema();const glee=await gleeContent();if(!glee.ok)throw Error();const data=await glee.json();
 const index:Record<string,WordMemory>=Object.create(null);
 for(const map of data.maps)for(const branch of map.branches)for(const item of branch.words)addMemorySeed(index,item.word,item.memory,`GLEE List ${map.list} · Part ${map.part}`);
 for(const table of data.tables)for(const item of table.words)addMemorySeed(index,item.word,item.memory,`GLEE List ${table.list}`);
 const row=await getRuntimeDatabase().prepare("SELECT json_group_array(json_object('key',key,'value',json(value),'revision',revision)) AS items FROM mind_map_state WHERE (key >= 'a-plus-note:' AND key < 'a-plus-note;') OR (key >= 'word-memory:' AND key < 'word-memory;')").first<{items:string}>();
 const records=JSON.parse(row?.items??"[]") as {key:string;value:any;revision:number}[];
 const savedAplus=new Set(records.filter(r=>r.key.startsWith("a-plus-note:")).map(r=>r.key.slice(12)));
 for(const [word,lecture] of Object.entries(lectures))if(!savedAplus.has(word))addMemorySeed(index,word,lecture.note,"A+ 原讲解");
 for(const r of records){if(r.key.startsWith("a-plus-note:"))addMemorySeed(index,r.key.slice(12),r.value,"A+ 已有记忆方法");}
 const bbIndex:Record<string,WordMemory>=Object.create(null);
 for(const entry of bbEntries)for(const w of entry.words){addMemorySeed(bbIndex,w.word,w.memory,`BB ${entry.volume}册 · 第 ${entry.number} 组`);addMemorySeed(index,w.word,w.memory,`BB ${entry.volume}册 · 第 ${entry.number} 组`);}
 for(const r of records)if(r.key.startsWith(prefix)){const key=r.key.slice(prefix.length);const stored=typeof r.value==="string"?{text:r.value,bbImported:false}:r.value;index[key]={text:stored.bbImported?compactMemoryText(stored.text):mergeMemoryTexts([stored.text,bbIndex[key]?.text??""]),revision:r.revision,sources:index[key]?.sources??[]};}
 for(const [word,memory] of Object.entries(index))memory.text=simplifyReviewedMemory(word,memory.text);
 return Response.json({memories:index},{headers:{"Cache-Control":"no-store"}});
 }catch{return Response.json({error:"读取共享记忆方法失败，请重试"},{status:500});}}
export async function PUT(request:Request){
 let p;try{p=await request.json();}catch{return Response.json({error:"格式错误"},{status:400});}
 if(typeof p?.word!=="string"||!wordMemoryKey(p.word)||p.word.length>300||typeof p.text!=="string"||p.text.length>40000||!Number.isInteger(p.revision)||p.revision<0)return Response.json({error:"记忆方法格式不正确或超过 40000 字"},{status:400});
 try{await ensureMindMapSchema();const db=getRuntimeDatabase(),key=prefix+wordMemoryKey(p.word);
 const previous=await db.prepare("SELECT value,revision FROM mind_map_state WHERE key=?").bind(key).first<{value:string;revision:number}>();
 // Retain the exact saved original before an edit replaces it. The read-time
 // compact view itself never overwrites the underlying record.
 if(previous&&previous.revision===p.revision)await db.prepare("INSERT INTO mind_map_state (key,value,revision,updated_at) VALUES (?,?,1,CURRENT_TIMESTAMP) ON CONFLICT(key) DO NOTHING").bind(`word-memory-backup:${wordMemoryKey(p.word)}:${previous.revision}`,previous.value).run();
 p.text=compactMemoryText(p.text);
 const saved=p.revision===0?await db.prepare("INSERT INTO mind_map_state (key,value,revision,updated_at) VALUES (?,?,1,CURRENT_TIMESTAMP) ON CONFLICT(key) DO NOTHING RETURNING revision").bind(key,JSON.stringify({text:p.text,bbImported:true})).first<{revision:number}>():await db.prepare("UPDATE mind_map_state SET value=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE key=? AND revision=? RETURNING revision").bind(JSON.stringify({text:p.text,bbImported:true}),key,p.revision).first<{revision:number}>();
 if(!saved){const current=await db.prepare("SELECT value,revision FROM mind_map_state WHERE key=?").bind(key).first<{value:string;revision:number}>();return Response.json({error:"其他设备更新过这个词，请核对云端内容后重试。",current:current?{text:typeof JSON.parse(current.value)==="string"?JSON.parse(current.value):JSON.parse(current.value).text,revision:current.revision}:null},{status:409});}
 return Response.json({text:p.text,revision:saved.revision});
 }catch{return Response.json({error:"保存失败，草稿已保留"},{status:500});}}
