import type {Result} from './practiceModel';

export const REVIEW_INTERVALS = [1, 2, 4, 7, 15, 30] as const;
export type ReviewRecord = {level: number; due: string; lastDay: string; reviews: number};
export type ReviewHistory = Record<string, ReviewRecord>;

/** Review dates follow the learner's existing Beijing-day convention on every device. */
export function reviewDay(now = new Date()): string {
 const parts = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
 }).formatToParts(now);
 const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)!.value;
 return `${part('year')}-${part('month')}-${part('day')}`;
}

function validDay(value: unknown): value is string {
 if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
 const time = Date.parse(`${value}T00:00:00Z`);
 return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}
function assertDay(day: string) {
 if (!validDay(day)) throw new RangeError('Invalid review day');
}
function addDays(day: string, days: number) {
 return new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}
function validRecord(value: unknown): value is ReviewRecord {
 if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
 const record = value as Partial<ReviewRecord>;
 return Number.isInteger(record.level) && record.level! >= 0 && record.level! < REVIEW_INTERVALS.length
  && validDay(record.due) && (record.lastDay === '' || validDay(record.lastDay))
  && Number.isSafeInteger(record.reviews) && record.reviews! >= 0;
}
function wasAnswered(value: unknown): boolean {
 if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
 const result = value as Partial<Result>;
 return result.done === true
  || (Number.isSafeInteger(result.errors) && result.errors! > 0)
  || (Number.isSafeInteger(result.streak) && result.streak! > 0);
}

/** Old results have no answer dates, so only previously answered entries become due today. */
export function readPracticeReviewHistory(
 saved: string | null,
 legacyResults: Record<string, Result> | undefined,
 knownIds: ReadonlySet<string>,
 today = reviewDay(),
): ReviewHistory {
 assertDay(today);
 let parsed: unknown;
 try { parsed = saved === null ? null : JSON.parse(saved); } catch { parsed = null; }
 const history: ReviewHistory = {};
 if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
  for (const [id, value] of Object.entries(parsed)) {
   if (knownIds.has(id) && validRecord(value)) {
    // Copy only validated fields, keeping imports detached from their source objects.
    history[id] = {level: value.level, due: value.due, lastDay: value.lastDay, reviews: value.reviews};
   }
  }
 }
 for (const [id, value] of Object.entries(legacyResults ?? {})) {
  if (knownIds.has(id) && !Object.hasOwn(history, id) && wasAnswered(value)) {
   history[id] = {level: 0, due: today, lastDay: '', reviews: 0};
  }
 }
 return history;
}

/** Call only after the complete question is graded, never after the intermediate meaning step. */
export function recordPracticeReview(
 history: ReviewHistory,
 id: string,
 correct: boolean,
 completed: boolean,
 today = reviewDay(),
): ReviewHistory {
 assertDay(today);
 if (!id || (correct && !completed)) return history;
 const old = validRecord(history[id]) ? history[id] : undefined;
 // Early practice and repeat correct answers preserve the original review schedule.
 if (correct && old && (old.lastDay >= today || old.due > today)) return history;
 const level = !correct || !old ? 0 : Math.min(old.level + 1, REVIEW_INTERVALS.length - 1);
 return {
  ...history,
  [id]: {
   level,
   due: addDays(today, REVIEW_INTERVALS[level]),
   lastDay: today,
   reviews: Math.min((old?.reviews ?? 0) + 1, Number.MAX_SAFE_INTEGER),
  },
 };
}

export function duePracticeIds(history: ReviewHistory, today = reviewDay()): string[] {
 assertDay(today);
 return Object.keys(history)
  .filter(id => validRecord(history[id]) && history[id].due <= today)
  .sort((a, b) => history[a].due.localeCompare(history[b].due) || a.localeCompare(b));
}
