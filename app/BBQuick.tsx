import {studyStorage} from "../community/storage";
"use client";
import RevealControls from "./RevealControls";
import {useEffect,useMemo,useRef,useState} from "react";
import data from "./bbEquivalents.json";
import SharedWordMemory,{useWordMemory} from "./SharedWordMemory";
import {wordMemoryKey} from "./wordMemoryModel";
import {bbOccurrences} from "./bbModel";
import RatingCloudSync from "./RatingCloudSync";
import {validRatings,type Ratings,type Rating} from "./ratingSyncModel";
import {restoreBBRange,type BBRange} from "./quickRangeModel";
const volumes={上:"上 · 超超超高频",中:"中 · 超超高频",下:"下 · 超高频"};
const colors=[{value:"unknown",label:"不认识",color:"red"},{value:"fuzzy",label:"模糊",color:"yellow"},{value:"familiar",label:"熟悉",color:"green"}] as const;
const key="gre-bb-ratings-v1";
const rangeKey="gre-bb-selection-v1";
const occurrences=bbOccurrences(data);
export default function BBQuick({pronounce}:{pronounce:(word:string)=>void}){
 const [ratings,setRatings]=useState<Ratings>({}),[ready,setReady]=useState(false),[query,setQuery]=useState(""),[filter,setFilter]=useState("全部"),[snapshot,setSnapshot]=useState<Ratings>({}),[revealed,setRevealed]=useState<string[]>([]),[activeId,setActiveId]=useState(""),[order,setOrder]=useState<string[]|null>(null);
 const [range,setRange]=useState<{value:BBRange;ready:boolean}>({value:{volume:"全部",lists:[1]},ready:false});
 const {volume,lists}=range.value;
 const [equivalents,setEquivalents]=useState<string[]>([]);
 const [notes,setNotes]=useState<string[]>([]);
 const refs=useRef<Record<string,HTMLElement|null>>({}),scroll=useRef(false),memory=useWordMemory();
 useEffect(()=>{try{const stored=JSON.parse(studyStorage.getItem(key)??"{}");if(validRatings(stored)){setRatings(stored);setSnapshot(stored);}}catch{}setReady(true);},[]);
 useEffect(()=>{if(ready)try{studyStorage.setItem(key,JSON.stringify(ratings));}catch{}},[ratings,ready]);
 useEffect(()=>{const timer=window.setTimeout(()=>{let value:BBRange={volume:"全部",lists:[1]};try{value=restoreBBRange(studyStorage.getItem(rangeKey),data);}catch{}setRange(current=>current.ready?current:{value,ready:true});},0);return()=>window.clearTimeout(timer);},[]);
 useEffect(()=>{if(range.ready)try{studyStorage.setItem(rangeKey,JSON.stringify(range.value));}catch{}},[range]);
 function changeRange(value:BBRange){setRange({value,ready:true});}
 const ordered=useMemo(()=>order?order.map(id=>data.find(e=>e.id===id)!):data,[order]);
 const q=query.trim().toLowerCase();
 const scoped=ordered.filter(e=>(volume==="全部"||e.volume===volume)&&lists.includes(e.list));
 const entries=scoped.filter(e=>(filter==="全部"||(snapshot[e.id]??"unrated")===filter)&&(!q||[e.comparison,...e.words.flatMap(w=>[w.word,w.meaning,w.memory,memory?.drafts[wordMemoryKey(w.word)]?.text??memory?.records[wordMemoryKey(w.word)]?.text??""])].join(" ").toLowerCase().includes(q)));
 const current=entries.find(e=>e.id===activeId)??entries[0];
 function reveal(id:string){setActiveId(id);setRevealed(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);}
 function toggleEquivalent(id:string){setActiveId(id);setEquivalents(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);}
 function rate(id:string,rating:Rating){setActiveId(id);setEquivalents(s=>s.includes(id)?s:[...s,id]);setRatings(s=>({...s,[id]:rating}));setRevealed(s=>s.includes(id)?s:[...s,id]);}
 function shuffle(){const ids=data.map(e=>e.id);for(let i=ids.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}setOrder(ids);setActiveId("");}
 useEffect(()=>{if(scroll.current&&current){refs.current[current.id]?.scrollIntoView({block:"center",behavior:"smooth"});scroll.current=false;}},[current?.id]);
 useEffect(()=>{function keydown(e:KeyboardEvent){const target=e.target as HTMLElement|null;if(!current||e.isComposing||e.metaKey||e.ctrlKey||e.altKey||target?.closest("input,textarea,select,summary,[contenteditable='true']"))return;if(target?.closest("button,a")&&(e.key==="Enter"||e.code==="Space"))return;if(e.repeat&&!e.key.startsWith("Arrow"))return;
 if(["ArrowUp","ArrowLeft","ArrowDown","ArrowRight"].includes(e.key)){e.preventDefault();const offset=["ArrowUp","ArrowLeft"].includes(e.key)?-1:1;const next=entries[Math.max(0,Math.min(entries.length-1,entries.findIndex(x=>x.id===current.id)+offset))];scroll.current=true;setActiveId(next.id);}
 else if(e.key==="Enter"){e.preventDefault();if(!equivalents.includes(current.id))toggleEquivalent(current.id);else reveal(current.id);}else if(e.code==="Space"){e.preventDefault();pronounce(current.words[0].word);}else if(["1","2","3"].includes(e.key)){e.preventDefault();rate(current.id,colors[+e.key-1].value);}}
 window.addEventListener("keydown",keydown);return()=>window.removeEventListener("keydown",keydown);});
 const availableLists=[...new Set(data.filter(e=>volume==="全部"||e.volume===volume).map(e=>e.list))];
 return <div className="bbQuick">
  <div className="libraryHead"><div><p className="eyebrow">BB SENTENCE EQUIVALENCE</p><h1>BB六选二</h1><p className="quickIntro">上、中、下三册，共 {data.length.toLocaleString()} 组、{data.length*2} 个词条。保留原顺序和重复词条；释义、同组说明与记忆法来自原文。</p></div><div className="libraryActions">
   <RevealControls total={entries.length} shown={entries.filter(e=>equivalents.includes(e.id)).length} showLabel="显示当前等价词" hideLabel="隐藏全部等价词" onShow={()=>setEquivalents(entries.map(e=>e.id))} onHide={()=>setEquivalents([])}/>
   <RevealControls total={entries.length} shown={entries.filter(e=>revealed.includes(e.id)).length} onShow={()=>setRevealed(entries.map(e=>e.id))} onHide={()=>setRevealed([])}/>
   <RevealControls total={entries.length} shown={entries.filter(e=>notes.includes(e.id)).length} showLabel="显示当前记忆方法" hideLabel="隐藏全部记忆方法" onShow={()=>setNotes(entries.map(e=>e.id))} onHide={()=>setNotes([])}/>
  </div></div>
  {ready&&<RatingCloudSync module="bb" ratings={ratings} onLoad={r=>{setRatings(r);setSnapshot(r);}}/>}
  <div className="quickFilters"><label>分册 <select aria-label="BB 分册" value={volume} onChange={e=>{const v=e.target.value;changeRange({volume:v,lists:[...new Set(data.filter(x=>v==="全部"||x.volume===v).map(x=>x.list))]});setActiveId("");setRevealed([]);}}><option>全部</option>{Object.entries(volumes).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label><input className="search" aria-label="搜索 BB六选二" placeholder="搜索当前范围的单词、释义或笔记…" value={query} onChange={e=>setQuery(e.target.value)}/>
  <details className="rangePicker categoryPicker"><summary>选择范围 · {lists.length} 个 List</summary><div className="rangePickerPanel categoryPickerPanel"><button onClick={()=>changeRange({volume,lists:availableLists})}>全选</button><button onClick={()=>changeRange({volume,lists:[]})}>全不选</button>{availableLists.map(n=><button key={n} aria-pressed={lists.includes(n)} className={lists.includes(n)?"active":""} onClick={()=>{changeRange({volume,lists:lists.includes(n)?lists.filter(x=>x!==n):[...lists,n]});setActiveId("");}}>List {n} · {data.filter(x=>x.list===n).length} 组</button>)}</div></details></div>
  <div className="quickStats">{[{value:"全部",label:"全部",color:""},...colors,{value:"unrated",label:"未标记",color:""}].map(r=><button key={r.value} className={`${r.color} ${filter===r.value?"active":""}`} aria-pressed={filter===r.value} onClick={()=>{setFilter(r.value);setSnapshot({...ratings});setActiveId("");}}>{r.label} <strong>{scoped.filter(e=>r.value==="全部"||(ratings[e.id]??"unrated")===r.value).length}</strong></button>)}</div>
  <div className="shuffleControls"><button onClick={()=>order?setOrder(null):shuffle()}>{order?"恢复原顺序":"开启乱序"}</button>{order&&<button onClick={shuffle}>再打乱一次</button>}</div>
  <div className="shortcutBar"><span><kbd>↑</kbd><kbd>↓</kbd> 上 / 下一组</span><span><kbd>Enter</kbd> 等价词 → 释义</span><span><kbd>Space</kbd> 朗读第一个词</span><span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> 红 / 黄 / 绿</span></div>
  <p className="quickCount">默认显示每组第一个词，等价词与释义可分别揭晓。当前范围 {scoped.length} 组 · 正在显示 {entries.length} 组 · 记忆方法按同词共享，可直接编辑并一次保存。</p>
  <div className="bbEntries">{entries.map(entry=>{const shown=revealed.includes(entry.id),equivalentShown=equivalents.includes(entry.id);return <article key={entry.id} ref={el=>{refs.current[entry.id]=el;}} className={`bbEntry ${current?.id===entry.id?"keyboardActive":""} ${ratings[entry.id]?`rated-${ratings[entry.id]}`:""}`} aria-label={`第 ${entry.number} 组 · ${entry.words[0].word}`}>
   <header className="bbEntryHead"><span>{volumes[entry.volume as keyof typeof volumes]} · List {entry.list} · 第 {entry.number} 组 · PDF 第 {entry.page}{entry.endPage!==entry.page?`–${entry.endPage}`:""} 页</span><button aria-expanded={shown} onClick={()=>reveal(entry.id)}>{shown?"隐藏释义":"显示释义"}</button><button aria-expanded={notes.includes(entry.id)} onClick={()=>setNotes(s=>s.includes(entry.id)?s.filter(x=>x!==entry.id):[...s,entry.id])}>{notes.includes(entry.id)?"隐藏记忆方法":"显示记忆方法"}</button></header>
   <div className="bbWordGrid">{entry.words.map((word,i)=><div className={`bbWord ${i===0?"bbCoreWord":"bbEquivalentWord"}`} key={i}>{i>0&&<span className="bbArrow" aria-hidden="true">→</span>}{i===0||equivalentShown?<><button className="bbPronounce" onClick={()=>{setActiveId(entry.id);pronounce(word.word);}} aria-label={`朗读 ${word.word}`}>{word.word} <span aria-hidden="true">▶</span></button>{occurrences[`${entry.id}:${i}`].total>1&&<details className="bbRepeated"><summary>重复词 · 共 {occurrences[`${entry.id}:${i}`].total} 处 · 查看全部位置</summary><div className="bbRepeatLocations">{occurrences[`${entry.id}:${i}`].locations.map(location=><button key={location.id} disabled={location.id===`${entry.id}:${i}`} onClick={()=>{changeRange({volume:location.volume,lists:[location.list]});setQuery("");setFilter("全部");setSnapshot({...ratings});scroll.current=true;setActiveId(location.entryId);setEquivalents(s=>s.includes(location.entryId)?s:[...s,location.entryId]);setRevealed(s=>s.includes(location.entryId)?s:[...s,location.entryId]);}}>{location.location}{location.id===`${entry.id}:${i}`?"（当前）":" →"}</button>)}</div></details>}{shown&&<p className="bbMeaning">{word.meaning}</p>}{notes.includes(entry.id)&&<SharedWordMemory word={word.word} hideWord/>}</>:null}{i>0&&<button className="bbEquivalentToggle" aria-expanded={equivalentShown} onClick={()=>toggleEquivalent(entry.id)}>{equivalentShown?"隐藏等价词":"显示等价词"}</button>}</div>)}</div>
   {shown&&equivalentShown&&<><p className="bbComparison"><b>原文同组说明</b>{entry.comparison}</p></>}{notes.includes(entry.id)&&equivalentShown&&<><details className="bbOriginal"><summary>查看本组原始记忆法</summary><p>{entry.originalMemory||"原文未提供"}</p></details></>}
   <div className="trafficLights" role="group" aria-label={`第 ${entry.number} 组掌握程度`}>{colors.map(r=><button key={r.value} className={`${r.color} ${ratings[entry.id]===r.value?"active":""}`} aria-pressed={ratings[entry.id]===r.value} onClick={()=>rate(entry.id,r.value)}><i/>{r.label}</button>)}</div>
  </article>;})}</div>{!entries.length&&<p className="emptyState">当前没有匹配词条，请调整范围或搜索条件。</p>}
  <p className="filterHint">按每 30 组划分 List。中册正文实际提取 449 组（封面标称 450 组），全部保留，未补造缺项。原始记忆法留作对照，编辑后的内容在单词卡中统一显示。</p>
 </div>;
}
