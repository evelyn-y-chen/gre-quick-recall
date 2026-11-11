/** Per-field edit times travel with the existing workspace, including offline saves.
 * A later upload does not make its unchanged fields newer. */
export const fieldClockKey='gre-workspace-field-edits-v1';
type Stamp={at:number;token:string;hash:string};
export type FieldClocks=Record<string,Stamp>;
type Path=string[];
type Namespace='rows'|'storage';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const safe=(key:string)=>!['__proto__','constructor','prototype'].includes(key);
const pathKey=(path:Path)=>JSON.stringify(path);
const canonical=(v:unknown):string=>v===undefined?'undefined':JSON.stringify(object(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(canonical(v[k]))])):Array.isArray(v)?v.map(item=>JSON.parse(canonical(item))):v);
const same=(a:unknown,b:unknown)=>canonical(a)===canonical(b);
function hash(v:unknown){
 const text=canonical(v);let a=2166136261,b=5381;
 for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619);b=Math.imul(b,33)^text.charCodeAt(i);}
 return (a>>>0).toString(36)+':'+(b>>>0).toString(36)+':'+text.length;
}
const later=(a:Stamp|undefined,b:Stamp|undefined)=>!a?b:!b?a:a.at!==b.at?(a.at>b.at?a:b):a.token>=b.token?a:b;
function decode(raw:string|undefined):{json:boolean;value:unknown}{if(raw===undefined)return {json:false,value:undefined};try{return {json:true,value:JSON.parse(raw)};}catch{return {json:false,value:raw};}}
export function readFieldClocks(raw:string|undefined):FieldClocks{
 const result:FieldClocks={};if(!raw)return result;
 try{const values=JSON.parse(raw);if(!object(values))return result;
  for(const [key,value] of Object.entries(values)){
   let path;try{path=JSON.parse(key);}catch{continue;}
   if(!Array.isArray(path)||path.length<2||!['rows','storage'].includes(path[0])||!path.every(p=>typeof p==='string'&&safe(p))||!object(value)||!Number.isSafeInteger(value.at)||(value.at as number)<=0||typeof value.token!=='string'||value.token.length>100||typeof value.hash!=='string'||value.hash.length>100)continue;
   result[key]=value as Stamp;
  }
 }catch{/* Old workspaces have no field clock map. */}return result;
}
function identities(values:unknown[]):string[]|undefined{
 if(!values.every(v=>object(v)&&typeof v.id==='string'&&!!v.id&&safe(v.id)))return;
 const ids=values.map(v=>(v as {id:string}).id);return new Set(ids).size===ids.length?ids:undefined;
}
/** Stamp only changed leaves, plus container membership/order for additions/removals. */
export function stampFieldChange(clocks:FieldClocks,namespace:Namespace,key:string,before:string|undefined,after:string|undefined,at:number,token:string){
 if(before===after||key===fieldClockKey)return;
 function visit(path:Path,b:unknown,a:unknown){
  if(same(b,a))return;
  clocks[pathKey(path)]={at,token,hash:hash(a)};
  if(b===undefined&&a!==undefined&&path.at(-1)?.startsWith('@'))clocks[pathKey([...path,'$created'])]??={at,token,hash:hash(a)};
  if(object(a)){
   const old=object(b)?b:{};
   for(const k of new Set([...Object.keys(old),...Object.keys(a)]))if(safe(k))visit([...path,k],old[k],a[k]);
  }else if(Array.isArray(a)&&identities(a)&&(!Array.isArray(b)||identities(b))){
   const previous=Array.isArray(b)?b:[],old=new Map(previous.map(v=>[(v as {id:string}).id,v])),next=new Map(a.map(v=>[(v as {id:string}).id,v]));
   visit([...path,'$order'],previous.map(v=>(v as {id:string}).id),a.map(v=>(v as {id:string}).id));
   for(const id of new Set([...old.keys(),...next.keys()]))visit([...path,'@'+id],old.get(id),next.get(id));
  }
 }
 visit([namespace,key],decode(before).value,decode(after).value);
}
export function createFieldMerger(baseRaw:string|undefined,localRaw:string|undefined,remoteRaw:string|undefined){
 const local=readFieldClocks(localRaw),remote=readFieldClocks(remoteRaw),base=readFieldClocks(baseRaw),out:FieldClocks={};
 for(const key of new Set([...Object.keys(base),...Object.keys(local),...Object.keys(remote)])){const stamp=later(later(base[key],local[key]),remote[key]);if(stamp)out[key]=stamp;}
 const enabled=Object.keys(local).length>0||Object.keys(remote).length>0;
 function stamp(clocks:FieldClocks,path:Path,value:unknown){const s=clocks[pathKey(path)];return s?.hash===hash(value)?s:undefined;}
 function keep(path:Path,value:unknown,s:Stamp|undefined){if(s)out[pathKey(path)]={...s,hash:hash(value)};return value;}
 function merge(path:Path,b:unknown,l:unknown,r:unknown,lf:number,rf:number,whole=false):unknown{
  const ls=stamp(local,path,l),rs=stamp(remote,path,r),newest=later(ls,rs);
  if(same(l,r))return keep(path,l,newest);
  // Deletion is an edit too. An old device missing an unseen item is not a deletion.
  if(l===undefined||r===undefined){
   const missing=l===undefined?l:r,present=l===undefined?r:l,deleted=l===undefined?ls:rs,existing=l===undefined?rs:ls;
   if(deleted){const newer=later(deleted,existing);if(newer===deleted)return keep(path,missing,deleted);}
   if(!deleted)return keep(path,present,existing);
  }
  const atomic=whole||['results','progress','lookback','recalls'].includes(path.at(-2)??'')||['recallArchive','recallRound','recallSubmission','recallReminder','config'].includes(path.at(-1)??'')||object(l)&&object(r)&&typeof l.sessionId==='string'&&typeof r.sessionId==='string'&&l.sessionId!==r.sessionId;
  if(!atomic&&object(l)&&object(r)){
   const before=object(b)?b:{},result:Record<string,unknown>={};
   for(const key of [...new Set([...Object.keys(before),...Object.keys(l),...Object.keys(r)])].sort())if(safe(key)){
    const value=merge([...path,key],before[key],l[key],r[key],lf,rf);if(value!==undefined)result[key]=value;
   }
   return keep(path,result,newest);
  }
  if(Array.isArray(l)&&Array.isArray(r)&&identities(l)&&identities(r)){
   const before=Array.isArray(b)&&identities(b)?b:[],bm=new Map(before.map(v=>[(v as {id:string}).id,v])),lm=new Map(l.map(v=>[(v as {id:string}).id,v])),rm=new Map(r.map(v=>[(v as {id:string}).id,v]));
   const baseIds=[...bm.keys()],localIds=[...lm.keys()],remoteIds=[...rm.keys()],unchanged=(ids:string[])=>same(ids.filter(id=>bm.has(id)),baseIds.filter(id=>ids.includes(id)));
   const order=unchanged(localIds)&&unchanged(remoteIds)?baseIds:merge([...path,'$order'],baseIds,localIds,remoteIds,lf,rf) as string[];
   const ids=[...order,...[...new Set([...lm.keys(),...rm.keys()])].filter(id=>!order.includes(id)).sort((a,b)=>{
    const created=(id:string)=>later(local[pathKey([...path,'@'+id,'$created'])],remote[pathKey([...path,'@'+id,'$created'])])??later(local[pathKey([...path,'@'+id])],remote[pathKey([...path,'@'+id])]);return (created(a)?.at??0)-(created(b)?.at??0)||a.localeCompare(b);
   })],result=[];
   for(const id of ids){const value=merge([...path,'@'+id],bm.get(id),lm.get(id),rm.get(id),lf,rf);if(value!==undefined)result.push(value);}
   return keep(path,result,newest);
  }
  // Exact leaf clocks take precedence over whole-file timestamps, even for an
  // explicit edit back to the baseline text. Unchanged legacy fields have no vote.
  if(ls||rs){
   const left=ls??(!same(l,b)&&lf?{at:lf,token:'legacy',hash:hash(l)}:undefined),right=rs??(!same(r,b)&&rf?{at:rf,token:'legacy',hash:hash(r)}:undefined),chosen=later(left,right);
   return keep(path,chosen===left?l:r,chosen);
  }
  if(same(l,b))return r;if(same(r,b))return l;
  if(lf!==rf)return lf>rf?l:r;
  // Only pre-upgrade values can lack both field times. Keep a deterministic
  // choice; existing recovery checkpoints retain the prior versions.
  return canonical(l)>=canonical(r)?l:r;
 }
 return {enabled,merge(namespace:Namespace,key:string,b:string|undefined,l:string|undefined,r:string|undefined,localTime=0,remoteTime=0,whole=false){
  const bv=decode(b),lv=decode(l),rv=decode(r),value=merge([namespace,key],bv.value,lv.value,rv.value,localTime,remoteTime,whole);
  if(value===undefined)return undefined;
  return lv.json||rv.json?JSON.stringify(value):String(value);
 },record(namespace:Namespace,key:string,before:string,after:string){let at=1;for(const stamp of Object.values(out))at=Math.max(at,stamp.at+1);stampFieldChange(out,namespace,key,before,after,at,'compact:'+hash(after));},metadata:()=>Object.keys(out).length?JSON.stringify(Object.fromEntries(Object.keys(out).sort().map(key=>[key,out[key]]))):undefined};
}
