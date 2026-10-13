export type NotebookRating = "unknown" | "fuzzy" | "familiar";
export type NotebookWord = { id: string; word: string; meaning: string; note: string; origin: string; rating?: NotebookRating };
export type NotebookBatch = { id: string; source: string; date: string; words: NotebookWord[] };
export type NotebookDraft = { batch: NotebookBatch; revision: number };
export type NotebookSummary = { id: string; source: string; date: string; count: number; revision: number };
export const NOTEBOOK_DRAFT_KEY = "gre-vocabulary-notebook-drafts-v1";
export const notebookIdentity = (word: Pick<NotebookWord, "word" | "meaning">) => `${word.word.trim().toLowerCase()}\u0000${word.meaning.trim()}`;
export function validNotebookBatch(value: unknown, complete = true): value is NotebookBatch {
  if (!value || typeof value !== "object") return false;
  const batch = value as NotebookBatch;
  const text = (s: unknown, max: number) => typeof s === "string" && s.length <= max;
  return text(batch.id, 80) && /^[a-zA-Z0-9-]+$/.test(batch.id)
    && text(batch.source, 300) && (!complete || !!batch.source.trim())
    && text(batch.date, 10) && (!complete || /^\d{4}-\d{2}-\d{2}$/.test(batch.date))
    && Array.isArray(batch.words) && batch.words.length <= 1000
    && batch.words.every((w) => w && text(w.id, 80) && !!w.id && text(w.word, 300) && (!complete || !!w.word.trim())
      && text(w.meaning, 4000) && text(w.note, 4000) && text(w.origin, 1000)
      && (w.rating === undefined || ["unknown", "fuzzy", "familiar"].includes(w.rating)))
    && new Set(batch.words.map((w) => w.id)).size === batch.words.length;
}

export type NotebookCandidate = Pick<NotebookWord,"word"|"meaning"|"note"|"origin">;
export const notebookWordKey = (word:string) => word.trim().replace(/\s+/g," ").toLowerCase();
const sourceBlock = (w:NotebookCandidate) => `【${w.origin.trim() || "未填写来源"}】\n${w.meaning.trim() || "暂无释义"}`;
export function hasNotebookSource(words:NotebookWord[], candidate:NotebookCandidate) {
 return words.some((w) => notebookWordKey(w.word) === notebookWordKey(candidate.word) &&
  ((w.meaning.trim() === candidate.meaning.trim() && w.origin.trim() === candidate.origin.trim()) ||
   (`\n\n${w.meaning.trim()}\n\n`).includes(`\n\n${sourceBlock(candidate)}\n\n`)));
}
export function mergeNotebookCandidates(words:NotebookWord[], candidates:NotebookCandidate[], newId:()=>string):NotebookWord[] {
 const next=words.map((w)=>({...w}));
 for(const candidate of candidates) {
  if(!candidate.word.trim()) continue;
  const index=next.findIndex((w)=>notebookWordKey(w.word)===notebookWordKey(candidate.word));
  if(index<0) {next.push({...candidate,id:newId(),word:candidate.word.trim(),meaning:sourceBlock(candidate)});continue;}
  if(hasNotebookSource(next,candidate)) continue;
  const old=next[index];
  const previous=old.meaning.startsWith("【") ? old.meaning : sourceBlock(old);
  next[index]={...old,meaning:previous+"\n\n"+sourceBlock(candidate),
   origin:[...new Set([...old.origin.split("\n"),...candidate.origin.split("\n")].filter(Boolean))].join("\n"),
   note:[...new Set([old.note,candidate.note].filter(Boolean))].join("\n\n")};
 }
 return next;
}
