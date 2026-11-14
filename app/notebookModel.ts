export type NotebookRating = "unknown" | "fuzzy" | "familiar";
export const NOTEBOOK_RATINGS = [
  {id:"unknown",label:"不认识",color:"red"},
  {id:"fuzzy",label:"模糊",color:"yellow"},
  {id:"familiar",label:"熟悉",color:"green"},
] as const;
export const NOTEBOOK_RATING_SCOPES = [...NOTEBOOK_RATINGS,{id:"unrated",label:"未标注"}] as const;
export type NotebookRecallResult = "correct" | "partial" | "incorrect";
export type NotebookRecallAttempt = { id: string; answer: string; checked: boolean; forgotten?: boolean; revealed?:boolean; result?: NotebookRecallResult; submittedAt?:string };
export type NotebookRecallArchive = {correct:number;incorrect:number;partial:number;streak:number;attempts:number};
export type NotebookRecallReminder = {id:string;at:string;wordIds:string[];label:string};
export const NOTEBOOK_RECALL_LIMIT = 20;
export type NotebookWord = { id: string; word: string; meaning: string; briefMeaning?: string; note: string; origin: string; rating?: NotebookRating; recalls?: NotebookRecallAttempt[]; recallArchive?:NotebookRecallArchive };
export type NotebookBatch = { id: string; source: string; date: string; words: NotebookWord[]; entryDraft?: {word:string;meaning:string}; recallPhase?: "writing"|"checking"; recallRound?:{id:string;wordIds:string[]};recallReminder?:NotebookRecallReminder;recallSubmission?:{id:string;at:string;wordIds:string[]} };
export type NotebookDraft = { batch: NotebookBatch; revision: number };
export type NotebookSummary = { id: string; source: string; date: string; count: number; revision: number; draft?:boolean;recallReminder?:NotebookRecallReminder };
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
  const ids=(value:unknown):value is string[]=>Array.isArray(value)&&value.length>0&&value.length<=1000&&value.every(id=>text(id,80)&&!!id)&&new Set(value).size===value.length;
  return text(batch.id, 80) && /^[a-zA-Z0-9-]+$/.test(batch.id)
    && text(batch.source, 300) && (!complete || !!batch.source.trim())
    && text(batch.date, 10) && (!complete || /^\d{4}-\d{2}-\d{2}$/.test(batch.date))
    && (batch.recallPhase === undefined || batch.recallPhase === "writing" || batch.recallPhase === "checking")
    && (batch.recallRound === undefined || (!!batch.recallRound&&text(batch.recallRound.id,80)&&!!batch.recallRound.id&&ids(batch.recallRound.wordIds)))
    && (batch.recallSubmission === undefined || (!!batch.recallSubmission&&text(batch.recallSubmission.id,80)&&!!batch.recallSubmission.id&&text(batch.recallSubmission.at,40)&&Number.isFinite(Date.parse(batch.recallSubmission.at))&&ids(batch.recallSubmission.wordIds)))
    && (batch.recallReminder === undefined || (!!batch.recallReminder&&text(batch.recallReminder.id,80)&&!!batch.recallReminder.id&&text(batch.recallReminder.at,40)&&Number.isFinite(Date.parse(batch.recallReminder.at))&&ids(batch.recallReminder.wordIds)&&text(batch.recallReminder.label,80)))
    && (batch.entryDraft === undefined || (!!batch.entryDraft && text(batch.entryDraft.word,300) && text(batch.entryDraft.meaning,4000)))
    && Array.isArray(batch.words) && batch.words.length <= 1000
    && batch.words.every((w) => w && text(w.id, 80) && !!w.id && text(w.word, 300) && (!complete || !!w.word.trim())
      && text(w.meaning, 4000) && (w.briefMeaning === undefined || text(w.briefMeaning,500)) && text(w.note, 4000) && text(w.origin, 1000)
      && (w.recalls === undefined || (Array.isArray(w.recalls) && w.recalls.length <= NOTEBOOK_RECALL_LIMIT
        && w.recalls.every((r) => r && text(r.id,80) && !!r.id && text(r.answer,1000) && typeof r.checked === "boolean"
          && (r.forgotten === undefined || typeof r.forgotten === "boolean")
          && (r.revealed === undefined || typeof r.revealed === "boolean")
          && (r.submittedAt === undefined || (text(r.submittedAt,40)&&Number.isFinite(Date.parse(r.submittedAt))&&r.checked&&!!r.result))
          && (r.result === undefined || (r.checked && ["correct","partial","incorrect"].includes(r.result))))
        && new Set(w.recalls.map((r) => r.id)).size === w.recalls.length))
      && (w.recallArchive===undefined || (!!w.recallArchive&&[w.recallArchive.correct,w.recallArchive.incorrect,w.recallArchive.partial,w.recallArchive.streak,w.recallArchive.attempts].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=1_000_000_000)&&w.recallArchive.streak<=w.recallArchive.incorrect+w.recallArchive.partial&&w.recallArchive.correct+w.recallArchive.incorrect+w.recallArchive.partial<=w.recallArchive.attempts))
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
