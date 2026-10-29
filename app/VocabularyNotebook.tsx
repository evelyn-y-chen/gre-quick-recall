import type {PlanNavigation} from "../community/planNavigation";
import {studyStorage} from "../community/storage";
import {recordLearningPlanWords} from "../community/learningPlanStore";
import {reviewDay} from "../community/practiceReviewModel";
import {appFetch} from "../community/api";
"use client";

import SharedWordMemory,{useWordMemory} from "./SharedWordMemory";
import DictionaryLookup from "./DictionaryLookup";
import DictionaryLinks from "./DictionaryLinks";
import RevealControls from "./RevealControls";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildNotebookCatalog, type CatalogWord } from "./notebookCatalog";
import { NOTEBOOK_DRAFT_KEY, hasNotebookSource, mergeNotebookCandidates, validNotebookBatch, type NotebookBatch, type NotebookDraft, type NotebookSummary, type NotebookWord, type NotebookRating } from "./notebookModel";
import type { GleeMindMap } from "./gleeMindMaps";
import type { GleeTableList } from "./gleeTableLists";

function drafts(): Record<string, NotebookDraft> {
  try {
    const value = JSON.parse(studyStorage.getItem(NOTEBOOK_DRAFT_KEY) ?? "{}");
    return Object.fromEntries(Object.entries(value).filter(([,v]) => {
      const d = v as NotebookDraft;
      return d && validNotebookBatch(d.batch, false) && Number.isInteger(d.revision) && d.revision >= 0;
    })) as Record<string, NotebookDraft>;
  } catch { return {}; }
}
const summary = (batch: NotebookBatch, revision: number, draft=false): NotebookSummary => ({id: batch.id, source: batch.source, date: batch.date, count: batch.words.length, revision,...(draft?{draft:true}:{})});
function mergeSummaries(cloud: NotebookSummary[]) {
  const result = new Map(cloud.map((item) => [item.id,item]));
  Object.values(drafts()).forEach((d) => result.set(d.batch.id,summary(d.batch,d.revision,true)));
  return [...result.values()].sort((a,b) => b.date.localeCompare(a.date));
}
const SOURCE_ORDER_KEY = "gre-notebook-source-order-v1";
const DISPLAY_KEY = "gre-notebook-display-v1";
function displayPreferences() {
  try {
    const saved = JSON.parse(studyStorage.getItem(DISPLAY_KEY) ?? "{}");
    return {showReference: saved?.showReference !== false, showMemory: saved?.showMemory !== false};
  } catch { return {showReference:true,showMemory:true}; }
}
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };

export default function VocabularyNotebook({ words, pronounce,planTarget,onPlanTargetHandled }: {
  planTarget?:PlanNavigation|null;onPlanTargetHandled?:()=>void;
  words: Array<{id: string; word: string; meaning: string; list?: number; note?: string}>;
  pronounce: (word: string) => void;
}) {
  const sharedMemory=useWordMemory();
  const [batches,setBatches] = useState<NotebookSummary[]>([]);
  const [batch,setBatch] = useState<NotebookBatch | null>(null);
  const [revision,setRevision] = useState(0);
  const [source,setSource] = useState("");
  const [date,setDate] = useState(today);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [dirty,setDirty] = useState(false);
  const [status,setStatus] = useState("正在读取生词本…");
  const [conflict,setConflict] = useState(false);
  const [query,setQuery] = useState("");
  const [module,setModule] = useState("全部词库");
  const [selected,setSelected] = useState<string[]>([]);
  const [manual,setManual] = useState({meaning:"",note:"",origin:"手动补充"});
  const [activeId,setActiveId] = useState("");
  const rowRefs = useRef<Record<string, HTMLElement | null>>({});
  const [review,setReview] = useState(false);
  const [revealed,setRevealed] = useState<string[]>([]);
  const [display,setDisplay] = useState(displayPreferences);
  const [displayStatus,setDisplayStatus] = useState("");
  const [removed,setRemoved] = useState<{word: NotebookWord; index: number} | null>(null);
  const [cloudMaps,setCloudMaps] = useState<GleeMindMap[] | undefined>();
  const [cloudTables,setCloudTables] = useState<GleeTableList[] | undefined>();
  const [catalogStatus,setCatalogStatus] = useState("正在同步导图与表格中的自定义内容…");
  const catalog = useMemo(() => buildNotebookCatalog(words,cloudMaps,cloudTables),[words,cloudMaps,cloudTables]);
  const defaultModules = useMemo(() => [...new Set(catalog.map((w) => w.module))],[catalog]);
  const [sourceOrder,setSourceOrder] = useState<string[]>([]);
  const [orderStatus,setOrderStatus] = useState("");
  const modules = useMemo(() => [...new Set([...sourceOrder.filter((m) => defaultModules.includes(m)),...defaultModules])],[sourceOrder,defaultModules]);
  const sourceRanks = useMemo(() => new Map(modules.map((m,i) => [m,i])),[modules]);
  useEffect(() => {
    try { const saved=JSON.parse(studyStorage.getItem(SOURCE_ORDER_KEY) ?? "[]"); if(Array.isArray(saved)) setSourceOrder(saved.filter((m): m is string => typeof m === "string")); }
    catch { setOrderStatus("暂时无法读取偏好，当前使用默认顺序。"); }
  },[]);
  function saveSourceOrder(next: string[]) {
    setSourceOrder(next);
    try {studyStorage.setItem(SOURCE_ORDER_KEY,JSON.stringify(next));setOrderStatus("顺序已保存到这台设备，搜索结果已更新。");}
    catch {setOrderStatus("排序已生效，但未能保存在这台设备上。");}
  }
  function moveSource(name: string, direction: number) {
    const next=[...modules],index=next.indexOf(name),target=index+direction;
    if(index<0 || target<0 || target>=next.length) return;
    [next[index],next[target]]=[next[target],next[index]];saveSourceOrder(next);
  }
  const selectedWords = catalog.filter((w) => selected.includes(w.id));
  const showNotes = display.showReference || display.showMemory;
  function changeDisplay(field: "showReference" | "showMemory", checked: boolean) {
    const next = {...display,[field]:checked};
    setDisplay(next);
    try { studyStorage.setItem(DISPLAY_KEY,JSON.stringify(next)); setDisplayStatus(""); }
    catch { setDisplayStatus("显示偏好暂时无法保存，本次选择仍生效。"); }
  }

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return catalog.filter((w) => (module === "全部词库" || w.module === module) && `${w.word} ${w.meaning} ${w.origin}`.toLowerCase().includes(q))
      .sort((a,b) => (sourceRanks.get(a.module) ?? 0)-(sourceRanks.get(b.module) ?? 0) || Number(b.word.toLowerCase() === q)-Number(a.word.toLowerCase() === q));
  },[catalog,module,query,sourceRanks]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await appFetch("/api/notebook",{cache:"no-store"});
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!cancelled) { setBatches(mergeSummaries(data.batches)); setStatus("先填写来源开始收集，或打开以前的收集。"); }
      } catch {
        if (!cancelled) { setBatches(mergeSummaries([])); setStatus("工作区列表读取失败，已显示本机草稿。可刷新页面重试。"); }
      } finally { if (!cancelled) setLoading(false); }
    }
    void load();
    void appFetch("/api/mind-map",{cache:"no-store"}).then(async (r) => {
      if (!r.ok) throw new Error();
      const data = await r.json();
      if (!cancelled) { setCloudMaps(data.maps); setCloudTables(data.tables); setCatalogStatus("已包含工作区导图与表格中的自定义单词。"); }
    }).catch(() => { if (!cancelled) setCatalogStatus("暂未同步工作区导图编辑；当前可搜索各模块原有词库，稍后刷新重试。"); });
    return () => { cancelled = true; };
  },[]);

  function persist(next: NotebookBatch, rev = revision) {
    setBatch(next); setDirty(true); setConflict(false);
    setBatches((items) => [summary(next,rev,true),...items.filter((item) => item.id !== next.id)]);
    try {
      studyStorage.setItem(NOTEBOOK_DRAFT_KEY,JSON.stringify({...drafts(),[next.id]:{batch:next,revision:rev}}));
      setStatus("本机草稿已保留，记得保存到当前工作区。");
    } catch { setStatus("本机草稿空间不足，请立即保存到当前工作区。"); }
  }
  function resetView() { setActiveId(""); setSelected([]); setRemoved(null); setRevealed([]); setReview(false); setConflict(false); }
  function create() {
    if (!source.trim() || !date) return;
    resetView(); setRevision(0);
    persist({id:crypto.randomUUID(),source:source.trim(),date,words:[]},0);
    setSource("");
  }
  async function open(id: string) {
    if (!id || id === batch?.id) return;
    resetView(); setLoading(true);
    const local = drafts()[id];
    if (local) {
      setBatch(local.batch); setRevision(local.revision); setDirty(true); setStatus("已恢复这次收集的本机草稿。"); setLoading(false); return;
    }
    try {
      const response = await appFetch(`/api/notebook?id=${encodeURIComponent(id)}`,{cache:"no-store"});
      if (!response.ok) throw new Error();
      const saved = await response.json() as NotebookDraft;
      setBatch(saved.batch); setRevision(saved.revision); setDirty(false); setStatus("已读取工作区生词本。");
    } catch { setStatus("读取失败，请重试；当前收集未改变。"); }
    finally { setLoading(false); }
  }
  useEffect(()=>{if(!planTarget||planTarget.deckId!=='notebook'||!planTarget.batchId)return;void open(planTarget.batchId).then(()=>{setReview(true);onPlanTargetHandled?.();});},[planTarget?.id]);
  async function save() {
    if (!batch) return;
    if (!validNotebookBatch(batch)) { setStatus("请填写来源和每条生词的英文；每次最多收集 1000 个词。"); return; }
    setSaving(true);
    try {
      if(sharedMemory && Object.keys(sharedMemory.drafts).length && !await sharedMemory.save())throw Error("记忆方法未全部保存，请查看页面底部提示。");
      const response = await appFetch("/api/notebook",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({batch,revision})});
      const saved = await response.json();
      if (!response.ok) { setConflict(response.status===409); throw new Error(saved.error); }
      setRevision(saved.revision); setDirty(false); setConflict(false);
      const local = drafts(); delete local[batch.id];
      try { studyStorage.setItem(NOTEBOOK_DRAFT_KEY,JSON.stringify(local)); } catch {}
      setBatches((items) => [summary(batch,saved.revision),...items.filter((item) => item.id !== batch.id)]);
      window.dispatchEvent(new Event("word-memory-source-saved"));
      setStatus("已保存到当前工作区。");
    } catch (error) { setStatus(error instanceof Error ? error.message : "工作区保存失败，草稿仍保留。"); }
    finally { setSaving(false); }
  }
  function add(candidates: Array<Pick<CatalogWord,"word"|"meaning"|"note"|"origin">>) {
    if (!batch) return false;
    const merged=mergeNotebookCandidates(batch.words,candidates,()=>crypto.randomUUID());
    if (merged.length > 1000) {setStatus("本次已超过 1000 个词，请另开一次收集。");return false;}
    if (!validNotebookBatch({...batch,words:merged})) {setStatus("合并后内容过长，请减少所选释义或先精简已有内容；本次修改尚未加入。");return false;}
    persist({...batch,words:merged}); setSelected([]);
    setStatus(`已合并所选释义，本次共 ${merged.length} 个词。同词的不同来源记在一起，请保存到当前工作区。`);
    return true;
  }
  function editWord(id: string, field: "word"|"meaning"|"note"|"origin", value: string) {
    if (batch) persist({...batch,words:batch.words.map((w) => w.id === id ? {...w,[field]:value} : w)});
  }

  function rateWord(id: string, rating: NotebookRating, toggle = false) {
    const word=batch?.words.find(w=>w.id===id);
    if(word&&!(toggle&&word.rating===rating))recordLearningPlanWords([word.word],rating==="familiar"?"green":rating==="fuzzy"?"yellow":"red",reviewDay(),batch!.words.map(w=>w.word));
    if (batch) persist({...batch,words:batch.words.map((w) => w.id === id ? {...w,rating:toggle && w.rating === rating ? undefined : rating} : w)});
  }

  const activeWord = batch?.words.find((w) => w.id === activeId) ?? batch?.words[0];
  const activeWordId = activeWord?.id;
  const activeWordRevealed = !!activeWordId && revealed.includes(activeWordId);
  useEffect(() => {
    if (!review || !activeWordId) return;
    const frame = requestAnimationFrame(() => {
      const row = rowRefs.current[activeWordId];
      if (!row) return;
      // Wait until the revealed meaning and notes have changed the row height.
      const target = row.getBoundingClientRect().height > window.innerHeight * .8
        ? row.querySelector<HTMLElement>(".notebookWordHead") ?? row : row;
      target.scrollIntoView({block:"center",behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"});
    });
    return () => cancelAnimationFrame(frame);
  }, [review, activeWordId, activeWordRevealed]);

  function handleKeyboard(event: KeyboardEvent) {
    if(document.querySelector?.(".learningPlanOverlay, .onboardingOverlay, .workspaceMenuOverlay"))return;
    const target = event.target as HTMLElement | null;
    if (!review || !activeWord || !batch || loading || saving || event.isComposing || event.metaKey || event.ctrlKey || event.altKey || target?.closest("input, textarea, select, [contenteditable='true']")) return;
    if (target?.closest("button, summary, a") && (event.key === "Enter" || event.code === "Space")) return;
    const backward = event.key === "ArrowUp" || event.key === "ArrowLeft";
    const forward = event.key === "ArrowDown" || event.key === "ArrowRight";
    if (event.repeat && !backward && !forward) return;
    if (backward || forward) {
      event.preventDefault();
      const index = batch.words.findIndex((w) => w.id === activeWord.id);
      const next = batch.words[Math.max(0, Math.min(batch.words.length - 1, index + (forward ? 1 : -1)))];
      setActiveId(next.id); rowRefs.current[next.id]?.focus({preventScroll:true});
      return;
    }
    if (event.code === "Space") { event.preventDefault(); pronounce(activeWord.word); return; }
    if (event.key === "Enter") { event.preventDefault(); setRevealed((s) => s.includes(activeWord.id) ? s.filter((id) => id !== activeWord.id) : [...s,activeWord.id]); return; }
    const rating = ({"1":"unknown","2":"fuzzy","3":"familiar"} as Record<string,NotebookRating>)[event.key];
    if (rating) { event.preventDefault(); rateWord(activeWord.id,rating,false); setRevealed((s) => s.includes(activeWord.id) ? s : [...s,activeWord.id]); }
  }
  useEffect(() => { window.addEventListener("keydown",handleKeyboard); return () => window.removeEventListener("keydown",handleKeyboard); });

  return <section className={`vocabNotebook${review ? " notebookReviewMode" : ""}${showNotes ? "" : " notebookNotesHidden"}`} onKeyDown={(e) => {e.stopPropagation();handleKeyboard(e.nativeEvent);}}>
    <div className="libraryHead"><div><p className="eyebrow">MY VOCABULARY</p><h1>生词本</h1><p className="quickIntro">按每次学习来源收集生词，从所有模块选词，也可以自己补充。</p></div></div>
    <fieldset disabled={loading || saving} className="notebookControls">
      <form className="notebookNew" onSubmit={(e) => {e.preventDefault();create();}}>
        <label>这次生词的来源<input required maxLength={300} value={source} onChange={(e) => setSource(e.target.value)} placeholder="例如：阅读机经 Passage 11 · 第二次练习" /></label>
        <label>日期<input required type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label><button className="solid" type="submit">开始这次收集</button>
      </form>
      <label className="notebookHistory">以前的收集 · {batches.length} 次{batches.some(b=>b.draft)?`（含 ${batches.filter(b=>b.draft).length} 次草稿）`:''}<select value={batch?.id ?? ""} onChange={(e) => void open(e.target.value)}><option value="">选择一次收集…</option>{batches.map((b) => <option key={b.id} value={b.id}>{b.date} · {b.source}（{b.count} 词{b.draft?' · 草稿':''}）</option>)}</select></label>
    </fieldset>
    <p className="notebookHint">账号模式下，其他设备的收集还没显示？可在「更多」→「检查账号同步」核对并读取；会先保全本机修改。</p>
    <p className="notebookStatus" role="status">{status}</p>
    {conflict && batch && <button type="button" onClick={() => {setRevision(0);persist({...batch,id:crypto.randomUUID(),source:`${batch.source.slice(0,280)}（本机副本）`},0);}}>将本机草稿另存为新收集</button>}
    {batch && <fieldset disabled={loading || saving} className="notebookControls">
      <div className="notebookBatchHead"><label>本次来源<input required maxLength={300} value={batch.source} onChange={(e) => persist({...batch,source:e.target.value})} /></label><label>收集日期<input type="date" value={batch.date} onChange={(e) => persist({...batch,date:e.target.value})} /></label><button className="solid" type="button" onClick={save}>{saving ? "保存中…" : dirty ? "保存到当前工作区 · 有修改" : "保存到当前工作区"}</button></div>
      <div className="notebookMode"><button type="button" aria-pressed={!review} onClick={() => setReview(false)}>收集与编辑</button><button type="button" aria-pressed={review} onClick={() => {setReview(true);setRevealed([]);}}>遮挡复习</button><span>本次 {batch.words.length} 个生词</span></div>
      <div className="notebookDisplay" role="group" aria-label="生词本显示设置">
        <span>显示内容</span>
        <label><input type="checkbox" checked={display.showReference} onChange={(e) => changeDisplay("showReference",e.target.checked)} />显示对照释义</label>
        <label><input type="checkbox" checked={display.showMemory} onChange={(e) => changeDisplay("showMemory",e.target.checked)} />显示记忆笔记</label>
        <small>只调整显示，内容会保留。</small>
      </div>
      {displayStatus && <p className="notebookHint" role="status">{displayStatus}</p>}
      {!review && <div className="notebookAddGrid notebookUnifiedAdd">
        <section className="notebookPanel"><h2>添加生词</h2><div className="notebookSearch"><input aria-label="搜索所有模块的生词" value={query} onChange={(e) => {setQuery(e.target.value);setManual({meaning:"",note:"",origin:"手动补充"});}} placeholder="输入英文、中文释义或来源…" /><select aria-label="筛选词库" value={module} onChange={(e) => setModule(e.target.value)}><option>全部词库</option>{modules.map((m) => <option key={m}>{m}</option>)}</select></div><p className="notebookHint">同一个词可勾选多个来源，释义会合并到一行。{catalogStatus}</p>
          <details className="notebookSourcePreferences"><summary>词库来源优先顺序</summary>
            <p className="notebookHint">排在前面的来源优先显示；同一来源内，完整匹配的单词优先。偏好保存在这台设备。</p>
            <ol>{modules.map((name,index) => <li key={name}><span className="notebookSourceRank">{index+1}</span><span className="notebookSourceName">{name}</span><div><button type="button" aria-label={`上移 ${name}`} disabled={index===0} onClick={() => moveSource(name,-1)}>上移</button><button type="button" aria-label={`下移 ${name}`} disabled={index===modules.length-1} onClick={() => moveSource(name,1)}>下移</button></div></li>)}</ol>
            <button type="button" onClick={() => saveSourceOrder(defaultModules)}>恢复默认顺序</button>
            {orderStatus && <p className="notebookHint" role="status">{orderStatus}</p>}
          </details>
          <div className="notebookResults">{matches.slice(0,100).map((w) => {const exists=hasNotebookSource(batch.words,w);return <label className="notebookResult" key={w.id}><input type="checkbox" disabled={exists} checked={selected.includes(w.id)} onChange={(e) => setSelected((s) => e.target.checked ? [...s,w.id] : s.filter((id) => id!==w.id))} /><span><strong>{w.word}</strong><span className="notebookMeaning">{w.meaning || "暂无释义，可加入后补充"}</span><small>{w.origin}{exists ? " · 本次已加入" : ""}</small></span></label>;})}{!query.trim() && <p>输入关键词，搜索所有已有模块。</p>}</div>
          {matches.length>100 && <p className="notebookHint">共 {matches.length} 条，显示前 100 条。可缩小关键词或选择词库。</p>}
          {!!query.trim() && <details className="notebookSupplement" key={query.trim()} open={!matches.length || undefined}>
            <summary>{matches.length ? "查词典或补充这一个词" : `词库未找到「${query.trim()}」，查词典或直接填写`}</summary>
            <DictionaryLookup word={query.trim()} meaning={manual.meaning} origin={manual.origin} onApply={(meaning,origin) => setManual(previous=>({...previous,meaning,origin}))} />
            <div className="notebookSupplementFields"><label>补充释义<textarea rows={2} maxLength={4000} value={manual.meaning} placeholder="选择词典释义，或直接填写…" onChange={(e) => setManual({...manual,meaning:e.target.value})} /></label><SharedWordMemory word={query.trim()} editing/><label>这条释义的来源<input maxLength={1000} value={manual.origin} onChange={(e) => setManual({...manual,origin:e.target.value})} /></label></div>
          </details>}
          <button type="button" className="solid" disabled={!selected.length && !query.trim()} onClick={() => {
            const candidates=[...selectedWords];
            if(query.trim() && (manual.meaning.trim() || manual.note.trim() || !candidates.length)) candidates.push({id:"manual",module:"补充",word:query.trim(),meaning:manual.meaning,note:manual.note,origin:manual.origin});
            if(add(candidates)) setManual({meaning:"",note:"",origin:"手动补充"});
          }}>加入本次生词{selected.length ? `（${selected.length} 条所选释义）` : ""}</button>
        </section>
      </div>}
      <div className="notebookListHead"><h2>{review ? "本次生词复习" : "本次生词"}</h2>{review && <RevealControls total={batch.words.length} shown={batch.words.filter((word) => revealed.includes(word.id)).length} showLabel="显示全部释义" onShow={() => setRevealed(batch.words.map((word) => word.id))} onHide={() => setRevealed([])} />}{removed && <button type="button" onClick={() => {const next=[...batch.words];next.splice(removed.index,0,removed.word);persist({...batch,words:next});setRemoved(null);}}>撤销移除 {removed.word.word}</button>}</div>
      {!batch.words.length && <p className="notebookEmpty">还没有生词。输入单词，勾选来源或填写释义，再点击「加入本次生词」。</p>}
      {review && !!batch.words.length && <div className="shortcutBar notebookShortcuts" aria-label="生词本复习快捷键"><span><kbd>↑</kbd><kbd>←</kbd> 上一词</span><span><kbd>↓</kbd><kbd>→</kbd> 下一词</span><span><kbd>Space</kbd> 发音</span><span><kbd>Enter</kbd> 显示 / 隐藏释义与笔记</span><span><kbd>1</kbd> 不认识</span><span><kbd>2</kbd> 模糊</span><span><kbd>3</kbd> 熟悉</span><span>标注时同时揭晓释义</span></div>}
      {review && !!batch.words.length && <div className="notebookRowHeader" aria-hidden="true"><span>单词</span><div><span>释义</span>{showNotes && <span>{display.showReference && display.showMemory ? "对照与记忆笔记" : display.showReference ? "对照释义" : "记忆笔记"}</span>}<span>词库来源</span></div><span>掌握程度</span></div>}
      <div className="notebookWords">{batch.words.map((w,index) => <article className={`notebookWord${w.rating ? ` rated-${w.rating}` : ""}${review && activeWord?.id === w.id ? " notebookActive" : ""}`} key={w.id} tabIndex={review ? 0 : undefined} aria-current={review && activeWord?.id === w.id ? "true" : undefined} ref={(node) => {rowRefs.current[w.id]=node;}} onClick={() => setActiveId(w.id)} onFocus={() => setActiveId(w.id)}>
        <div className="notebookWordHead">
          <span className="notebookWordNumber">{index+1}</span>
          {review ? <strong className="notebookCardTitle">{w.word}</strong> : <input className="notebookCardTitle" aria-label={`第 ${index+1} 个单词`} maxLength={300} value={w.word} onChange={(e) => editWord(w.id,"word",e.target.value)} />}
          <button className="notebookPronounce" type="button" onClick={() => pronounce(w.word)} aria-label={`朗读生词 ${w.word}`} title="朗读">▶</button>
          {!review && <button className="notebookRemove" type="button" aria-label={`移除 ${w.word}`} onClick={() => {setRemoved({word:w,index});persist({...batch,words:batch.words.filter((x) => x.id!==w.id)});}}>移除</button>}
        </div>
        {review ? <div className="notebookCardReview">
          <button className="notebookReveal" type="button" aria-expanded={revealed.includes(w.id)} onClick={() => setRevealed((s) => s.includes(w.id) ? s.filter((id) => id!==w.id) : [...s,w.id])}>{revealed.includes(w.id) ? (w.meaning || "未填写释义").split("\n").map((line,i)=><span key={i} className={/^【.*】$/.test(line.trim())?"notebookMeaningSource":"notebookMeaningLine"}>{line||"\u00a0"}</span>) : "点击揭晓释义与笔记"}</button>
          {revealed.includes(w.id) && showNotes && <div className="notebookCardNote">{display.showReference && w.note && <section className="notebookCollectionNote"><strong>对照释义与收集笔记</strong><p>{w.note}</p></section>}{display.showMemory && <SharedWordMemory word={w.word}/>}</div>}
          <div className="notebookCardSource"><span>词库来源</span><p>{w.origin || "未填写"}</p></div>
          <details className="notebookCardDictionary"><summary>补查词典</summary><DictionaryLinks word={w.word}/></details>
        </div> : <div className="notebookEditGrid">
          <label>释义<textarea rows={2} maxLength={4000} value={w.meaning} placeholder="填写释义" onChange={(e) => editWord(w.id,"meaning",e.target.value)} /></label>
          {showNotes && <div className="notebookCardNote">{display.showReference && <label>对照释义与收集笔记<textarea rows={4} maxLength={4000} value={w.note} placeholder="保留词库中的释义、来源或本次收集的补充笔记，与左侧释义分开。" onChange={(e) => editWord(w.id,"note",e.target.value)} /></label>}{display.showMemory && <SharedWordMemory word={w.word} editing/>}</div>}
          <label>词库来源<textarea rows={1} maxLength={1000} value={w.origin} onChange={(e) => editWord(w.id,"origin",e.target.value)} /></label>
          <details className="notebookCardDictionary"><summary>补查词典</summary><DictionaryLookup word={w.word} meaning={w.meaning} origin={w.origin} onApply={(meaning,origin) => {if(batch)persist({...batch,words:batch.words.map(item=>item.id===w.id?{...item,meaning,origin}:item)});}} /></details>
        </div>}
        <div className="notebookRating"><span>掌握程度{!w.rating ? " · 未标注" : ""}</span><div className="trafficLights" role="group" aria-label={`${w.word} 掌握程度`}>
          {([{value:"unknown",label:"不认识",color:"red"},{value:"fuzzy",label:"模糊",color:"yellow"},{value:"familiar",label:"熟悉",color:"green"}] as const).map((r) => <button key={r.value} type="button" className={`${r.color}${w.rating === r.value ? " active" : ""}`} aria-pressed={w.rating === r.value} onClick={() => rateWord(w.id,r.value)}><i /><span>{r.label}</span></button>)}
        </div></div>
      </article>)}</div>
      {!!batch.words.length && <div className="notebookListSave"><span>标注、释义和笔记一起保存</span><button className="solid" type="button" onClick={save}>{saving ? "保存中…" : dirty ? "保存全部修改" : "已保存"}</button></div>}
    </fieldset>}
  </section>;
}
