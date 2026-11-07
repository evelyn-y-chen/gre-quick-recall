import NotebookFrequencyBadge from "./NotebookFrequency";
import {alphabeticalIds} from "./studyWordOrder";
import type {PlanNavigation} from "../community/planNavigation";
import {studyStorage} from "../community/storage";
"use client";
import RevealControls from "./RevealControls";
import SharedWordMemory from "./SharedWordMemory";

import { useEffect, useMemo, useRef, useState } from "react";
import {qingshanDecks,qingshanRatingKeys,groupQingshanRows,qingshanDisplayRating,qingshanRowLabel,type QingshanDeck,type QingshanDisplayEntry} from './qingshanCatalog';
import RatingCloudSync from './RatingCloudSync';
import {readSavedRatings,writeSavedRatings} from './ratingStorage';
import {recordLearningPlanRatings} from '../community/learningPlanStore';
import Practice from '../community/Practice';
import {restoreGroupRange} from './quickRangeModel';
type Rating='unknown'|'fuzzy'|'familiar';
type Filter=Rating|'unrated';
type Entry=QingshanDisplayEntry;
const groupOf=(entry:Entry)=>entry.group;
const ratingsList: Array<{ value: Filter; label: string; color: string }> = [
  { value: "unknown", label: "不认识", color: "red" },
  { value: "fuzzy", label: "模糊", color: "yellow" },
  { value: "familiar", label: "熟悉", color: "green" },
  { value: "unrated", label: "未标记", color: "" },
];

export default function QingshanQuick({deck,pronounce,planTarget,onPlanTargetHandled}:{deck:QingshanDeck;pronounce:(word:string)=>void;planTarget?:PlanNavigation|null;onPlanTargetHandled?:()=>void}) {
 const {title,entries:sourceEntries,intro,commonLabel,specialLabel}=qingshanDecks[deck];
 const entries=useMemo(()=>groupQingshanRows(sourceEntries),[sourceEntries]);
 const [ratings,setRatings]=useState<Record<string,Rating>>(()=>readSavedRatings(studyStorage,qingshanRatingKeys[deck])??{});
 const [testing,setTesting]=useState(false),[hideNotes,setHideNotes]=useState(false),[hideRelated,setHideRelated]=useState(false);
 const onRate=(id:string,rating:Rating)=>{const entry=entries.find(row=>row.id===id);if(!entry)return;const updates=Object.fromEntries(entry.sourceRows.map(row=>[row.id,rating]));recordLearningPlanRatings(deck,updates);setRatings(current=>({...current,...updates}));};
 useEffect(()=>writeSavedRatings(studyStorage,qingshanRatingKeys[deck],ratings),[ratings,deck]);
  const groups = useMemo(() => [...new Set(entries.map(groupOf))], [entries]);
  const storageKey = `gre-${deck}-selection-v1`;
  const [range, setRange] = useState<{ key: string; selection: string[]; ready: boolean }>({ key: storageKey, selection: groups.slice(0, 1), ready: false });
  const selection = range.key === storageKey ? range.selection : groups.slice(0, 1);
  useEffect(()=>{if(!planTarget||planTarget.deckId!==deck)return;const group=entries.find(e=>e.list===planTarget.list)?.group;if(group&&groups.includes(group)){setRange({key:storageKey,selection:[group],ready:true});setQuery('');setFilters([]);setOrder(null);setAlphabetical(false);setActiveId(null);}if(planTarget.method==='test')setTesting(true);onPlanTargetHandled?.();},[planTarget?.id,deck]);
  const ready = range.key === storageKey && range.ready;
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filter[]>([]);
  const [snapshot, setSnapshot] = useState(ratings);
  const [revealed, setRevealed] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [order, setOrder] = useState<string[] | null>(null);
  const [alphabetical, setAlphabetical] = useState(false);
  const rows = useRef<Record<string, HTMLDivElement | null>>({});
  const scroll = useRef(false);
  const spoken = useRef("");
  useEffect(() => {
    const timer = window.setTimeout(() => {
      let restored = groups.slice(0, 1);
      try {
        restored = restoreGroupRange(studyStorage.getItem(storageKey), groups);
      } catch {}
      setRange(current => current.key === storageKey && current.ready ? current : { key: storageKey, selection: restored, ready: true });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [storageKey, groups]);

  useEffect(() => {
    // Readiness belongs to this deck, preventing a previous selection from
    // overwriting the next deck's saved range before restoration completes.
    if (range.ready && range.key === storageKey) {
      try { studyStorage.setItem(storageKey, JSON.stringify(range.selection)); } catch {}
    }
  }, [range, storageKey]);

  const ordered = useMemo(() => {
    const ids = alphabetical ? alphabeticalIds(entries,entry=>entry.word) : order;
    if (!ids) return entries;
    const byId = new Map(entries.map((entry) => [entry.id, entry]));
    return [...ids.map((id) => byId.get(id)).filter((entry): entry is Entry => !!entry),...entries.filter(entry=>!ids.includes(entry.id))];
  }, [entries, order, alphabetical]);
  const scoped = ordered.filter((entry) => selection.includes(groupOf(entry)));
  const keyword = query.trim().toLocaleLowerCase();
  const visible = scoped.filter((entry) =>
    (!filters.length || filters.includes(qingshanDisplayRating(entry,snapshot) ?? "unrated"))
    && (!keyword || [entry.word, entry.commonMeaning, entry.specialMeaning].filter(Boolean).join(" ").toLocaleLowerCase().includes(keyword)),
  );
  const active = visible.find((entry) => entry.id === activeId) ?? visible[0];
  const counts = scoped.reduce((total, entry) => {
    total[qingshanDisplayRating(entry,ratings) ?? "unrated"] += 1;
    return total;
  }, { unknown: 0, fuzzy: 0, familiar: 0, unrated: 0 });

  useEffect(() => {
    if (!ready || !active) { spoken.current = ""; return; }
    if (spoken.current !== active.id) {
      spoken.current = active.id;
      pronounce(active.word);
    }
    if (scroll.current) {
      rows.current[active.id]?.scrollIntoView({ behavior: "smooth", block: "center" });
      scroll.current = false;
    }
  }, [active, ready, pronounce]);

  function reveal(id: string) {
    setActiveId(id);
    setRevealed((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }
  function rate(id: string, value: Rating) {
    setActiveId(id);
    onRate(id, value);
    setRevealed((current) => current.includes(id) ? current : [...current, id]);
  }
  function changeSelection(next: string[]) {
    setRange({ key: storageKey, selection: next, ready: true });
    setSnapshot({ ...ratings });
    setActiveId(null);
    setRevealed([]);
  }
  function shuffle() {
    const ids = entries.map((entry) => entry.id);
    for (let i = ids.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    setAlphabetical(false); setOrder(ids);
    setActiveId(null);
  }

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (document.querySelector?.(".learningPlanOverlay, .onboardingOverlay, .workspaceMenuOverlay, .practiceOverlay")) return;
      const target = event.target as HTMLElement | null;
      if (!active || event.isComposing || event.metaKey || event.ctrlKey || event.altKey || target?.closest("input, textarea, select, [contenteditable='true'], summary")) return;
      const isArrow = event.key.startsWith("Arrow");
      if (event.repeat && !isArrow) return;
      if (isArrow && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
        event.preventDefault();
        const offset = ["ArrowUp", "ArrowLeft"].includes(event.key) ? -1 : 1;
        const index = visible.findIndex((entry) => entry.id === active.id);
        const next = visible[Math.max(0, Math.min(visible.length - 1, index + offset))];
        scroll.current = next.id !== active.id;
        setActiveId(next.id);
      } else if (event.key === "Enter") {
        event.preventDefault(); reveal(active.id);
      } else if (event.code === "Space") {
        event.preventDefault(); pronounce(active.word);
      } else if (["1", "2", "3"].includes(event.key)) {
        event.preventDefault(); rate(active.id, (["unknown", "fuzzy", "familiar"] as Rating[])[Number(event.key) - 1]);
      }
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  });

  return <div className="zhangQuick qingshanQuick" tabIndex={-1}>
    <RatingCloudSync module={deck} ratings={ratings} onLoad={setRatings}/>
    {testing&&<Practice deck={deck} initialLists={entries.filter(e=>selection.includes(e.group)).map(e=>e.list).filter((v,i,a)=>a.indexOf(v)===i)} onClose={()=>setTesting(false)}/>}
    <div className="practiceEntry"><button className="primary" onClick={()=>setTesting(true)}>开始测试</button><span>沿用当前页码 · 可多选红黄绿 · 自动保存进度</span></div>
    <div className="libraryHead"><div><p className="eyebrow">VOCABULARY QUICK RECALL</p><h1>{title}</h1><p className="quickIntro">{intro}</p></div>
      <div className="libraryActions"><RevealControls total={visible.length} shown={visible.filter((entry) => revealed.includes(entry.id)).length} onShow={() => setRevealed(visible.map((entry) => entry.id))} onHide={() => setRevealed([])} /></div>
    </div>
    <div className="quickStats" aria-label={`${title}掌握程度统计`}>
      {ratingsList.map(({ value, label, color }) => <button key={value} className={`${filters.includes(value) ? "active " : ""}${color}`} aria-pressed={filters.includes(value)} onClick={() => {
        setFilters((current) => current.includes(value) ? current.length === 1 ? current : current.filter((item) => item !== value) : [...current, value]);
        setSnapshot({ ...ratings });
      }}><i />{label} <strong>{counts[value]}</strong></button>)}
    </div>
    <p className="filterHint">颜色可多选；标记后本轮名单不变，再点唯一已选颜色可刷新。</p>
    <div className="quickFilters mathQuickFilters">
      <input className="search" aria-label={`搜索${title}`} placeholder="搜索词汇或两列释义…" value={query} onChange={(event) => { setQuery(event.target.value); setActiveId(null); }} />
      <details className="rangePicker categoryPicker"><summary><span>选择原表页码</span><strong>{selection.length === groups.length ? `全部 · ${groups.length} 组` : selection.length <= 2 ? selection.join(" / ") || "尚未选择" : `已选 ${selection.length} 组`}</strong></summary>
        <div className="rangePickerPanel categoryPickerPanel"><button className="all" onClick={() => changeSelection(selection.length === groups.length ? [] : groups)}>{selection.length === groups.length ? "全不选" : "全选"}</button>
          {groups.map((group) => <button key={group} aria-pressed={selection.includes(group)} className={selection.includes(group) ? "active" : ""} onClick={() => changeSelection(selection.includes(group) ? selection.filter((value) => value !== group) : groups.filter((value) => value === group || selection.includes(value)))}>{group}</button>)}
        </div>
      </details>
      <button className="filterReset" onClick={() => { setFilters([]); setSnapshot({ ...ratings }); }}>显示全部颜色</button>
    </div>
    <div className="shuffleControls" role="group" aria-label="词表显示顺序"><button className={!order&&!alphabetical?"active":""} aria-pressed={!order&&!alphabetical} onClick={()=>{setOrder(null);setAlphabetical(false);setActiveId(null);}}>原顺序</button><button className={order&&!alphabetical?"active":""} aria-pressed={!!order&&!alphabetical} onClick={shuffle}>一键打乱</button><button className={alphabetical?"active":""} aria-pressed={alphabetical} onClick={()=>{setOrder(null);setAlphabetical(true);setActiveId(null);}}>A–Z 字母排序</button></div>
    <p className="quickCount">词库 {entries.length} 条 · 当前范围 {scoped.length} 条 · 正在显示 {visible.length} 条 · 当前：{active?.word ?? "无匹配词"}</p>
    <div className="shortcutBar"><span><kbd>↑</kbd><kbd>↓</kbd> 上 / 下一词</span><span><kbd>Space</kbd> 发音</span><span><kbd>Enter</kbd> 揭晓 / 遮挡</span><span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> 红 / 黄 / 绿</span></div>
    <div className="shuffleControls"><button aria-pressed={hideRelated} onClick={()=>setHideRelated(!hideRelated)}>{hideRelated?`显示${commonLabel}`:`隐藏${commonLabel}`}</button><button aria-pressed={hideNotes} onClick={()=>setHideNotes(!hideNotes)}>{hideNotes?'显示共享笔记':'隐藏共享笔记'}</button></div>
    <div className="zhangTable qingshanTable" role="table" aria-label={title}>
     <div className="zhangRow qingshanRow qingshanHeader" role="row"><span role="columnheader">词汇</span><span role="columnheader">{commonLabel}</span><span role="columnheader">{specialLabel}</span><span role="columnheader">共享笔记</span><span role="columnheader">掌握程度</span></div>
     {visible.map(entry=><div className={`zhangRow qingshanRow ${entry.id===active?.id?'keyboardActive':''}`} role="row" aria-current={entry.id===active?.id?"true":undefined} key={entry.id} ref={el=>{rows.current[entry.id]=el;}}>
      <div role="cell"><button className="quickWord" onClick={()=>{setActiveId(entry.id);pronounce(entry.word);}}><strong>{entry.word}</strong></button><NotebookFrequencyBadge word={entry.word}/><small>{entry.group} · {qingshanRowLabel(entry)}</small><small>PDF 第 {entry.page} 页</small></div>
      <div role="cell"><small className="qingshanCellLabel">{commonLabel}</small>{hideRelated?<span className="muted">已隐藏</span>:<button className={`quickMeaning ${revealed.includes(entry.id)?"revealed":""}`} aria-expanded={revealed.includes(entry.id)} onClick={()=>reveal(entry.id)}>{revealed.includes(entry.id)?entry.commonMeaning||'—':`点击揭晓${commonLabel}`}</button>}</div>
      <div role="cell"><small className="qingshanCellLabel">{specialLabel}</small><button className={`quickMeaning ${revealed.includes(entry.id)?"revealed":""}`} aria-expanded={revealed.includes(entry.id)} onClick={()=>reveal(entry.id)}>{revealed.includes(entry.id)?entry.specialMeaning||'—':`点击揭晓${specialLabel}`}</button></div>
      <div role="cell">{hideNotes?<span className="muted">笔记已隐藏</span>:<SharedWordMemory word={entry.word}/>}</div>
      <div role="cell" className="trafficLights" aria-label={`${entry.word} 掌握程度`}>{ratingsList.slice(0,3).map(({value,label,color})=><button key={value} className={`${qingshanDisplayRating(entry,ratings)===value?'active ':''}${color}`} aria-pressed={qingshanDisplayRating(entry,ratings)===value} onClick={()=>rate(entry.id,value as Rating)}><i/><span>{label}</span></button>)}</div>
     </div>)}
    </div>
    {!visible.length&&<p>当前范围没有词条，请调整页码或颜色筛选。</p>}
  </div>;
}
