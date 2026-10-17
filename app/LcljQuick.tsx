import {studyStorage} from "../community/storage";
"use client";
import RevealControls from "./RevealControls";
import SharedWordMemory from "./SharedWordMemory";

import { useEffect, useMemo, useRef, useState } from "react";
import fillData from "./lcljFill.json";
import readingData from "./lcljReading.json";
import mathData from "./lcljMath.json";
import { restoreGroupRange } from "./quickRangeModel";

export type LcljDeck = "lclj-fill" | "lclj-reading" | "lclj-math";
type Rating = "unknown" | "fuzzy" | "familiar";
type Filter = Rating | "unrated";
type Entry = { id: string; word: string; meaning: string; list?: number; category?: string; context?: string; equivalent?: string; passage?: string; sourceRow?: number; page?: number };
const groupOf = (entry: Entry) => entry.list ? `List ${String(entry.list).padStart(2, "0")}` : entry.category!;
const decks: Record<LcljDeck, { title: string; entries: Entry[]; intro: string }> = {
  "lclj-fill": { title: "填空高频3000词", entries: fillData, intro: "根据网络资源整理，共 3,072 条。按原顺序每 50 条分为一组，共 62 个 List。" },
  "lclj-reading": { title: "阅读核心300词", entries: readingData.map((entry, index) => ({ ...entry, list: Math.floor(index / 50) + 1 })), intro: "原表共 318 条，按原顺序每 50 条分为一组，共 7 个 List，最后一组 18 条。" },
  "lclj-math": { title: "数学词汇索引", entries: mathData, intro: "来自《GRE数学词汇索引》，共 291 条，包含数学术语、公式换算和常用句型。" },
};
const ratingsList: Array<{ value: Filter; label: string; color: string }> = [
  { value: "unknown", label: "不认识", color: "red" },
  { value: "fuzzy", label: "模糊", color: "yellow" },
  { value: "familiar", label: "熟悉", color: "green" },
  { value: "unrated", label: "未标记", color: "" },
];

export default function LcljQuick({ deck, ratings, onRate, pronounce }: {
  deck: LcljDeck;
  ratings: Record<string, Rating>;
  onRate: (id: string, rating: Rating) => void;
  pronounce: (word: string) => void;
}) {
  const { title, entries, intro } = decks[deck];
  const groups = useMemo(() => [...new Set(entries.map(groupOf))], [entries]);
  const storageKey = deck === "lclj-reading" ? "gre-lclj-reading-selection-v2" : `gre-${deck}-selection-v1`;
  const [range, setRange] = useState<{ key: string; selection: string[]; ready: boolean }>({ key: storageKey, selection: groups.slice(0, 1), ready: false });
  const selection = range.key === storageKey ? range.selection : groups.slice(0, 1);
  const ready = range.key === storageKey && range.ready;
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filter[]>([]);
  const [snapshot, setSnapshot] = useState(ratings);
  const [revealed, setRevealed] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [order, setOrder] = useState<string[] | null>(null);
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
    if (!order) return entries;
    const byId = new Map(entries.map((entry) => [entry.id, entry]));
    return order.map((id) => byId.get(id)!);
  }, [entries, order]);
  const scoped = ordered.filter((entry) => selection.includes(groupOf(entry)));
  const keyword = query.trim().toLocaleLowerCase();
  const visible = scoped.filter((entry) =>
    (!filters.length || filters.includes(snapshot[entry.id] ?? "unrated"))
    && (!keyword || [entry.word, entry.meaning, entry.context, entry.equivalent, entry.passage, entry.category].filter(Boolean).join(" ").toLocaleLowerCase().includes(keyword)),
  );
  const active = visible.find((entry) => entry.id === activeId) ?? visible[0];
  const counts = scoped.reduce((total, entry) => {
    total[ratings[entry.id] ?? "unrated"] += 1;
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
    setOrder(ids);
    setActiveId(null);
  }

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (document.querySelector?.(".learningPlanOverlay, .onboardingOverlay")) return;
      const target = event.target as HTMLElement | null;
      if (!active || event.metaKey || event.ctrlKey || event.altKey || target?.closest("input, textarea, select, [contenteditable='true'], summary")) return;
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

  return <div className="lcljQuick" tabIndex={-1}>
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
      <input className="search" aria-label={`搜索${title}`} placeholder="搜索英文、释义或题号…" value={query} onChange={(event) => { setQuery(event.target.value); setActiveId(null); }} />
      <details className="rangePicker categoryPicker"><summary><span>{deck !== "lclj-math" ? "选择 List" : "选择分类"}</span><strong>{selection.length === groups.length ? `全部 · ${groups.length} 组` : selection.length <= 2 ? selection.join(" / ") || "尚未选择" : `已选 ${selection.length} 组`}</strong></summary>
        <div className="rangePickerPanel categoryPickerPanel"><button className="all" onClick={() => changeSelection(selection.length === groups.length ? [] : groups)}>{selection.length === groups.length ? "全不选" : "全选"}</button>
          {groups.map((group) => <button key={group} aria-pressed={selection.includes(group)} className={selection.includes(group) ? "active" : ""} onClick={() => changeSelection(selection.includes(group) ? selection.filter((value) => value !== group) : groups.filter((value) => value === group || selection.includes(value)))}>{group}</button>)}
        </div>
      </details>
      <button className="filterReset" onClick={() => { setFilters([]); setSnapshot({ ...ratings }); }}>显示全部颜色</button>
    </div>
    <div className="shuffleControls"><button className={order ? "active" : ""} aria-pressed={!!order} onClick={() => order ? (setOrder(null), setActiveId(null)) : shuffle()}>{order ? "关闭乱序，恢复正序" : "开启乱序"}</button>{order && <button onClick={shuffle}>再打乱一次</button>}</div>
    <p className="quickCount">词库 {entries.length} 条 · 当前范围 {scoped.length} 条 · 正在显示 {visible.length} 条 · 当前：{active?.word ?? "无匹配词"}</p>
    <div className="shortcutBar"><span><kbd>↑</kbd><kbd>↓</kbd> 上 / 下一词</span><span><kbd>Space</kbd> 发音</span><span><kbd>Enter</kbd> 揭晓 / 遮挡</span><span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> 红 / 黄 / 绿</span></div>
    <div className="quickTable mathQuickTable lcljQuickTable" role="table" aria-label={`${title}速刷表`}>
      <div className="quickRow quickHeader" role="row"><span>英文</span><span>{deck === "lclj-reading" ? "本义 · 文中义 · 对应选项" : "中文释义"}</span><span>分类 / 来源</span><span>掌握程度</span></div>
      {visible.map((entry) => <div className={`quickRow ${entry.id === active?.id ? "keyboardActive" : ""} ${ratings[entry.id] ? `rated-${ratings[entry.id]}` : ""}`} key={entry.id} role="row" aria-current={entry.id === active?.id ? "true" : undefined} ref={(element) => { rows.current[entry.id] = element; }}>
        <button className="quickWord" onClick={() => { setActiveId(entry.id); spoken.current = entry.id; pronounce(entry.word); }} aria-label={`朗读 ${entry.word}`}><strong>{entry.word}</strong></button>
        <button className={`quickMeaning ${revealed.includes(entry.id) ? "revealed" : ""}`} aria-expanded={revealed.includes(entry.id)} onClick={() => reveal(entry.id)}>
          {revealed.includes(entry.id) ? <span className="lcljMeaning"><span>{deck === "lclj-reading" && <b>本义：</b>}{entry.meaning}</span>{deck === "lclj-reading" && <><span><b>文中义：</b>{entry.context || "原表未提供"}</span><span><b>对应选项：</b>{entry.equivalent || "原表未提供"}</span></>}</span> : <span>点击揭晓{deck === "lclj-reading" ? "释义与对应选项" : "中文释义"}</span>}
        </button>
        <div className="mathCategoryCell lcljSource"><span>{groupOf(entry)}</span>{deck === "lclj-reading" && entry.category && <span>{entry.category}</span>}<small>{entry.page ? `PDF 第 ${entry.page} 页` : `原表第 ${entry.sourceRow} 行`}</small>{entry.passage && <small>{entry.passage}</small>}</div>
        <div className="trafficLights" role="group" aria-label={`${entry.word} 掌握程度`}>{ratingsList.slice(0, 3).map(({ value, label, color }) => <button key={value} className={`${ratings[entry.id] === value ? "active " : ""}${color}`} aria-pressed={ratings[entry.id] === value} onClick={() => rate(entry.id, value as Rating)}><i /><span>{label}</span></button>)}</div>
        {deck!=="lclj-reading"&&revealed.includes(entry.id)&&<div className="sharedMemoryRow"><SharedWordMemory word={entry.word}/></div>}
      </div>)}
    </div>
    {!visible.length && <p className="emptyState">当前没有匹配词条。可调整分类、颜色或搜索关键词。</p>}
  </div>;
}
