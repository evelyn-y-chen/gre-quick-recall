import type {Snapshot} from './database';
import {ratingModules,validRatings,type Rating,type Ratings} from '../app/ratingSyncModel';
export const ratingClockKey='gre-rating-modified-v1';
const storageKeys:Record<string,string>={bb:'gre-bb-ratings-v1',words:'gre-quick-ratings-v1',equivalents:'gre-equivalent-quick-ratings-v1','a-plus':'gre-a-plus-equivalent-quick-ratings-v1',glee:'gre-glee-1500-quick-ratings-v1',math:'gre-math-vocabulary-quick-ratings-v1',lclj:'gre-lclj-quick-ratings-v1','a-plus-words':'gre-a-plus-word-marks-v1'};
type Stamp={rating:Rating;at:number};
type Clocks=Record<string,Record<string,Stamp>>;
type Storage={getItem:(key:string)=>string|null;setItem:(key:string,value:string)=>void};
const safeKey=(key:string)=>!!key&&!['__proto__','constructor','prototype'].includes(key);
const parse=(raw:string|undefined|null):unknown=>{try{return raw?JSON.parse(raw):undefined;}catch{return undefined;}};
function clocks(raw:string|undefined|null):Clocks{
 const value=parse(raw);const result:Clocks={};
 if(!value||typeof value!=='object'||Array.isArray(value))return result;
 for(const module of ratingModules){const entries=(value as Clocks)[module];if(!entries||typeof entries!=='object'||Array.isArray(entries))continue;
  const next:Record<string,Stamp>={};for(const [id,s] of Object.entries(entries))if(safeKey(id)&&s&&['unknown','fuzzy','familiar'].includes(s.rating)&&Number.isSafeInteger(s.at)&&s.at>0)next[id]={rating:s.rating,at:s.at};result[module]=next;
 }return result;
}
export function stampRatingChanges(storage:Storage,module:string,changes:Ratings,now=Date.now()){
 if(!(ratingModules as readonly string[]).includes(module)||!validRatings(changes)||!Object.keys(changes).length)return;
 const all=clocks(storage.getItem(ratingClockKey)),entries=all[module]??{};
 const last=Math.max(0,...Object.values(entries).map(s=>s.at)),at=Math.max(Math.floor(now),last+1);
 for(const [id,rating] of Object.entries(changes))entries[id]={rating,at};all[module]=entries;storage.setItem(ratingClockKey,JSON.stringify(all));
}
const isRatingStorage=(key:string)=>key===ratingClockKey||Object.values(storageKeys).includes(key)||key.startsWith('gre-rating-cloud-pending:');
const isRatingRow=(key:string)=>ratingModules.some(module=>key.startsWith(`quick-rating:${module}:`));
type Value={rating:Rating;at:number;row?:Snapshot['rows'][number]};
function moduleValues(snapshot:Snapshot|undefined,module:string):Record<string,Value>{
 const result:Record<string,Value>={};if(!snapshot)return result;const prefix=`quick-rating:${module}:`,times=clocks(snapshot.storage[ratingClockKey])[module]??{};
 for(const row of snapshot.rows)if(row.key.startsWith(prefix)){const id=row.key.slice(prefix.length),rating=parse(row.value);if(safeKey(id)&&['unknown','fuzzy','familiar'].includes(rating as string))result[id]={rating:rating as Rating,at:0,row};}
 for(const key of [storageKeys[module],`gre-rating-cloud-pending:${module}`]){const values=parse(snapshot.storage[key]);if(validRatings(values))for(const [id,rating] of Object.entries(values)){
  const existing=result[id],stamp=times[id];
  if(existing&&stamp?.rating===existing.rating&&stamp.rating!==rating)continue;
  result[id]={...existing,rating,at:0};
 }}
 for(const [id,value] of Object.entries(result)){const stamp=times[id];if(stamp?.rating===value.rating)value.at=stamp.at;}
 return result;
}
function choose(base:Value|undefined,local:Value|undefined,remote:Value|undefined,module:string,id:string):Value|undefined{
 if(!local)return remote;if(!remote)return local;
 if(local.rating===remote.rating)return local.at>remote.at?local:remote;
 if(local.at||remote.at){if(local.at!==remote.at)return local.at>remote.at?local:remote;return local.rating>remote.rating?local:remote;}
 if(local.rating===base?.rating)return remote;if(remote.rating===base?.rating)return local;
 throw Error(`同一个词的旧版红黄绿记录不同，已保留本机记录。请先导出便笺，再核对 ${module} 的标记。`);
}
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
type PlanAnswer='red'|'yellow'|'green';
const planAnswerRank:Record<PlanAnswer,number>={red:0,yellow:1,green:2};
function isPlanAnswerKey(key:string){
 const match=/^lemnota-plan-answer:([A-Za-z0-9_-]{1,100}):([^:]{1,1500}):(\d{4}-\d{2}-\d{2})$/.exec(key);
 if(!match)return false;
 const date=new Date(`${match[3]}T00:00:00.000Z`);
 if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==match[3])return false;
 try{const word=decodeURIComponent(match[2]);return word.length>0&&word.length<=500&&!/[\u0000-\u001f\u007f]/.test(word)&&encodeURIComponent(word)===match[2];}catch{return false;}
}
function planAnswer(raw:string|undefined):PlanAnswer|undefined{
 const value=parse(raw);return value==='red'||value==='yellow'||value==='green'?value:undefined;
}
function mergeMap<T>(base:Record<string,T>,local:Record<string,T>,remote:Record<string,T>,preferLocal:(key:string)=>boolean=()=>false):Record<string,T>{
 const out:Record<string,T>={};for(const key of new Set([...Object.keys(base),...Object.keys(local),...Object.keys(remote)])){
  if(!safeKey(key))throw Error('便笺中有无效记录键，原有记录未被替换。');
  let value:T|undefined;if(same(local[key],base[key]))value=remote[key];else if(same(remote[key],base[key])||same(local[key],remote[key]))value=local[key];else if(preferLocal(key))value=local[key];else throw Error('两台设备修改了同一份笔记或设置，已保留本机记录，请导出便笺后核对。');
  if(value!==undefined)out[key]=value;
 }return out;
}
/** Preserve concurrent changes to different words; never resolve note conflicts by overwriting. */
export function mergeWorkspaceSnapshots(base:Snapshot|undefined,local:Snapshot,remote:Snapshot):Snapshot{
 const rowMap=(s:Snapshot|undefined)=>Object.fromEntries((s?.rows??[]).filter(r=>!isRatingRow(r.key)).map(r=>[r.key,r]));
 // Row revisions/timestamps can differ even when the note content is identical.
 const baseRows=rowMap(base),localRows=rowMap(local),remoteRows=rowMap(remote);
 for(const key of Object.keys(baseRows)){if(localRows[key]?.value===baseRows[key].value)localRows[key]=baseRows[key];if(remoteRows[key]?.value===baseRows[key].value)remoteRows[key]=baseRows[key];}
 for(const key of Object.keys(localRows))if(localRows[key]?.value===remoteRows[key]?.value)localRows[key]=remoteRows[key];
 const snapshots=[base,local,remote];
 // Answers are append-only daily facts: independent words/days are a union,
 // and a missed answer remains recorded even if another device reports green.
 // Malformed keys or values retain the ordinary conflict protection below.
 const planKeys=new Set([...new Set(snapshots.flatMap(s=>Object.keys(s?.storage??{})))].filter(key=>isPlanAnswerKey(key)&&snapshots.every(s=>!s||!Object.hasOwn(s.storage,key)||planAnswer(s.storage[key])!==undefined)));
 const plainStorage=(s:Snapshot|undefined)=>Object.fromEntries(Object.entries(s?.storage??{}).filter(([k])=>!isRatingStorage(k)&&!planKeys.has(k)));
 const storage=mergeMap(plainStorage(base),plainStorage(local),plainStorage(remote),key=>key==='lemnota-username'||key==='community-theme'||/^gre-.*(?:selection|lists|sets|categories|range|last-quick-type|study-list|auto-speak|source-order)/.test(key));
 for(const key of [...planKeys].sort()){
  const answers=snapshots.map(s=>planAnswer(s?.storage[key])).filter((value):value is PlanAnswer=>value!==undefined);
  if(answers.length)storage[key]=JSON.stringify(answers.reduce((lowest,value)=>planAnswerRank[value]<planAnswerRank[lowest]?value:lowest));
 }
 for(const [source,snapshot] of [['base',base],['local',local],['remote',remote]] as const)if(snapshot)for(const [key,raw] of Object.entries(snapshot.storage))if(isRatingStorage(key)&&key!==ratingClockKey&&!validRatings(parse(raw)))storage[`gre-rating-recovery:${key}:${source}`]=raw;
 const rows=Object.values(mergeMap(baseRows,localRows,remoteRows)),allClocks:Clocks={};
 for(const module of ratingModules){
  const b=moduleValues(base,module),l=moduleValues(local,module),r=moduleValues(remote,module),ratings:Ratings={},times:Record<string,Stamp>={};
  for(const id of new Set([...Object.keys(b),...Object.keys(l),...Object.keys(r)])){
   const value=choose(b[id],l[id],r[id],module,id);if(!value)continue;ratings[id]=value.rating;if(value.at)times[id]={rating:value.rating,at:value.at};
   const previous=r[id]?.row??l[id]?.row;rows.push(previous&&parse(previous.value)===value.rating?{...previous}:{key:`quick-rating:${module}:${id}`,value:JSON.stringify(value.rating),revision:(previous?.revision??0)+1,updated_at:new Date(value.at||0).toISOString()});
  }
  if(Object.keys(ratings).length||[base,local,remote].some(s=>s&&storageKeys[module] in s.storage))storage[storageKeys[module]]=JSON.stringify(ratings);
  if([base,local,remote].some(s=>s&&`gre-rating-cloud-pending:${module}` in s.storage))storage[`gre-rating-cloud-pending:${module}`]='{}';
  if(Object.keys(times).length)allClocks[module]=times;
 }
 if(Object.keys(allClocks).length)storage[ratingClockKey]=JSON.stringify(allClocks);
 return {version:1,rows,storage};
}
/** Import ratings only. All existing notes, settings and test history stay in place. */
export function mergeImportedRatings(current:Snapshot,incoming:Snapshot):Snapshot{
 const ratingsOnly={version:1 as const,rows:[...current.rows.filter(r=>!isRatingRow(r.key)),...incoming.rows.filter(r=>isRatingRow(r.key))],storage:{...Object.fromEntries(Object.entries(current.storage).filter(([k])=>!isRatingStorage(k))),...Object.fromEntries(Object.entries(incoming.storage).filter(([k])=>isRatingStorage(k)))}};
 return mergeWorkspaceSnapshots(undefined,current,ratingsOnly);
}
/** Historical notebook imports only fill unmarked words; they never recolor an existing mark. */
export function mergeMissingImportedRatings(current:Snapshot,incoming:Snapshot):{payload:Snapshot;added:number}{
 const rows=[...current.rows],storage={...current.storage};let added=0;
 for(const module of ratingModules){
  const present=moduleValues(current,module),other=moduleValues(incoming,module),missing=Object.entries(other).filter(([id])=>!Object.hasOwn(present,id));
  if(!missing.length)continue;
  const values:Ratings=Object.fromEntries(Object.entries(present).map(([id,v])=>[id,v.rating]));
  for(const [id,value] of missing){
   const key=`quick-rating:${module}:${id}`;
   if(rows.some(r=>r.key===key))continue; // Preserve even an unreadable current row for recovery.
   values[id]=value.rating;rows.push(value.row??{key,value:JSON.stringify(value.rating),revision:1,updated_at:new Date(value.at||0).toISOString()});added++;
  }
  storage[storageKeys[module]]=JSON.stringify(values);
 }
 return {payload:{version:1,rows,storage},added};
}
