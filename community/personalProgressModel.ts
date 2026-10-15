export type Level='unknown'|'fuzzy'|'familiar';
export type Catalog={id:string;name:string;module:string;storageKey:string;entries:{id:string;words:string[]}[]};
type Snapshot={rows:{key:string;value:string}[];storage:Record<string,string>};
export const TESTED_WORDS='lemnota-tested-words-v1';
export const COMPLETIONS='lemnota-completed-practices-v1';
const rank:Record<Level,number>={unknown:0,fuzzy:1,familiar:2};
const norm=(word:string)=>word.trim().toLowerCase().replace(/\s+/g,' ');
const parsed=(s:string|undefined)=>{try{return JSON.parse(s??'null');}catch{return null;}};
const level=(v:unknown):v is Level=>v==='unknown'||v==='fuzzy'||v==='familiar';
function put(map:Map<string,Level>,word:string,value:Level){const key=norm(word);if(key&&(!map.has(key)||rank[value]<rank[map.get(key)!]))map.set(key,value);}
export function summarizeProgress(snapshot:Snapshot,catalogs:Catalog[]){
 const all=new Map<string,Level>(),studiedWords=new Set<string>(),completed=new Set<string>(),rows=new Map(snapshot.rows.map(r=>[r.key,r.value]));
 const ledger=parsed(snapshot.storage[COMPLETIONS]);if(ledger&&typeof ledger==='object')for(const [id,v] of Object.entries(ledger))if(id&&v&&typeof (v as any).module==='string'&&typeof (v as any).completedAt==='string')completed.add(id);
 const tested=parsed(snapshot.storage[TESTED_WORDS]);
 const groups=catalogs.map(c=>{const ratings:Record<string,unknown>={};for(const row of snapshot.rows)if(row.key.startsWith(`quick-rating:${c.module}:`))ratings[row.key.slice(`quick-rating:${c.module}:`.length)]=parsed(row.value);const local=parsed(snapshot.storage[c.storageKey]);if(local&&typeof local==='object'&&!Array.isArray(local))Object.assign(ratings,local);
 const states=new Map<string,Level>(),words=new Set<string>();for(const entry of c.entries){const values=['','word','equivalents','meaning','left','right'].map(d=>ratings[entry.id+(d?':'+d:'')]).filter(level);for(const word of entry.words){const normalized=norm(word);if(!normalized)continue;words.add(normalized);for(const value of values)put(states,word,value);}}
 if(c.id==='notebook')for(const row of snapshot.rows)if(row.key.startsWith('vocab-notebook:')){const data=parsed(row.value);for(const w of Array.isArray(data?.words)?data.words:[]){if(typeof w.word!=='string')continue;words.add(norm(w.word));if(level(w.rating))put(states,w.word,w.rating);}}
 for(const [word,value] of states)put(all,word,value);
 const studied=new Set(states.keys());
const legacyRun=parsed(snapshot.storage['lemnota-practice-'+c.id]);if(legacyRun?.results&&typeof legacyRun.results==='object')for(const id of Object.keys(legacyRun.results)){const exact=c.entries.find(e=>e.id===id);if(exact?.words[0])studied.add(norm(exact.words[0]));else if(c.id==='bb'){const split=id.lastIndexOf(':'),entry=c.entries.find(e=>e.id===id.slice(0,split));const word=entry?.words[Number(id.slice(split+1))];if(word)studied.add(norm(word));}}
if(c.id==='a-plus'){const saved=parsed(rows.get('a-plus-test-session:v1'));if(saved?.progress)for(const [id,v] of Object.entries(saved.progress))if((v as any)?.attempts>0){const word=c.entries.find(e=>e.id===id)?.words[0];if(word)studied.add(norm(word));}}
if(tested&&typeof tested==='object'&&tested[c.id]&&typeof tested[c.id]==='object')for(const word of Object.keys(tested[c.id]))if(tested[c.id][word]===true&&words.has(norm(word)))studied.add(norm(word));
 for(const word of studied)studiedWords.add(word);
 const count=(state:Level)=>[...states.values()].filter(v=>v===state).length;
 return {id:c.id,name:c.name,total:words.size,studied:studied.size,familiar:count('familiar'),fuzzy:count('fuzzy'),unknown:count('unknown'),unrated:words.size-states.size};});
 for(const deck of ['words','a-plus','bb']){const run=parsed(snapshot.storage['lemnota-practice-'+deck]);if(run&&run.turn>0&&Array.isArray(run.queue)&&run.queue.length===0&&run.results&&Object.values(run.results).every((r:any)=>r?.done===true))completed.add(run.sessionId??`legacy-${deck}-${run.turn}-${Object.keys(run.results).sort().join(',')}`);}
 const aplus=parsed(rows.get('a-plus-test-session:v1'));if(aplus?.stage==='complete'&&typeof aplus.id==='string')completed.add('a-plus-full:'+aplus.id);
 return {studied:studiedWords.size,familiar:[...all.values()].filter(v=>v==='familiar').length,tests:completed.size,top:groups.filter(g=>g.studied>0).sort((a,b)=>b.studied-a.studied||b.familiar-a.familiar||a.id.localeCompare(b.id)).slice(0,3)};
}
