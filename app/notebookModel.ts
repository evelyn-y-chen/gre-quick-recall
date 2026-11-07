export type NotebookRating = "unknown" | "fuzzy" | "familiar";
export type NotebookRecallResult = "correct" | "partial" | "incorrect";
export type NotebookRecallAttempt = { id: string; answer: string; checked: boolean; result?: NotebookRecallResult };
export const NOTEBOOK_RECALL_LIMIT = 20;
export type NotebookWord = { id: string; word: string; meaning: string; briefMeaning?: string; note: string; origin: string; rating?: NotebookRating; recalls?: NotebookRecallAttempt[] };
export type NotebookBatch = { id: string; source: string; date: string; words: NotebookWord[]; entryDraft?: {word:string;meaning:string} };
export type NotebookDraft = { batch: NotebookBatch; revision: number };
export type NotebookSummary = { id: string; source: string; date: string; count: number; revision: number; draft?:boolean };
export const NOTEBOOK_DRAFT_KEY = "gre-vocabulary-notebook-drafts-v1";
/** A compact cue, independent of full references and the learner's recall answers. */
export function notebookBriefMeaning(word: Pick<NotebookWord,"meaning"|"briefMeaning">): string {
  if (word.briefMeaning !== undefined) return word.briefMeaning;
  return (word.meaning.split(/\r?\n/).map(line=>line.trim()).find(line=>line && !line.startsWith("【") && !line.startsWith("批注说明：")) ?? "").replace(/^手写[：:]\s*/,"").slice(0,500);
}
export const notebookIdentity = (word: Pick<NotebookWord, "word" | "meaning">) => `${word.word.trim().toLowerCase()}\u0000${word.meaning.trim()}`;
export function validNotebookBatch(value: unknown, complete = true): value is NotebookBatch {
  if (!value || typeof value !== "object") return false;
  const batch = value as NotebookBatch;
  const text = (s: unknown, max: number) => typeof s === "string" && s.length <= max;
  return text(batch.id, 80) && /^[a-zA-Z0-9-]+$/.test(batch.id)
    && text(batch.source, 300) && (!complete || !!batch.source.trim())
    && text(batch.date, 10) && (!complete || /^\d{4}-\d{2}-\d{2}$/.test(batch.date))
    && (batch.entryDraft === undefined || (!!batch.entryDraft && text(batch.entryDraft.word,300) && text(batch.entryDraft.meaning,4000)))
    && Array.isArray(batch.words) && batch.words.length <= 1000
    && batch.words.every((w) => w && text(w.id, 80) && !!w.id && text(w.word, 300) && (!complete || !!w.word.trim())
      && text(w.meaning, 4000) && (w.briefMeaning === undefined || text(w.briefMeaning,500)) && text(w.note, 4000) && text(w.origin, 1000)
      && (w.recalls === undefined || (Array.isArray(w.recalls) && w.recalls.length <= NOTEBOOK_RECALL_LIMIT
        && w.recalls.every((r) => r && text(r.id,80) && !!r.id && text(r.answer,1000) && typeof r.checked === "boolean"
          && (r.result === undefined || (r.checked && ["correct","partial","incorrect"].includes(r.result))))
        && new Set(w.recalls.map((r) => r.id)).size === w.recalls.length))
      && (w.rating === undefined || ["unknown", "fuzzy", "familiar"].includes(w.rating)))
    && new Set(batch.words.map((w) => w.id)).size === batch.words.length;
}

export type NotebookCandidate = Pick<NotebookWord,"word"|"meaning"|"note"|"origin">;
export const notebookWordKey = (word:string) => word.trim().replace(/\s+/g," ").toLowerCase();
const sourceBlock = (w:NotebookCandidate) => w.meaning.trim() ? `【${w.origin.trim() || "未填写来源"}】\n${w.meaning.trim()}` : "";
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
  next[index]={...old,meaning:[previous,sourceBlock(candidate)].filter(Boolean).join("\n\n"),
   origin:[...new Set([...old.origin.split("\n"),...candidate.origin.split("\n")].filter(Boolean))].join("\n"),
   note:[...new Set([old.note,candidate.note].filter(Boolean))].join("\n\n")};
 }
 return next;
}
