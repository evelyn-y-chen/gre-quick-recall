"use client";
import {createContext,useContext,useEffect,useState,type ReactNode} from "react";
import {readNotebookFrequencyBatches,subscribeNotebookChanges} from "../db/notebookStore";
import {studyStorage,subscribeStudyStorage} from "../community/storage";
import {NOTEBOOK_DRAFT_KEY} from "./notebookModel";
import {countNotebookFrequency,notebookFrequencyKey} from "./notebookFrequencyModel";

const FrequencyContext = createContext<Record<string,number>>({});
/** Scoped to the active workspace; drafts replace saved collections, never add twice. */
export function NotebookFrequencyProvider({children}:{children:ReactNode}) {
  const [counts,setCounts] = useState<Record<string,number>>({});
  useEffect(() => {
    let active = true, request = 0;
    let batches:unknown[] = [];
    const update = () => { if (active) setCounts(countNotebookFrequency(batches,studyStorage.getItem(NOTEBOOK_DRAFT_KEY))); };
    async function refresh() {
      const id = ++request;
      try {
        const saved = await readNotebookFrequencyBatches();
        if (!active || id !== request) return;
        batches = saved; update();
      } catch { if (active && id === request) update(); }
    }
    const stopSaved = subscribeNotebookChanges(() => { void refresh(); });
    const stopDrafts = subscribeStudyStorage(key => { if (!key || key === NOTEBOOK_DRAFT_KEY) update(); });
    update(); void refresh();
    return () => { active = false; request++; stopSaved(); stopDrafts(); };
  },[]);
  return <FrequencyContext.Provider value={counts}>{children}</FrequencyContext.Provider>;
}

export default function NotebookFrequencyBadge({word}:{word:string}) {
  const counts = useContext(FrequencyContext);
  const key = notebookFrequencyKey(word);
  const count = Object.hasOwn(counts,key) ? counts[key] : 0;
  if (!count) return null;
  const description = `生词本收集 ${count} 次；同一次收集的多个来源只计一次，不代表测试答错次数`;
  return <span className="notebookFrequencyBadge" title={description} aria-label={`${word}：${description}`}>收集 {count} 次</span>;
}
