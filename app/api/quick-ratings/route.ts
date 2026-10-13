import { getRuntimeDatabase } from "../../../db/runtime";
import { ratingModules,validRatings } from "../../ratingSyncModel";
const validModule=(value:unknown):value is string=>typeof value==="string" && (ratingModules as readonly string[]).includes(value);
export async function GET(request:Request) {
 const module=new URL(request.url).searchParams.get("module");
 if(!validModule(module))return Response.json({error:"未知词库"},{status:400});
 const prefix=`quick-rating:${module}:`;
 try {
  const row=await getRuntimeDatabase().prepare("SELECT json_group_object(substr(key,?),json(value)) AS ratings FROM mind_map_state WHERE key >= ? AND key < ?").bind(prefix.length+1,prefix,`quick-rating:${module};`).first<{ratings:string}>();
  return Response.json({ratings:JSON.parse(row?.ratings??"{}")},{headers:{"Cache-Control":"no-store"}});
 }catch{return Response.json({error:"读取学习记录失败"},{status:500});}
}
export async function PUT(request:Request) {
 let payload;try{payload=await request.json();}catch{return Response.json({error:"记录格式不正确"},{status:400});}
 if(!validModule(payload?.module)||!validRatings(payload?.ratings))return Response.json({error:"记录格式不正确"},{status:400});
 try {
  await getRuntimeDatabase().prepare(`INSERT INTO mind_map_state (key,value,revision,updated_at)
   SELECT ? || key,json_quote(value),1,CURRENT_TIMESTAMP FROM json_each(?) WHERE true
   ON CONFLICT(key) DO UPDATE SET value=excluded.value,revision=mind_map_state.revision+1,updated_at=CURRENT_TIMESTAMP`).bind(`quick-rating:${payload.module}:`,JSON.stringify(payload.ratings)).run();
  return Response.json({saved:true});
 }catch{return Response.json({error:"保存失败，请重试"},{status:500});}
}
