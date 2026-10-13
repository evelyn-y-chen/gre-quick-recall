import {validSession,entries,type Session} from "../../aPlusTestModel";
import {updateReviewHistory} from "../../aPlusReviewModel";
import {getRuntimeDatabase} from "../../../db/runtime";
import {ensureMindMapSchema} from "../../../db/mindMapStore";
const key="a-plus-test-session:v1";
async function loadCorrectedRow(){return getRuntimeDatabase().prepare("SELECT value,revision FROM mind_map_state WHERE key=?").bind(key).first<{value:string;revision:number}>();}
export async function GET(){
 try{await ensureMindMapSchema();const row=await loadCorrectedRow();const session=row?JSON.parse(row.value):null;return Response.json({session,revision:row?.revision??0,history:session?.reviewHistory??{}},{headers:{"Cache-Control":"no-store"}});}catch{return Response.json({error:"无法读取测试记录"},{status:500});}
}
export async function PUT(request:Request){
 let p;try{p=await request.json();}catch{return Response.json({error:"格式不正确"},{status:400});}
 if(!validSession(p?.session)||!Number.isInteger(p?.revision)||p.revision<0)return Response.json({error:"测试记录不完整"},{status:400});
 try{
  await ensureMindMapSchema();const db=getRuntimeDatabase();
  const row=await db.prepare("SELECT value,revision FROM mind_map_state WHERE key=?").bind(key).first<{value:string;revision:number}>();
  if((row?.revision??0)!==p.revision)return Response.json({error:"其他设备已更新测试进度，本机草稿已保留，请先刷新核对。"},{status:409});
  const previous=row?JSON.parse(row.value):null;
  const history=updateReviewHistory(previous?.reviewHistory??{},previous,p.session as Session);
  // Schedule and session commit together under the same revision check. Client history is never trusted.
  const value=JSON.stringify({...p.session,reviewHistory:history,reviewBackfillSeptember26:true});
  const result=p.revision===0?await db.prepare("INSERT INTO mind_map_state (key,value,revision,updated_at) VALUES (?,?,1,CURRENT_TIMESTAMP) ON CONFLICT(key) DO NOTHING RETURNING revision").bind(key,value).first<{revision:number}>():await db.prepare("UPDATE mind_map_state SET value=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE key=? AND revision=? RETURNING revision").bind(value,key,p.revision).first<{revision:number}>();
  if(!result)return Response.json({error:"其他设备已更新测试进度，本机草稿已保留，请先刷新核对。"},{status:409});
  return Response.json({...result,history});
 }catch{return Response.json({error:"保存失败，本机草稿仍保留"},{status:500});}
}
