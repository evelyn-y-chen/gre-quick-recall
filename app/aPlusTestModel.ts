import data from "./aPlusEquivalents.json";
import synonymPairs from "./equivalents.json";
export type Entry = typeof data[number];
export type TestMode = "single" | "multiple";
export type Config = {lists:number[];order:"sequential"|"random";mode:TestMode};
export type Option = {word:string;meaning:string;correct:boolean};
export type Question = {id:string;entryId:string;meanings:string[];options:Option[];early:boolean};
export type Progress = {attempts:number;correct:number;hadError:boolean;done:boolean;due:number;meaningErrors:number;missed:Record<string,number>;extra:Record<string,number>;retryWords?:string[]};
export type Session = {version:1;id:string;config:Config;order:string[];turn:number;progress:Record<string,Progress>;question:Question|null;stage:"meaning"|"synonyms"|"feedback"|"complete";meaningChoice:string|null;synonymUncertain?:boolean;synonymSkipped?:boolean;selected:string[]};
export const entries:Entry[]=data;
export const byId = new Map(entries.map(e=>[e.id,e]));
const key=(s:string)=>s.trim().replace(/\s+/g," ").toLowerCase();
export function equivalents(entry:Entry):string[] {
 return [...new Set(entry.equivalents.flatMap(w=>({"lackluster stale":["lackluster","stale"],"hypocrisy disinformation":["hypocrisy","disinformation"],"turbid confused":["turbid","confused"]} as Record<string,string[]>)[w]??[w.replace(/\s*（.*?）/g,"").trim()]).map(key))].filter(w=>w!==key(entry.word));
}
const terms=(e:Entry)=>[key(e.word),...equivalents(e)];
const groups=new Map<string,Entry[]>();
for(const e of entries)for(const word of terms(e))groups.set(word,[...(groups.get(word)??[]),e]);
const pool=[...new Set(entries.flatMap(e=>equivalents(e)))];
export function shuffle<T>(items:T[],random:()=>number=Math.random):T[]{const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
const senseParts=(meaning:string)=>meaning.replace(/[a-zA-Z]+\./g,"").replace(/[（(][^）)]*[）)]/g,"").split(/[\/、，,；;]/).map(x=>x.trim().replace(/[的地]$/g,"")).filter(x=>x.length>=2);
const nearbySense=(a:string,b:string)=>senseParts(a).some(x=>senseParts(b).some(y=>x===y));
// Cross-deck links exclude distractors without changing the chosen A+ group's answers.
const synonymLinks=new Map<string,Set<string>>();
function linkSynonyms(left:string,right:string){
 const a=key(left),b=key(right);if(!synonymLinks.has(a))synonymLinks.set(a,new Set());if(!synonymLinks.has(b))synonymLinks.set(b,new Set());synonymLinks.get(a)!.add(b);synonymLinks.get(b)!.add(a);
}
for(const e of entries)for(const word of equivalents(e))linkSynonyms(e.word,word);
for(const pair of synonymPairs)linkSynonyms(pair.left,pair.right);
linkSynonyms("lambast","lambaste");
function connected(seed:Entry):Set<Entry>{
 const found=new Set<Entry>(),seen=new Set<string>(),queue=terms(seed);
 for(let i=0;i<queue.length;i++){const word=queue[i];if(seen.has(word))continue;seen.add(word);for(const g of groups.get(word)??[])found.add(g);for(const related of synonymLinks.get(word)??[])if(!seen.has(related))queue.push(related);}
 return found;
}
const safeGroups=new Map<string,Entry[]>();
export function distractorGroups(entryId:string):Entry[]{
 const cached=safeGroups.get(entryId);if(cached)return cached;
 const e=byId.get(entryId)!,related=connected(e),blocked=new Set([...related].flatMap(terms));
 const safe=entries.filter(x=>!related.has(x)&&!terms(x).some(w=>blocked.has(w))&&![...related].some(g=>nearbySense(g.meaning,x.meaning)));
 const unsafeWords=new Set(entries.filter(x=>!safe.includes(x)).flatMap(terms));
 const result=safe.filter(x=>equivalents(x).some(w=>!unsafeWords.has(w)));
 safeGroups.set(entryId,result);return result;
}
export function makeQuestion(entryId:string,mode:TestMode,early=false,random:()=>number=Math.random,retryWords:string[]=[]):Question {
 const e=byId.get(entryId)!,positives=equivalents(e),safe=distractorGroups(entryId);
 const safeSet=new Set(safe);
 const allowed=(w:string)=>(groups.get(w)??[]).every(g=>safeSet.has(g));
 const poolSafe=pool.filter(allowed);
 const required=[...new Set(retryWords)];
 const requiredPositives=required.filter(w=>positives.includes(w)).slice(0,mode==="single"?1:5);
 const requiredNegatives=required.filter(w=>poolSafe.includes(w)).slice(0,6-Math.max(1,requiredPositives.length));
 const randomCount=mode==="single"?1:1+Math.floor(random()*Math.min(5,positives.length));
 const count=Math.min(6-requiredNegatives.length,Math.max(requiredPositives.length,randomCount));
 const chosen=[...requiredPositives,...shuffle(positives.filter(w=>!requiredPositives.includes(w)),random).slice(0,count-requiredPositives.length)],negatives=[...requiredNegatives];
 if(6-count-negatives.length>=2&&random()<.7){
  const group=shuffle(safe,random).find(g=>equivalents(g).filter(w=>allowed(w)&&!negatives.includes(w)).length>=2);
  if(group)negatives.push(...shuffle(equivalents(group).filter(w=>allowed(w)&&!negatives.includes(w)),random).slice(0,2));
 }
 for(const word of shuffle(poolSafe,random)){if(negatives.length>=6-count)break;if(!negatives.includes(word))negatives.push(word);}
 const gloss=(w:string)=>[...new Set((groups.get(w)??[]).map(g=>g.meaning))].join("；");
 const options=shuffle([...chosen.map(word=>({word,meaning:gloss(word),correct:true})),...negatives.map(word=>({word,meaning:gloss(word),correct:false}))],random);
 const meanings=shuffle([e.meaning,...shuffle([...new Set(safe.map(x=>x.meaning))],random).slice(0,3)],random);
 if(options.length!==6||meanings.length!==4)throw Error("无法生成足够的题目选项");
 return {id:crypto.randomUUID(),entryId,meanings,options,early};
}
export function createSession(config:Config,random:()=>number=Math.random,onlyIds?:string[]):Session {
 const scope=entries.filter(e=>config.lists.includes(e.list)&&(!onlyIds||onlyIds.includes(e.id)));
 const order=(config.order==="random"?shuffle(scope,random):scope).map(e=>e.id);
 if(!order.length)throw Error("请至少选择一个 List");
 const progress=Object.fromEntries(order.map(id=>[id,{attempts:0,correct:0,hadError:false,done:false,due:0,meaningErrors:0,missed:{},extra:{}}]));
 return {version:1,id:crypto.randomUUID(),config,order,turn:0,progress,question:makeQuestion(order[0],config.mode,false,random),stage:"meaning",meaningChoice:null,synonymUncertain:false,synonymSkipped:false,selected:[]};
}
export function chooseMeaning(s:Session,choice:string):Session {
 if(s.stage!=="meaning"||!s.question||(choice!=="不确定"&&!s.question.meanings.includes(choice)))return s;
 const e=byId.get(s.question.entryId)!;
 if(choice===e.meaning)return {...s,meaningChoice:choice,stage:"synonyms",synonymSkipped:false};
 const p=s.progress[e.id],turn=s.turn+1;
 return {...s,meaningChoice:choice,stage:"feedback",synonymSkipped:true,synonymUncertain:false,selected:[],turn,progress:{...s.progress,[e.id]:{...p,attempts:p.attempts+1,correct:0,hadError:true,done:false,due:turn+5,meaningErrors:p.meaningErrors+1}}};
}
export function gradeQuestion(s:Session,selected:string[],uncertain=false):Session {
 if(s.stage!=="synonyms"||!s.question)return s;
 const q=s.question,e=byId.get(q.entryId)!,p=s.progress[e.id];
 const picked=uncertain?[]:[...new Set(selected)].filter(w=>q.options.some(o=>o.word===w));
 if(!uncertain&&(!picked.length||(s.config.mode==="single"&&picked.length!==1)))return s;
 const missed=q.options.filter(o=>o.correct&&!picked.includes(o.word));
 const extra=q.options.filter(o=>!o.correct&&picked.includes(o.word));
 const meaningOK=s.meaningChoice===e.meaning;
 const allOK=meaningOK&&!missed.length&&!extra.length;
 const hadError=p.hadError||!allOK,correct=allOK?p.correct+1:0,turn=s.turn+1;
 const next:Progress={...p,attempts:p.attempts+1,correct,hadError,done:(!hadError&&allOK)||(hadError&&correct>=2),due:turn+5,meaningErrors:p.meaningErrors+Number(!meaningOK),missed:{...p.missed},extra:{...p.extra},retryWords:[...missed,...extra].map(o=>o.word)};
 for(const o of missed)next.missed[o.word]=(next.missed[o.word]??0)+1;
 for(const o of extra)next.extra[o.word]=(next.extra[o.word]??0)+1;
 return {...s,turn,selected:picked,synonymUncertain:uncertain,stage:"feedback",progress:{...s.progress,[e.id]:next}};
}
export function advanceSession(s:Session,random:()=>number=Math.random):Session {
 if(s.stage!=="feedback")return s;
 const left=s.order.filter(id=>!s.progress[id].done);
 if(!left.length)return {...s,question:null,stage:"complete"};
 const reviews=left.filter(id=>s.progress[id].attempts>0&&s.progress[id].due<=s.turn).sort((a,b)=>s.progress[a].due-s.progress[b].due);
 const fresh=left.find(id=>s.progress[id].attempts===0);
 const id=reviews[0]??fresh??[...left].sort((a,b)=>s.progress[a].due-s.progress[b].due)[0];
 const early=s.progress[id].attempts>0&&s.progress[id].due>s.turn;
 return {...s,question:makeQuestion(id,s.config.mode,early,random,s.progress[id].retryWords??[...Object.keys(s.progress[id].missed),...Object.keys(s.progress[id].extra)].slice(0,6)),stage:"meaning",meaningChoice:null,synonymUncertain:false,selected:[]};
}
export function validSession(value:unknown):value is Session {
 if(!value||typeof value!=="object")return false;
 const s=value as Session;
 const integer=(n:unknown,max=1000000)=>Number.isInteger(n)&&Number(n)>=0&&Number(n)<=max;
 const counts=(v:unknown)=>!!v&&typeof v==="object"&&!Array.isArray(v)&&Object.entries(v).length<=3000&&Object.entries(v).every(([k,n])=>k.length<=300&&integer(n));
 if(s.version!==1||typeof s.id!=="string"||s.id.length>80||!s.config||!["single","multiple"].includes(s.config.mode)||!["sequential","random"].includes(s.config.order)||!Array.isArray(s.config.lists)||!s.config.lists.length||s.config.lists.length>80||!s.config.lists.every(n=>integer(n,80)&&n>=1))return false;
 if(!Array.isArray(s.order)||!s.order.length||s.order.length>800||new Set(s.order).size!==s.order.length||!s.order.every(id=>byId.has(id))||!integer(s.turn)||!s.progress||typeof s.progress!=="object")return false;
 if(!s.order.every(id=>{const p=s.progress[id];return p&&integer(p.attempts)&&integer(p.correct)&&integer(p.due)&&integer(p.meaningErrors)&&typeof p.done==="boolean"&&typeof p.hadError==="boolean"&&counts(p.missed)&&counts(p.extra)&&(p.retryWords===undefined||Array.isArray(p.retryWords)&&p.retryWords.length<=6&&p.retryWords.every(w=>typeof w==="string"&&w.length<=300));}))return false;
 if(!["meaning","synonyms","feedback","complete"].includes(s.stage)||!(s.meaningChoice===null||typeof s.meaningChoice==="string"&&s.meaningChoice.length<4000)||!Array.isArray(s.selected)||s.selected.length>6||!s.selected.every(w=>typeof w==="string"&&w.length<=300))return false;
 if(s.synonymSkipped!==undefined&&typeof s.synonymSkipped!=="boolean")return false;
 if(s.synonymUncertain!==undefined&&typeof s.synonymUncertain!=="boolean")return false;
 if(s.stage==="complete")return s.question===null;
 const q=s.question;
 return !!q&&typeof q.id==="string"&&q.id.length<=80&&s.order.includes(q.entryId)&&typeof q.early==="boolean"&&Array.isArray(q.meanings)&&q.meanings.length===4&&q.meanings.every(m=>typeof m==="string"&&m.length<4000)&&Array.isArray(q.options)&&q.options.length===6&&q.options.every(o=>o&&typeof o.word==="string"&&o.word.length<=300&&typeof o.meaning==="string"&&o.meaning.length<10000&&typeof o.correct==="boolean");
}

export function refreshAmbiguousQuestion(session:Session):Session{
 if(session.stage==="synonyms"&&session.question&&session.meaningChoice!==byId.get(session.question.entryId)!.meaning)return chooseMeaning({...session,stage:"meaning"},session.meaningChoice??"不确定");
 if(!session.question||!["meaning","synonyms"].includes(session.stage))return session;
 const safe=new Set(distractorGroups(session.question.entryId));
 if(!session.question.options.some(option=>!option.correct&&(groups.get(option.word)??[]).some(group=>!safe.has(group))))return session;
 return {...session,question:makeQuestion(session.question.entryId,session.config.mode,session.question.early,Math.random,session.progress[session.question.entryId].retryWords),stage:"meaning",meaningChoice:null,selected:[],synonymUncertain:false};
}
