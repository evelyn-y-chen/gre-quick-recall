import {validNotebookBatch,type NotebookBatch,type NotebookRating} from "./notebookModel";
import {notebookFrequencyKey} from "./notebookFrequencyModel";
import type {NotebookPracticeTerm} from "../community/Practice";

function fingerprint(text:string) {
  let a=2166136261,b=5381;
  for (const c of text) { a=Math.imul(a^c.charCodeAt(0),16777619); b=Math.imul(b,33)^c.charCodeAt(0); }
  return (a>>>0).toString(16)+(b>>>0).toString(16);
}
/** Provenance headings remain in origin, rather than becoming quiz answers. */
export function notebookQuizMeaning(raw:string) {
  return [...new Set(raw.split(/\r?\n/).map(line=>line.trim()).filter(line=>line&&!/^【.*】$/.test(line)&&! /^(批注说明|出处|来源)\s*[:：]/.test(line)).map(line=>line.replace(/^释义\s*[:：]\s*/,"")))].join("；");
}
export function buildNotebookPractice(batches:unknown[]) {
  const selected=new Map<string,NotebookBatch>();
  for (const batch of batches) if (validNotebookBatch(batch,false)) selected.set(batch.id,batch);
  const words=new Map<string,{word:string;meanings:Set<string>;notes:Set<string>;origins:Set<string>;rating?:NotebookRating}>();
  let total=0,missingMeanings=0;
  const rank={unknown:0,fuzzy:1,familiar:2};
  for (const batch of [...selected.values()].sort((a,b)=>a.id.localeCompare(b.id))) for (const item of batch.words) {
    const key=notebookFrequencyKey(item.word); if (!key) continue;
    total++;
    const meaning=notebookQuizMeaning(item.meaning);
    if (!meaning) { missingMeanings++; continue; }
    let entry=words.get(key);
    if (!entry) { entry={word:item.word.trim(),meanings:new Set(),notes:new Set(),origins:new Set()}; words.set(key,entry); }
    entry.meanings.add(meaning);
    if (item.note.trim()) entry.notes.add(item.note.trim());
    entry.origins.add([batch.source,batch.date,item.origin].filter(Boolean).join(" · "));
    if (item.rating && (!entry.rating || rank[item.rating]<rank[entry.rating])) entry.rating=item.rating;
  }
  const terms:NotebookPracticeTerm[]=[...words].map(([key,item])=>({id:"notebook-"+fingerprint(key),word:item.word,meaning:[...item.meanings].join("；"),note:[...item.notes].join("\n\n"),origin:[...item.origins].join("\n"),rating:item.rating,list:1}));
  const content=[...terms].sort((a,b)=>a.id.localeCompare(b.id)).map(({id,word,meaning,note,origin})=>({id,word,meaning,note,origin}));
  return {id:fingerprint(JSON.stringify({collections:[...selected.keys()].sort(),terms:content})),source:[...selected.values()].map(batch=>batch.source).join(" / "),terms,collections:selected.size,total,missingMeanings,duplicates:total-missingMeanings-terms.length};
}
