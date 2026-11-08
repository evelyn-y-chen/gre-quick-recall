import type {PlanNavigation} from "../community/planNavigation";
import {studyStorage} from "../community/storage";
import {recordLearningPlanWords} from "../community/learningPlanStore";
import {reviewDay} from "../community/practiceReviewModel";
import {appFetch,getWorkspaceGeneration} from "../community/api";
import {persistLearningWorkspace} from "../community/workspacePersistence";
"use client";

import SharedWordMemory,{useWordMemory} from "./SharedWordMemory";
import NotebookFrequencyBadge from "./NotebookFrequency";
import {alphabeticalIds} from "./studyWordOrder";
import {buildNotebookPractice} from "./notebookPracticeModel";
import Practice,{type NotebookPractice} from "../community/Practice";
import DictionaryLookup from "./DictionaryLookup";
import DictionaryLinks from "./DictionaryLinks";
import NotebookWrittenRecall from "./NotebookWrittenRecall";
import NotebookRecallTools from "./NotebookRecallTools";
import {appendNotebookRecall,hideNotebookRecallReferences,startNotebookRecall} from "./notebookRecallModel";
import {createNotebookAutosaver,type NotebookSaveState} from "./notebookAutosave";
import RevealControls from "./RevealControls";
import { memo, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { buildNotebookCatalog, type CatalogWord } from "./notebookCatalog";
import { NOTEBOOK_DRAFT_KEY, hasNotebookSource, mergeNotebookCandidates, notebookBriefMeaning, validNotebookBatch, type NotebookBatch, type NotebookDraft, type NotebookSummary, type NotebookWord, type NotebookRating } from "./notebookModel";
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
const summary = (batch: NotebookBatch, revision: number, draft=false): NotebookSummary => ({id: batch.id, source: batch.source, date: batch.date, count: batch.words.length, revision,...(draft?{draft:true}:{}),...(batch.recallReminder?{recallReminder:batch.recallReminder}:{})});
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
    return {showBriefMeaning: saved?.showBriefMeaning !== false, showReference: saved?.showReference !== false, showMemory: saved?.showMemory !== false};
  } catch { return {showBriefMeaning:true,showReference:true,showMemory:true}; }
}
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };

type NotebookRowActions = {
  activate:(id:string)=>void;
  pronounce:(word:string)=>void;
  edit:(id:string,field:"word"|"meaning"|"briefMeaning"|"note"|"origin",value:string)=>void;
  remove:(id:string)=>void;
  reveal:(id:string)=>void;
  rate:(id:string,rating:NotebookRating)=>void;
  applyMeaning:(id:string,meaning:string,origin:string)=>void;
  again:(id:string)=>void;
  recall:(id:string,recalls:NonNullable<NotebookWord["recalls"]>)=>void;
};
// Unchanged rows retain their word object and stable action ref while a single
// answer is edited. Large collections no longer rebuild every input per key.
const NotebookWordRow=memo(function NotebookWordRow({word:w,index,review,wholeRecall,checking,active,isRevealed,display,source,rowRefs,actions}:{
  word:NotebookWord;index:number;review:boolean;wholeRecall:boolean;checking:boolean;active:boolean;isRevealed:boolean;
  display:ReturnType<typeof displayPreferences>;source:string;
  rowRefs:RefObject<Record<string,HTMLElement|null>>;actions:RefObject<NotebookRowActions>;
}) {
  const showNotes=display.showReference||display.showMemory;
  return <article className={`notebookWord${w.recalls?.at(-1)?.result||w.recalls?.at(-1)?.forgotten?` notebookJudged-${w.recalls.at(-1)!.result??'incorrect'}`:""}${w.rating ? ` rated-${w.rating}` : ""}${active ? " notebookActive" : ""}`} key={w.id} data-word-id={w.id} tabIndex={active ? 0 : -1} aria-current={active ? "true" : undefined} ref={(node) => {rowRefs.current[w.id]=node;}} onClick={() => actions.current.activate(w.id)} onFocus={() => actions.current.activate(w.id)}>
        <div className="notebookWordHead">
          <span className="notebookWordNumber">{index+1}</span>
          <div className="notebookWordLabel">{review || wholeRecall ? <strong className="notebookCardTitle">{w.word}</strong> : <input className="notebookCardTitle" aria-label={`第 ${index+1} 个单词`} maxLength={300} value={w.word} onChange={(e) => actions.current.edit(w.id,"word",e.target.value)} />}<NotebookFrequencyBadge word={w.word}/></div>
          <button className="notebookPronounce" type="button" onClick={() => actions.current.pronounce(w.word)} aria-label={`朗读生词 ${w.word}`} title="朗读">▶</button>
          {!review && !wholeRecall && <button className="notebookRemove" type="button" aria-label={`移除 ${w.word}`} onClick={() => actions.current.remove(w.id)}>移除</button>}
        </div>
        {review ? <div className="notebookCardReview">
          {display.showBriefMeaning && isRevealed && <p className="notebookBriefPreview"><small>简短释义</small><span>{notebookBriefMeaning(w)||"未填写"}</span></p>}
          <button className="notebookReveal" type="button" aria-expanded={isRevealed} onClick={() => actions.current.reveal(w.id)}>{isRevealed ? (w.meaning || "未填写释义").split("\n").map((line,i)=><span key={i} className={/^【.*】$/.test(line.trim())?"notebookMeaningSource":"notebookMeaningLine"}>{line||"\u00a0"}</span>) : "点击揭晓释义与笔记"}</button>
          {isRevealed && showNotes && <div className="notebookCardNote">{display.showReference && w.note && <section className="notebookCollectionNote"><strong>对照释义与收集笔记</strong><p>{w.note}</p></section>}{display.showMemory && <SharedWordMemory word={w.word}/>}</div>}
          <div className="notebookCardSource"><span>词库来源</span><p>{w.origin || "未填写"}</p></div>
          <details className="notebookCardDictionary"><summary>补查词典</summary><DictionaryLinks word={w.word}/></details>
        </div> : wholeRecall ? <div className="notebookWholeReference">
          {checking||w.recalls?.at(-1)?.revealed?<><strong>参考释义</strong><p>{notebookBriefMeaning(w)||"还没有参考释义，可在收集与编辑中补充。"}</p>
            <details><summary>完整释义、笔记与来源</summary><p>{w.meaning||"未填写完整释义"}</p>{display.showReference&&w.note&&<p>{w.note}</p>}{display.showMemory&&<SharedWordMemory word={w.word}/>}<small>{w.origin||source}</small></details>
            <DictionaryLinks word={w.word}/>
          </>:<p className="notebookWholeMasked">参考释义待统一核对</p>}
        </div> : <div className="notebookEditGrid">
          {display.showBriefMeaning && <label className="notebookBriefMeaning">简短释义<textarea aria-label={`${w.word} 简短释义`} rows={2} maxLength={500} value={notebookBriefMeaning(w)} placeholder="用几个字记住大意（选填）" onChange={e=>actions.current.edit(w.id,"briefMeaning",e.target.value)}/></label>}
          <details className="notebookReferenceMeaning"><summary>{w.meaning.trim()?"查看／编辑参考释义":"填写参考释义（选填）"}</summary><label>释义<textarea rows={2} maxLength={4000} value={w.meaning} placeholder="参考释义可以留空" onChange={(e) => actions.current.edit(w.id,"meaning",e.target.value)} /></label></details>
          <DictionaryLinks word={w.word}/>
          <details className="notebookRowExtras"><summary>笔记与来源</summary>
          {showNotes && <div className="notebookCardNote">{display.showReference && <label>对照释义与收集笔记<textarea rows={4} maxLength={4000} value={w.note} placeholder="保留词库中的释义、来源或本次收集的补充笔记，与左侧释义分开。" onChange={(e) => actions.current.edit(w.id,"note",e.target.value)} /></label>}{display.showMemory && <SharedWordMemory word={w.word} editing/>}</div>}
          <label>词库来源<textarea rows={1} maxLength={1000} value={w.origin} onChange={(e) => actions.current.edit(w.id,"origin",e.target.value)} /></label>
          <details className="notebookCardDictionary"><summary>补查词典</summary><DictionaryLookup word={w.word} meaning={w.meaning} origin={w.origin} onApply={(meaning,origin) => actions.current.applyMeaning(w.id,meaning,origin)} /></details>
          </details>
        </div>}
        {!review&&<NotebookWrittenRecall word={w} wholePage={wholeRecall} referenceVisible={checking||!!w.recalls?.at(-1)?.revealed} onNewAttempt={()=>actions.current.again(w.id)} onChange={recalls=>actions.current.recall(w.id,recalls)}/>}
        <div className="notebookRating"><span>掌握程度{!w.rating ? " · 未标注" : ""}</span>{wholeRecall&&!checking?<small>统一核对后标记</small>:<div className="trafficLights" role="group" aria-label={`${w.word} 掌握程度`}>
          {([{value:"unknown",label:"不认识",color:"red"},{value:"fuzzy",label:"模糊",color:"yellow"},{value:"familiar",label:"熟悉",color:"green"}] as const).map((r) => <button key={r.value} type="button" className={`${r.color}${w.rating === r.value ? " active" : ""}`} aria-pressed={w.rating === r.value} onClick={() => actions.current.rate(w.id,r.value)}><i /><span>{r.label}</span></button>)}
        </div>}</div>
      </article>;
});

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
  const [saveStates,setSaveStates]=useState<Record<string,NotebookSaveState>>({});
  const mounted=useRef(true),workspaceGeneration=useRef(getWorkspaceGeneration());
  const currentBatch=useRef({batch,revision});currentBatch.current={batch,revision};
  const memoryRef=useRef(sharedMemory);memoryRef.current=sharedMemory;
  const autosaver=useRef<ReturnType<typeof createNotebookAutosaver>|null>(null);
  if(!autosaver.current)autosaver.current=createNotebookAutosaver({
    storage:studyStorage,generation:workspaceGeneration.current,getGeneration:getWorkspaceGeneration,
    schedule:fn=>window.setTimeout(fn,600),cancel:id=>window.clearTimeout(id),
    put:async(next,rev)=>{
      const response=await appFetch("/api/notebook",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({batch:next,revision:rev})});
      const result=await response.json();
      if(!response.ok)throw Object.assign(Error(result.error||"生词本自动保存失败，请重试。"),{conflict:response.status===409});
      return result;
    },
    persist:()=>persistLearningWorkspace(workspaceGeneration.current),
    saveMemory:async()=>{const memory=memoryRef.current;return !memory||!Object.keys(memory.drafts).length||await memory.save();},
    onState:(id,state)=>{
      if(!mounted.current)return;
      setSaveStates(states=>({...states,[id]:state}));
      if(currentBatch.current.batch?.id===id)setConflict(state.phase==='conflict');
    },
    onLocalSave:(saved,rev)=>{
      if(!mounted.current)return;
      const pending=drafts()[saved.id];
      setBatches(items=>[summary(pending?.batch??saved,rev,!!pending),...items.filter(item=>item.id!==saved.id)]);
      if(currentBatch.current.batch?.id===saved.id){
        currentBatch.current.revision=rev;setRevision(rev);
        setDirty(JSON.stringify(currentBatch.current.batch)!==JSON.stringify(saved));
      }
      window.dispatchEvent(new Event("word-memory-source-saved"));
    },
  });
  useEffect(()=>{
    mounted.current=true;const flush=()=>{void autosaver.current?.flushAll();};
    window.addEventListener('online',flush);window.addEventListener('pagehide',flush);
    return()=>{mounted.current=false;window.removeEventListener('online',flush);window.removeEventListener('pagehide',flush);flush();};
  },[]);
  useEffect(()=>{
    if(batch&&sharedMemory&&Object.keys(sharedMemory.drafts).length&&!sharedMemory.busy)autosaver.current?.schedule(batch,revision);
  },[batch?.id,sharedMemory?.drafts,sharedMemory?.busy,sharedMemory?.ready]);
  const [query,setQuery] = useState("");
  const [module,setModule] = useState("全部词库");
  const [selected,setSelected] = useState<string[]>([]);
  const [manual,setManual] = useState({meaning:"",note:"",origin:"手动补充"});
  const rowEntry=batch?.entryDraft??{word:"",meaning:""};
  const entryRef=useRef<HTMLInputElement|null>(null);
  const [activeId,setActiveId] = useState("");
  const rowRefs = useRef<Record<string, HTMLElement | null>>({});
  const centerRequested = useRef(false);
  const [review,setReview] = useState(false);
  const [revealed,setRevealed] = useState<string[]>([]);
  const [display,setDisplay] = useState(displayPreferences);
  const [displayStatus,setDisplayStatus] = useState("");
  const [wordOrder,setWordOrder] = useState<string[] | null>(null);
  const [alphabetical,setAlphabetical] = useState(false);
  const [testCollections,setTestCollections] = useState<string[]>([]);
  const [testLoading,setTestLoading] = useState(false);
  const [testStatus,setTestStatus] = useState("");
  const [testing,setTesting] = useState<NotebookPractice|null>(null);
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
  const selectedWords = useMemo(() => catalog.filter((w) => selected.includes(w.id)),[catalog,selected]);
  const showNotes = display.showReference || display.showMemory;
  function changeDisplay(field: "showBriefMeaning" | "showReference" | "showMemory", checked: boolean) {
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
    currentBatch.current={batch:next,revision:rev};
    setBatch(next); setDirty(true); setConflict(false);
    setBatches((items) => [summary(next,rev,true),...items.filter((item) => item.id !== next.id)]);
    try {
      studyStorage.setItem(NOTEBOOK_DRAFT_KEY,JSON.stringify({...drafts(),[next.id]:{batch:next,revision:rev}}));
      setStatus("修改已保留，生词本会自动保存。");
      autosaver.current?.schedule(next,rev);
    } catch { setStatus("本机草稿空间不足，请立即保存到当前工作区。"); }
  }
  function resetView() { setActiveId(""); setSelected([]); setRemoved(null); setRevealed([]); setReview(false); setConflict(false); setWordOrder(null); setAlphabetical(false); }
  function create() {
    if (!source.trim() || !date) return;
    resetView(); setRevision(0);
    persist({id:crypto.randomUUID(),source:source.trim(),date,words:[]},0);
    setSource("");
  }
  async function open(id: string) {
    if (!id || id === currentBatch.current.batch?.id) return currentBatch.current.batch;
    resetView(); setLoading(true);
    const local = drafts()[id];
    if (local) {
      currentBatch.current={batch:local.batch,revision:local.revision};
      setBatch(local.batch); setRevision(local.revision); setDirty(true); setStatus("已恢复这次收集的本机草稿，将自动保存。"); setLoading(false); autosaver.current?.schedule(local.batch,local.revision); return local.batch;
    }
    try {
      const response = await appFetch(`/api/notebook?id=${encodeURIComponent(id)}`,{cache:"no-store"});
      if (!response.ok) throw new Error();
      const saved = await response.json() as NotebookDraft;
      currentBatch.current={batch:saved.batch,revision:saved.revision};
      setBatch(saved.batch); setRevision(saved.revision); setDirty(false); setStatus("已读取工作区生词本。");return saved.batch;
    } catch { setStatus("读取失败，请重试；当前收集未改变。"); }
    finally { setLoading(false); }
  }
  useEffect(()=>{if(!planTarget||planTarget.deckId!=='notebook'||!planTarget.batchId)return;void open(planTarget.batchId).then(opened=>{
    if(opened&&planTarget.notebookRecall&&opened.recallReminder){setReview(false);persist(startNotebookRecall(opened,opened.recallReminder.wordIds,()=>crypto.randomUUID()),currentBatch.current.revision);}
    else if(opened)setReview(true);
    onPlanTargetHandled?.();
  });},[planTarget?.id]);
  async function save() {
    if (!batch) return;
    setSaving(true);
    try {autosaver.current?.schedule(batch,currentBatch.current.revision);await autosaver.current?.flush(batch.id);}
    finally { setSaving(false); }
  }
  function checkAllRecall() {
    if(!batch)return;
    persist({...batch,recallPhase:"checking",words:batch.words.map(word=>{
      if(batch.recallRound&&!batch.recallRound.wordIds.includes(word.id))return word;
      const attempts=word.recalls??[],last=attempts.at(-1);
      return last&&(last.answer.trim()||last.forgotten)?{...word,recalls:[...attempts.slice(0,-1),{...last,checked:true,revealed:true,...(last.forgotten&&!last.result?{result:'incorrect' as const}:{})}]}:word;
    })});
  }
  function add(candidates: Array<Pick<CatalogWord,"word"|"meaning"|"note"|"origin">>,clearEntry=false) {
    if (!batch) return false;
    const merged=mergeNotebookCandidates(batch.words,candidates,()=>crypto.randomUUID());
    if (merged.length > 1000) {setStatus("本次已超过 1000 个词，请另开一次收集。");return false;}
    if (!validNotebookBatch({...batch,words:merged})) {setStatus("合并后内容过长，请减少所选释义或先精简已有内容；本次修改尚未加入。");return false;}
    persist({...batch,words:merged,...(clearEntry?{entryDraft:undefined}:{})}); setSelected([]);
    setStatus(`已合并所选释义，本次共 ${merged.length} 个词，修改会自动保存。`);
    return true;
  }
  function editWord(id: string, field: "word"|"meaning"|"briefMeaning"|"note"|"origin", value: string) {
    if (batch) persist({...batch,words:batch.words.map((w) => w.id === id ? {...w,[field]:value} : w)});
  }
  async function startNotebookTest() {
    if (!testCollections.length || testLoading) return;
    setTestLoading(true); setTestStatus("正在准备所选收集…");
    try {
      const local=drafts();
      const selected=await Promise.all(testCollections.map(async id=>{
        if (batch?.id===id) return batch;
        if (local[id]) return local[id].batch;
        const response=await appFetch(`/api/notebook?id=${encodeURIComponent(id)}`,{cache:"no-store"});
        if (!response.ok) throw Error("部分收集未能读取，请重试；原有记录没有改变。");
        const saved=await response.json();
        if (!validNotebookBatch(saved.batch,false)) throw Error("部分收集格式不完整，请先打开核对。");
        return saved.batch;
      }));
      const prepared=buildNotebookPractice(selected);
      if (!prepared.terms.length) throw Error("这些收集中还没有可测试的释义，请先补充释义。");
      setTestStatus(`已合并 ${prepared.collections} 次收集，共 ${prepared.terms.length} 个词${prepared.duplicates?`（同词合并 ${prepared.duplicates} 条）`:""}${prepared.missingMeanings?`；${prepared.missingMeanings} 条未填写释义，暂不出题`:""}。`);
      setTesting(prepared);
    } catch(error) { setTestStatus(error instanceof Error?error.message:"测试尚未开始，请重试。"); }
    finally { setTestLoading(false); }
  }

  function rateWord(id: string, rating: NotebookRating, toggle = false) {
    const word=batch?.words.find(w=>w.id===id);
    if(word&&!(toggle&&word.rating===rating))recordLearningPlanWords([word.word],rating==="familiar"?"green":rating==="fuzzy"?"yellow":"red",reviewDay(),batch!.words.map(w=>w.word));
    if (batch) persist({...batch,words:batch.words.map((w) => w.id === id ? {...w,rating:toggle && w.rating === rating ? undefined : rating} : w)});
  }

  const displayWords = useMemo(() => {
    const allWords = batch?.words ?? [];
    const scope=batch?.recallPhase&&!review?batch.recallRound?.wordIds:undefined;
    const words=scope?allWords.filter(word=>scope.includes(word.id)):allWords;
    const ids = alphabetical ? alphabeticalIds(words,word=>word.word) : wordOrder;
    if (!ids) return words;
    const byId = new Map(words.map(word=>[word.id,word]));
    return [...ids.map(id=>byId.get(id)).filter((word): word is NotebookWord=>!!word),...words.filter(word=>!ids.includes(word.id))];
  },[batch,wordOrder,alphabetical,review]);
  function changeWordOrder(mode:"original"|"shuffle"|"alphabetical") {
    setAlphabetical(mode === "alphabetical"); setActiveId("");
    if (mode !== "shuffle") { setWordOrder(null); return; }
    const ids = (batch?.words ?? []).map(word=>word.id);
    for (let i=ids.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [ids[i],ids[j]]=[ids[j],ids[i]]; }
    setWordOrder(ids);
  }
  const activeWord = displayWords.find((w) => w.id === activeId) ?? displayWords[0];
  const activeWordId = activeWord?.id;
  const activeWordRevealed = !!activeWordId && revealed.includes(activeWordId);
  useEffect(() => {
    // Editing/focusing another input must not scroll the document mid-answer.
    // Outside masked review, only an explicit arrow move requests centering.
    if ((!review && !centerRequested.current) || !activeWordId) return;
    centerRequested.current=false;
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
    if(testing||document.querySelector?.(".learningPlanOverlay, .onboardingOverlay, .workspaceMenuOverlay, [role='dialog'][aria-modal='true']"))return;
    const target = event.target as HTMLElement | null;
    if (event.defaultPrevented || !activeWord || !batch || loading || saving || event.isComposing || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || target?.closest("input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='textbox']")) return;
    if (target?.closest("button, summary, a") && (event.key === "Enter" || event.code === "Space")) return;
    const backward = event.key === "ArrowUp" || review && event.key === "ArrowLeft";
    const forward = event.key === "ArrowDown" || review && event.key === "ArrowRight";
    if (event.repeat && !backward && !forward) return;
    if (backward || forward) {
      event.preventDefault();
      const index = displayWords.findIndex((w) => w.id === activeWord.id);
      const next = displayWords[Math.max(0, Math.min(displayWords.length - 1, index + (forward ? 1 : -1)))];
      centerRequested.current=next.id!==activeWord.id;
      setActiveId(next.id); rowRefs.current[next.id]?.focus({preventScroll:true});
      return;
    }
    if (!review) return;
    if (event.code === "Space") { event.preventDefault(); pronounce(activeWord.word); return; }
    if (event.key === "Enter") { event.preventDefault(); setRevealed((s) => s.includes(activeWord.id) ? s.filter((id) => id !== activeWord.id) : [...s,activeWord.id]); return; }
    const rating = ({"1":"unknown","2":"fuzzy","3":"familiar"} as Record<string,NotebookRating>)[event.key];
    if (rating) { event.preventDefault(); rateWord(activeWord.id,rating,false); setRevealed((s) => s.includes(activeWord.id) ? s : [...s,activeWord.id]); }
  }
  useEffect(() => { window.addEventListener("keydown",handleKeyboard); return () => window.removeEventListener("keydown",handleKeyboard); });

  const rowActions=useRef<NotebookRowActions>(null!);
  rowActions.current={
    activate:setActiveId,pronounce,edit:editWord,rate:rateWord,
    remove:id=>{if(!batch)return;const index=batch.words.findIndex(word=>word.id===id);if(index<0)return;setRemoved({word:batch.words[index],index});persist({...batch,words:batch.words.filter(word=>word.id!==id)});},
    reveal:id=>setRevealed(ids=>ids.includes(id)?ids.filter(value=>value!==id):[...ids,id]),
    applyMeaning:(id,meaning,origin)=>{if(batch)persist({...batch,words:batch.words.map(word=>word.id===id?{...word,meaning,origin}:word)});},
    again:id=>{if(batch)persist({...batch,words:batch.words.map(word=>word.id===id?appendNotebookRecall(word,()=>crypto.randomUUID()):word)});},
    recall:(id,recalls)=>{if(batch)persist({...batch,words:batch.words.map(word=>word.id===id?{...word,recalls}:word)});},
  };
  const saveState=batch?saveStates[batch.id]:undefined;
  const wholeRecall=!review&&!!batch?.recallPhase,checking=batch?.recallPhase==="checking";
  const recalledCount=displayWords.filter(word=>{const last=word.recalls?.at(-1);return last&&(last.answer.trim()||last.forgotten);}).length??0;
  const wholeRecallActions=batch&&<><button type="button" className="solid" disabled={!batch.words.length} onClick={()=>checking?persist(hideNotebookRecallReferences(batch)):checkAllRecall()}>{checking?"隐藏释义，继续回忆":"统一核对释义"}</button><span>{checking?"参考释义已显示，请判断正确／错误，再标记掌握程度。":`已回忆 ${recalledCount} / ${displayWords.length} 词；想不起来可点「不记得」。`}</span></>;
  return <section className={`vocabNotebook${review ? " notebookReviewMode" : " notebookDocumentMode"}${wholeRecall?" notebookWholeRecall":""}${showNotes ? "" : " notebookNotesHidden"}`} onKeyDown={(e) => {e.stopPropagation();handleKeyboard(e.nativeEvent);}}>
    <div className="libraryHead"><div><p className="eyebrow">MY VOCABULARY</p><h1>生词本</h1><p className="quickIntro">像写文档一样逐行收集，先回忆释义，再查词核对。</p></div></div>
    <fieldset disabled={loading || saving} className="notebookControls">
      <form className="notebookNew" onSubmit={(e) => {e.preventDefault();create();}}>
        <label>这次生词的来源<input required maxLength={300} value={source} onChange={(e) => setSource(e.target.value)} placeholder="例如：阅读机经 Passage 11 · 第二次练习" /></label>
        <label>日期<input required type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label><button className="solid" type="submit">开始这次收集</button>
      </form>
      <label className="notebookHistory">以前的收集 · {batches.length} 次{batches.some(b=>b.draft)?`（含 ${batches.filter(b=>b.draft).length} 次草稿）`:''}<select value={batch?.id ?? ""} onChange={(e) => void open(e.target.value)}><option value="">选择一次收集…</option>{batches.map((b) => <option key={b.id} value={b.id}>{b.date} · {b.source}（{b.count} 词{b.draft?' · 草稿':''}）</option>)}</select></label>
    </fieldset>
    <p className="notebookHint">账号模式下，其他设备的收集还没显示？可在「更多」→「检查账号同步」核对并读取；会先保全本机修改。</p>
    <p className="notebookStatus" role="status">{status}</p>
    {!!batches.length && <section className="notebookCombinedTest">
      <details><summary>多次收集一起测试 · 已选 {testCollections.length} 次</summary>
        <p>选择要一起复习的收集。同词合并释义与来源，不改变各次收集；当前草稿也会保留。</p>
        <div className="notebookTestActions"><button type="button" disabled={testLoading} onClick={()=>setTestCollections(batches.map(item=>item.id))}>全选收集</button><button type="button" disabled={testLoading} onClick={()=>setTestCollections([])}>清空选择</button></div>
        <div className="notebookTestChoices">{batches.map(item=><label key={item.id}><input type="checkbox" disabled={testLoading} checked={testCollections.includes(item.id)} onChange={e=>setTestCollections(ids=>e.target.checked?[...ids,item.id]:ids.filter(id=>id!==item.id))}/><span>{item.source}<small>{item.date} · {item.count} 词{item.draft?" · 草稿":""}</small></span></label>)}</div>
      </details>
      <button className="solid" type="button" disabled={!testCollections.length||testLoading||loading} onClick={()=>void startNotebookTest()}>{testLoading?"正在准备…":`测试所选 ${testCollections.length} 次收集`}</button>
      {testStatus&&<p role="status">{testStatus}</p>}
    </section>}
    {conflict && batch && <button type="button" onClick={() => {setRevision(0);persist({...batch,id:crypto.randomUUID(),source:`${batch.source.slice(0,280)}（本机副本）`},0);}}>将本机草稿另存为新收集</button>}
    {batch && <fieldset disabled={loading} className="notebookControls">
      <div className="notebookBatchHead"><label>本次来源<input required maxLength={300} value={batch.source} onChange={(e) => persist({...batch,source:e.target.value})} /></label><label>收集日期<input type="date" value={batch.date} onChange={(e) => persist({...batch,date:e.target.value})} /></label><button className="solid" type="button" disabled={saving} onClick={save}>{saving ? "保存中…" : "立即保存"}</button></div>
      <div className="notebookStatus" role="status" aria-live="polite"><strong>生词本自动保存</strong> · {saveState?.message??(dirty?"草稿已保留，正在准备自动保存…":"当前收集已保存，修改后会自动保存。")}</div>
      <div className="notebookMode"><button type="button" aria-pressed={!review&&!wholeRecall} onClick={() => {setReview(false);if(batch.recallPhase)persist({...batch,recallPhase:undefined});}}>收集与编辑</button><button type="button" aria-pressed={wholeRecall} onClick={()=>{setReview(false);if(!batch.recallPhase)persist(hideNotebookRecallReferences(batch));}}>整页回忆</button><button type="button" aria-pressed={review} onClick={() => {setReview(true);setRevealed([]);}}>遮挡复习</button><span>本次 {batch.words.length} 个生词</span></div>
      {wholeRecall&&<div className="notebookWholeToolbar" role="group" aria-label="整页回忆操作">{wholeRecallActions}</div>}
      {!wholeRecall&&<div className="notebookDisplay" role="group" aria-label="生词本显示设置">
        <span>显示内容</span>
        <label><input type="checkbox" checked={display.showBriefMeaning} onChange={(e) => changeDisplay("showBriefMeaning",e.target.checked)} />显示简短释义</label>
        <label><input type="checkbox" checked={display.showReference} onChange={(e) => changeDisplay("showReference",e.target.checked)} />显示对照释义</label>
        <label><input type="checkbox" checked={display.showMemory} onChange={(e) => changeDisplay("showMemory",e.target.checked)} />显示记忆笔记</label>
        <small>简短释义可直接编辑；隐藏只调整显示，内容会保留。</small>
      </div>}
      {displayStatus && <p className="notebookHint" role="status">{displayStatus}</p>}
      {!!batch.words.length && <div className="shuffleControls" role="group" aria-label="生词本显示顺序"><button type="button" aria-pressed={!wordOrder&&!alphabetical} onClick={()=>changeWordOrder("original")}>原顺序</button><button type="button" aria-pressed={!!wordOrder&&!alphabetical} onClick={()=>changeWordOrder("shuffle")}>一键打乱</button><button type="button" aria-pressed={alphabetical} onClick={()=>changeWordOrder("alphabetical")}>A–Z 字母排序</button></div>}
      {!review && !wholeRecall && <details className="notebookCatalogAdd"><summary>从已有词库选词，或填入词典释义</summary><div className="notebookAddGrid notebookUnifiedAdd">
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
      </div></details>}
      <div className="notebookListHead"><h2>{review ? "本次生词复习" : "本次生词"}</h2>{review && <RevealControls total={batch.words.length} shown={batch.words.filter((word) => revealed.includes(word.id)).length} showLabel="显示全部释义" onShow={() => setRevealed(batch.words.map((word) => word.id))} onHide={() => setRevealed([])} />}{removed && <button type="button" onClick={() => {const next=[...batch.words];next.splice(removed.index,0,removed.word);persist({...batch,words:next});setRemoved(null);}}>撤销移除 {removed.word.word}</button>}</div>
      {!batch.words.length && <p className="notebookEmpty">从下方第一行开始。只填英文也可以，参考释义可以稍后补充。</p>}
      {wholeRecall?<p className="notebookHint">先滚动填写每个词，想不起来可选「不记得」。写完后在页尾统一核对，逐词判断正确／错误，再标记掌握程度。不记得会立即计错并揭晓该词；可以继续滚动填写。填写、判断和统计自动保存。</p>:!review && <p className="notebookHint">参考释义可展开查看；在「我写的释义」凭记忆填写，点核对后自行判断。也可选择「整页回忆」，全部写完后统一核对。</p>}
      {!!batch.words.length && <div className="shortcutBar notebookShortcuts" aria-label={review?"生词本复习快捷键":"生词本移动快捷键"}><span><kbd>↑</kbd>{review&&<kbd>←</kbd>} 上一词</span><span><kbd>↓</kbd>{review&&<kbd>→</kbd>} 下一词</span>{review?<><span><kbd>Space</kbd> 发音</span><span><kbd>Enter</kbd> 显示 / 隐藏释义与笔记</span><span><kbd>1</kbd> 不认识</span><span><kbd>2</kbd> 模糊</span><span><kbd>3</kbd> 熟悉</span><span>标注时同时揭晓释义</span></>:<span>选中词条自动居中；输入时保留光标操作，点击词条空白处后使用。</span>}</div>}
      {review && !!batch.words.length && <div className="notebookRowHeader" aria-hidden="true"><span>单词</span><div><span>释义</span>{showNotes && <span>{display.showReference && display.showMemory ? "对照与记忆笔记" : display.showReference ? "对照释义" : "记忆笔记"}</span>}<span>词库来源</span></div><span>掌握程度</span></div>}
      {!review&&!!batch.words.length&&<div className="notebookDocumentHeader" aria-hidden="true"><span>英文 · 词频</span><span>{wholeRecall?"统一核对 · 参考释义":"简短释义 · 查词"}</span><span>我写的释义</span><span>掌握程度</span></div>}
      {wholeRecall&&batch.recallRound&&<div className="notebookRecallRound"><span>本轮选择 {displayWords.length} / 本次 {batch.words.length} 词</span><button type="button" onClick={()=>persist({...batch,recallRound:undefined})}>返回整次收集</button></div>}
      <div className="notebookWords">{displayWords.map((word,index)=><NotebookWordRow key={word.id} word={word} index={index} review={review} wholeRecall={wholeRecall} checking={checking} active={activeWord?.id===word.id} isRevealed={revealed.includes(word.id)} display={display} source={batch.source} rowRefs={rowRefs} actions={rowActions}/>)}</div>
      {wholeRecall&&<div className="notebookWholeToolbar notebookWholeFooter" role="group" aria-label="页尾整页回忆操作">{wholeRecallActions}</div>}
      {!!batch.words.length&&<NotebookRecallTools key={batch.id} batch={batch} onStart={ids=>{setReview(false);setActiveId('');setRevealed([]);persist(startNotebookRecall(batch,ids,()=>crypto.randomUUID()));}} onUpdate={next=>persist(next)}/>}
      {!review&&!wholeRecall&&<form className="notebookEntryRow" onSubmit={e=>{e.preventDefault();if(!rowEntry.word.trim())return;if(add([{word:rowEntry.word,meaning:rowEntry.meaning,note:"",origin:batch.source}],true))entryRef.current?.focus();}}>
        <label>下一个单词<input ref={entryRef} aria-label="新一行英文单词" maxLength={300} value={rowEntry.word} placeholder="输入英文…" onChange={e=>persist({...batch,entryDraft:{...rowEntry,word:e.target.value}})}/><NotebookFrequencyBadge word={rowEntry.word}/></label>
        <label>参考释义（选填）<input maxLength={4000} value={rowEntry.meaning} placeholder="可以先留空" onChange={e=>persist({...batch,entryDraft:{...rowEntry,meaning:e.target.value}})}/></label>
        <div className="notebookEntryLookup">{rowEntry.word.trim()?<DictionaryLinks word={rowEntry.word}/>:<span>填入单词后可查韦氏／海词</span>}</div>
        <button type="submit" className="solid" disabled={!rowEntry.word.trim()}>＋ 加入本行</button>
        {(rowEntry.word||rowEntry.meaning)&&<small className="notebookEntryHint">这行已保留为草稿；点击「加入本行」后计入本次收集与词频。</small>}
      </form>}
      {!!batch.words.length && <div className="notebookListSave"><span>{saveState?.message??"标注、释义和笔记会自动保存"}</span>{saveState&&(saveState.phase==='error'||saveState.phase==='conflict')&&<button className="solid" type="button" disabled={saving} onClick={save}>重试保存</button>}</div>}
    </fieldset>}
    {testing && <Practice key={testing.id} deck="notebook" notebook={testing} onClose={()=>setTesting(null)}/>}
  </section>;
}
