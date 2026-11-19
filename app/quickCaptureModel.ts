import {mergeNotebookCandidates,validNotebookBatch,type NotebookBatch,type NotebookDraft} from './notebookModel';

export type CaptureCard={id:string;word:string;meaning:string;origin:string;target:string;source:string;date:string;collectionId:string};
export type CaptureDraft={cards:CaptureCard[];active:string;lastTarget:string};
export type CaptureInput={field:'word'|'meaning';text:string};
export const captureDate=()=>{const d=new Date(),pad=(n:number)=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;};
export function emptyCapture():CaptureDraft{return {cards:[],active:'',lastTarget:''};}
export function newCaptureCard(target='',newId=()=>crypto.randomUUID()):CaptureCard{return {id:newId(),word:'',meaning:'',origin:'',target,source:'',date:captureDate(),collectionId:newId()};}
export function readCaptureDraft(raw:string|null):CaptureDraft{
 if(!raw)return emptyCapture();
 const value=JSON.parse(raw) as CaptureDraft;
 if(!value||!Array.isArray(value.cards)||typeof value.active!=='string'||typeof value.lastTarget!=='string'||value.cards.some(c=>!c||['id','word','meaning','origin','target','source','date','collectionId'].some(k=>typeof c[k as keyof CaptureCard]!=='string')))throw Error('收词草稿暂时无法读取，请先保留本页内容。');
 return value;
}
export function captureInput(hash:string):CaptureInput|null{
 const params=new URLSearchParams(hash.replace(/^#/,'')),field=params.get('capture');
 if(field!=='word'&&field!=='meaning')return null;
 const text=(params.get('text')??'').trim();
 if(text.length>(field==='word'?300:4000))throw Error(field==='word'?'请只复制单词或短语，最多 300 字。':'释义最多 4000 字，请精简后再收录。');
 return {field,text};
}
export function receiveCapture(draft:CaptureDraft,input:CaptureInput,newId=()=>crypto.randomUUID()):CaptureDraft{
 if(input.text.length>(input.field==='word'?300:4000))throw Error(input.field==='word'?'单词或短语最多 300 字。':'释义最多 4000 字。');
 let current=draft.cards.find(c=>c.id===draft.active),cards=draft.cards;
 if(!current||input.field==='word'&&!!input.text&&current.word.trim()&&current.word.trim().toLowerCase()!==input.text.toLowerCase()){
  current=newCaptureCard(draft.lastTarget,newId);cards=[...cards,current];
 }
 const meaning=input.field==='meaning'?[...new Set([current.meaning.trim(),input.text].filter(Boolean))].join('\n'):current.meaning;
 if(meaning.length>4000)throw Error('合并后的释义超过 4000 字，请先精简当前释义。');
 const changed={...current,...(input.field==='word'&&input.text?{word:input.text}:{meaning})};
 return {...draft,active:current.id,cards:cards.map(c=>c.id===current!.id?changed:c)};
}
export function captureIntoBatch(card:CaptureCard,saved:NotebookDraft|null,newId=()=>crypto.randomUUID()):NotebookDraft{
 if(!card.word.trim())throw Error('请先填写英文单词。');
 if(card.target&&!saved)throw Error('这次收集未能读取，请重新选择收录位置。');
 const batch:NotebookBatch=saved?.batch??{id:card.collectionId,source:card.source.trim()||`${card.date} 随手收词`,date:card.date,words:[]};
 const words=mergeNotebookCandidates(batch.words,[{word:card.word.trim(),meaning:card.meaning.trim(),origin:card.origin.trim(),note:''}],newId);
 const next={...batch,words:words.map(w=>w.word.trim().toLowerCase()===card.word.trim().toLowerCase()&&w.meaning!==batch.words.find(old=>old.id===w.id)?.meaning?{...w,briefMeaning:undefined}:w)};
 if(!validNotebookBatch(next))throw Error('请检查单词和释义长度；每次收集最多 1000 个词。');
 return {batch:next,revision:saved?.revision??0};
}
