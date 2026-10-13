import entries from "../../aPlusEquivalents.json";
import { readMindMapState, writeMindMapState, ensureMindMapSchema } from "../../../db/mindMapStore";
import { getRuntimeDatabase } from "../../../db/runtime";
const normalize=(word:string)=>word.trim().toLowerCase();
const words=new Set(entries.flatMap(entry=>[entry.word,...entry.equivalents]).map(normalize));
const validWord=(value:unknown):value is string=>typeof value==="string"&&words.has(normalize(value));
export async function GET(request:Request){
 const word=new URL(request.url).searchParams.get("word");
 if(word!==null&&!validWord(word))return Response.json({error:"未知单词"},{status:400});
 try{
  if(word!==null){const saved=await readMindMapState(`a-plus-note:${normalize(word)}`);return Response.json({note:saved?JSON.parse(saved.value):""},{headers:{"Cache-Control":"no-store"}});}
  await ensureMindMapSchema();
  const row=await getRuntimeDatabase().prepare("SELECT json_group_object(substr(key,13),json(value)) AS notes FROM mind_map_state WHERE key >= 'a-plus-note:' AND key < 'a-plus-note;'").first<{notes:string}>();
  return Response.json({notes:JSON.parse(row?.notes??"{}")},{headers:{"Cache-Control":"no-store"}});
 }catch{return Response.json({error:"读取笔记失败"},{status:500});}
}
export async function PUT(request:Request){
 let payload;try{payload=await request.json();}catch{return Response.json({error:"笔记格式不正确"},{status:400});}
 if(!payload||typeof payload!=="object")return Response.json({error:"笔记格式不正确"},{status:400});
 if("notes" in payload){
  if(!payload.notes||typeof payload.notes!=="object"||Array.isArray(payload.notes))return Response.json({error:"笔记格式不正确"},{status:400});
  const pairs=Object.entries(payload.notes);
  if(!pairs.length||pairs.length>words.size||pairs.some(([w,n])=>!validWord(w)||typeof n!=="string"||n.length>4000))return Response.json({error:"请选择词库中的单词，每条笔记最多 4000 字"},{status:400});
  const normalized=Object.fromEntries(pairs.map(([w,n])=>[normalize(w),n]));
  try{
   await ensureMindMapSchema();
   await getRuntimeDatabase().prepare(`INSERT INTO mind_map_state (key,value,revision,updated_at)
    SELECT 'a-plus-note:' || key,json_quote(value),1,CURRENT_TIMESTAMP FROM json_each(?) WHERE true
    ON CONFLICT(key) DO UPDATE SET value=excluded.value,revision=mind_map_state.revision+1,updated_at=CURRENT_TIMESTAMP`).bind(JSON.stringify(normalized)).run();
   return Response.json({saved:true,count:Object.keys(normalized).length});
  }catch{return Response.json({error:"保存失败，未提交本次批量修改"},{status:500});}
 }
 if(!validWord(payload.word)||typeof payload.note!=="string"||payload.note.length>4000)return Response.json({error:"请选择词库中的单词，笔记最多 4000 字"},{status:400});
 try{await writeMindMapState(`a-plus-note:${normalize(payload.word)}`,JSON.stringify(payload.note));return Response.json({saved:true});}catch{return Response.json({error:"保存笔记失败"},{status:500});}
}
