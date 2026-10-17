import {studyStorage} from "../community/storage";
import {recordLearningPlanRatings} from "../community/learningPlanStore";
import {appFetch} from "../community/api";
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import SharedWordMemory, {useWordMemory} from "./SharedWordMemory";
import {wordMemoryKey} from "./wordMemoryModel";
import vocabulary from "./vocabulary.json";
import { findGleeMemoryLocation } from "./sharedGleeMemory";
import QuickGleeMemory, {QuickGleeMemoryProvider} from "./QuickGleeMemory";
import WordNoteCard from "../community/WordNoteCard";
import Practice, {type Deck as PracticeDeck} from "../community/Practice";
import BBQuick from "./BBQuick";
import RevealControls from "./RevealControls";
import APlusTest from "./APlusTest";
import {APlusWordMarksProvider,APlusWordMark} from "./APlusWordMarks";
import APlusNotes, { APlusNotesProvider } from "./APlusNotes";
import RatingCloudSync from "./RatingCloudSync";
import {readSavedRatings,writeSavedRatings} from "./ratingStorage";
import VocabularyNotebook from "./VocabularyNotebook";
import LcljQuick, { type LcljDeck } from "./LcljQuick";
import equivalentData from "./equivalents.json";
import aPlusEquivalentData from "./aPlusEquivalents.json";
import glee1500Data from "./glee1500.json";
import list1To9NotesData from "./list1To9Notes.json";
import { LIST_1_TO_9_COURSE_NOTES } from "./list1To9CourseNotes.ts";
import {
  acyclicMindMapLogicLinks,
  GLEE_MIND_MAPS,
  type GleeMindMap,
  type MindMapBranchKind,
  type MindMapLogicLink,
} from "./gleeMindMaps";
import { GLEE_DUAL_VIEW_LISTS, GLEE_TABLE_LISTS, type GleeTableList } from "./gleeTableLists";
import { buildRootAffixSummaryRows, GLEE_ROOT_AFFIX_COURSE_MEANINGS, GLEE_ROOT_AFFIX_LISTS } from "./gleeRootAffixes";
import { buildEquivalentMemoryTips, type MemoryTip } from "./memoryTips";
import { MATH_CATEGORIES, MATH_WORDS, type MathVocabularyEntry } from "./mathVocabulary";

type Word = {
  id: string;
  word: string;
  phonetic?: string;
  pos?: string;
  meaning: string;
  note?: string;
  list?: number;
  page?: number;
};

type ListWordNote = {
  list: number;
  number: number;
  word: string;
  pos: string;
  coreMeaning: string;
  memoryAnchor: string;
  morphology: string;
  synonymGroup: string;
  contrast: string;
  usage: string;
  greSense: string;
};

type Progress = {
  level: number;
  dueAt: number;
  dueDay?: number;
  firstSeenDay?: number;
  lastCorrectDay?: number;
  lastLapseDay?: number;
  correct: number;
  wrong: number;
  fuzzy: number;
  lastSeen: number;
};

type SessionRetry = {
  id: string;
  after: number;
  passes: number;
  reason: "wrong" | "fuzzy" | "bridge";
  stage?: "choice" | "recall";
};

type Log = {
  at: number;
  wordId: string;
  result: "correct" | "fuzzy" | "wrong";
  mode: "choice" | "recall";
};

type Store = {
  progress: Record<string, Progress>;
  logs: Log[];
};

type EquivalentPair = {
  id: string;
  left: string;
  right: string;
  meaning: string;
  set: number;
  page: number;
};

type APlusEquivalentEntry = {
  id: string;
  number: number;
  word: string;
  equivalents: string[];
  meaning: string;
  list: number;
  page: number;
};

type GleeWord = {
  id: string;
  number: number;
  globalNumber: number;
  word: string;
  meaning: string;
  english: string;
  list: number;
  page: number;
  notebookCoreMeaning?: string;
  memoryAnchor?: string;
  morphology?: string;
  synonymGroup?: string;
  contrast?: string;
  usage?: string;
  greSense?: string;
};

type EquivalentLog = {
  at: number;
  pairId: string;
  result: "correct" | "wrong";
  mode: "learn" | "test";
};

type EquivalentStore = {
  progress: Record<string, Progress>;
  logs: EquivalentLog[];
};

type QuickRating = "unknown" | "fuzzy" | "familiar";
type QuickRatingFilter = QuickRating | "unrated";
type EquivalentCueDirection = "left" | "right" | "meaning";
type EquivalentCueMode = "mixed" | EquivalentCueDirection;
type APlusCueDirection = "word" | "equivalents" | "meaning";
type APlusCueMode = "mixed" | APlusCueDirection;
type QuickType = "bb" | "notebook" | LcljDeck | "words" | "equivalents" | "a-plus" | "glee" | "mindmap" | "math";
type ShuffleSetting = { enabled: boolean; seed: number };

const STORAGE_KEY = "gre-quanneng-vocab-v1";
const EQUIVALENT_KEY = "gre-equivalent-v1";
const PLAN_START_KEY = "gre-14day-plan-start";
const PLAN_DAY_KEY = "gre-14day-manual-day";
const QUICK_RATING_KEY = "gre-quick-ratings-v1";
const EQUIVALENT_QUICK_RATING_KEY = "gre-equivalent-quick-ratings-v1";
const A_PLUS_QUICK_RATING_KEY = "gre-a-plus-equivalent-quick-ratings-v1";
const GLEE_QUICK_RATING_KEY = "gre-glee-1500-quick-ratings-v1";
const LCLJ_QUICK_RATING_KEY = "gre-lclj-quick-ratings-v1";
const MATH_QUICK_RATING_KEY = "gre-math-vocabulary-quick-ratings-v1";
const QUICK_WORD_LISTS_KEY = "gre-quick-word-lists-v1";
const QUICK_EQUIVALENT_SETS_KEY = "gre-quick-equivalent-sets-v1";
const A_PLUS_LISTS_KEY = "gre-a-plus-lists-v1";
const GLEE_LISTS_KEY = "gre-glee-lists-v1";
const MATH_CATEGORIES_KEY = "gre-math-vocabulary-categories-v1";
const MIND_MAP_RECALL_KEY = "gre-glee-mindmap-recall-v1";
const DAY = 86_400_000;
const REVIEW_DAY_OFFSETS = [0, 1, 3, 7, 13, 30, 60];

const DEMO_WORDS: Word[] = [
  { id: "abate", word: "abate", phonetic: "/əˈbeɪt/", pos: "v.", meaning: "减轻；减弱", note: "强度或程度下降" },
  { id: "aberrant", word: "aberrant", phonetic: "/əˈberənt/", pos: "adj.", meaning: "异常的；偏离常规的", note: "偏离正常轨道" },
  { id: "abhor", word: "abhor", phonetic: "/əbˈhɔːr/", pos: "v.", meaning: "憎恶；厌恶", note: "比 dislike 强得多" },
  { id: "abstemious", word: "abstemious", phonetic: "/əbˈstiːmiəs/", pos: "adj.", meaning: "有节制的；饮食适量的" },
  { id: "acquiesce", word: "acquiesce", phonetic: "/ˌækwiˈes/", pos: "v.", meaning: "默许；勉强同意", note: "不情愿但不反对" },
  { id: "adroit", word: "adroit", phonetic: "/əˈdrɔɪt/", pos: "adj.", meaning: "熟练的；机敏的" },
  { id: "alacrity", word: "alacrity", phonetic: "/əˈlækrəti/", pos: "n.", meaning: "欣然；敏捷", note: "愉快而迅速地行动" },
  { id: "ambivalent", word: "ambivalent", phonetic: "/æmˈbɪvələnt/", pos: "adj.", meaning: "矛盾的；摇摆不定的" },
  { id: "anomalous", word: "anomalous", phonetic: "/əˈnɒmələs/", pos: "adj.", meaning: "反常的；不规则的" },
  { id: "antipathy", word: "antipathy", phonetic: "/ænˈtɪpəθi/", pos: "n.", meaning: "强烈反感；厌恶" },
  { id: "apathy", word: "apathy", phonetic: "/ˈæpəθi/", pos: "n.", meaning: "冷漠；缺乏兴趣" },
  { id: "appease", word: "appease", phonetic: "/əˈpiːz/", pos: "v.", meaning: "安抚；平息" },
  { id: "arcane", word: "arcane", phonetic: "/ɑːrˈkeɪn/", pos: "adj.", meaning: "神秘难懂的；鲜为人知的" },
  { id: "assiduous", word: "assiduous", phonetic: "/əˈsɪdʒuəs/", pos: "adj.", meaning: "勤勉的；坚持不懈的" },
  { id: "austere", word: "austere", phonetic: "/ɒˈstɪr/", pos: "adj.", meaning: "朴素严厉的；苦行的" },
  { id: "avarice", word: "avarice", phonetic: "/ˈævərɪs/", pos: "n.", meaning: "贪婪；贪财" },
  { id: "bolster", word: "bolster", phonetic: "/ˈboʊlstər/", pos: "v.", meaning: "支持；增强" },
  { id: "capricious", word: "capricious", phonetic: "/kəˈprɪʃəs/", pos: "adj.", meaning: "反复无常的；任性的" },
];
const SOURCE_WORDS = (vocabulary as Word[]).length ? (vocabulary as Word[]) : DEMO_WORDS;
const LIST_1_TO_9_NOTES = list1To9NotesData as ListWordNote[];
const EQUIVALENTS = equivalentData as EquivalentPair[];
const A_PLUS_EQUIVALENTS = aPlusEquivalentData as APlusEquivalentEntry[];
const LIST_1_TO_9_NOTE_MAP = new Map(LIST_1_TO_9_NOTES.map((note) => [`${note.list}:${note.number}`, note]));
const GLEE_WORDS: GleeWord[] = (glee1500Data as GleeWord[]).map((word) => {
  const note = LIST_1_TO_9_NOTE_MAP.get(`${word.list}:${word.number}`);
  if (!note) return word;
  const courseNote = LIST_1_TO_9_COURSE_NOTES[note.word.toLocaleLowerCase()];
  return {
    ...word,
    word: note.word,
    notebookCoreMeaning: note.coreMeaning,
    memoryAnchor: courseNote?.memory,
    morphology: courseNote?.relatedWords,
    synonymGroup: courseNote?.synonyms,
    usage: courseNote?.example,
  };
});
function normalizedLookupWord(word: string) {
  return word.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
}

const GLEE_MEANING_BY_LIST_WORD = new Map(GLEE_WORDS.map((entry) => [`${entry.list}:${normalizedLookupWord(entry.word)}`, entry.meaning]));
const GLEE_MEANING_BY_WORD = new Map(GLEE_WORDS.map((entry) => [normalizedLookupWord(entry.word), entry.meaning]));
// Older saved maps retain this spelling; resolve their meaning without changing progress keys.
GLEE_MEANING_BY_WORD.set("anthropomorphiz", "v. 赋予人格；拟人化");
GLEE_MEANING_BY_LIST_WORD.set("4:anthropomorphiz", "v. 赋予人格；拟人化");
const MIND_MAP_FALLBACK_MEANINGS: Record<string, string> = {
  plain: "adj. 朴素的，简朴的",
  rude: "adj. 粗鲁的，无礼的",
  polite: "adj. 礼貌的",
  unexpected: "adj. 意料之外的",
  instinctive: "adj. 本能的，凭直觉的",
  disagreement: "n. 意见不一致，分歧",
  agreement: "n. 一致，同意",
  impression: "n. 印象",
  combination: "n. 结合，组合",
  soundness: "n. 健全，可靠性",
  strict: "adj. 严格的",
  helpless: "adj. 无助的，无能为力的",
  fruitless: "adj. 无成果的，无效的",
  ineffective: "adj. 无效的",
  unwilling: "adj. 不情愿的",
  model: "adj. 模范的，典型的",
  corrupt: "adj. 腐败的",
  natural: "adj. 自然的，自发的",
  equal: "adj. 平等的",
  early: "adj. 早熟的，早期的",
  accidental: "adj. 偶然的",
  dramatic: "adj. 戏剧性的，夸张的",
  offense: "n. 冒犯，生气",
  disappointment: "n. 失望，懊恼",
  inactivity: "n. 停止，不活动",
  readiness: "n. 准备就绪，欣然",
  protection: "n. 保护，防御物",
  cautious: "adj. 谨慎的",
  dependent: "adj. 取决于……的",
  private: "adj. 私有的，专属的",
  beauty: "n. 美，美感",
  social: "adj. 社交的，合群的",
  profitable: "adj. 有利可图的",
  urgent: "adj. 紧急的，迫切的",
  independent: "adj. 独立的，自主的",
  improve: "v. 改善，改进",
  encourage: "v. 鼓励，振奋",
  matter: "v. 要紧，有影响",
  interpret: "v. 解释，理解",
  ban: "v. 禁止",
  unprepared: "adj. 无准备的，即兴的",
  accept: "v. 接受，默许",
  regret: "v. 后悔；使收敛",
  shorten: "v. 缩短",
  cut: "v. 削减，缩短",
  enjoy: "v. 喜欢，享受",
  reveal: "v. 显示，表明",
  disappear: "v. 消失",
};

const EMPTY_STORE: Store = { progress: {}, logs: [] };
const EMPTY_EQUIVALENT_STORE: EquivalentStore = { progress: {}, logs: [] };

function localMidnight(timestamp = Date.now()) {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function planDay(start: number) {
  return Math.min(14, Math.max(1, Math.floor((localMidnight() - localMidnight(start)) / DAY) + 1));
}

function listsForDay(day: number) {
  if (day <= 9) return [day * 3 - 2, day * 3 - 1, day * 3];
  return day === 10 ? [28] : [];
}

function setsForDay(day: number) {
  if (day <= 9) return [day * 3 - 2, day * 3 - 1, day * 3];
  return day === 10 ? [28, 29] : [];
}

function listScheduledDay(list?: number) {
  if (!list) return 14;
  return list <= 27 ? Math.ceil(list / 3) : 10;
}

function setScheduledDay(set: number) {
  return set <= 27 ? Math.ceil(set / 3) : 10;
}

function isDueOnPlanDay(progress: Progress | undefined, day: number, timestamp: number) {
  if (!progress) return true;
  return progress.dueDay !== undefined ? progress.dueDay <= day : progress.dueAt <= timestamp;
}

function quickRatingRank(rating?: QuickRating) {
  if (rating === "unknown") return 0;
  if (rating === "fuzzy") return 1;
  if (!rating) return 2;
  return 3;
}

function updateSessionRetries(
  retries: SessionRetry[],
  id: string,
  result: "correct" | "fuzzy" | "wrong",
  stage?: "choice" | "recall",
) {
  const active = retries.find((item) => item.id === id && item.stage === stage);
  const next = retries
    .filter((item) => item.id !== id || item.stage !== stage)
    .map((item) => ({ ...item, after: Math.max(0, item.after - 1) }));
  if (result === "wrong") {
    next.push({ id, after: 3, passes: 2, reason: "wrong", stage });
  } else if (result === "fuzzy") {
    next.push({ id, after: 6, passes: Math.max(1, active?.passes ?? 1), reason: "fuzzy", stage });
  } else if (active && active.passes > 1) {
    next.push({ id, after: 6, passes: active.passes - 1, reason: active.reason, stage });
  }
  return next;
}

function stableScore(text: string, seed: number) {
  return [...text].reduce((sum, character) => (sum * 31 + character.charCodeAt(0)) % 1_000_003, seed);
}

function shuffled<T>(items: T[], setting: ShuffleSetting) {
  if (!setting.enabled) return items;
  const result = [...items];
  let state = setting.seed >>> 0;
  for (let index = result.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    const target = state % (index + 1);
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function workbookMemoryTips(word: GleeWord): MemoryTip[] {
  const tips: MemoryTip[] = [];
  const coreMeaning = word.notebookCoreMeaning ?? word.meaning;
  if (word.morphology && word.morphology !== word.memoryAnchor) tips.push({ label: "词根词缀", title: word.morphology, detail: `连回核心义：${coreMeaning}` });
  if (word.synonymGroup) tips.push({ label: "同义词群", title: word.synonymGroup, detail: "把同一语义场中的词放在一起复习。" });
  if (word.contrast) tips.push({ label: "辨析", title: word.contrast, detail: "对照近义、反义或易混项，避免只记模糊方向。" });
  if (word.usage) tips.push({ label: "搭配派生", title: word.usage, detail: "一起记固定搭配、派生词或使用提醒。" });
  if (word.greSense) tips.push({ label: "英文考法", title: word.greSense, detail: `对应中文：${coreMeaning}` });
  return tips;
}

function quickEquivalentDirection(pair: EquivalentPair, mode: EquivalentCueMode): EquivalentCueDirection {
  if (mode !== "mixed") return mode;
  const directions: EquivalentCueDirection[] = ["left", "right", "meaning"];
  return directions[stableScore(pair.id, 101) % directions.length];
}

function quickEquivalentRatingKey(pairId: string, direction: EquivalentCueDirection) {
  return `${pairId}:${direction}`;
}

function quickEquivalentRatingFor(
  ratings: Record<string, QuickRating>,
  pairId: string,
  direction: EquivalentCueDirection,
) {
  return ratings[quickEquivalentRatingKey(pairId, direction)] ?? ratings[pairId];
}

function aPlusDirection(entry: APlusEquivalentEntry, mode: APlusCueMode): APlusCueDirection {
  if (mode !== "mixed") return mode;
  const directions: APlusCueDirection[] = ["word", "equivalents", "meaning"];
  return directions[stableScore(entry.id, 809) % directions.length];
}

function aPlusRatingKey(entryId: string, direction: APlusCueDirection) {
  return `${entryId}:${direction}`;
}

function aPlusRatingFor(
  ratings: Record<string, QuickRating>,
  entryId: string,
  direction: APlusCueDirection,
) {
  return ratings[aPlusRatingKey(entryId, direction)] ?? ratings[entryId];
}

function revealedEquivalentWords(pair: EquivalentPair, direction: EquivalentCueDirection, revealStage: number) {
  if (direction === "left") return revealStage >= 1 ? [pair.left, pair.right] : [pair.left];
  if (direction === "right") return revealStage >= 1 ? [pair.right, pair.left] : [pair.right];
  if (revealStage >= 2) return [pair.left, pair.right];
  return revealStage >= 1 ? [pair.left] : [];
}

function revealedAPlusWords(entry: APlusEquivalentEntry, direction: APlusCueDirection, revealStage: number) {
  if (direction === "word") return revealStage >= 1 ? [entry.word, ...entry.equivalents] : [entry.word];
  if (direction === "equivalents") return revealStage >= 1 ? [...entry.equivalents, entry.word] : entry.equivalents;
  if (revealStage >= 2) return [entry.word, ...entry.equivalents];
  return revealStage >= 1 ? [entry.word] : [];
}

function equivalentQuestion(pairs: EquivalentPair[], current: EquivalentPair) {
  const targetWords = new Set([current.left, current.right]);
  const distractorPairs: EquivalentPair[] = [];
  const seenMeanings = new Set([current.meaning]);
  const seed = stableScore(current.id, 17);
  const pool = pairs
    .filter((pair) => !targetWords.has(pair.left) && !targetWords.has(pair.right) && pair.meaning !== current.meaning)
    .sort((a, b) => stableScore(a.id, seed) - stableScore(b.id, seed));
  for (const pair of pool) {
    if (seenMeanings.has(pair.meaning)) continue;
    distractorPairs.push(pair);
    seenMeanings.add(pair.meaning);
    if (distractorPairs.length === 4) break;
  }
  const distractors = distractorPairs.map((pair, index) => index % 2 ? pair.right : pair.left);
  const options = [current.left, current.right, ...distractors]
    .sort((a, b) => stableScore(a, seed) - stableScore(b, seed));
  const meanings = [current.meaning, ...distractorPairs.slice(0, 3).map((pair) => pair.meaning)]
    .sort((a, b) => stableScore(a, seed + 97) - stableScore(b, seed + 97));
  return { options, meanings };
}

function seededOptions(words: Word[], current: Word) {
  const seed = [...current.word].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const partOfSpeech = current.pos?.split("/")[0];
  let pool = words.filter(
    (item) =>
      item.id !== current.id
      && item.pos?.split("/")[0] === partOfSpeech
      && Math.abs((item.list ?? 0) - (current.list ?? 0)) <= 2,
  );
  if (pool.length < 3) {
    pool = words.filter((item) => item.id !== current.id && item.pos?.split("/")[0] === partOfSpeech);
  }
  const distractors = pool
    .sort((a, b) => {
      const scoreA = [...a.word].reduce((sum, char) => sum + char.charCodeAt(0), seed) % 97;
      const scoreB = [...b.word].reduce((sum, char) => sum + char.charCodeAt(0), seed) % 97;
      return scoreA - scoreB;
    })
    .slice(0, 3);
  return [...distractors, current].sort((a, b) => {
    const aScore = (a.word.charCodeAt(0) * 7 + seed) % 13;
    const bScore = (b.word.charCodeAt(0) * 7 + seed) % 13;
    return aScore - bScore;
  });
}

function loadStore(): Store {
  try {
    const raw = studyStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : EMPTY_STORE;
  } catch {
    return EMPTY_STORE;
  }
}

function loadEquivalentStore(): EquivalentStore {
  try {
    const raw = studyStorage.getItem(EQUIVALENT_KEY);
    return raw ? JSON.parse(raw) : EMPTY_EQUIVALENT_STORE;
  } catch {
    return EMPTY_EQUIVALENT_STORE;
  }
}

function RangePicker({
  label,
  itemLabel,
  options,
  selected,
  onChange,
}: {
  label: string;
  itemLabel: "List" | "Set";
  options: number[];
  selected: number[];
  onChange: (values: number[]) => void;
}) {
  const allSelected = options.length > 0 && selected.length === options.length;
  const summary = allSelected
    ? `全部 ${itemLabel} · ${options.length} 个`
    : selected.length === 0
      ? "尚未选择"
      : selected.length <= 3
      ? selected.map((value) => `${itemLabel} ${String(value).padStart(2, "0")}`).join(" / ")
      : `已选 ${selected.length} 个 ${itemLabel}`;

  function toggle(value: number) {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value));
      return;
    }
    onChange([...selected, value].sort((a, b) => a - b));
  }

  return (
    <details className="rangePicker">
      <summary><span>{label}</span><strong>{summary}</strong></summary>
      <div className="rangePickerPanel">
        <button type="button" className={allSelected ? "active all" : "all"} aria-pressed={allSelected} onClick={() => onChange(allSelected ? [] : options)}>{allSelected ? "全不选" : "全选"}</button>
        {options.map((value) => (
          <button type="button" className={selected.includes(value) ? "active" : ""} aria-pressed={selected.includes(value)} onClick={() => toggle(value)} key={value}>
            {String(value).padStart(2, "0")}
          </button>
        ))}
      </div>
    </details>
  );
}

function CategoryPicker({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const allSelected = options.length > 0 && selected.length === options.length;
  const summary = allSelected
    ? `全部主题 · ${options.length} 个`
    : selected.length === 0
      ? "尚未选择"
      : selected.length <= 2
      ? selected.join(" / ")
      : `已选 ${selected.length} 个主题`;

  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value));
      return;
    }
    onChange(options.filter((item) => item === value || selected.includes(item)));
  }

  return (
    <details className="rangePicker categoryPicker">
      <summary><span>选择数学主题</span><strong>{summary}</strong></summary>
      <div className="rangePickerPanel categoryPickerPanel">
        <button type="button" className={allSelected ? "active all" : "all"} aria-pressed={allSelected} onClick={() => onChange(allSelected ? [] : options)}>{allSelected ? "全不选" : "全选"}</button>
        {options.map((value) => (
          <button type="button" className={selected.includes(value) ? "active" : ""} aria-pressed={selected.includes(value)} onClick={() => toggle(value)} key={value}>
            {value}
          </button>
        ))}
      </div>
    </details>
  );
}

function ShuffleControls({
  enabled,
  onToggle,
  onReshuffle,
}: {
  enabled: boolean;
  onToggle: () => void;
  onReshuffle: () => void;
}) {
  return (
    <div className="shuffleControls" aria-label="词条顺序">
      <button type="button" className={enabled ? "active" : ""} aria-pressed={enabled} onClick={onToggle}>
        <span aria-hidden="true">⇄</span>{enabled ? "关闭乱序，恢复正序" : "开启乱序"}
      </button>
      {enabled && <button type="button" className="reshuffle" onClick={onReshuffle}>再打乱一次</button>}
      <small>{enabled ? "本轮顺序已固定；再次打乱会生成新顺序。" : "按原词表顺序显示。"}</small>
    </div>
  );
}

function storedNumberSelection(key: string, max: number) {
  const raw = studyStorage.getItem(key);
  if (!raw) return null;
  const values = JSON.parse(raw);
  if (!Array.isArray(values)) return null;
  const valid = [...new Set(values.map(Number).filter((value) => Number.isInteger(value) && value >= 1 && value <= max))];
  return valid.sort((a, b) => a - b);
}

function storedStringSelection(key: string, options: string[]) {
  const raw = studyStorage.getItem(key);
  if (!raw) return null;
  const values = JSON.parse(raw);
  if (!Array.isArray(values)) return null;
  const valid = options.filter((option) => values.includes(option));
  return valid;
}

function formatDue(timestamp: number, dueDay?: number, currentDay?: number) {
  if (dueDay !== undefined) {
    if (currentDay !== undefined && dueDay <= currentDay) return "本学习日";
    return `第 ${dueDay} 学习日`;
  }
  if (!timestamp || timestamp <= Date.now()) return "现在";
  const hours = Math.ceil((timestamp - Date.now()) / 3_600_000);
  if (hours < 24) return `${hours} 小时后`;
  return `${Math.ceil(hours / 24)} 天后`;
}

function naturalVoice(voices: SpeechSynthesisVoice[]) {
  const candidates = voices.filter((voice) => voice.lang.toLowerCase().startsWith("en"));
  const avoid = /alex|fred|ralph|bruce|junior|whisper|bad news|bubbles|cellos|organ|trinoids/i;
  const score = (voice: SpeechSynthesisVoice) => {
    const name = voice.name.toLowerCase();
    let value = voice.lang.toLowerCase().startsWith("en-us") ? 40 : 10;
    if (/samantha/.test(name)) value += 100;
    else if (/\bava\b|ava \(enhanced\)|siri.*american/.test(name)) value += 95;
    else if (/google us english/.test(name)) value += 90;
    else if (/allison|susan|zoe|serena|victoria/.test(name)) value += 75;
    if (/enhanced|premium|natural/.test(name)) value += 25;
    if (avoid.test(name)) value -= 200;
    return value;
  };
  return candidates.sort((a, b) => score(b) - score(a))[0];
}

let speechRequest = 0;

function pronounceMany(words: string[]) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synthesizer = window.speechSynthesis;
  const request = ++speechRequest;
  let spoken = false;
  const speakWithAvailableVoices = () => {
    if (spoken || request !== speechRequest) return;
    spoken = true;
    synthesizer.cancel();
    const preferredVoice = naturalVoice(synthesizer.getVoices());
    if (synthesizer.paused) synthesizer.resume();
    window.setTimeout(() => {
      if (request !== speechRequest) return;
      if (synthesizer.paused) synthesizer.resume();
      words.forEach((word) => {
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = "en-US";
        utterance.rate = 0.96;
        utterance.pitch = 1.06;
        utterance.volume = 0.95;
        if (preferredVoice) utterance.voice = preferredVoice;
        synthesizer.speak(utterance);
      });
    }, 60);
  };
  if (synthesizer.getVoices().length) {
    speakWithAvailableVoices();
    return;
  }
  const fallback = window.setTimeout(speakWithAvailableVoices, 1_500);
  synthesizer.addEventListener("voiceschanged", () => {
    window.clearTimeout(fallback);
    speakWithAvailableVoices();
  }, { once: true });
}

function pronounce(word: string) {
  pronounceMany([word]);
}

const MIND_MAP_OPEN_KEY = "gre-glee-mindmap-open-v1";
const MIND_MAP_CLOUD_MIGRATED_KEY = "gre-glee-mindmap-cloud-migrated-v1";
const MIND_MAP_KIND_LABEL: Record<MindMapBranchKind, string> = {
  meaning: "语义组",
  root: "词根组",
  form: "形近词",
  contrast: "对照组",
};

const MIND_MAP_LINK_LABELS: MindMapLogicLink["label"][] = ["同义", "反义", "形近不同义", "词根联结", "派生联结", "场景联结"];

function rootAffixNodeKey(list: number, form: string) {
  return `root-affix:${list}:${form}`;
}

function rootAffixWordKey(list: number, form: string, word: string) {
  return `${rootAffixNodeKey(list, form)}:${normalizedLookupWord(word)}`;
}

function rootAffixSummaryWordKey(rootKey: string, word: string) {
  return `root-affix-summary:${rootKey}:${normalizedLookupWord(word)}`;
}

function gleeChineseMeaning(list: number, word: string) {
  const normalized = normalizedLookupWord(word);
  return GLEE_MEANING_BY_LIST_WORD.get(`${list}:${normalized}`)
    ?? GLEE_MEANING_BY_WORD.get(normalized)
    ?? MIND_MAP_FALLBACK_MEANINGS[normalized]
    ?? GLEE_ROOT_AFFIX_COURSE_MEANINGS[normalized]
    ?? "词库中暂无中文释义";
}

function gleeCourseReference(preferredList: number, word: string) {
  const normalized = normalizedLookupWord(word);
  const entry = GLEE_WORDS.find((item) => item.list === preferredList && normalizedLookupWord(item.word) === normalized)
    ?? GLEE_WORDS.find((item) => normalizedLookupWord(item.word) === normalized);
  return entry ? `List ${entry.list} · 第 ${entry.number} 词` : "课外辅助词";
}

function RootAffixLibrary({ selectedList }: { selectedList: number | "all" }) {
  const visibleLists = selectedList === "all"
    ? GLEE_ROOT_AFFIX_LISTS
    : GLEE_ROOT_AFFIX_LISTS.filter((item) => item.list === selectedList);
  const [openLists, setOpenLists] = useState<number[]>([1]);
  const [revealedRoots, setRevealedRoots] = useState<string[]>([]);
  const [revealedWords, setRevealedWords] = useState<string[]>([]);
  const [rootView, setRootView] = useState<"summary" | "maps">("summary");
  const summaryRows = buildRootAffixSummaryRows(visibleLists);
  const summaryWordCount = new Set(summaryRows.flatMap((entry) => entry.words.map(({ word }) => normalizedLookupWord(word)))).size;

  function toggleValue(value: string, values: string[], setValues: (next: string[]) => void) {
    setValues(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }

  return (
    <section className="rootAffixLibrary" aria-label="课末词根词缀思维导图">
      <div className="rootAffixIntro">
        <div><span>COURSE ROOTS &amp; AFFIXES</span><h2>词根词缀</h2></div>
        <div className="rootAffixIntroCopy">
          <p>完全按老师每个 Part 2 课末总结的顺序整理。先点词根核对根义，再点关联词查看词库中文义和老师的构词推导。</p>
          {selectedList === "all" && <strong className="rootAffixTotals">共 {summaryRows.length} 个不重复词根词缀 · 关联 {summaryWordCount} 个不重复单词</strong>}
        </div>
      </div>
      <div className="rootAffixViewSwitch" role="group" aria-label="选择词根词缀汇总表或分 List 导图">
        <button className={rootView === "summary" ? "active" : ""} onClick={() => setRootView("summary")}>汇总表</button>
        <button className={rootView === "maps" ? "active" : ""} onClick={() => setRootView("maps")}>分 List 导图</button>
      </div>
      {rootView === "summary" && (
        <div className="rootAffixSummary" role="table" aria-label="词根词缀汇总表">
          <div className="rootAffixSummaryHead" role="row">
            <b role="columnheader">来源</b><b role="columnheader">词根词缀</b><b role="columnheader">根义</b><b role="columnheader">关联词与核心 1500 编号</b><b role="columnheader">课程推导</b>
          </div>
          {summaryRows.map((entry) => (
            <div className="rootAffixSummaryRow" role="row" key={entry.key}>
              <div className="rootAffixSummaryLists" role="cell">
                {entry.sourceLists.map((list) => <span className="rootAffixSummaryList" key={`${entry.key}:list:${list}`}>List {list}</span>)}
              </div>
              <strong role="cell">{entry.form}</strong>
              <span role="cell">{entry.meaning}</span>
              <div className="rootAffixSummaryWords" role="cell">
                {entry.words.map(({ word, sourceLists }) => {
                  const wordKey = rootAffixSummaryWordKey(entry.key, word);
                  const wordOpen = revealedWords.includes(wordKey);
                  return (
                    <button className={`rootAffixSummaryWord ${wordOpen ? "revealed" : ""}`} key={`${entry.key}:${word}`} onClick={() => {
                      toggleValue(wordKey, revealedWords, setRevealedWords);
                      pronounce(word);
                    }} aria-expanded={wordOpen}>
                      <b>{word}</b>
                      <small>{gleeCourseReference(sourceLists[0], word)}</small>
                      <em>{wordOpen ? gleeChineseMeaning(sourceLists[0], word) : "点击查看中文"}</em>
                    </button>
                  );
                })}
              </div>
              <div className="rootAffixSummaryPaths" role="cell">
                {entry.coursePaths.map((path) => (
                  <p key={`${entry.key}:path:${path.list}:${path.text}`}><b>List {path.list}</b>{path.text}</p>
                ))}
              </div>
            </div>
          ))}
          {!summaryRows.length && <p className="rootAffixSummaryEmpty">这个 List 目前还没有课末词根词缀总结。</p>}
        </div>
      )}
      {rootView === "maps" && <div className="rootAffixCards">
        {visibleLists.map((listItem) => {
          const isOpen = openLists.includes(listItem.list);
          const wordCount = new Set(listItem.roots.flatMap((item) => item.words)).size;
          return (
            <article className={`rootAffixCard ${isOpen ? "open" : ""}`} key={listItem.list}>
              <button className="rootAffixListHead" onClick={() => setOpenLists((current) => current.includes(listItem.list) ? current.filter((item) => item !== listItem.list) : [...current, listItem.list])} aria-expanded={isOpen}>
                <strong>List {listItem.list}</strong>
                <span>{listItem.roots.length ? `${listItem.roots.length} 个词根词缀 · ${wordCount} 个课内词` : "本课暂无词根总结"}</span>
                <b>{isOpen ? "收起" : "展开"}⌄</b>
              </button>
              {isOpen && (
                <div className="rootAffixStage">
                  <div className="rootAffixCore"><span>List {listItem.list}</span><strong>词根词缀</strong></div>
                  {listItem.note && <p className="rootAffixEmpty">{listItem.note}</p>}
                  <div className="rootAffixTree">
                    {listItem.roots.map((entry, rootIndex) => {
                      const rootKey = rootAffixNodeKey(listItem.list, entry.form);
                      const rootOpen = revealedRoots.includes(rootKey);
                      return (
                        <div className="rootAffixBranch" key={rootKey}>
                          <span className="rootAffixOrder">{String(rootIndex + 1).padStart(2, "0")}</span>
                          <button className={`rootAffixRoot ${rootOpen ? "revealed" : ""}`} onClick={() => toggleValue(rootKey, revealedRoots, setRevealedRoots)} aria-expanded={rootOpen}>
                            <strong>{entry.form}</strong>
                            <small>{rootOpen ? entry.meaning : "点击核对根义"}</small>
                          </button>
                          {rootOpen && (
                            <div className="rootAffixWords">
                              <p className="rootAffixCoursePath"><b>老师讲解</b><span>{entry.coursePath}</span></p>
                              {entry.words.map((word) => {
                                const wordKey = rootAffixWordKey(listItem.list, entry.form, word);
                                const wordOpen = revealedWords.includes(wordKey);
                                return (
                                  <div className={`rootAffixWord ${wordOpen ? "revealed" : ""}`} key={wordKey}>
                                    <button onClick={() => {
                                      toggleValue(wordKey, revealedWords, setRevealedWords);
                                      pronounce(word);
                                    }} aria-expanded={wordOpen}>
                                      <strong>{word}</strong><span>{wordOpen ? "重新遮住" : "点击核对"}</span>
                                    </button>
                                    {wordOpen && <div><p><b>词库中文义</b><span>{gleeChineseMeaning(listItem.list, word)}</span></p><p><b>构词推导</b><span>{entry.coursePath}</span></p></div>}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>}
    </section>
  );
}

function courseBranchIndexes(branchCount: number) {
  return Array.from({ length: branchCount }, (_, index) => index);
}

type MindMapLinkDraft = {
  from: string;
  to: string;
  label: MindMapLogicLink["label"];
  detail: string;
};

type MindMapWordDraft = {
  word: string;
  synonyms: string;
  relatedWords: string;
  example: string;
  memory: string;
  parent: string;
  linkLabel: MindMapLogicLink["label"];
};

const EMPTY_MIND_MAP_WORD_DRAFT: MindMapWordDraft = {
  word: "",
  synonyms: "",
  relatedWords: "",
  example: "",
  memory: "",
  parent: "",
  linkLabel: "派生联结",
};

function cloneMindMaps(maps: GleeMindMap[]) {
  return JSON.parse(JSON.stringify(maps)) as GleeMindMap[];
}

type SharedWordField = "word" | "synonyms" | "relatedWords" | "example" | "memory";

function syncMindMapWordField(maps: GleeMindMap[], list: number, sourceWord: string, field: SharedWordField, value: string) {
  const sourceKey = normalizedLookupWord(sourceWord);
  return maps.map((map) => map.list !== list && field !== "memory" ? map : {
    ...map,
    branches: map.branches.map((branch) => {
      if (!branch.words.some((item) => normalizedLookupWord(item.word) === sourceKey)) return branch;
      const words = branch.words.map((item) => normalizedLookupWord(item.word) === sourceKey ? { ...item, [field]: value } : item);
      if (field !== "word") return { ...branch, words };
      const logicLinks = branch.logicLinks?.map((link) => ({
        ...link,
        from: normalizedLookupWord(link.from) === sourceKey ? value : link.from,
        to: normalizedLookupWord(link.to) === sourceKey ? value : link.to,
      }));
      const contrastGroups = branch.contrastGroups?.map((group) => ({
        ...group,
        words: group.words.map((word) => normalizedLookupWord(word) === sourceKey ? value : word),
      }));
      return { ...branch, words, logicLinks, contrastGroups };
    }),
  });
}

function syncTableWordField(tables: GleeTableList[], list: number, sourceWord: string, field: SharedWordField, value: string) {
  const sourceKey = normalizedLookupWord(sourceWord);
  return tables.map((table) => table.list !== list && field !== "memory" ? table : {
    ...table,
    words: table.words.map((item) => normalizedLookupWord(item.word) === sourceKey ? { ...item, [field]: value } : item),
  });
}

function mindMapNodeKey(mapId: string, word: string) {
  return `${mapId}:word:${normalizedLookupWord(word)}`;
}

function mindMapSearchTargetId(mapId: string, word: string) {
  return `mindmap-search-${mapId}-${encodeURIComponent(normalizedLookupWord(word))}`;
}

function tableWordNodeKey(tableId: string, wordId: string) {
  return `${tableId}:word:${wordId}`;
}

const GLEE_DUAL_VIEW_SET = new Set<number>(GLEE_DUAL_VIEW_LISTS);

function tableReviewNodeKey(table: GleeTableList, wordId: string, word: string) {
  if (GLEE_DUAL_VIEW_SET.has(table.list)) {
    const map = GLEE_MIND_MAPS.find((item) => item.list === table.list && item.branches.some((branch) => branch.words.some((entry) => normalizedLookupWord(entry.word) === normalizedLookupWord(word))));
    if (map) return mindMapNodeKey(map.id, word);
  }
  return tableWordNodeKey(table.id, wordId);
}

function migrateMindMapRecall(record: Record<string, true>) {
  const migrated: Record<string, true> = {};
  for (const key of Object.keys(record)) {
    const legacy = key.match(/^(\d+-\d+):(\d+):(\d+)$/);
    if (!legacy) {
      migrated[key] = true;
      continue;
    }
    const map = GLEE_MIND_MAPS.find((item) => item.id === legacy[1]);
    const word = map?.branches[Number(legacy[2])]?.words[Number(legacy[3])]?.word;
    if (map && word) migrated[mindMapNodeKey(map.id, word)] = true;
  }
  return migrated;
}

function GleeMindMapLibrary({editWord,onTargetHandled}:{editWord:string|null;onTargetHandled:()=>void}) {
  const sharedMemory=useWordMemory();
  const handledTarget=useRef<string|null>(null);
  const [editTargetId,setEditTargetId]=useState<string|null>(null);
  const [librarySection, setLibrarySection] = useState<"maps" | "roots">("maps");
  const [vocabView, setVocabView] = useState<"mindmap" | "table">("mindmap");
  const [mindMaps, setMindMaps] = useState<GleeMindMap[]>(GLEE_MIND_MAPS);
  const [tableLists, setTableLists] = useState<GleeTableList[]>(GLEE_TABLE_LISTS);
  const [editing, setEditing] = useState(false);
  const [editBackup, setEditBackup] = useState<GleeMindMap[] | null>(null);
  const [tableEditBackup, setTableEditBackup] = useState<GleeTableList[] | null>(null);
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudStatus, setCloudStatus] = useState("正在读取共享导图…");
  const [newWordDrafts, setNewWordDrafts] = useState<Record<string, MindMapWordDraft>>({});
  const [newLinkDrafts, setNewLinkDrafts] = useState<Record<string, MindMapLinkDraft>>({});
  const availableMindMapLists = Array.from(new Set([...tableLists.map((table) => table.list), ...mindMaps.map((map) => map.list)])).sort((a, b) => a - b);
  const [selectedList, setSelectedList] = useState<number | "all">("all");
  const [showOnlyUnmastered, setShowOnlyUnmastered] = useState(false);
  const [unmasteredFilterKeys, setUnmasteredFilterKeys] = useState<string[]>([]);
  const [mixedTableLists, setMixedTableLists] = useState<number[]>([]);
  const [rangeReady, setRangeReady] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(studyStorage.getItem("glee-mind-map-range-v1") ?? "null");
      const lists = new Set([...GLEE_MIND_MAPS.map((map) => map.list), ...GLEE_TABLE_LISTS.map((table) => table.list)]);
      if (saved?.selectedList === "all" || lists.has(saved?.selectedList)) setSelectedList(saved.selectedList);
      if (Array.isArray(saved?.mixedTableLists)) setMixedTableLists([...new Set<number>(saved.mixedTableLists.filter((list: unknown): list is number => typeof list === "number" && lists.has(list)))]);
    } catch {}
    setRangeReady(true);
  }, []);
  useEffect(() => {
    if (rangeReady) try { studyStorage.setItem("glee-mind-map-range-v1", JSON.stringify({ selectedList, mixedTableLists })); } catch {}
  }, [rangeReady, selectedList, mixedTableLists]);
  const [mindMapSearch, setMindMapSearch] = useState("");
  const [openMaps, setOpenMaps] = useState<string[]>(() => {
    if (typeof window === "undefined") return [GLEE_MIND_MAPS[0].id];
    try {
      const saved = studyStorage.getItem(MIND_MAP_OPEN_KEY);
      return saved ? JSON.parse(saved) : [GLEE_MIND_MAPS[0].id];
    } catch {
      return [GLEE_MIND_MAPS[0].id];
    }
  });
  const [revealedNodes, setRevealedNodes] = useState<string[]>([]);
  const [revealedTableWords, setRevealedTableWords] = useState<string[]>([]);
  const [shuffledTableOrders, setShuffledTableOrders] = useState<Record<string, string[]> | null>(null);
  const [unmasteredNodes, setUnmasteredNodes] = useState<Record<string, true>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const saved = studyStorage.getItem(MIND_MAP_RECALL_KEY);
      if (!saved) return {};
      const record = Object.fromEntries(Object.entries(JSON.parse(saved)).filter(([, value]) => value === true)) as Record<string, true>;
      return migrateMindMapRecall(record);
    } catch {
      return {};
    }
  });

  useEffect(() => {
    let active = true;
    async function loadSharedMindMap() {
      try {
        const response = await appFetch("/api/mind-map", { cache: "no-store" });
        const payload = await response.json() as { maps?: GleeMindMap[]; tables?: GleeTableList[]; unmastered?: Record<string, true>; error?: string };
        if (!response.ok || !payload.maps || !payload.tables || !payload.unmastered) throw new Error(payload.error ?? "读取失败");
        if (!active) return;
        setMindMaps(payload.maps);
        setTableLists(payload.tables);
        setUnmasteredNodes((local) => {
          const cloud = migrateMindMapRecall(payload.unmastered ?? {});
          const alreadyMigrated = studyStorage.getItem(MIND_MAP_CLOUD_MIGRATED_KEY) === "yes";
          if (!alreadyMigrated) {
            studyStorage.setItem(MIND_MAP_CLOUD_MIGRATED_KEY, "yes");
            return { ...migrateMindMapRecall(local), ...cloud };
          }
          return cloud;
        });
        setCloudReady(true);
        setCloudStatus("已和网页、主屏幕 App 共享");
      } catch {
        if (!active) return;
        setCloudStatus("工作区暂不可用，当前仍可浏览");
      }
    }
    loadSharedMindMap();
    return () => { active = false; };
  }, []);

  useEffect(()=>{
    if(!editWord||!cloudReady||handledTarget.current===editWord)return;
    handledTarget.current=editWord;
    const target=findGleeMemoryLocation(mindMaps,tableLists,editWord);
    onTargetHandled();
    if(!target){setCloudStatus(`未找到 ${editWord}，可能已改名或移除。`);return;}
    setLibrarySection("maps");setShowOnlyUnmastered(false);setMixedTableLists([]);setMindMapSearch("");
    setEditBackup(cloneMindMaps(mindMaps));setTableEditBackup(JSON.parse(JSON.stringify(tableLists)));setEditing(true);
    if(target.kind==="map"){
      setSelectedList(target.map.list);setVocabView("mindmap");
      setOpenMaps(current=>Array.from(new Set([...current,target.map.id])));
      setRevealedNodes(current=>Array.from(new Set([...current,mindMapNodeKey(target.map.id,target.item.word)])));
      setEditTargetId(`${mindMapSearchTargetId(target.map.id,target.item.word)}-editor`);
    }else{
      setSelectedList(target.table.list);setVocabView("table");
      setEditTargetId(`glee-edit-${target.table.id}-${target.item.id}`);
    }
    setCloudStatus(`已定位 ${target.item.word} 的记忆方法，修改后点击「保存到当前工作区」。`);
  },[editWord,cloudReady,mindMaps,tableLists,onTargetHandled]);
  useEffect(()=>{
    if(!editTargetId||!editing)return;
    const frame=requestAnimationFrame(()=>{
      const element=document.getElementById(editTargetId);
      element?.scrollIntoView({behavior:"smooth",block:"center"});
      element?.querySelector<HTMLTextAreaElement>('textarea[aria-label]')?.focus({preventScroll:true});
    });
    return()=>cancelAnimationFrame(frame);
  },[editTargetId,editing]);

  useEffect(() => {
    try {
      studyStorage.setItem(MIND_MAP_OPEN_KEY, JSON.stringify(openMaps));
    } catch {
      // Expansion state is optional; the maps remain fully usable without it.
    }
  }, [openMaps]);

  useEffect(() => {
    try {
      studyStorage.setItem(MIND_MAP_RECALL_KEY, JSON.stringify(unmasteredNodes));
    } catch {
      // A local copy keeps recall usable offline; D1 remains the shared source of truth.
    }
  }, [unmasteredNodes]);

  useEffect(() => {
    if (!cloudReady) return;
    const timer = window.setTimeout(async () => {
      try {
        setCloudStatus("正在同步未掌握记录…");
        const response = await appFetch("/api/mind-map", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope: "recall", value: unmasteredNodes }),
        });
        if (!response.ok) throw new Error("同步失败");
        setCloudStatus("未掌握记录已同步到当前工作区");
      } catch {
        setCloudStatus("未掌握记录同步失败，将保留本机副本");
      }
    }, 650);
    return () => window.clearTimeout(timer);
  }, [cloudReady, unmasteredNodes]);

  const visibleMaps = selectedList === "all"
    ? mindMaps
    : mindMaps.filter((map) => map.list === selectedList);
  const visibleTables = selectedList === "all"
    ? tableLists
    : tableLists.filter((table) => table.list === selectedList);
  const selectedHasMaps = visibleMaps.length > 0;
  const selectedHasTables = visibleTables.length > 0;
  const activeVocabView = !selectedHasMaps ? "table" : !selectedHasTables ? "mindmap" : vocabView;
  const canChooseVocabView = selectedList === "all" || (typeof selectedList === "number" && GLEE_DUAL_VIEW_SET.has(selectedList));
  const tableScopeTables = mixedTableLists.length
    ? tableLists.filter((table) => mixedTableLists.includes(table.list))
    : visibleTables;
  const unmasteredFilterKeySet = new Set(unmasteredFilterKeys);
  const displayedMaps = showOnlyUnmastered
    ? visibleMaps.filter((map) => map.branches.some((branch) => branch.words.some((item) => unmasteredFilterKeySet.has(mindMapNodeKey(map.id, item.word)))))
    : visibleMaps;
  const displayedTables = showOnlyUnmastered
    ? tableScopeTables.filter((table) => table.words.some((item) => unmasteredFilterKeySet.has(tableReviewNodeKey(table, item.id, item.word))))
    : tableScopeTables;
  const recallScopeKeys = activeVocabView === "table"
    ? tableScopeTables.flatMap((table) => table.words.map((item) => tableReviewNodeKey(table, item.id, item.word)))
    : visibleMaps.flatMap((map) => map.branches.flatMap((branch) => branch.words.map((item) => mindMapNodeKey(map.id, item.word))));
  const scopedUnmasteredCount = new Set([
    ...recallScopeKeys.filter((key) => unmasteredNodes[key]),
  ]).size;
  const mindMapSearchResults = useMemo(() => {
    const query = normalizedLookupWord(mindMapSearch.trim());
    if (!query) return [];
    return mindMaps.flatMap((map) => map.branches.flatMap((branch, branchIndex) => branch.words.map((item) => {
      const meaning = chineseMeaning(map.list, item.word, item.gloss);
      return { map, branch, branchIndex, item, meaning };
    })))
      .filter(({ item, meaning }) => normalizedLookupWord(item.word).includes(query) || meaning.toLocaleLowerCase().includes(query))
      .sort((left, right) => {
        const leftWord = normalizedLookupWord(left.item.word);
        const rightWord = normalizedLookupWord(right.item.word);
        const leftRank = leftWord === query ? 0 : leftWord.startsWith(query) ? 1 : 2;
        const rightRank = rightWord === query ? 0 : rightWord.startsWith(query) ? 1 : 2;
        return leftRank - rightRank || left.map.list - right.map.list || left.map.part - right.map.part || left.branchIndex - right.branchIndex;
      })
      .slice(0, 30);
  }, [mindMapSearch, mindMaps]);

  function updateBranch(mapId: string, branchIndex: number, updater: (branch: GleeMindMap["branches"][number]) => GleeMindMap["branches"][number]) {
    setMindMaps((current) => current.map((map) => map.id !== mapId ? map : {
      ...map,
      branches: map.branches.map((branch, index) => index === branchIndex ? updater(branch) : branch),
    }));
  }

  function beginEditing() {
    setShowOnlyUnmastered(false);
    setEditBackup(cloneMindMaps(mindMaps));
    setTableEditBackup(JSON.parse(JSON.stringify(tableLists)) as GleeTableList[]);
    setEditing(true);
    setCloudStatus("编辑中：导图与表格会双向同步，保存后同步到当前工作区");
  }

  function cancelEditing() {
    if (editBackup) setMindMaps(editBackup);
    if (tableEditBackup) setTableLists(tableEditBackup);
    setEditing(false);
    setEditBackup(null);
    setTableEditBackup(null);
    setNewWordDrafts({});
    setNewLinkDrafts({});
    setCloudStatus("已放弃本次未保存的修改");
  }

  async function saveMindMaps() {
    try {
      if(sharedMemory && Object.keys(sharedMemory.drafts).length && !await sharedMemory.save()) {setCloudStatus("记忆方法尚未保存，请查看页面底部提示。");return;}
      setCloudStatus("正在保存共享导图…");
      const [mapsResponse, tablesResponse] = await Promise.all([
        appFetch("/api/mind-map", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope: "maps", value: mindMaps }),
        }),
        appFetch("/api/mind-map", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope: "tables", value: tableLists }),
        }),
      ]);
      const mapsPayload = await mapsResponse.json() as { maps?: GleeMindMap[]; error?: string };
      const tablesPayload = await tablesResponse.json() as { tables?: GleeTableList[]; error?: string };
      if (!mapsResponse.ok || !mapsPayload.maps) throw new Error(mapsPayload.error ?? "导图保存失败");
      if (!tablesResponse.ok || !tablesPayload.tables) throw new Error(tablesPayload.error ?? "List 1–6 表格保存失败");
      setMindMaps(mapsPayload.maps);
      setTableLists(tablesPayload.tables);
      setEditing(false);
      setEditBackup(null);
      setTableEditBackup(null);
      setNewWordDrafts({});
      setNewLinkDrafts({});
      setCloudReady(true);
      window.dispatchEvent(new Event("glee-memory-saved"));
      setCloudStatus("已保存；同一单词的记忆方法在所有模块共享");
    } catch (error) {
      setCloudStatus(error instanceof Error ? error.message : "保存失败，请稍后再试");
    }
  }

  function updateWord(mapId: string, branchIndex: number, wordIndex: number, field: SharedWordField, value: string) {
    const sourceMap = mindMaps.find((map) => map.id === mapId);
    const oldWord = sourceMap?.branches[branchIndex]?.words[wordIndex]?.word;
    if (!sourceMap || !oldWord) return;
    if (field === "word" && oldWord) {
      const oldKey = mindMapNodeKey(mapId, oldWord);
      const nextKey = mindMapNodeKey(mapId, value);
      setUnmasteredNodes((current) => {
        if (!current[oldKey] || oldKey === nextKey) return current;
        const next = { ...current, [nextKey]: true as const };
        delete next[oldKey];
        return next;
      });
    }
    setMindMaps((current) => syncMindMapWordField(current, sourceMap.list, oldWord, field, value));
    setTableLists((current) => syncTableWordField(current, sourceMap.list, oldWord, field, value));
  }

  function updateTableWord(tableId: string, wordIndex: number, field: SharedWordField, value: string) {
    const sourceTable = tableLists.find((table) => table.id === tableId);
    const oldWord = sourceTable?.words[wordIndex]?.word;
    if (!sourceTable || !oldWord) return;
    if (field === "word") {
      const oldKey = tableReviewNodeKey(sourceTable, sourceTable.words[wordIndex].id, oldWord);
      const nextKey = tableWordNodeKey(sourceTable.id, sourceTable.words[wordIndex].id);
      setUnmasteredNodes((current) => {
        if (!current[oldKey] || oldKey === nextKey) return current;
        const next = { ...current, [nextKey]: true as const };
        delete next[oldKey];
        return next;
      });
    }
    setTableLists((current) => syncTableWordField(current, sourceTable.list, oldWord, field, value));
    setMindMaps((current) => syncMindMapWordField(current, sourceTable.list, oldWord, field, value));
  }

  function toggleTableShuffle() {
    if (showOnlyUnmastered) {
      setUnmasteredFilterKeys(Object.keys(unmasteredNodes).filter((key) => unmasteredNodes[key]));
    }
    if (shuffledTableOrders) {
      setShuffledTableOrders(null);
      return;
    }
    const shuffleIds = (original: string[]) => {
      const shuffled = [...original];
      for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
      }
      if (shuffled.length > 1 && shuffled.every((id, index) => id === original[index])) {
        shuffled.push(shuffled.shift() as string);
      }
      return shuffled;
    };
    const nextOrders = Object.fromEntries(tableLists.map((table) => [table.id, shuffleIds(table.words.map((item) => item.id))]));
    if (mixedTableLists.length) {
      nextOrders["mixed-tables"] = shuffleIds(tableScopeTables.flatMap((table) => table.words.map((item) => `${table.id}:${item.id}`)));
    }
    setShuffledTableOrders(nextOrders);
  }

  function toggleMixedTableList(list: number) {
    setMixedTableLists((current) => current.includes(list)
      ? current.filter((item) => item !== list)
      : [...current, list].sort((left, right) => left - right));
    setShuffledTableOrders(null);
    if (showOnlyUnmastered) {
      setUnmasteredFilterKeys(Object.keys(unmasteredNodes).filter((key) => unmasteredNodes[key]));
    }
  }

  function clearMixedTableLists() {
    setMixedTableLists([]);
    setShuffledTableOrders(null);
    if (showOnlyUnmastered) {
      setUnmasteredFilterKeys(Object.keys(unmasteredNodes).filter((key) => unmasteredNodes[key]));
    }
  }

  function removeWord(mapId: string, branchIndex: number, wordIndex: number) {
    const removed = mindMaps.find((map) => map.id === mapId)?.branches[branchIndex]?.words[wordIndex]?.word;
    if (!removed) return;
    setUnmasteredNodes((current) => {
      const next = { ...current };
      delete next[mindMapNodeKey(mapId, removed)];
      return next;
    });
    updateBranch(mapId, branchIndex, (branch) => {
      return {
        ...branch,
        words: branch.words.filter((_, index) => index !== wordIndex),
        logicLinks: branch.logicLinks?.filter((link) => link.from !== removed && link.to !== removed),
        contrastGroups: branch.contrastGroups?.map((group) => ({ ...group, words: group.words.filter((word) => word !== removed) })).filter((group) => group.words.length),
      };
    });
  }

  function addWord(mapId: string, branchIndex: number, draftKey: string) {
    const draft = newWordDrafts[draftKey];
    const word = draft?.word.trim();
    if (!word) return;
    updateBranch(mapId, branchIndex, (branch) => {
      if (branch.words.some((item) => normalizedLookupWord(item.word) === normalizedLookupWord(word))) return branch;
      const nextWord = {
        word,
        synonyms: draft.synonyms.trim() || undefined,
        relatedWords: draft.relatedWords.trim() || undefined,
        example: draft.example.trim() || undefined,
        memory: draft.memory.trim() || undefined,
      };
      const parent = draft.parent && branch.words.some((item) => item.word === draft.parent) ? draft.parent : "";
      return {
        ...branch,
        words: [...branch.words, nextWord],
        logicLinks: parent
          ? [...(branch.logicLinks ?? []), { from: parent, to: word, label: draft.linkLabel }]
          : branch.logicLinks,
      };
    });
    setNewWordDrafts((current) => ({ ...current, [draftKey]: { ...EMPTY_MIND_MAP_WORD_DRAFT } }));
    setCloudStatus(draft.parent ? `“${word}”已作为“${draft.parent}”的子分支加入草稿` : `“${word}”已加入组主分支`);
  }

  function setWordParent(mapId: string, branchIndex: number, word: string, parent: string) {
    const branch = mindMaps.find((map) => map.id === mapId)?.branches[branchIndex];
    if (!branch || parent === word) return;
    const existing = branch.logicLinks?.find((link) => link.to === word);
    if (parent) {
      const children = new Map<string, string[]>();
      branch.logicLinks?.filter((link) => link.to !== word).forEach((link) => {
        children.set(link.from, [...(children.get(link.from) ?? []), link.to]);
      });
      const pending = [word];
      const visited = new Set<string>();
      while (pending.length) {
        const current = pending.pop();
        if (!current || visited.has(current)) continue;
        if (current === parent) {
          setCloudStatus("不能把单词连接到自己的下级，否则会形成循环");
          return;
        }
        visited.add(current);
        pending.push(...(children.get(current) ?? []));
      }
    }
    updateBranch(mapId, branchIndex, (item) => {
      const withoutCurrentParent = (item.logicLinks ?? []).filter((link) => link.to !== word);
      return {
        ...item,
        logicLinks: parent
          ? [...withoutCurrentParent, { from: parent, to: word, label: existing?.label ?? "派生联结", detail: existing?.detail }]
          : withoutCurrentParent.length ? withoutCurrentParent : undefined,
      };
    });
    setCloudStatus(parent ? `“${word}”现在从“${parent}”延伸` : `“${word}”已移到组主分支`);
  }

  function setWordLinkLabel(mapId: string, branchIndex: number, word: string, label: MindMapLogicLink["label"]) {
    updateBranch(mapId, branchIndex, (branch) => ({
      ...branch,
      logicLinks: branch.logicLinks?.map((link) => link.to === word ? { ...link, label } : link),
    }));
  }

  function addLogicLink(mapId: string, branchIndex: number, draftKey: string) {
    const draft = newLinkDrafts[draftKey];
    if (!draft?.from || !draft.to || draft.from === draft.to) return;
    const branch = mindMaps.find((map) => map.id === mapId)?.branches[branchIndex];
    if (!branch) return;
    if (branch.logicLinks?.some((link) => link.to === draft.to)) {
      setCloudStatus(`“${draft.to}”已经有上级连接，请先移除原连接`);
      return;
    }
    const children = new Map<string, string[]>();
    branch.logicLinks?.forEach((link) => children.set(link.from, [...(children.get(link.from) ?? []), link.to]));
    const pending = [draft.to];
    const visited = new Set<string>();
    while (pending.length) {
      const word = pending.pop();
      if (!word || visited.has(word)) continue;
      if (word === draft.from) {
        setCloudStatus("这条连接会形成循环，请换一个起点或终点");
        return;
      }
      visited.add(word);
      pending.push(...(children.get(word) ?? []));
    }
    updateBranch(mapId, branchIndex, (item) => ({ ...item, logicLinks: [...(item.logicLinks ?? []), { ...draft, detail: draft.detail.trim() || undefined }] }));
    setNewLinkDrafts((current) => ({ ...current, [draftKey]: { from: "", to: "", label: "同义", detail: "" } }));
    setCloudStatus("连接已加入草稿，记得保存到当前工作区");
  }

  function toggleMap(id: string) {
    setOpenMaps((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
  }

  function focusMindMapSearchResult(result: (typeof mindMapSearchResults)[number]) {
    const nodeKey = mindMapNodeKey(result.map.id, result.item.word);
    setShowOnlyUnmastered(false);
    setSelectedList(result.map.list);
    setVocabView("mindmap");
    setOpenMaps((current) => current.includes(result.map.id) ? current : [...current, result.map.id]);
    setRevealedNodes((current) => current.includes(nodeKey) ? current : [...current, nodeKey]);
    pronounce(result.item.word);
    window.setTimeout(() => {
      document.getElementById(mindMapSearchTargetId(result.map.id, result.item.word))?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 160);
  }

  function openVisibleMaps() {
    setOpenMaps((current) => Array.from(new Set([...current, ...displayedMaps.map((map) => map.id)])));
  }

  function closeVisibleMaps() {
    const visibleIds = new Set(displayedMaps.map((map) => map.id));
    setOpenMaps((current) => current.filter((id) => !visibleIds.has(id)));
  }

  function refreshOnlyUnmastered() {
    setShowOnlyUnmastered(true);
    setUnmasteredFilterKeys(Object.keys(unmasteredNodes).filter((key) => unmasteredNodes[key]));
    const markedMapIds = visibleMaps
      .filter((map) => map.branches.some((branch) => branch.words.some((item) => unmasteredNodes[mindMapNodeKey(map.id, item.word)])))
      .map((map) => map.id);
    setOpenMaps((current) => Array.from(new Set([...current, ...markedMapIds])));
  }

  function revealNode(key: string, word: string) {
    setRevealedNodes((current) => current.includes(key) ? current : [...current, key]);
    pronounce(word);
  }

  function hideNode(key: string) {
    setRevealedNodes((current) => current.filter((item) => item !== key));
  }

  function setGroupVisibility(keys: string[], visible: boolean) {
    const keySet = new Set(keys);
    setRevealedNodes((current) => visible
      ? Array.from(new Set([...current, ...keys]))
      : current.filter((key) => !keySet.has(key)));
  }

  function toggleUnmastered(key: string) {
    setUnmasteredNodes((current) => {
      if (current[key]) {
        const next = { ...current };
        delete next[key];
        return next;
      }
      return { ...current, [key]: true };
    });
  }

  function chineseMeaning(list: number, word: string, suppliedGloss?: string) {
    const normalized = normalizedLookupWord(word);
    const storedMeaning = GLEE_MEANING_BY_LIST_WORD.get(`${list}:${normalized}`) ?? GLEE_MEANING_BY_WORD.get(normalized) ?? MIND_MAP_FALLBACK_MEANINGS[normalized];
    if (storedMeaning && suppliedGloss && !/[\u3400-\u9fff]/.test(suppliedGloss)) {
      const linkedWord = normalizedLookupWord(suppliedGloss);
      const linkedMeaning = GLEE_MEANING_BY_WORD.get(linkedWord) ?? MIND_MAP_FALLBACK_MEANINGS[linkedWord];
      return `${storedMeaning} · 近义：${suppliedGloss}${linkedMeaning ? `（${linkedMeaning}）` : ""}`;
    }
    return storedMeaning ?? suppliedGloss ?? "词库中暂无中文释义";
  }

  return (
    <>
      <div className="libraryHead mindMapLibraryHead">
        <div>
          <p className="eyebrow">GLEE 1500 · VISUAL REVIEW</p>
          <h1>GLEE 词汇复习</h1>
          <p className="quickIntro">“词汇导图”按课程顺序整理每组关系；List 21 Part 2 与 List 22–30 是沿用同样方法制作的仿讲内容，并已单独标注。“词根词缀”收录现有课程各 Part 2 的课末总结。</p>
        </div>
        <div className="mindMapCoverage"><strong>{tableLists.length + mindMaps.length}</strong><span>{tableLists.length} 张词汇表 · {mindMaps.length} 张导图<br />覆盖 List {Math.min(...availableMindMapLists)}–{Math.max(...availableMindMapLists)}</span></div>
      </div>

      <div className="mindMapSubnav" role="tablist" aria-label="选择复习板块">
        <button className={librarySection === "maps" ? "active" : ""} onClick={() => setLibrarySection("maps")} role="tab" aria-selected={librarySection === "maps"}>词汇导图</button>
        <button className={librarySection === "roots" ? "active" : ""} onClick={() => setLibrarySection("roots")} role="tab" aria-selected={librarySection === "roots"}>词根词缀</button>
      </div>

      <div className="mindMapToolbar" aria-label="词汇筛选和展示控制">
        <div className="mindMapListFilters" role="group" aria-label="选择 List">
          <button className={selectedList === "all" ? "active" : ""} onClick={() => setSelectedList("all")}>全部</button>
          {availableMindMapLists.map((list) => (
            <button className={selectedList === list ? "active" : ""} onClick={() => setSelectedList(list)} key={list}>List {list}</button>
          ))}
        </div>
        {librarySection === "maps" && <div className="mindMapActions">
          {canChooseVocabView && <div className="mindMapViewSwitch" role="group" aria-label="选择思维导图或表格版">
            <button className={activeVocabView === "mindmap" ? "active" : ""} onClick={() => setVocabView("mindmap")}>思维导图</button>
            <button className={activeVocabView === "table" ? "active" : ""} onClick={() => setVocabView("table")}>表格速刷</button>
          </div>}
          <button className={`mindMapUnmasteredFilter ${showOnlyUnmastered ? "active" : ""}`} onClick={refreshOnlyUnmastered} disabled={editing || (!showOnlyUnmastered && scopedUnmasteredCount === 0)} aria-pressed={showOnlyUnmastered}>
            {showOnlyUnmastered ? `刷新未掌握 (${scopedUnmasteredCount})` : `只看未掌握 (${scopedUnmasteredCount})`}
          </button>
          {showOnlyUnmastered && <button onClick={() => setShowOnlyUnmastered(false)}>显示全部词汇</button>}
          {activeVocabView === "mindmap" && displayedMaps.length > 0 && <button onClick={openVisibleMaps}>导图全部展开</button>}
          {activeVocabView === "mindmap" && displayedMaps.length > 0 && <button onClick={closeVisibleMaps}>导图全部收起</button>}
          {!editing ? <button className="mindMapEditButton" onClick={beginEditing}>编辑内容</button> : (
            <>
              <button onClick={cancelEditing}>放弃修改</button>
              <button className="mindMapSaveButton" onClick={saveMindMaps}>保存到当前工作区</button>
            </>
          )}
        </div>}
      </div>

      {librarySection === "maps" && (
        <section className="mindMapSearch" aria-label="搜索思维导图中的词汇">
          <label>
            <span>搜索导图词汇</span>
            <input type="search" value={mindMapSearch} onChange={(event) => setMindMapSearch(event.target.value)} placeholder="输入英文或中文，例如 cursory / 草率" />
          </label>
          {mindMapSearch.trim() && (
            <div className="mindMapSearchResults" aria-live="polite">
              <p>{mindMapSearchResults.length ? `找到 ${mindMapSearchResults.length} 个位置，点击即可展开并定位` : "没有在思维导图中找到这个词"}</p>
              {mindMapSearchResults.map((result) => (
                <button key={`${result.map.id}:${result.branchIndex}:${result.item.word}`} onClick={() => focusMindMapSearchResult(result)}>
                  <span><b>{result.item.word}</b><small>List {result.map.list} · Part {result.map.part} · {result.branch.title}</small></span>
                  <strong>{result.meaning}</strong>
                  <em>{sharedMemory?.drafts[wordMemoryKey(result.item.word)]?.text ?? sharedMemory?.records[wordMemoryKey(result.item.word)]?.text ?? result.item.relatedWords}</em>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {librarySection === "maps" && <div className={`mindMapCloudStatus ${cloudStatus.includes("失败") || cloudStatus.includes("不可用") ? "error" : ""}`} role="status">
        <i aria-hidden="true">●</i>{cloudStatus}
      </div>}

      {librarySection === "maps" && activeVocabView === "mindmap" && <div className="mindMapLegend" aria-label="导图颜色图例">
        {(Object.keys(MIND_MAP_KIND_LABEL) as MindMapBranchKind[]).map((kind) => <span className={`kind-${kind}`} key={kind}><i />{MIND_MAP_KIND_LABEL[kind]}</span>)}
        <small>点击单词 <b>↗</b> 朗读</small>
      </div>}

      {librarySection === "maps" && <div className="mindMapRecallGuide" aria-label="未掌握标记说明">
        <span><i>!</i><b>只标没掌握的词</b><small>揭晓答案后点击“标记未掌握”；会的词不需要操作，再点一次可取消。</small></span>
      </div>}

      {librarySection === "maps" && showOnlyUnmastered && ((activeVocabView === "mindmap" && displayedMaps.length === 0) || (activeVocabView === "table" && displayedTables.length === 0)) && (
        <div className="mindMapUnmasteredEmpty">当前范围还没有标记为未掌握的词。选择其他 List，或点击“显示全部词汇”返回。</div>
      )}

      {librarySection === "roots" && <RootAffixLibrary selectedList={selectedList} />}

      {librarySection === "maps" && activeVocabView === "table" && tableScopeTables.length > 0 && (
        <section className="gleeTableLibrary" aria-label="GLEE 横向词汇表">
          <div className="gleeTableSectionHead">
            <div><span>{mixedTableLists.length ? "MIXED REVIEW" : selectedList === "all" ? "TABLE REVIEW" : `LIST ${selectedList}`}</span><h2>{mixedTableLists.length ? `List ${mixedTableLists.join(" + ")} 混合速刷` : selectedList === "all" ? "词汇表格速刷" : `List ${selectedList} 表格版`}</h2></div>
            <div className="gleeTableSectionTools">
              <p>先看英文回忆中文；“只看未掌握”会固定本轮词单，取消标记的词等到下次随机打乱或重新进入筛选时再移出。</p>
              <div className="gleeTableActionButtons">
                <button className="gleeCoverAllButton" type="button" onClick={() => setRevealedTableWords([])} disabled={editing || revealedTableWords.length === 0}>
                  一键遮挡
                </button>
                <button className={`gleeShuffleButton ${shuffledTableOrders ? "active" : ""}`} type="button" onClick={toggleTableShuffle} disabled={editing} aria-pressed={Boolean(shuffledTableOrders)}>
                  {shuffledTableOrders ? "恢复课程顺序" : "随机打乱"}
                </button>
              </div>
            </div>
          </div>
          <div className="gleeTableMixPanel">
            <div><span><b>多 List 混合</b><small>可同时选择多个 List，词汇会合并到同一张速刷表中。</small></span>{mixedTableLists.length > 0 && <button type="button" onClick={clearMixedTableLists}>清空混合选择</button>}</div>
            <div className="gleeTableMixChoices" role="group" aria-label="选择需要混合的 List">
              {tableLists.map((table) => <button type="button" className={mixedTableLists.includes(table.list) ? "active" : ""} aria-pressed={mixedTableLists.includes(table.list)} onClick={() => toggleMixedTableList(table.list)} key={`mix-${table.list}`}>List {table.list}</button>)}
            </div>
          </div>
          {(mixedTableLists.length && displayedTables.length
            ? [{ id: "mixed-tables", tables: displayedTables }]
            : displayedTables.map((table) => ({ id: table.id, tables: [table] }))
          ).map((section) => {
            const isMixed = section.id === "mixed-tables";
            const tableUnmasteredCount = section.tables.reduce((total, table) => total + table.words.filter((item) => unmasteredNodes[tableReviewNodeKey(table, item.id, item.word)]).length, 0);
            const shuffleOrder = shuffledTableOrders?.[section.id];
            const orderById = shuffleOrder ? new Map(shuffleOrder.map((id, index) => [id, index])) : null;
            const displayedWords = section.tables
              .flatMap((table) => table.words.map((item, wordIndex) => ({ table, item, wordIndex, orderKey: isMixed ? `${table.id}:${item.id}` : item.id })))
              .filter(({ table, item }) => !showOnlyUnmastered || unmasteredFilterKeySet.has(tableReviewNodeKey(table, item.id, item.word)))
              .sort((left, right) => editing || !orderById
                ? left.table.list - right.table.list || left.wordIndex - right.wordIndex
                : (orderById.get(left.orderKey) ?? Number.MAX_SAFE_INTEGER) - (orderById.get(right.orderKey) ?? Number.MAX_SAFE_INTEGER));
            return (
              <article className={`gleeTableCard ${editing ? "is-editing" : ""} ${isMixed ? "is-mixed" : ""}`} key={section.id}>
                <header>
                  <div><strong>{isMixed ? `List ${mixedTableLists.join(" + ")}` : `List ${section.tables[0].list}`}</strong><span>{showOnlyUnmastered ? `本轮 ${displayedWords.length} 个` : `${displayedWords.length} 个词`}</span></div>
                  <small>{tableUnmasteredCount ? `${tableUnmasteredCount} 个未掌握` : "暂时没有未掌握"}</small>
                </header>
                <div className="gleeWordGrid">
                  {displayedWords.map(({ table, item, wordIndex }) => {
                    const nodeKey = tableReviewNodeKey(table, item.id, item.word);
                    const visible = revealedTableWords.includes(nodeKey);
                    const isUnmastered = Boolean(unmasteredNodes[nodeKey]);
                    const hasExtras = Boolean(item.memory || item.synonyms || item.relatedWords || item.example);
                    if (editing) {
                      return (
                        <div className="gleeTableEditCell" id={`glee-edit-${table.id}-${item.id}`} key={`${table.id}:${item.id}`}>
                          <span>{isMixed ? `L${table.list} · #${wordIndex + 1}` : `#${wordIndex + 1}`}</span>
                          <input aria-label={`List ${table.list} 第 ${wordIndex + 1} 个英文单词`} value={item.word} onChange={(event) => updateTableWord(table.id, wordIndex, "word", event.target.value)} />
                          <SharedWordMemory word={item.word} editing/>
                          <input placeholder="同义词（可选）" value={item.synonyms ?? ""} onChange={(event) => updateTableWord(table.id, wordIndex, "synonyms", event.target.value)} />
                          <input placeholder="相关词汇（可选：词形、派生词等）" value={item.relatedWords ?? ""} onChange={(event) => updateTableWord(table.id, wordIndex, "relatedWords", event.target.value)} />
                          <textarea placeholder="例句（可选）" value={item.example ?? ""} onChange={(event) => updateTableWord(table.id, wordIndex, "example", event.target.value)} />
                        </div>
                      );
                    }
                    return (
                      <div className={`gleeTableWordCell ${visible ? "revealed" : ""} ${isUnmastered ? "unmastered" : ""}`} key={`${table.id}:${item.id}`}>
                        <button className="gleeTableWordMain" onClick={() => {
                          if (!visible) setRevealedTableWords((current) => [...current, nodeKey]);
                          pronounce(item.word);
                        }} aria-expanded={visible}>
                          <small>{isMixed ? `List ${table.list} · #${wordIndex + 1}` : `#${wordIndex + 1}`}</small>
                          <strong>{item.word}</strong>
                          {visible && <span>{chineseMeaning(table.list, item.word)}</span>}
                        </button>
                        {visible && (
                          <div className="gleeTableWordExtras">
                            {!editing && <SharedWordMemory word={item.word}/> }
                            {item.synonyms && <p><b>同义词</b><span>{item.synonyms}</span></p>}
                            {item.relatedWords && <p><b>相关词汇</b><span>{item.relatedWords}</span></p>}
                            {item.example && <p><b>例句</b><span>{item.example}</span></p>}
                          </div>
                        )}
                        {visible && (
                          <div className="gleeTableWordActions">
                            <button className={isUnmastered ? "active" : ""} onClick={() => toggleUnmastered(nodeKey)}>{isUnmastered ? "! 未掌握" : "标记未掌握"}</button>
                            <button onClick={() => setRevealedTableWords((current) => current.filter((key) => key !== nodeKey))}>重新遮住</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {librarySection === "maps" && activeVocabView === "mindmap" && <div className="mindMapCollection">
        {displayedMaps.map((map) => {
          const isOpen = openMaps.includes(map.id);
          const wordCount = new Set(map.branches.flatMap((branch) => branch.words.map((item) => item.word))).size;
          const mapNodeKeys = map.branches.flatMap((branch) => branch.words.map((item) => mindMapNodeKey(map.id, item.word)));
          const unmasteredCount = mapNodeKeys.filter((key) => unmasteredNodes[key]).length;
          return (
            <article className={`mindMapCard ${isOpen ? "open" : ""}`} key={map.id}>
              <button className="mindMapCardHeader" onClick={() => toggleMap(map.id)} aria-expanded={isOpen} aria-controls={`mindmap-${map.id}`}>
                <span className="mindMapListBadge">List {map.list}</span>
                <span className="mindMapPart"><strong>Part {map.part}</strong><small>{showOnlyUnmastered ? `${unmasteredCount} 个未掌握` : `${map.branches.length} 个分组 · ${wordCount} 个词形`}</small>{(map.list >= 22 || map.id === "21-2") && <em className="mindMapModeledBadge">仿 Glee 讲解</em>}</span>
                <span className={`mindMapCardProgress ${unmasteredCount ? "hasItems" : ""}`}><b>{unmasteredCount}</b> 个未掌握</span>
                <span className="mindMapExpand">{isOpen ? "收起" : "展开导图"}<i aria-hidden="true">⌄</i></span>
              </button>

              {isOpen && (
                <div className="mindMapStage" id={`mindmap-${map.id}`}>
                  <p className="mindMapPanHint">{map.list >= 22 || map.id === "21-2" ? "按老师既有方法仿讲并重新归组；不是官方课程原话" : "已按老师讲解与课末总结顺序从上到下排列"}</p>
                  <div className="mindMapCanvas">
                    <div className="mindMapCore"><span>List {map.list}</span><strong>Part {map.part}</strong></div>
                    <div className="mindMapBranches">
                    {courseBranchIndexes(map.branches.length).map((branchIndex, readingIndex) => (
                      (() => {
                        const branch = map.branches[branchIndex];
                        const branchWords = showOnlyUnmastered
                          ? branch.words.filter((item) => unmasteredFilterKeySet.has(mindMapNodeKey(map.id, item.word)))
                          : branch.words;
                        if (!branchWords.length) return null;
                        const nodeKeys = branchWords.map((item) => mindMapNodeKey(map.id, item.word));
                        const groupVisible = nodeKeys.every((key) => revealedNodes.includes(key));
                        const englishFirst = branch.kind === "root" || branch.kind === "form";
                        const wordIndexByName = new Map(branch.words.map((item, wordIndex) => [item.word, wordIndex]));
                        const displayedWordNames = new Set(branchWords.map((item) => item.word));
                        const parentByTarget = new Map<string, NonNullable<typeof branch.logicLinks>[number]>();
                        const childrenBySource = new Map<string, NonNullable<typeof branch.logicLinks>>();
                        acyclicMindMapLogicLinks(branch.logicLinks ?? []).forEach((link) => {
                          if (!displayedWordNames.has(link.from) || !displayedWordNames.has(link.to) || parentByTarget.has(link.to)) return;
                          parentByTarget.set(link.to, link);
                          childrenBySource.set(link.from, [...(childrenBySource.get(link.from) ?? []), link]);
                        });
                        const rootWords = branchWords.filter((item) => !parentByTarget.has(item.word));
                        const countLabel = branch.count.includes("+")
                          ? `原图标注 ${branch.count}`
                          : `${branch.count} 个词`;
                        const directEdgeLabel = branch.kind === "root" ? "词根延伸" : branch.kind === "form" ? "词形联结" : branch.kind === "contrast" ? "对照归类" : "同义归组";

                        const renderWordNode = (item: (typeof branch.words)[number], incomingLabel?: string, incomingDetail?: string, trail: string[] = []) => {
                          const wordIndex = wordIndexByName.get(item.word);
                          if (wordIndex === undefined || trail.includes(item.word)) return null;
                          const nodeKey = mindMapNodeKey(map.id, item.word);
                          const visible = revealedNodes.includes(nodeKey);
                          const contrastGroup = branch.contrastGroups?.find((group) => group.words.includes(item.word));
                          const isUnmastered = Boolean(unmasteredNodes[nodeKey]);
                          const childLinks = childrenBySource.get(item.word) ?? [];
                          const edgeLabel = incomingLabel ?? contrastGroup?.label ?? directEdgeLabel;
                          const hasExtras = Boolean(item.memory || item.synonyms || item.relatedWords || item.example);
                          const parentLink = branch.logicLinks?.find((link) => link.to === item.word);
                          return (
                            <div className={`mindMapTreeNode ${childLinks.length ? "hasChildren" : ""}`} key={nodeKey}>
                              <div className="mindMapTreeRow">
                                <span className={`mindMapEdgeLabel ${!incomingLabel ? "groupEdge" : "relationEdge"}`} title={incomingDetail}>{edgeLabel}</span>
                                <div className={`mindMapWordCell ${isUnmastered ? "unmastered" : ""}`} id={mindMapSearchTargetId(map.id, item.word)}>
                                  <div className={`mindMapWordSlot ${englishFirst ? "englishCue" : "chineseCue"} ${visible ? "revealed" : "masked"} ${visible && contrastGroup ? `tone-${contrastGroup.tone}` : ""}`}>
                                    <button className="mindMapWordMain" onClick={() => visible ? pronounce(item.word) : revealNode(nodeKey, item.word)} aria-label={visible ? `朗读 ${item.word}` : `揭晓第 ${wordIndex + 1} 个单词`} title={visible ? `朗读 ${item.word}` : "点击揭晓并朗读"}>
                                      {englishFirst ? (
                                        <><strong>{item.word}</strong><small>{visible ? chineseMeaning(map.list, item.word, item.gloss) : "点击核对中文义"}</small><i aria-hidden="true">↗</i></>
                                      ) : visible ? (
                                        <><strong>{item.word}</strong>{contrastGroup && <em>{contrastGroup.label}</em>}<small>{chineseMeaning(map.list, item.word, item.gloss)}</small><i aria-hidden="true">↗</i></>
                                      ) : (
                                        <><strong aria-hidden="true">••••••</strong><small>点击回忆英文</small></>
                                      )}
                                    </button>
                                    {visible && <button className="mindMapWordHide" onClick={() => hideNode(nodeKey)} aria-label={`遮住 ${item.word}`} title="重新遮住">×</button>}
                                  </div>
                                  {visible && (
                                    <div className="mindMapWordExtras" aria-label={`${item.word} 的补充学习内容`}>
                                      {!editing && <SharedWordMemory word={item.word}/> }
                                      {item.synonyms && <p><b>同义词</b><span>{item.synonyms}</span></p>}
                                      {item.relatedWords && <p><b>相关词汇</b><span>{item.relatedWords}</span></p>}
                                      {item.example && <p><b>例句</b><span>{item.example}</span></p>}
                                    </div>
                                  )}
                                  {visible && (
                                    <button
                                      className={`mindMapUnmasteredButton ${isUnmastered ? "active" : ""}`}
                                      onClick={() => toggleUnmastered(nodeKey)}
                                      aria-pressed={isUnmastered}
                                    >{isUnmastered ? "! 已标记未掌握" : "标记未掌握"}</button>
                                  )}
                                </div>
                                {editing && (
                                  <div className="mindMapInlineWordEditor" id={`${mindMapSearchTargetId(map.id,item.word)}-editor`} aria-label={`编辑 ${item.word}`}>
                                    <div className="mindMapInlineEditorFields">
                                      <input aria-label="英文单词" placeholder="英文单词" value={item.word} onChange={(event) => updateWord(map.id, branchIndex, wordIndex, "word", event.target.value)} />
                                      <SharedWordMemory word={item.word} editing/>
                                      <input aria-label={`${item.word} 的同义词`} placeholder="同义词（可选）" value={item.synonyms ?? ""} onChange={(event) => updateWord(map.id, branchIndex, wordIndex, "synonyms", event.target.value)} />
                                      <input aria-label={`${item.word} 的相关词汇`} placeholder="相关词汇（词形、派生词等）" value={item.relatedWords ?? ""} onChange={(event) => updateWord(map.id, branchIndex, wordIndex, "relatedWords", event.target.value)} />
                                      <textarea aria-label={`${item.word} 的例句`} placeholder="例句（可选）" value={item.example ?? ""} onChange={(event) => updateWord(map.id, branchIndex, wordIndex, "example", event.target.value)} />
                                    </div>
                                    <div className="mindMapInlineEditorRelation">
                                      <label>上级词<select value={parentLink?.from ?? ""} onChange={(event) => setWordParent(map.id, branchIndex, item.word, event.target.value)}><option value="">组主分支</option>{branch.words.filter((candidate) => candidate.word !== item.word).map((candidate) => <option value={candidate.word} key={`${item.word}:parent:${candidate.word}`}>{candidate.word}</option>)}</select></label>
                                      <label>关系<select disabled={!parentLink} value={parentLink?.label ?? "派生联结"} onChange={(event) => setWordLinkLabel(map.id, branchIndex, item.word, event.target.value as MindMapLogicLink["label"])}>{MIND_MAP_LINK_LABELS.map((label) => <option value={label} key={`${item.word}:${label}`}>{label}</option>)}</select></label>
                                      <button onClick={() => removeWord(map.id, branchIndex, wordIndex)}>移除这个词</button>
                                    </div>
                                  </div>
                                )}
                              </div>
                              {childLinks.length > 0 && (
                                <div className="mindMapTreeChildren">
                                  {childLinks.map((link) => {
                                    const child = branch.words[wordIndexByName.get(link.to) ?? -1];
                                    return child ? renderWordNode(child, link.label, link.detail, [...trail, item.word]) : null;
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        };
                        return (
                          <section className={`mindMapBranch kind-${branch.kind} side-single ${editing ? "is-editing" : ""}`} key={`${map.id}-${branchIndex}`}>
                            <div className="mindMapBranchNode" title={branch.note ?? branch.relation}>
                              <span>第 {readingIndex + 1} 组 · {MIND_MAP_KIND_LABEL[branch.kind]}</span>
                              <strong>{branch.title}</strong>
                              <b>{countLabel}</b>
                              {branch.relation && <small className="mindMapBranchRelation"><i aria-hidden="true">↳</i>{branch.relation}</small>}
                              {branch.contrastGroups && (
                                <div className="mindMapContrastLegend" aria-label="对照的两个方向">
                                  {branch.contrastGroups.map((group) => <span className={`tone-${group.tone}`} key={group.label}><i />{group.label}</span>)}
                                </div>
                              )}
                              <div className="mindMapBranchTools">
                                <button onClick={() => setGroupVisibility(nodeKeys, !groupVisible)}>{groupVisible ? (englishFirst ? "遮住释义" : "遮住英文") : (englishFirst ? "显示释义" : "显示英文")}</button>
                              </div>
                            </div>
                            <div className="mindMapWordForest">
                              {rootWords.map((item) => renderWordNode(item))}
                            </div>
                            {editing && (() => {
                              const draftKey = `${map.id}:${branchIndex}`;
                              const wordDraft = newWordDrafts[draftKey] ?? EMPTY_MIND_MAP_WORD_DRAFT;
                              const linkDraft = newLinkDrafts[draftKey] ?? { from: "", to: "", label: "同义" as const, detail: "" };
                              return (
                                <div className="mindMapBranchEditor">
                                  <div className="mindMapEditorTitle">
                                    <label>分组名<input value={branch.title} onChange={(event) => updateBranch(map.id, branchIndex, (item) => ({ ...item, title: event.target.value }))} /></label>
                                    <label>类型<select value={branch.kind} onChange={(event) => updateBranch(map.id, branchIndex, (item) => ({ ...item, kind: event.target.value as MindMapBranchKind }))}>{(Object.keys(MIND_MAP_KIND_LABEL) as MindMapBranchKind[]).map((kind) => <option value={kind} key={kind}>{MIND_MAP_KIND_LABEL[kind]}</option>)}</select></label>
                                  </div>
                                  <p>添加新单词（已有单词直接在它右侧编辑）</p>
                                  <div className="mindMapEditorWords">
                                    <div className="mindMapEditorWordCard mindMapEditorAddRow">
                                      <div className="mindMapEditorWordMain">
                                        <input placeholder="新单词" value={wordDraft.word} onChange={(event) => setNewWordDrafts((current) => ({ ...current, [draftKey]: { ...wordDraft, word: event.target.value } }))} />
                                        <SharedWordMemory word={wordDraft.word} editing/>
                                        <button onClick={() => addWord(map.id, branchIndex, draftKey)}>＋ 加单词</button>
                                      </div>
                                      <div className="mindMapEditorWordExtras">
                                        <input placeholder="同义词（可选）" value={wordDraft.synonyms} onChange={(event) => setNewWordDrafts((current) => ({ ...current, [draftKey]: { ...wordDraft, synonyms: event.target.value } }))} />
                                        <input placeholder="相关词汇（可选：词形、派生词等）" value={wordDraft.relatedWords} onChange={(event) => setNewWordDrafts((current) => ({ ...current, [draftKey]: { ...wordDraft, relatedWords: event.target.value } }))} />
                                        <textarea placeholder="例句（可选）" value={wordDraft.example} onChange={(event) => setNewWordDrafts((current) => ({ ...current, [draftKey]: { ...wordDraft, example: event.target.value } }))} />
                                      </div>
                                      <div className="mindMapEditorWordRelation">
                                        <label>从哪个词延伸<select value={wordDraft.parent} onChange={(event) => setNewWordDrafts((current) => ({ ...current, [draftKey]: { ...wordDraft, parent: event.target.value } }))}><option value="">直接放在组主分支</option>{branch.words.map((item) => <option value={item.word} key={`new-parent:${item.word}`}>{item.word}</option>)}</select></label>
                                        <label>关系<select disabled={!wordDraft.parent} value={wordDraft.linkLabel} onChange={(event) => setNewWordDrafts((current) => ({ ...current, [draftKey]: { ...wordDraft, linkLabel: event.target.value as MindMapLogicLink["label"] } }))}>{MIND_MAP_LINK_LABELS.map((label) => <option value={label} key={`new:${label}`}>{label}</option>)}</select></label>
                                      </div>
                                    </div>
                                  </div>
                                  <p>组内连接</p>
                                  <div className="mindMapEditorLinks">
                                    {(branch.logicLinks ?? []).map((link, linkIndex) => (
                                      <div key={`${draftKey}:link:${linkIndex}`}>
                                        <span><b>{link.from}</b><i>→</i><b>{link.to}</b><small>{link.label}{link.detail ? ` · ${link.detail}` : ""}</small></span>
                                        <button onClick={() => updateBranch(map.id, branchIndex, (item) => ({ ...item, logicLinks: item.logicLinks?.filter((_, index) => index !== linkIndex) }))}>移除连接</button>
                                      </div>
                                    ))}
                                    <div className="mindMapEditorAddLink">
                                      <select aria-label="连接起点" value={linkDraft.from} onChange={(event) => setNewLinkDrafts((current) => ({ ...current, [draftKey]: { ...linkDraft, from: event.target.value } }))}><option value="">从哪个词</option>{branch.words.map((item) => <option value={item.word} key={`from-${item.word}`}>{item.word}</option>)}</select>
                                      <span>→</span>
                                      <select aria-label="连接终点" value={linkDraft.to} onChange={(event) => setNewLinkDrafts((current) => ({ ...current, [draftKey]: { ...linkDraft, to: event.target.value } }))}><option value="">连到哪个词</option>{branch.words.map((item) => <option value={item.word} key={`to-${item.word}`}>{item.word}</option>)}</select>
                                      <select aria-label="关系" value={linkDraft.label} onChange={(event) => setNewLinkDrafts((current) => ({ ...current, [draftKey]: { ...linkDraft, label: event.target.value as MindMapLogicLink["label"] } }))}>{MIND_MAP_LINK_LABELS.map((label) => <option value={label} key={label}>{label}</option>)}</select>
                                      <input aria-label="连接说明" placeholder="连接说明（可选）" value={linkDraft.detail} onChange={(event) => setNewLinkDrafts((current) => ({ ...current, [draftKey]: { ...linkDraft, detail: event.target.value } }))} />
                                      <button onClick={() => addLogicLink(map.id, branchIndex, draftKey)}>＋ 加连接</button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </section>
                        );
                      })()
                    ))}
                    </div>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>}
    </>
  );
}

function parseVocabulary(text: string): Word[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const rows = lines.map((line) => {
    const cells: string[] = [];
    let cell = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (character === '"' && quoted && line[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = !quoted;
      } else if (character === delimiter && !quoted) {
        cells.push(cell.trim());
        cell = "";
      } else {
        cell += character;
      }
    }
    cells.push(cell.trim());
    return cells;
  });
  const header = rows[0].map((cell) => cell.toLowerCase());
  const hasHeader = header.some((cell) => ["word", "单词", "meaning", "释义"].includes(cell));
  const wordIndex = Math.max(0, header.findIndex((cell) => ["word", "单词"].includes(cell)));
  const meaningIndex = hasHeader
    ? Math.max(1, header.findIndex((cell) => ["meaning", "释义", "中文释义"].includes(cell)))
    : 1;
  return rows
    .slice(hasHeader ? 1 : 0)
    .filter((row) => row[wordIndex] && row[meaningIndex])
    .map((row, index) => ({
      id: `${row[wordIndex].toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${index}`,
      word: row[wordIndex],
      meaning: row[meaningIndex],
      pos: row[hasHeader ? header.findIndex((cell) => ["pos", "词性"].includes(cell)) : 2] || "",
      phonetic: row[hasHeader ? header.findIndex((cell) => ["phonetic", "音标"].includes(cell)) : 3] || "",
      note: row[hasHeader ? header.findIndex((cell) => ["note", "备注"].includes(cell)) : 4] || "",
      list: Number(row[hasHeader ? header.findIndex((cell) => ["list", "列表"].includes(cell)) : 5]) || undefined,
      page: Number(row[hasHeader ? header.findIndex((cell) => ["page", "页码"].includes(cell)) : 6]) || undefined,
    }));
}

export default function Home() {
  const [practiceDeck,setPracticeDeck]=useState<PracticeDeck|null>(null);
  const [words, setWords] = useState<Word[]>(SOURCE_WORDS);
  const [store, setStore] = useState<Store>(EMPTY_STORE);
  const [equivalentStore, setEquivalentStore] = useState<EquivalentStore>(EMPTY_EQUIVALENT_STORE);
  const [now] = useState(() => Date.now());
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<"home" | "quick" | "study" | "equivalents" | "library">("quick");
  const [aPlusMode,setAPlusMode] = useState<"scan"|"test">("scan");
  const [quickType, setQuickType] = useState<QuickType>("words");
  const [gleeEditWord,setGleeEditWord]=useState<string|null>(null);
  const [quickShuffle, setQuickShuffle] = useState<Record<QuickType, ShuffleSetting>>({
    bb: { enabled: false, seed: 0 },
    notebook: { enabled: false, seed: 0 },
    words: { enabled: false, seed: 0 },
    equivalents: { enabled: false, seed: 0 },
    "a-plus": { enabled: false, seed: 0 },
    glee: { enabled: false, seed: 0 },
    mindmap: { enabled: false, seed: 0 },
    math: { enabled: false, seed: 0 },
    "lclj-fill": { enabled: false, seed: 0 },
    "lclj-reading": { enabled: false, seed: 0 },
    "lclj-math": { enabled: false, seed: 0 },
  });
  const [equivalentMode, setEquivalentMode] = useState<"learn" | "test">("learn");
  const [equivalentSet, setEquivalentSet] = useState("1");
  const [equivalentIndex, setEquivalentIndex] = useState(0);
  const [equivalentStage, setEquivalentStage] = useState<"pair" | "meaning" | "result">("pair");
  const [equivalentSelected, setEquivalentSelected] = useState<string[]>([]);
  const [pairCorrect, setPairCorrect] = useState(false);
  const [meaningSelected, setMeaningSelected] = useState<string | null>(null);
  const [wordRetries, setWordRetries] = useState<SessionRetry[]>([]);
  const [equivalentRetries, setEquivalentRetries] = useState<SessionRetry[]>([]);
  const [quickRatings, setQuickRatings] = useState<Record<string, QuickRating>>({});
  const [quickRevealed, setQuickRevealed] = useState<string[]>([]);
  const [quickActiveId, setQuickActiveId] = useState<string | null>(null);
  const [quickQuery, setQuickQuery] = useState("");
  const [quickRatingFilters, setQuickRatingFilters] = useState<QuickRatingFilter[]>([]);
  const [quickRatingSnapshot, setQuickRatingSnapshot] = useState<Record<string, QuickRating>>({});
  const [quickEquivalentRatings, setQuickEquivalentRatings] = useState<Record<string, QuickRating>>({});
  const [quickEquivalentRevealStages, setQuickEquivalentRevealStages] = useState<Record<string, number>>({});
  const [quickEquivalentMemoryOpen, setQuickEquivalentMemoryOpen] = useState<string[]>([]);
  const [quickEquivalentActiveId, setQuickEquivalentActiveId] = useState<string | null>(null);
  const [quickEquivalentQuery, setQuickEquivalentQuery] = useState("");
  const [quickEquivalentRatingFilters, setQuickEquivalentRatingFilters] = useState<QuickRatingFilter[]>([]);
  const [quickEquivalentRatingSnapshot, setQuickEquivalentRatingSnapshot] = useState<Record<string, QuickRating>>({});
  const [quickEquivalentCueMode, setQuickEquivalentCueMode] = useState<EquivalentCueMode>("left");
  const [quickWordLists, setQuickWordLists] = useState<number[]>([1]);
  const [quickEquivalentSets, setQuickEquivalentSets] = useState<number[]>([1]);
  const [aPlusLists, setAPlusLists] = useState<number[]>([1]);
  const [aPlusRatings, setAPlusRatings] = useState<Record<string, QuickRating>>({});
  const [aPlusMeaningOverrides,setAPlusMeaningOverrides]=useState<Record<string,boolean>>({});
  const [aPlusRevealStages, setAPlusRevealStages] = useState<Record<string, number>>({});
  const [aPlusActiveId, setAPlusActiveId] = useState<string | null>(null);
  const [aPlusQuery, setAPlusQuery] = useState("");
  const [aPlusRatingFilters, setAPlusRatingFilters] = useState<QuickRatingFilter[]>([]);
  const [aPlusRatingSnapshot, setAPlusRatingSnapshot] = useState<Record<string, QuickRating>>({});
  const [aPlusCueMode, setAPlusCueMode] = useState<APlusCueMode>("word");
  const [gleeLists, setGleeLists] = useState<number[]>([1]);
  const [gleeRatings, setGleeRatings] = useState<Record<string, QuickRating>>({});
  const [gleeRevealStages, setGleeRevealStages] = useState<Record<string, number>>({});
  const [gleeMemoryOpen, setGleeMemoryOpen] = useState<string[]>([]);
  const [gleeActiveId, setGleeActiveId] = useState<string | null>(null);
  const [gleeQuery, setGleeQuery] = useState("");
  const [gleeRatingFilters, setGleeRatingFilters] = useState<QuickRatingFilter[]>([]);
  const [gleeRatingSnapshot, setGleeRatingSnapshot] = useState<Record<string, QuickRating>>({});
  const [mathCategories, setMathCategories] = useState<string[]>([MATH_CATEGORIES[0]]);
  const [lcljRatings, setLcljRatings] = useState<Record<string, QuickRating>>({});
  const [mathRatings, setMathRatings] = useState<Record<string, QuickRating>>({});
  const [mathRevealed, setMathRevealed] = useState<string[]>([]);
  const [mathActiveId, setMathActiveId] = useState<string | null>(null);
  const [mathQuery, setMathQuery] = useState("");
  const [mathRatingFilters, setMathRatingFilters] = useState<QuickRatingFilter[]>([]);
  const [mathRatingSnapshot, setMathRatingSnapshot] = useState<Record<string, QuickRating>>({});
  const [currentPlanDay, setCurrentPlanDay] = useState(1);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [query, setQuery] = useState("");
  const [listFilter, setListFilter] = useState("all");
  const [studyList, setStudyList] = useState("1");
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [importMessage, setImportMessage] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const quickRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const quickShouldScroll = useRef(false);
  const quickWordAutoSpokenId = useRef("");
  const quickEquivalentRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const quickEquivalentShouldScroll = useRef(false);
  const quickEquivalentAutoSpokenKey = useRef("");
  const aPlusRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const aPlusShouldScroll = useRef(false);
  const aPlusAutoSpokenKey = useRef("");
  const gleeRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const gleeShouldScroll = useRef(false);
  const gleeAutoSpokenId = useRef("");
  const mathRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const mathShouldScroll = useRef(false);
  const mathAutoSpokenId = useRef("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setStore(loadStore());
      setEquivalentStore(loadEquivalentStore());
      // Restore each ratings map independently of optional words and settings.
      const restoreRatings = (key:string,apply:(value:Record<string,QuickRating>)=>void) => {
        const value=readSavedRatings(studyStorage,key);if(value)apply(value);
      };
      restoreRatings(QUICK_RATING_KEY,r=>{setQuickRatings(r);setQuickRatingSnapshot(r);});
      restoreRatings(EQUIVALENT_QUICK_RATING_KEY,r=>{setQuickEquivalentRatings(r);setQuickEquivalentRatingSnapshot(r);});
      restoreRatings(A_PLUS_QUICK_RATING_KEY,r=>{setAPlusRatings(r);setAPlusRatingSnapshot(r);});
      restoreRatings(GLEE_QUICK_RATING_KEY,r=>{setGleeRatings(r);setGleeRatingSnapshot(r);});
      restoreRatings(LCLJ_QUICK_RATING_KEY,setLcljRatings);
      restoreRatings(MATH_QUICK_RATING_KEY,r=>{setMathRatings(r);setMathRatingSnapshot(r);});
      try {
        const savedWords = studyStorage.getItem(`${STORAGE_KEY}-words`);
        if (savedWords) {
          try {const parsed=JSON.parse(savedWords);if(Array.isArray(parsed)&&parsed.every(w=>w&&typeof w.id==="string"&&typeof w.word==="string"&&typeof w.meaning==="string"))setWords(parsed);}catch{}
        }
        const savedStudyList = studyStorage.getItem(`${STORAGE_KEY}-study-list`);
        if (savedStudyList) setStudyList(savedStudyList);
        const savedAutoSpeak = studyStorage.getItem(`${STORAGE_KEY}-auto-speak`);
        if (savedAutoSpeak !== null) setAutoSpeak(savedAutoSpeak !== "false");
        const savedQuickWordLists = storedNumberSelection(QUICK_WORD_LISTS_KEY, 30);
        const savedQuickEquivalentSets = storedNumberSelection(QUICK_EQUIVALENT_SETS_KEY, 29);
        const savedAPlusLists = storedNumberSelection(A_PLUS_LISTS_KEY, 80);
        const savedGleeLists = storedNumberSelection(GLEE_LISTS_KEY, 30);
        const savedMathCategories = storedStringSelection(MATH_CATEGORIES_KEY, MATH_CATEGORIES);
        if (savedQuickWordLists) setQuickWordLists(savedQuickWordLists);
        if (savedQuickEquivalentSets) setQuickEquivalentSets(savedQuickEquivalentSets);
        if (savedAPlusLists) setAPlusLists(savedAPlusLists);
        if (savedGleeLists) setGleeLists(savedGleeLists);
        if (savedMathCategories) setMathCategories(savedMathCategories);
        const savedQuickType = studyStorage.getItem("gre-last-quick-type-v1");
        if (["notebook", "words", "equivalents", "a-plus", "bb", "glee", "mindmap", "math", "lclj-fill", "lclj-reading", "lclj-math"].includes(savedQuickType ?? "")) setQuickType(savedQuickType as QuickType);
        const savedManualDay = Number(studyStorage.getItem(PLAN_DAY_KEY));
        const savedPlanStart = Number(studyStorage.getItem(PLAN_START_KEY));
        const migratedDay = savedPlanStart ? planDay(savedPlanStart) : 1;
        const selectedDay = savedManualDay >= 1 && savedManualDay <= 14 ? savedManualDay : migratedDay;
        setCurrentPlanDay(selectedDay);
        studyStorage.setItem(PLAN_DAY_KEY, String(selectedDay));
      } catch {}
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (ready) studyStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }, [ready, store]);

  useEffect(() => {
    if (ready) studyStorage.setItem(EQUIVALENT_KEY, JSON.stringify(equivalentStore));
  }, [equivalentStore, ready]);

  useEffect(() => {
    if (ready) studyStorage.setItem(`${STORAGE_KEY}-study-list`, studyList);
  }, [ready, studyList]);

  useEffect(() => {
    if (ready) studyStorage.setItem(`${STORAGE_KEY}-auto-speak`, String(autoSpeak));
  }, [autoSpeak, ready]);

  useEffect(() => {
    if (ready) studyStorage.setItem(PLAN_DAY_KEY, String(currentPlanDay));
  }, [currentPlanDay, ready]);

  useEffect(() => {
    if (ready) writeSavedRatings(studyStorage,QUICK_RATING_KEY,quickRatings);
  }, [quickRatings, ready]);

  useEffect(() => {
    if (ready) writeSavedRatings(studyStorage,EQUIVALENT_QUICK_RATING_KEY,quickEquivalentRatings);
  }, [quickEquivalentRatings, ready]);

  useEffect(() => {
    if (ready) writeSavedRatings(studyStorage,A_PLUS_QUICK_RATING_KEY,aPlusRatings);
  }, [aPlusRatings, ready]);

  useEffect(() => {
    if (ready) writeSavedRatings(studyStorage,GLEE_QUICK_RATING_KEY,gleeRatings);
  }, [gleeRatings, ready]);

  useEffect(() => {
    if (ready) writeSavedRatings(studyStorage,MATH_QUICK_RATING_KEY,mathRatings);
  }, [mathRatings, ready]);

  useEffect(() => {
    if (ready) writeSavedRatings(studyStorage,LCLJ_QUICK_RATING_KEY,lcljRatings);
  }, [lcljRatings, ready]);

  useEffect(() => {
    if (ready) studyStorage.setItem(QUICK_WORD_LISTS_KEY, JSON.stringify(quickWordLists));
  }, [quickWordLists, ready]);

  useEffect(() => {
    if (ready) studyStorage.setItem("gre-last-quick-type-v1", quickType);
  }, [quickType, ready]);

  useEffect(() => {
    if (ready) studyStorage.setItem(QUICK_EQUIVALENT_SETS_KEY, JSON.stringify(quickEquivalentSets));
  }, [quickEquivalentSets, ready]);

  useEffect(() => {
    if (ready) studyStorage.setItem(A_PLUS_LISTS_KEY, JSON.stringify(aPlusLists));
  }, [aPlusLists, ready]);

  useEffect(() => {
    if (ready) studyStorage.setItem(GLEE_LISTS_KEY, JSON.stringify(gleeLists));
  }, [gleeLists, ready]);

  useEffect(() => {
    if (ready) studyStorage.setItem(MATH_CATEGORIES_KEY, JSON.stringify(mathCategories));
  }, [mathCategories, ready]);

  const availableLists = useMemo(() => {
    const counts = new Map<number, number>();
    words.forEach((word) => {
      if (word.list) counts.set(word.list, (counts.get(word.list) ?? 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => a[0] - b[0]);
  }, [words]);

  const todayLists = useMemo(() => listsForDay(currentPlanDay), [currentPlanDay]);
  const todaySets = useMemo(() => setsForDay(currentPlanDay), [currentPlanDay]);

  const dueWords = useMemo(() => {
    const scopedWords = studyList === "all"
      ? words
      : studyList === "plan"
        ? words.filter((word) => listScheduledDay(word.list) <= currentPlanDay)
        : words.filter((word) => word.list === Number(studyList));
    const usableScope = scopedWords.length ? scopedWords : words;
    const due = usableScope.filter((word) => {
      const progress = store.progress[word.id];
      return isDueOnPlanDay(progress, currentPlanDay, now)
        || (studyList === "plan" && currentPlanDay === 14 && (progress?.level ?? 0) < 3);
    });
    return due.length
      ? [...due].sort((a, b) => quickRatingRank(quickRatings[a.id]) - quickRatingRank(quickRatings[b.id]))
      : [...usableScope].sort((a, b) => (store.progress[a.id]?.dueDay ?? 99) - (store.progress[b.id]?.dueDay ?? 99));
  }, [currentPlanDay, now, quickRatings, store, studyList, words]);

  const wordRetryIds = new Set(wordRetries.map((item) => item.id));
  const mainDueWords = dueWords.filter((word) => !wordRetryIds.has(word.id));
  const readyWordRetry = wordRetries.find((item) => item.after <= 0)
    ?? (!mainDueWords.length ? [...wordRetries].sort((a, b) => a.after - b.after)[0] : undefined);
  const current = words.find((word) => word.id === readyWordRetry?.id)
    ?? mainDueWords[0]
    ?? dueWords[0]
    ?? words[0];
  const currentWordStage: "choice" | "recall" = readyWordRetry?.stage ?? "choice";
  const options = useMemo(() => seededOptions(words, current), [words, current]);

  const quickWords = useMemo(() => {
    const selected = words.filter((word) => quickWordLists.includes(word.list ?? 0));
    return shuffled(selected, quickShuffle.words);
  }, [quickShuffle.words, quickWordLists, words]);
  const filteredQuickWords = quickWords.filter((word) => {
    const ratingAtFilterTime = quickRatingSnapshot[word.id];
    const matchesRating = !quickRatingFilters.length
      || quickRatingFilters.some((filter) => filter === "unrated" ? !ratingAtFilterTime : ratingAtFilterTime === filter);
    const keyword = quickQuery.trim().toLowerCase();
    return matchesRating && (!keyword
      || word.word.toLowerCase().includes(keyword)
      || word.meaning.includes(quickQuery.trim()));
  });
  const quickRatingCounts = quickWords.reduce(
    (counts, word) => {
      const rating = quickRatings[word.id] ?? "unrated";
      counts[rating] += 1;
      return counts;
    },
    { unknown: 0, fuzzy: 0, familiar: 0, unrated: 0 } as Record<QuickRating | "unrated", number>,
  );
  const quickActiveWord = filteredQuickWords.find((word) => word.id === quickActiveId)
    ?? filteredQuickWords[0];
  const quickActiveWordId = quickActiveWord?.id;

  useEffect(() => {
    if (view !== "quick" || !quickActiveWordId || !quickShouldScroll.current) return;
    quickShouldScroll.current = false;
    quickRowRefs.current[quickActiveWordId]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [quickActiveWordId, view]);

  useEffect(() => {
    if (view !== "quick" || quickType !== "words" || !quickActiveWord) {
      quickWordAutoSpokenId.current = "";
      return;
    }
    if (quickWordAutoSpokenId.current === quickActiveWord.id) return;
    quickWordAutoSpokenId.current = quickActiveWord.id;
    pronounce(quickActiveWord.word);
  }, [quickActiveWord, quickType, view]);

  const dueEquivalentPairs = useMemo(() => {
    const scopedPairs = equivalentSet === "all"
      ? EQUIVALENTS
      : equivalentSet === "plan"
        ? EQUIVALENTS.filter((pair) => setScheduledDay(pair.set) <= currentPlanDay)
        : EQUIVALENTS.filter((pair) => pair.set === Number(equivalentSet));
    const usableScope = scopedPairs.length ? scopedPairs : EQUIVALENTS;
    const due = usableScope.filter((pair) => {
      const progress = equivalentStore.progress[pair.id];
      return isDueOnPlanDay(progress, currentPlanDay, now)
        || (equivalentSet === "plan" && currentPlanDay === 14 && (progress?.level ?? 0) < 3);
    });
    return due.length
      ? due
      : [...usableScope].sort((a, b) => (equivalentStore.progress[a.id]?.dueDay ?? 99) - (equivalentStore.progress[b.id]?.dueDay ?? 99));
  }, [currentPlanDay, equivalentSet, equivalentStore, now]);
  const equivalentRetryIds = new Set(equivalentRetries.map((item) => item.id));
  const mainDueEquivalentPairs = dueEquivalentPairs.filter((pair) => !equivalentRetryIds.has(pair.id));
  const readyEquivalentRetry = equivalentRetries.find((item) => item.after <= 0)
    ?? (!mainDueEquivalentPairs.length ? [...equivalentRetries].sort((a, b) => a.after - b.after)[0] : undefined);
  const currentPair = EQUIVALENTS.find((pair) => pair.id === readyEquivalentRetry?.id)
    ?? mainDueEquivalentPairs[0]
    ?? dueEquivalentPairs[0]
    ?? EQUIVALENTS[0];
  const equivalentOptions = useMemo(
    () => equivalentQuestion(EQUIVALENTS, currentPair),
    [currentPair],
  );
  const quickEquivalentPairs = useMemo(() => {
    const selected = EQUIVALENTS.filter((pair) => quickEquivalentSets.includes(pair.set));
    return shuffled(selected, quickShuffle.equivalents);
  }, [quickEquivalentSets, quickShuffle.equivalents]);
  const filteredQuickEquivalentPairs = quickEquivalentPairs.filter((pair) => {
    const direction = quickEquivalentDirection(pair, quickEquivalentCueMode);
    const ratingAtFilterTime = quickEquivalentRatingFor(quickEquivalentRatingSnapshot, pair.id, direction);
    const matchesRating = !quickEquivalentRatingFilters.length
      || quickEquivalentRatingFilters.some((filter) => filter === "unrated" ? !ratingAtFilterTime : ratingAtFilterTime === filter);
    const keyword = quickEquivalentQuery.trim().toLowerCase();
    return matchesRating && (!keyword
      || pair.left.toLowerCase().includes(keyword)
      || pair.right.toLowerCase().includes(keyword)
      || pair.meaning.includes(quickEquivalentQuery.trim()));
  });
  const quickEquivalentRatingCounts = quickEquivalentPairs.reduce(
    (counts, pair) => {
      const direction = quickEquivalentDirection(pair, quickEquivalentCueMode);
      const rating = quickEquivalentRatingFor(quickEquivalentRatings, pair.id, direction) ?? "unrated";
      counts[rating] += 1;
      return counts;
    },
    { unknown: 0, fuzzy: 0, familiar: 0, unrated: 0 } as Record<QuickRating | "unrated", number>,
  );
  const quickEquivalentActivePair = filteredQuickEquivalentPairs.find((pair) => pair.id === quickEquivalentActiveId)
    ?? filteredQuickEquivalentPairs[0];
  const quickEquivalentActivePairId = quickEquivalentActivePair?.id;
  const quickEquivalentActiveDirection = quickEquivalentActivePair
    ? quickEquivalentDirection(quickEquivalentActivePair, quickEquivalentCueMode)
    : null;
  const quickEquivalentActivePrompt = quickEquivalentActivePair && quickEquivalentActiveDirection
    ? quickEquivalentActiveDirection === "left"
      ? quickEquivalentActivePair.left
      : quickEquivalentActiveDirection === "right"
        ? quickEquivalentActivePair.right
        : quickEquivalentActivePair.meaning
    : null;
  const quickEquivalentActiveRevealStage = quickEquivalentActivePairId
    ? quickEquivalentRevealStages[quickEquivalentActivePairId] ?? 0
    : 0;

  useEffect(() => {
    if (view !== "quick" || quickType !== "equivalents" || !quickEquivalentActivePairId || !quickEquivalentShouldScroll.current) return;
    quickEquivalentShouldScroll.current = false;
    quickEquivalentRowRefs.current[quickEquivalentActivePairId]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [quickEquivalentActivePairId, quickType, view]);

  useEffect(() => {
    if (view !== "quick" || quickType !== "equivalents" || !quickEquivalentActivePair || !quickEquivalentActiveDirection) {
      quickEquivalentAutoSpokenKey.current = "";
      return;
    }
    const speechKey = `${quickEquivalentActivePair.id}:${quickEquivalentActiveDirection}`;
    if (quickEquivalentAutoSpokenKey.current === speechKey) return;
    quickEquivalentAutoSpokenKey.current = speechKey;
    if (quickEquivalentActiveDirection === "left") pronounce(quickEquivalentActivePair.left);
    else if (quickEquivalentActiveDirection === "right") pronounce(quickEquivalentActivePair.right);
  }, [quickEquivalentActiveDirection, quickEquivalentActivePair, quickType, view]);

  const aPlusEntries = useMemo(() => shuffled(
    A_PLUS_EQUIVALENTS.filter((entry) => aPlusLists.includes(entry.list)),
    quickShuffle["a-plus"],
  ), [aPlusLists, quickShuffle]);
  const filteredAPlusEntries = aPlusEntries.filter((entry) => {
    const direction = aPlusDirection(entry, aPlusCueMode);
    const ratingAtFilterTime = aPlusRatingFor(aPlusRatingSnapshot, entry.id, direction);
    const matchesRating = !aPlusRatingFilters.length
      || aPlusRatingFilters.some((filter) => filter === "unrated" ? !ratingAtFilterTime : ratingAtFilterTime === filter);
    const keyword = aPlusQuery.trim().toLowerCase();
    return matchesRating && (!keyword
      || entry.word.toLowerCase().includes(keyword)
      || entry.equivalents.some((word) => word.toLowerCase().includes(keyword))
      || entry.meaning.includes(aPlusQuery.trim()));
  });
  const aPlusRatingCounts = aPlusEntries.reduce(
    (counts, entry) => {
      const direction = aPlusDirection(entry, aPlusCueMode);
      const rating = aPlusRatingFor(aPlusRatings, entry.id, direction) ?? "unrated";
      counts[rating] += 1;
      return counts;
    },
    { unknown: 0, fuzzy: 0, familiar: 0, unrated: 0 } as Record<QuickRating | "unrated", number>,
  );
  const aPlusActiveEntry = filteredAPlusEntries.find((entry) => entry.id === aPlusActiveId)
    ?? filteredAPlusEntries[0];
  const aPlusActiveDirection = aPlusActiveEntry ? aPlusDirection(aPlusActiveEntry, aPlusCueMode) : null;
  const aPlusActiveStage = aPlusActiveEntry ? aPlusRevealStages[aPlusActiveEntry.id] ?? 0 : 0;
  const aPlusActivePrompt = aPlusActiveEntry && aPlusActiveDirection
    ? aPlusActiveDirection === "word"
      ? aPlusActiveEntry.word
      : aPlusActiveDirection === "equivalents"
        ? aPlusActiveEntry.equivalents.join(" / ")
        : aPlusActiveEntry.meaning
    : null;

  useEffect(() => {
    if (view !== "quick" || quickType !== "a-plus" || !aPlusActiveEntry || !aPlusShouldScroll.current) return;
    aPlusShouldScroll.current = false;
    aPlusRowRefs.current[aPlusActiveEntry.id]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [aPlusActiveEntry, quickType, view]);

  useEffect(() => {
    if (view !== "quick" || quickType !== "a-plus" || !aPlusActiveEntry || !aPlusActiveDirection) {
      aPlusAutoSpokenKey.current = "";
      return;
    }
    const speechKey = `${aPlusActiveEntry.id}:${aPlusActiveDirection}`;
    if (aPlusAutoSpokenKey.current === speechKey) return;
    aPlusAutoSpokenKey.current = speechKey;
    if (aPlusActiveDirection === "word") pronounce(aPlusActiveEntry.word);
    else if (aPlusActiveDirection === "equivalents") pronounceMany(aPlusActiveEntry.equivalents);
  }, [aPlusActiveDirection, aPlusActiveEntry, quickType, view]);

  const gleeWords = useMemo(() => shuffled(
    GLEE_WORDS.filter((word) => gleeLists.includes(word.list)),
    quickShuffle.glee,
  ), [gleeLists, quickShuffle.glee]);
  const filteredGleeWords = gleeWords.filter((word) => {
    const ratingAtFilterTime = gleeRatingSnapshot[word.id];
    const matchesRating = !gleeRatingFilters.length
      || gleeRatingFilters.some((filter) => filter === "unrated" ? !ratingAtFilterTime : ratingAtFilterTime === filter);
    const keyword = gleeQuery.trim().toLowerCase();
    return matchesRating && (!keyword
      || word.word.toLowerCase().includes(keyword)
      || word.meaning.includes(gleeQuery.trim())
      || word.english.toLowerCase().includes(keyword)
      || [word.notebookCoreMeaning, word.memoryAnchor, word.morphology, word.synonymGroup, word.contrast, word.usage, word.greSense]
        .some((value) => value?.toLowerCase().includes(keyword)));
  });
  const gleeRatingCounts = gleeWords.reduce(
    (counts, word) => {
      const rating = gleeRatings[word.id] ?? "unrated";
      counts[rating] += 1;
      return counts;
    },
    { unknown: 0, fuzzy: 0, familiar: 0, unrated: 0 } as Record<QuickRating | "unrated", number>,
  );
  const gleeActiveWord = filteredGleeWords.find((word) => word.id === gleeActiveId) ?? filteredGleeWords[0];

  useEffect(() => {
    if (view !== "quick" || quickType !== "glee" || !gleeActiveWord || !gleeShouldScroll.current) return;
    gleeShouldScroll.current = false;
    gleeRowRefs.current[gleeActiveWord.id]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [gleeActiveWord, quickType, view]);

  useEffect(() => {
    if (view !== "quick" || quickType !== "glee" || !gleeActiveWord) {
      gleeAutoSpokenId.current = "";
      return;
    }
    if (gleeAutoSpokenId.current === gleeActiveWord.id) return;
    gleeAutoSpokenId.current = gleeActiveWord.id;
    pronounce(gleeActiveWord.word);
  }, [gleeActiveWord, quickType, view]);

  const mathWords = useMemo(() => shuffled(
    MATH_WORDS.filter((word) => mathCategories.includes(word.category)),
    quickShuffle.math,
  ), [mathCategories, quickShuffle.math]);
  const filteredMathWords = mathWords.filter((word) => {
    const ratingAtFilterTime = mathRatingSnapshot[word.id];
    const matchesRating = !mathRatingFilters.length
      || mathRatingFilters.some((filter) => filter === "unrated" ? !ratingAtFilterTime : ratingAtFilterTime === filter);
    const keyword = mathQuery.trim().toLowerCase();
    return matchesRating && (!keyword
      || word.term.toLowerCase().includes(keyword)
      || word.meaning.includes(mathQuery.trim())
      || word.category.includes(mathQuery.trim()));
  });
  const mathRatingCounts = mathWords.reduce(
    (counts, word) => {
      const rating = mathRatings[word.id] ?? "unrated";
      counts[rating] += 1;
      return counts;
    },
    { unknown: 0, fuzzy: 0, familiar: 0, unrated: 0 } as Record<QuickRating | "unrated", number>,
  );
  const mathActiveWord = filteredMathWords.find((word) => word.id === mathActiveId) ?? filteredMathWords[0];

  useEffect(() => {
    if (view !== "quick" || quickType !== "math" || !mathActiveWord || !mathShouldScroll.current) return;
    mathShouldScroll.current = false;
    mathRowRefs.current[mathActiveWord.id]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [mathActiveWord, quickType, view]);

  useEffect(() => {
    if (view !== "quick" || quickType !== "math" || !mathActiveWord) {
      mathAutoSpokenId.current = "";
      return;
    }
    if (mathAutoSpokenId.current === mathActiveWord.id) return;
    mathAutoSpokenId.current = mathActiveWord.id;
    pronounce(mathActiveWord.term);
  }, [mathActiveWord, quickType, view]);

  useEffect(() => {
    if (!ready || view !== "study" || !autoSpeak || !current?.word) return;
    const timer = window.setTimeout(() => pronounce(current.word), 120);
    return () => window.clearTimeout(timer);
  }, [autoSpeak, current, ready, view]);

  useEffect(() => {
    if (!ready || view !== "equivalents" || equivalentMode !== "learn" || !autoSpeak || !currentPair) return;
    const timer = window.setTimeout(() => pronounceMany([currentPair.left, currentPair.right]), 120);
    return () => window.clearTimeout(timer);
  }, [autoSpeak, currentPair, equivalentMode, ready, view]);

  const todayLogs = store.logs.filter((log) => now - log.at < DAY);
  const todayEquivalentLogs = equivalentStore.logs.filter((log) => now - log.at < DAY);
  const mastered = words.filter((word) => (store.progress[word.id]?.level ?? 0) >= 3).length;
  const equivalentMastered = EQUIVALENTS.filter((pair) => (equivalentStore.progress[pair.id]?.level ?? 0) >= 3).length;
  const totalTodayLogs = todayLogs.length + todayEquivalentLogs.length;
  const correctTodayLogs = todayLogs.filter((log) => log.result === "correct").length
    + todayEquivalentLogs.filter((log) => log.result === "correct").length;
  const accuracy = totalTodayLogs
    ? Math.round((correctTodayLogs / totalTodayLogs) * 100)
    : 0;
  const dueWordCount = words.filter((word) => listScheduledDay(word.list) <= currentPlanDay
    && (isDueOnPlanDay(store.progress[word.id], currentPlanDay, now)
      || (currentPlanDay === 14 && (store.progress[word.id]?.level ?? 0) < 3))).length;
  const dueEquivalentCount = EQUIVALENTS.filter((pair) => setScheduledDay(pair.set) <= currentPlanDay
    && (isDueOnPlanDay(equivalentStore.progress[pair.id], currentPlanDay, now)
      || (currentPlanDay === 14 && (equivalentStore.progress[pair.id]?.level ?? 0) < 3))).length;

  function grade(result: "correct" | "fuzzy" | "wrong") {
    const previous = store.progress[current.id] ?? {
      level: 0,
      dueAt: 0,
      correct: 0,
      wrong: 0,
      fuzzy: 0,
      lastSeen: 0,
    };
    const activeRetry = wordRetries.find(
      (item) => item.id === current.id && item.stage === currentWordStage,
    );
    const stagePassed = result === "correct" && (!activeRetry || activeRetry.passes <= 1);
    const choicePassed = currentWordStage === "choice" && stagePassed;
    const wordCompleted = currentWordStage === "recall" && stagePassed;
    const firstSeenDay = previous.firstSeenDay ?? currentPlanDay;
    const isNewCorrectDay = wordCompleted && previous.lastCorrectDay !== currentPlanDay;
    const firstLapseToday = result === "wrong" && previous.lastLapseDay !== currentPlanDay;
    const level = wordCompleted
      ? Math.min(REVIEW_DAY_OFFSETS.length - 1, previous.level + (isNewCorrectDay ? 1 : 0))
      : firstLapseToday
        ? Math.max(0, previous.level - 1)
        : previous.level;
    const dueDay = wordCompleted
      ? Math.max(currentPlanDay + 1, firstSeenDay + REVIEW_DAY_OFFSETS[level])
      : currentPlanDay;
    const dueAt = wordCompleted
      ? Date.now() + Math.max(1, dueDay - currentPlanDay) * DAY
      : Date.now();
    setStore((value) => ({
      progress: {
        ...value.progress,
        [current.id]: {
          ...previous,
          level,
          dueAt,
          dueDay,
          firstSeenDay,
          lastCorrectDay: wordCompleted ? currentPlanDay : previous.lastCorrectDay,
          lastLapseDay: result === "wrong" ? currentPlanDay : previous.lastLapseDay,
          correct: previous.correct + (result === "correct" ? 1 : 0),
          fuzzy: previous.fuzzy + (result === "fuzzy" ? 1 : 0),
          wrong: previous.wrong + (result === "wrong" ? 1 : 0),
          lastSeen: Date.now(),
        },
      },
      logs: [...value.logs, { at: Date.now(), wordId: current.id, result, mode: currentWordStage }].slice(-3000),
    }));
    if (result === "wrong") rateQuickWord(current.id, "unknown");
    else if (result === "fuzzy") rateQuickWord(current.id, "fuzzy");
    else if (wordCompleted) rateQuickWord(current.id, "familiar");
    setWordRetries((value) => {
      const next = updateSessionRetries(value, current.id, result, currentWordStage);
      if (!choicePassed) return next;
      return [
        ...next.filter((item) => item.id !== current.id || item.stage !== "recall"),
        { id: current.id, after: 5, passes: 1, reason: "bridge", stage: "recall" },
      ];
    });
    setSelected(null);
    setRevealed(false);
    setIndex((value) => value + 1);
  }

  function choose(option: Word) {
    if (selected) return;
    setSelected(option.id);
    setRevealed(true);
  }

  function resetEquivalentQuestion() {
    setEquivalentStage("pair");
    setEquivalentSelected([]);
    setPairCorrect(false);
    setMeaningSelected(null);
  }

  function gradeEquivalent(result: "correct" | "wrong") {
    const previous = equivalentStore.progress[currentPair.id] ?? {
      level: 0,
      dueAt: 0,
      correct: 0,
      wrong: 0,
      fuzzy: 0,
      lastSeen: 0,
    };
    const firstSeenDay = previous.firstSeenDay ?? currentPlanDay;
    const isNewCorrectDay = previous.lastCorrectDay !== currentPlanDay;
    const level = result === "correct"
      ? Math.min(REVIEW_DAY_OFFSETS.length - 1, previous.level + (isNewCorrectDay ? 1 : 0))
      : Math.max(0, previous.level - 1);
    const dueDay = result === "correct"
      ? Math.max(currentPlanDay + 1, firstSeenDay + REVIEW_DAY_OFFSETS[level])
      : currentPlanDay;
    const dueAt = result === "correct"
      ? Date.now() + Math.max(1, dueDay - currentPlanDay) * DAY
      : Date.now();
    setEquivalentStore((value) => ({
      progress: {
        ...value.progress,
        [currentPair.id]: {
          ...previous,
          level,
          dueAt,
          dueDay,
          firstSeenDay,
          lastCorrectDay: result === "correct" ? currentPlanDay : previous.lastCorrectDay,
          correct: previous.correct + (result === "correct" ? 1 : 0),
          wrong: previous.wrong + (result === "wrong" ? 1 : 0),
          lastSeen: Date.now(),
        },
      },
      logs: [...value.logs, {
        at: Date.now(),
        pairId: currentPair.id,
        result,
        mode: equivalentMode,
      }].slice(-3000),
    }));
    recordLearningPlanRatings("equivalents",{[currentPair.id]:result==="correct"?"familiar":"unknown"});
    setQuickEquivalentRatings((value) => ({
      ...value,
      [currentPair.id]: result === "correct" ? "familiar" : "unknown",
    }));
    setEquivalentRetries((value) => updateSessionRetries(value, currentPair.id, result));
    resetEquivalentQuestion();
    setEquivalentIndex((value) => value + 1);
  }

  function toggleEquivalentWord(word: string) {
    if (equivalentStage !== "pair") return;
    setEquivalentSelected((value) => value.includes(word)
      ? value.filter((item) => item !== word)
      : value.length < 2 ? [...value, word] : value);
  }

  function confirmEquivalentPair() {
    if (equivalentSelected.length !== 2) return;
    const correct = equivalentSelected.includes(currentPair.left) && equivalentSelected.includes(currentPair.right);
    setPairCorrect(correct);
    setEquivalentStage("meaning");
    if (autoSpeak) pronounceMany([currentPair.left, currentPair.right]);
  }

  function finishEquivalentTest() {
    if (!meaningSelected) return;
    setEquivalentStage("result");
  }

  function changeEquivalentSet(value: string) {
    setEquivalentSet(value);
    setEquivalentIndex(0);
    setEquivalentRetries([]);
    setQuickEquivalentRatingSnapshot({ ...quickEquivalentRatings });
    setQuickEquivalentRevealStages({});
    setQuickEquivalentMemoryOpen([]);
    setQuickEquivalentActiveId(null);
    quickEquivalentShouldScroll.current = false;
    resetEquivalentQuestion();
  }

  function changeQuickEquivalentSets(values: number[]) {
    setQuickEquivalentSets(values);
    setQuickEquivalentRatingSnapshot({ ...quickEquivalentRatings });
    setQuickEquivalentRevealStages({});
    setQuickEquivalentMemoryOpen([]);
    setQuickEquivalentActiveId(null);
    quickEquivalentShouldScroll.current = false;
  }

  async function importFile(file?: File) {
    if (!file) return;
    try {
      const text = await file.text();
      const imported = file.name.endsWith(".json") ? JSON.parse(text) : parseVocabulary(text);
      if (!Array.isArray(imported) || imported.length < 4) throw new Error("词条过少");
      const normalized: Word[] = imported.map((item, i) => ({
        id: item.id || `${item.word.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${i}`,
        word: item.word,
        meaning: item.meaning,
      phonetic: item.phonetic || "",
      pos: item.pos || "",
      note: item.note || "",
      list: Number(item.list) || undefined,
      page: Number(item.page) || undefined,
      }));
      setWords(normalized);
      studyStorage.setItem(`${STORAGE_KEY}-words`, JSON.stringify(normalized));
      setIndex(0);
      setImportMessage(`已导入 ${normalized.length} 个词`);
    } catch {
      setImportMessage("导入失败：请使用 CSV、TSV 或 JSON，至少包含 word 和 meaning 两列");
    }
  }

  function exportBackup() {
    const payload = JSON.stringify({
      words,
      wordProgress: store,
      equivalentProgress: equivalentStore,
      quickRatings,
      quickEquivalentRatings,
      aPlusQuickRatings: aPlusRatings,
      glee1500QuickRatings: gleeRatings,
      mathVocabularyQuickRatings: mathRatings,
      lcljQuickRatings: lcljRatings,
      planDay: currentPlanDay,
      exportedAt: new Date().toISOString(),
    }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "GRE全能词-学习记录.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function speak() {
    pronounce(current.word);
  }

  function changeStudyList(value: string) {
    setStudyList(value);
    setIndex(0);
    setWordRetries([]);
    setQuickRatingSnapshot({ ...quickRatings });
    setQuickRevealed([]);
    setQuickActiveId(null);
    quickShouldScroll.current = false;
    setSelected(null);
    setRevealed(false);
  }

  function resetQuickActive(type: QuickType) {
    if (type === "words") {
      setQuickActiveId(null);
      quickShouldScroll.current = false;
    } else if (type === "equivalents") {
      setQuickEquivalentActiveId(null);
      quickEquivalentShouldScroll.current = false;
    } else if (type === "a-plus") {
      setAPlusActiveId(null);
      aPlusShouldScroll.current = false;
    } else if (type === "glee") {
      setGleeActiveId(null);
      gleeShouldScroll.current = false;
    } else if (type === "math") {
      setMathActiveId(null);
      mathShouldScroll.current = false;
    }
  }

  function newShuffleSeed() {
    return (Date.now() % 1_000_003) + Math.floor(Math.random() * 1_000_003);
  }

  function toggleQuickShuffle(type: QuickType) {
    setQuickShuffle((current) => ({
      ...current,
      [type]: current[type].enabled
        ? { enabled: false, seed: 0 }
        : { enabled: true, seed: newShuffleSeed() },
    }));
    resetQuickActive(type);
  }

  function reshuffleQuickType(type: QuickType) {
    setQuickShuffle((current) => ({
      ...current,
      [type]: { enabled: true, seed: newShuffleSeed() },
    }));
    resetQuickActive(type);
  }

  function changeQuickWordLists(values: number[]) {
    setQuickWordLists(values);
    setQuickRatingSnapshot({ ...quickRatings });
    setQuickRevealed([]);
    setQuickActiveId(null);
    quickShouldScroll.current = false;
  }

  function startTodayWords() {
    changeStudyList("plan");
    setView("study");
  }

  function startTodayEquivalents() {
    changeEquivalentSet("plan");
    setEquivalentMode("learn");
    setView("equivalents");
  }

  function changePlanDay(day: number) {
    const nextDay = Math.min(14, Math.max(1, day));
    setCurrentPlanDay(nextDay);
    setIndex(0);
    setSelected(null);
    setRevealed(false);
    setEquivalentIndex(0);
    setWordRetries([]);
    setEquivalentRetries([]);
    setQuickRevealed([]);
    setQuickRatingSnapshot({ ...quickRatings });
    setQuickActiveId(null);
    quickShouldScroll.current = false;
    setQuickEquivalentRevealStages({});
    setQuickEquivalentMemoryOpen([]);
    setQuickEquivalentRatingSnapshot({ ...quickEquivalentRatings });
    setQuickEquivalentActiveId(null);
    quickEquivalentShouldScroll.current = false;
    resetEquivalentQuestion();
  }

  function toggleQuickMeaning(wordId: string) {
    setQuickRevealed((value) => value.includes(wordId)
      ? value.filter((id) => id !== wordId)
      : [...value, wordId]);
  }

  function rateQuickWord(wordId: string, rating: QuickRating) {
    recordLearningPlanRatings("words",{[wordId]:rating});
    setQuickRatings((value) => ({ ...value, [wordId]: rating }));
  }

  function moveQuickWord(offset: -1 | 1) {
    if (!filteredQuickWords.length) return;
    const currentPosition = Math.max(0, filteredQuickWords.findIndex((word) => word.id === quickActiveWord?.id));
    const nextPosition = Math.min(filteredQuickWords.length - 1, Math.max(0, currentPosition + offset));
    quickShouldScroll.current = nextPosition !== currentPosition;
    const nextWord = filteredQuickWords[nextPosition];
    setQuickActiveId(nextWord.id);
  }

  function rateQuickWordInPlace(wordId: string, rating: QuickRating) {
    rateQuickWord(wordId, rating);
    setQuickRevealed((value) => value.includes(wordId) ? value : [...value, wordId]);
    quickShouldScroll.current = false;
    setQuickActiveId(wordId);
  }

  function toggleQuickRatingFilter(filter: QuickRatingFilter) {
    setQuickRatingFilters((current) => current.includes(filter)
      ? current.length === 1 ? current : current.filter((item) => item !== filter)
      : [...current, filter]);
    setQuickRatingSnapshot({ ...quickRatings });
  }

  function clearQuickRatingFilters() {
    setQuickRatingFilters([]);
    setQuickRatingSnapshot({ ...quickRatings });
  }

  function setQuickEquivalentRevealStage(pairId: string, stage: number) {
    setQuickEquivalentRevealStages((value) => ({ ...value, [pairId]: stage }));
    setQuickEquivalentActiveId(pairId);
  }

  function toggleQuickEquivalentMemory(pairId: string) {
    setQuickEquivalentMemoryOpen((value) => value.includes(pairId)
      ? value.filter((id) => id !== pairId)
      : [...value, pairId]);
  }

  function cycleQuickEquivalentReveal(pair: EquivalentPair) {
    const stage = quickEquivalentRevealStages[pair.id] ?? 0;
    const direction = quickEquivalentDirection(pair, quickEquivalentCueMode);
    const nextStage = stage >= 2 ? 0 : stage + 1;
    setQuickEquivalentRevealStage(pair.id, nextStage);
    if (stage === 0 && nextStage === 1) {
      pronounce(direction === "left" ? pair.right : pair.left);
    } else if (direction === "meaning" && stage === 1 && nextStage === 2) {
      pronounce(pair.right);
    } else if (nextStage === 0 && direction !== "meaning") {
      pronounce(direction === "left" ? pair.left : pair.right);
    }
  }

  function rateQuickEquivalentInPlace(pairId: string, direction: EquivalentCueDirection, rating: QuickRating) {
    recordLearningPlanRatings("equivalents",{[quickEquivalentRatingKey(pairId,direction)]:rating});
    setQuickEquivalentRatings((value) => ({
      ...value,
      [quickEquivalentRatingKey(pairId, direction)]: rating,
    }));
    quickEquivalentShouldScroll.current = false;
    setQuickEquivalentActiveId(pairId);
  }

  function toggleQuickEquivalentRatingFilter(filter: QuickRatingFilter) {
    setQuickEquivalentRatingFilters((current) => current.includes(filter)
      ? current.length === 1 ? current : current.filter((item) => item !== filter)
      : [...current, filter]);
    setQuickEquivalentRatingSnapshot({ ...quickEquivalentRatings });
  }

  function clearQuickEquivalentRatingFilters() {
    setQuickEquivalentRatingFilters([]);
    setQuickEquivalentRatingSnapshot({ ...quickEquivalentRatings });
  }

  function changeQuickEquivalentCueMode(mode: EquivalentCueMode) {
    setQuickEquivalentCueMode(mode);
    setQuickEquivalentRatingSnapshot({ ...quickEquivalentRatings });
    setQuickEquivalentRevealStages({});
    setQuickEquivalentMemoryOpen([]);
    setQuickEquivalentActiveId(null);
    quickEquivalentShouldScroll.current = false;
  }

  function moveQuickEquivalent(offset: -1 | 1) {
    if (!filteredQuickEquivalentPairs.length) return;
    const currentPosition = Math.max(0, filteredQuickEquivalentPairs.findIndex((pair) => pair.id === quickEquivalentActivePair?.id));
    const nextPosition = Math.min(filteredQuickEquivalentPairs.length - 1, Math.max(0, currentPosition + offset));
    const nextPair = filteredQuickEquivalentPairs[nextPosition];
    quickEquivalentShouldScroll.current = nextPosition !== currentPosition;
    setQuickEquivalentActiveId(nextPair.id);
  }

  function setAPlusRevealStage(entryId: string, stage: number) {
    setAPlusRevealStages((value) => ({ ...value, [entryId]: stage }));
    setAPlusActiveId(entryId);
  }

  function cycleAPlusReveal(entry: APlusEquivalentEntry) {
    setAPlusMeaningOverrides(current=>{const next={...current};delete next[entry.id];return next;});
    const stage = aPlusRevealStages[entry.id] ?? 0;
    const direction = aPlusDirection(entry, aPlusCueMode);
    const nextStage = stage >= 2 ? 0 : stage + 1;
    setAPlusRevealStage(entry.id, nextStage);
    if (nextStage === 0) {
      if (direction === "word") pronounce(entry.word);
      else if (direction === "equivalents") pronounceMany(entry.equivalents);
    } else if (stage === 0) {
      if (direction === "word") pronounceMany(entry.equivalents);
      else pronounce(entry.word);
    } else if (direction === "meaning") {
      pronounceMany(entry.equivalents);
    }
  }

  function rateAPlusInPlace(entryId: string, direction: APlusCueDirection, rating: QuickRating) {
    recordLearningPlanRatings("a-plus",{[aPlusRatingKey(entryId,direction)]:rating});
    setAPlusRatings((value) => ({ ...value, [aPlusRatingKey(entryId, direction)]: rating }));
    aPlusShouldScroll.current = false;
    setAPlusActiveId(entryId);
  }

  function toggleAPlusRatingFilter(filter: QuickRatingFilter) {
    setAPlusRatingFilters((current) => current.includes(filter)
      ? current.length === 1 ? current : current.filter((item) => item !== filter)
      : [...current, filter]);
    setAPlusRatingSnapshot({ ...aPlusRatings });
  }

  function clearAPlusRatingFilters() {
    setAPlusRatingFilters([]);
    setAPlusRatingSnapshot({ ...aPlusRatings });
  }

  function changeAPlusCueMode(mode: APlusCueMode) {
    setAPlusCueMode(mode);
    setAPlusRatingSnapshot({ ...aPlusRatings });
    setAPlusRevealStages({});
    setAPlusActiveId(null);
    aPlusShouldScroll.current = false;
  }

  function changeAPlusLists(values: number[]) {
    setAPlusLists(values);
    setAPlusRatingSnapshot({ ...aPlusRatings });
    setAPlusRevealStages({});
    setAPlusActiveId(null);
    aPlusShouldScroll.current = false;
  }

  function moveAPlusEntry(offset: -1 | 1) {
    if (!filteredAPlusEntries.length) return;
    const currentPosition = Math.max(0, filteredAPlusEntries.findIndex((entry) => entry.id === aPlusActiveEntry?.id));
    const nextPosition = Math.min(filteredAPlusEntries.length - 1, Math.max(0, currentPosition + offset));
    const nextEntry = filteredAPlusEntries[nextPosition];
    aPlusShouldScroll.current = nextPosition !== currentPosition;
    setAPlusActiveId(nextEntry.id);
  }

  function setGleeRevealStage(wordId: string, stage: number) {
    setGleeRevealStages((value) => ({ ...value, [wordId]: stage }));
    setGleeActiveId(wordId);
  }

  function toggleGleeMemory(wordId: string) {
    setGleeMemoryOpen((value) => value.includes(wordId)
      ? value.filter((id) => id !== wordId)
      : [...value, wordId]);
  }

  function cycleGleeReveal(word: GleeWord) {
    const stage = gleeRevealStages[word.id] ?? 0;
    const nextStage = stage >= 2 ? 0 : stage + 1;
    setGleeRevealStage(word.id, nextStage);
    if (nextStage === 0) pronounce(word.word);
  }

  function rateGleeInPlace(wordId: string, rating: QuickRating) {
    recordLearningPlanRatings("glee",{[wordId]:rating});
    setGleeRatings((value) => ({ ...value, [wordId]: rating }));
    setGleeRevealStage(wordId, 2);
    gleeShouldScroll.current = false;
  }

  function toggleGleeRatingFilter(filter: QuickRatingFilter) {
    setGleeRatingFilters((current) => current.includes(filter)
      ? current.length === 1 ? current : current.filter((item) => item !== filter)
      : [...current, filter]);
    setGleeRatingSnapshot({ ...gleeRatings });
  }

  function clearGleeRatingFilters() {
    setGleeRatingFilters([]);
    setGleeRatingSnapshot({ ...gleeRatings });
  }

  function changeGleeLists(values: number[]) {
    setGleeLists(values);
    setGleeRatingSnapshot({ ...gleeRatings });
    setGleeRevealStages({});
    setGleeMemoryOpen([]);
    setGleeActiveId(null);
    gleeShouldScroll.current = false;
  }

  function moveGleeWord(offset: -1 | 1) {
    if (!filteredGleeWords.length) return;
    const currentPosition = Math.max(0, filteredGleeWords.findIndex((word) => word.id === gleeActiveWord?.id));
    const nextPosition = Math.min(filteredGleeWords.length - 1, Math.max(0, currentPosition + offset));
    const nextWord = filteredGleeWords[nextPosition];
    gleeShouldScroll.current = nextPosition !== currentPosition;
    setGleeActiveId(nextWord.id);
  }

  function toggleMathMeaning(wordId: string) {
    setMathRevealed((value) => value.includes(wordId)
      ? value.filter((id) => id !== wordId)
      : [...value, wordId]);
    setMathActiveId(wordId);
  }

  function rateMathInPlace(wordId: string, rating: QuickRating) {
    recordLearningPlanRatings("math",{[wordId]:rating});
    setMathRatings((value) => ({ ...value, [wordId]: rating }));
    setMathRevealed((value) => value.includes(wordId) ? value : [...value, wordId]);
    mathShouldScroll.current = false;
    setMathActiveId(wordId);
  }

  function toggleMathRatingFilter(filter: QuickRatingFilter) {
    setMathRatingFilters((current) => current.includes(filter)
      ? current.length === 1 ? current : current.filter((item) => item !== filter)
      : [...current, filter]);
    setMathRatingSnapshot({ ...mathRatings });
  }

  function clearMathRatingFilters() {
    setMathRatingFilters([]);
    setMathRatingSnapshot({ ...mathRatings });
  }

  function changeMathCategories(values: string[]) {
    setMathCategories(values);
    setMathRatingSnapshot({ ...mathRatings });
    setMathRevealed([]);
    setMathActiveId(null);
    mathShouldScroll.current = false;
  }

  function moveMathWord(offset: -1 | 1) {
    if (!filteredMathWords.length) return;
    const currentPosition = Math.max(0, filteredMathWords.findIndex((word) => word.id === mathActiveWord?.id));
    const nextPosition = Math.min(filteredMathWords.length - 1, Math.max(0, currentPosition + offset));
    const nextWord = filteredMathWords[nextPosition];
    mathShouldScroll.current = nextPosition !== currentPosition;
    setMathActiveId(nextWord.id);
  }

  const filteredWords = words.filter(
    (word) =>
      (listFilter === "all" || word.list === Number(listFilter))
      && (word.word.toLowerCase().includes(query.toLowerCase()) || word.meaning.includes(query)),
  );

  useEffect(() => {
    function handleKeyboard(event: KeyboardEvent) {
      if (document.querySelector?.(".learningPlanOverlay, .onboardingOverlay")) return;
      const target = event.target as HTMLElement | null;
      const editing = target?.matches("input, textarea, select, [contenteditable='true']");
      if (editing || event.metaKey || event.ctrlKey || event.altKey) return;

      const isArrow = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key);
      if (event.repeat && !isArrow) return;

      if (view === "quick" && quickType === "math" && mathActiveWord) {
        if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
          event.preventDefault();
          moveMathWord(-1);
          return;
        }
        if (event.key === "ArrowDown" || event.key === "ArrowRight") {
          event.preventDefault();
          moveMathWord(1);
          return;
        }
        if (event.code === "Space") {
          event.preventDefault();
          pronounce(mathActiveWord.term);
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          toggleMathMeaning(mathActiveWord.id);
          return;
        }
        const rating = ({ "1": "unknown", "2": "fuzzy", "3": "familiar" } as Record<string, QuickRating>)[event.key];
        if (rating) {
          event.preventDefault();
          rateMathInPlace(mathActiveWord.id, rating);
        }
        return;
      }

      if (view === "quick" && quickType === "glee" && gleeActiveWord) {
        if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
          event.preventDefault();
          moveGleeWord(-1);
          return;
        }
        if (event.key === "ArrowDown" || event.key === "ArrowRight") {
          event.preventDefault();
          moveGleeWord(1);
          return;
        }
        if (event.code === "Space") {
          event.preventDefault();
          pronounce(gleeActiveWord.word);
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          cycleGleeReveal(gleeActiveWord);
          return;
        }
        const rating = ({ "1": "unknown", "2": "fuzzy", "3": "familiar" } as Record<string, QuickRating>)[event.key];
        if (rating) {
          event.preventDefault();
          rateGleeInPlace(gleeActiveWord.id, rating);
        }
        return;
      }

      if (view === "quick" && quickType === "a-plus" && aPlusMode === "scan" && aPlusActiveEntry && aPlusActiveDirection) {
        if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
          event.preventDefault();
          moveAPlusEntry(-1);
          return;
        }
        if (event.key === "ArrowDown" || event.key === "ArrowRight") {
          event.preventDefault();
          moveAPlusEntry(1);
          return;
        }
        if (event.code === "Space") {
          event.preventDefault();
          const visibleWords = revealedAPlusWords(aPlusActiveEntry, aPlusActiveDirection, aPlusActiveStage);
          if (visibleWords.length > 1) pronounceMany(visibleWords);
          else if (visibleWords.length === 1) pronounce(visibleWords[0]);
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          cycleAPlusReveal(aPlusActiveEntry);
          return;
        }
        const rating = ({ "1": "unknown", "2": "fuzzy", "3": "familiar" } as Record<string, QuickRating>)[event.key];
        if (rating) {
          event.preventDefault();
          rateAPlusInPlace(aPlusActiveEntry.id, aPlusActiveDirection, rating);
        }
        return;
      }

      if (view === "quick" && quickType === "equivalents" && quickEquivalentActivePair && quickEquivalentActiveDirection) {
        if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
          event.preventDefault();
          moveQuickEquivalent(-1);
          return;
        }
        if (event.key === "ArrowDown" || event.key === "ArrowRight") {
          event.preventDefault();
          moveQuickEquivalent(1);
          return;
        }
        if (event.code === "Space") {
          event.preventDefault();
          const visibleWords = revealedEquivalentWords(
            quickEquivalentActivePair,
            quickEquivalentActiveDirection,
            quickEquivalentActiveRevealStage,
          );
          if (visibleWords.length > 1) pronounceMany(visibleWords);
          else if (visibleWords.length === 1) pronounce(visibleWords[0]);
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          cycleQuickEquivalentReveal(quickEquivalentActivePair);
          return;
        }
        const equivalentQuickRatingByKey: Record<string, QuickRating> = {
          "1": "unknown",
          "2": "fuzzy",
          "3": "familiar",
        };
        const rating = equivalentQuickRatingByKey[event.key];
        if (rating) {
          event.preventDefault();
          rateQuickEquivalentInPlace(quickEquivalentActivePair.id, quickEquivalentActiveDirection, rating);
        }
        return;
      }

      if (view === "quick" && quickType === "words" && quickActiveWord) {
        if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
          event.preventDefault();
          moveQuickWord(-1);
          return;
        }
        if (event.key === "ArrowDown" || event.key === "ArrowRight") {
          event.preventDefault();
          moveQuickWord(1);
          return;
        }
        if (event.code === "Space") {
          event.preventDefault();
          pronounce(quickActiveWord.word);
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          toggleQuickMeaning(quickActiveWord.id);
          return;
        }
        const quickRatingByKey: Record<string, QuickRating> = {
          "1": "unknown",
          "2": "fuzzy",
          "3": "familiar",
        };
        const quickRating = quickRatingByKey[event.key];
        if (quickRating) {
          event.preventDefault();
          rateQuickWordInPlace(quickActiveWord.id, quickRating);
        }
        return;
      }

      if (view !== "study") return;
      if (event.code === "Space") {
        event.preventDefault();
        speak();
        return;
      }
      if (currentWordStage === "choice" && !revealed) {
        const optionIndex = ["a", "b", "c", "d"].indexOf(event.key.toLowerCase());
        if (optionIndex >= 0 && options[optionIndex]) {
          event.preventDefault();
          choose(options[optionIndex]);
        }
        return;
      }
      if (currentWordStage === "recall" && !revealed && event.key === "Enter") {
        event.preventDefault();
        setRevealed(true);
        return;
      }
      if (!revealed || !["1", "2", "3"].includes(event.key)) return;
      event.preventDefault();
      if (event.key === "1") grade("wrong");
      else if (event.key === "2") grade(currentWordStage === "choice" && selected !== current.id ? "wrong" : "fuzzy");
      else grade(currentWordStage === "choice" && selected !== current.id ? "wrong" : "correct");
    }

    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  });

  if (!ready) return <main className="loading">正在读取你的学习记录…</main>;

  return (
    <main className="shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView("quick")} aria-label="返回速刷">
          <span className="brandMark">笺</span>
          <span><strong>词笺 · Lemnota</strong><small>Worth noting.</small></span>
        </button>
        <span className="freeModeBadge">自由速刷</span>
      </header>

      {view === "home" && (
        <section className="home">
          <div className="hero">
            <div>
              <p className="eyebrow">TODAY · 主动回忆优先</p>
              <h1>不是“看过”，<br />而是<strong>一眼认出。</strong></h1>
              <p className="intro">每天一小组，先作答再看释义。答错的词会更快回来，答对的词会逐步拉开复习间隔。</p>
              <label className="heroListPicker">
                <span>当前学习范围</span>
                <select value={studyList} onChange={(event) => changeStudyList(event.target.value)}>
                  {availableLists.map(([list, count]) => (
                    <option value={list} key={list}>List {String(list).padStart(2, "0")} · {count} 词</option>
                  ))}
                  <option value="all">全部 List</option>
                </select>
              </label>
              <button className="primary" onClick={() => setView("study")}>
                开始今日训练 <span>→</span>
              </button>
              <p className="microcopy">建议 10–15 分钟 · 当前待复习 {dueWords.length} 词</p>
            </div>
            <div className="wordSculpture" aria-hidden="true">
              <span>abate</span><span>arcane</span><span>adroit</span><span>apathy</span>
              <i>meaning<br />before<br />memory</i>
            </div>
          </div>

          <section className="planPanel">
            <div className="planIntro">
              <div className="planDayControl">
                <button disabled={currentPlanDay === 1} onClick={() => changePlanDay(currentPlanDay - 1)} aria-label="切换到上一学习日">←</button>
                <label>
                  <span>当前学习日</span>
                  <select value={currentPlanDay} onChange={(event) => changePlanDay(Number(event.target.value))}>
                    {Array.from({ length: 14 }, (_, item) => item + 1).map((day) => (
                      <option value={day} key={day}>第 {day} 天</option>
                    ))}
                  </select>
                </label>
                <button disabled={currentPlanDay === 14} onClick={() => changePlanDay(currentPlanDay + 1)} aria-label="切换到下一学习日">→</button>
              </div>
              <span className="planDay">DAY {String(currentPlanDay).padStart(2, "0")} / 14 · 手动进度</span>
              <h2>{currentPlanDay <= 10 ? "新学 + 当日测试" : "只复习，不再加新内容"}</h2>
              <p>
                {currentPlanDay <= 9
                  ? "前 9 天每天完成 3 个全能词 List 和 3 个等价词 Set；早上新学，下午测试，晚上清错题。"
                  : currentPlanDay === 10
                    ? "今天完成最后 1 个全能词 List 和 2 个等价词 Set；从明天开始四天总复习。"
                    : "优先处理到期与错题；用遮挡回忆和六选二通关确认能真正提取，而不是眼熟。"}
              </p>
            </div>
            <div className="planTasks">
              <article>
                <span>任务 A · 全能词</span>
                <strong>{todayLists.length ? todayLists.map((item) => `List ${item}`).join(" / ") : "到期词 + 弱项"}</strong>
                <small>{todayLists.length ? `当天新词 ${words.filter((word) => todayLists.includes(word.list ?? 0)).length} · 含旧词共待完成 ${dueWordCount}` : `${dueWordCount} 个待复习或未熟练词`}</small>
                <button onClick={startTodayWords}>开始全能词 →</button>
              </article>
              <article>
                <span>任务 B · 等价词</span>
                <strong>{todaySets.length ? todaySets.map((item) => `Set ${item}`).join(" / ") : "六选二综合复习"}</strong>
                <small>{todaySets.length ? `当天新词对 ${EQUIVALENTS.filter((pair) => todaySets.includes(pair.set)).length} · 含旧词共待完成 ${dueEquivalentCount}` : `${dueEquivalentCount} 组待复习或未熟练词对`}</small>
                <button onClick={startTodayEquivalents}>开始等价词 →</button>
              </article>
            </div>
          </section>

          <div className="statsGrid">
            <article><span>今日作答</span><strong>{totalTodayLogs}</strong><small>两套词表合计</small></article>
            <article><span>今日正确率</span><strong>{accuracy}%</strong><small>模糊不计作掌握</small></article>
            <article><span>全能词熟练</span><strong>{mastered}</strong><small>连续通过至 7 天间隔</small></article>
            <article className="darkCard"><span>等价关系熟练</span><strong>{equivalentMastered}<em> / {EQUIVALENTS.length}</em></strong><small>词对和词义均通过</small></article>
          </div>

          <div className="methodGrid">
            <article>
              <span className="step">01</span>
              <h2>第一关 · 选择辨义</h2>
              <p>每个词先通过四选一；答错或模糊只在本关返场，过关后才进入遮挡回忆队列。</p>
              <button onClick={() => setView("study")}>开始双阶段训练 →</button>
            </article>
            <article>
              <span className="step">02</span>
              <h2>第二关 · 遮挡回忆</h2>
              <p>选择过关后穿插 5 个词，再不看选项主动回忆；这关也通过，词条才真正完成。</p>
              <button onClick={() => setView("study")}>查看连续流程 →</button>
            </article>
            <article className="why">
              <span className="step">03</span>
              <h2>六选二通关</h2>
              <p>先从六个英文选项里找出等价词，再确认共同中文义；两步都对才计为掌握。</p>
              <button onClick={() => { setEquivalentMode("test"); setView("equivalents"); }}>进入等价词测试 →</button>
            </article>
          </div>
        </section>
      )}

      {view === "quick" && (
        <section className="library quickPage">
          <div className="quickTypeSwitch" role="tablist" aria-label="选择速刷词表">
            <button className={quickType === "notebook" ? "active" : ""} onClick={() => setQuickType("notebook")} role="tab" aria-selected={quickType === "notebook"}>生词本</button>
            <button className={quickType === "words" ? "active" : ""} onClick={() => setQuickType("words")} role="tab" aria-selected={quickType === "words"}>全能词速刷</button>
            <button className={quickType === "equivalents" ? "active" : ""} onClick={() => setQuickType("equivalents")} role="tab" aria-selected={quickType === "equivalents"}>等价词速刷</button>
            <button className={quickType === "a-plus" ? "active" : ""} onClick={() => setQuickType("a-plus")} role="tab" aria-selected={quickType === "a-plus"}>A加GRE版等价词</button>
            <button className={quickType === "bb" ? "active" : ""} onClick={() => setQuickType("bb")} role="tab" aria-selected={quickType === "bb"}>BB六选二</button>
            <button className={quickType === "glee" ? "active" : ""} onClick={() => setQuickType("glee")} role="tab" aria-selected={quickType === "glee"}>GLEE必备1500词</button>
            <button className={quickType === "mindmap" ? "active" : ""} onClick={() => setQuickType("mindmap")} role="tab" aria-selected={quickType === "mindmap"}>GLEE词汇导图</button>
            <button className={quickType === "math" ? "active" : ""} onClick={() => setQuickType("math")} role="tab" aria-selected={quickType === "math"}>数学词汇</button>
            {([['lclj-fill', '填空高频3000词'], ['lclj-reading', '阅读核心300词'], ['lclj-math', '数学词汇索引']] as const).map(([type, label]) => (
              <button key={type} className={quickType === type ? "active" : ""} onClick={() => setQuickType(type)} role="tab" aria-selected={quickType === type}>{label}</button>
            ))}
          </div>

          {["words","a-plus","bb"].includes(quickType)&&<div className="practiceEntry"><button className="primary" onClick={()=>setPracticeDeck(quickType as PracticeDeck)}>开始测试 · {quickType==="bb"?"释义与同义词":"双向释义"}</button><span>看英文选中文 / 看中文选英文 · 错题记忆笔记</span></div>}
          {practiceDeck&&<Practice key={"practice-"+practiceDeck} deck={practiceDeck} onClose={()=>setPracticeDeck(null)}/>}
          {ready && quickType !== "bb" && quickType !== "notebook" && quickType !== "mindmap" && !(quickType === "a-plus" && aPlusMode === "test") && <RatingCloudSync
            key={quickType.startsWith("lclj-") ? "lclj" : quickType}
            module={quickType.startsWith("lclj-") ? "lclj" : quickType}
            ratings={quickType === "words" ? quickRatings : quickType === "equivalents" ? quickEquivalentRatings : quickType === "a-plus" ? aPlusRatings : quickType === "glee" ? gleeRatings : quickType === "math" ? mathRatings : lcljRatings}
            onLoad={quickType === "words" ? setQuickRatings : quickType === "equivalents" ? setQuickEquivalentRatings : quickType === "a-plus" ? setAPlusRatings : quickType === "glee" ? setGleeRatings : quickType === "math" ? setMathRatings : setLcljRatings}
          />}
          {quickType === "bb" ? <BBQuick pronounce={pronounce}/> : quickType === "notebook" ? (
            <VocabularyNotebook words={words} pronounce={pronounce} />
          ) : quickType === "lclj-fill" || quickType === "lclj-reading" || quickType === "lclj-math" ? (
            <LcljQuick key={quickType} deck={quickType} ratings={lcljRatings} onRate={(id, rating) => {recordLearningPlanRatings("lclj",{[id]:rating});setLcljRatings((current) => ({ ...current, [id]: rating }));}} pronounce={pronounce} />
          ) : quickType === "words" ? (
            <>
              <div className="libraryHead">
                <div>
                  <p className="eyebrow">QUICK VOCABULARY SCAN</p>
                  <h1>快速过词</h1>
                  <p className="quickIntro">词表来源：青山学堂。先看英文回忆，再揭晓释义，用红黄绿记录本次掌握情况。</p>
                </div>
                <div className="libraryActions">
                  <RevealControls total={filteredQuickWords.length} shown={filteredQuickWords.filter((word) => quickRevealed.includes(word.id)).length} onShow={() => setQuickRevealed(filteredQuickWords.map((word) => word.id))} onHide={() => setQuickRevealed([])} />
                </div>
              </div>

              <div className="quickStats" aria-label="速刷掌握程度统计">
                <button aria-pressed={quickRatingFilters.includes("unknown")} className={quickRatingFilters.includes("unknown") ? "active red" : "red"} onClick={() => toggleQuickRatingFilter("unknown")}><i />不认识 <strong>{quickRatingCounts.unknown}</strong></button>
                <button aria-pressed={quickRatingFilters.includes("fuzzy")} className={quickRatingFilters.includes("fuzzy") ? "active yellow" : "yellow"} onClick={() => toggleQuickRatingFilter("fuzzy")}><i />模糊 <strong>{quickRatingCounts.fuzzy}</strong></button>
                <button aria-pressed={quickRatingFilters.includes("familiar")} className={quickRatingFilters.includes("familiar") ? "active green" : "green"} onClick={() => toggleQuickRatingFilter("familiar")}><i />熟悉 <strong>{quickRatingCounts.familiar}</strong></button>
                <button aria-pressed={quickRatingFilters.includes("unrated")} className={quickRatingFilters.includes("unrated") ? "active" : ""} onClick={() => toggleQuickRatingFilter("unrated")}>未标记 <strong>{quickRatingCounts.unrated}</strong></button>
              </div>
              <p className="filterHint">可同时选择多个颜色；本轮名单保持不变。再次点击唯一已选颜色可刷新筛选结果。</p>

              <div className="quickFilters">
                <input className="search" value={quickQuery} onChange={(event) => setQuickQuery(event.target.value)} placeholder="搜索英文或中文释义…" />
                <RangePicker label="选择速刷范围" itemLabel="List" options={availableLists.map(([list]) => list)} selected={quickWordLists} onChange={changeQuickWordLists} />
                <button className="filterReset" onClick={clearQuickRatingFilters}>{quickRatingFilters.length ? `显示全部 · 已选 ${quickRatingFilters.length} 类` : "当前显示全部颜色"}</button>
              </div>
              <ShuffleControls enabled={quickShuffle.words.enabled} onToggle={() => toggleQuickShuffle("words")} onReshuffle={() => reshuffleQuickType("words")} />

              <p className="quickCount">当前范围 {quickWords.length} 词 · 正在显示 {filteredQuickWords.length} 词 · 当前：{quickActiveWord?.word ?? "无匹配词"}</p>

              <div className="shortcutBar" aria-label="速刷快捷键">
                <span><kbd>↑</kbd><kbd>←</kbd> 上一词</span><span><kbd>↓</kbd><kbd>→</kbd> 下一词</span><span><kbd>Space</kbd> 发音</span><span><kbd>Enter</kbd> 显示 / 隐藏释义</span><span><kbd>1</kbd> 红灯 + 释义</span><span><kbd>2</kbd> 黄灯 + 释义</span><span><kbd>3</kbd> 绿灯 + 释义</span>
              </div>

              <QuickGleeMemoryProvider>
              <div className="quickTable allWordsMemoryTable" role="table" aria-label="快速过词表">
                <div className="quickRow quickHeader" role="row"><span>单词</span><span>核心释义</span><span>记忆方法</span><span>掌握程度</span></div>
                {filteredQuickWords.map((word) => {
                  const revealedMeaning = quickRevealed.includes(word.id);
                  const rating = quickRatings[word.id];
                  const active = word.id === quickActiveWordId;
                  return (
                    <div className={`quickRow ${active ? "keyboardActive" : ""} ${rating ? `rated-${rating}` : ""}`} role="row" aria-current={active ? "true" : undefined} key={word.id} ref={(element) => { quickRowRefs.current[word.id] = element; }}>
                      <button className="quickWord" onClick={() => { setQuickActiveId(word.id); pronounce(word.word); }} aria-label={`朗读 ${word.word}`}><strong>{word.word}</strong><small>List {String(word.list ?? "—").padStart(2, "0")} · {word.pos} {word.phonetic}</small></button>
                      <button className={`quickMeaning ${revealedMeaning ? "revealed" : ""}`} onClick={() => { setQuickActiveId(word.id); toggleQuickMeaning(word.id); }} aria-expanded={revealedMeaning}>{revealedMeaning ? word.meaning : <span>点击显示释义</span>}</button>
                      <QuickGleeMemory word={word.word} revealed={revealedMeaning} onEdit={target=>{setGleeEditWord(target);setQuickType("mindmap");}}/>
                      <div className="trafficLights" role="group" aria-label={`${word.word} 掌握程度`}>
                        <button className={rating === "unknown" ? "active red" : "red"} onClick={() => rateQuickWordInPlace(word.id, "unknown")} title="不认识（快捷键 1）"><i /><span>不认识</span></button>
                        <button className={rating === "fuzzy" ? "active yellow" : "yellow"} onClick={() => rateQuickWordInPlace(word.id, "fuzzy")} title="模糊（快捷键 2）"><i /><span>模糊</span></button>
                        <button className={rating === "familiar" ? "active green" : "green"} onClick={() => rateQuickWordInPlace(word.id, "familiar")} title="熟悉（快捷键 3）"><i /><span>熟悉</span></button>
                      </div>
                    </div>
                  );
                })}
              </div>
              </QuickGleeMemoryProvider>
            </>
          ) : quickType === "equivalents" ? (
            <>
              <div className="libraryHead">
                <div>
                  <p className="eyebrow">QUICK EQUIVALENCE SCAN</p>
                  <h1>等价词速刷</h1>
                  <p className="quickIntro">词表来源：青山学堂。默认由等价词 1 提示；也可以指定等价词 2、共同含义或三向混合，集中巩固不同提取方向。</p>
                </div>
                <div className="libraryActions">
                  <RevealControls total={filteredQuickEquivalentPairs.length} shown={filteredQuickEquivalentPairs.filter((pair) => quickEquivalentRevealStages[pair.id] === 2).length} hidden={filteredQuickEquivalentPairs.filter((pair) => !quickEquivalentRevealStages[pair.id]).length} showLabel="全部揭晓" hideLabel="重新遮挡" onShow={() => setQuickEquivalentRevealStages(Object.fromEntries(filteredQuickEquivalentPairs.map((pair) => [pair.id, 2])))} onHide={() => setQuickEquivalentRevealStages({})} />
                </div>
              </div>

              <div className="quickStats" aria-label="等价词速刷掌握程度统计">
                <button aria-pressed={quickEquivalentRatingFilters.includes("unknown")} className={quickEquivalentRatingFilters.includes("unknown") ? "active red" : "red"} onClick={() => toggleQuickEquivalentRatingFilter("unknown")}><i />没想起 <strong>{quickEquivalentRatingCounts.unknown}</strong></button>
                <button aria-pressed={quickEquivalentRatingFilters.includes("fuzzy")} className={quickEquivalentRatingFilters.includes("fuzzy") ? "active yellow" : "yellow"} onClick={() => toggleQuickEquivalentRatingFilter("fuzzy")}><i />只想起部分 <strong>{quickEquivalentRatingCounts.fuzzy}</strong></button>
                <button aria-pressed={quickEquivalentRatingFilters.includes("familiar")} className={quickEquivalentRatingFilters.includes("familiar") ? "active green" : "green"} onClick={() => toggleQuickEquivalentRatingFilter("familiar")}><i />都清楚 <strong>{quickEquivalentRatingCounts.familiar}</strong></button>
                <button aria-pressed={quickEquivalentRatingFilters.includes("unrated")} className={quickEquivalentRatingFilters.includes("unrated") ? "active" : ""} onClick={() => toggleQuickEquivalentRatingFilter("unrated")}>未标记 <strong>{quickEquivalentRatingCounts.unrated}</strong></button>
              </div>
              <p className="filterHint">可同时选择多个颜色；改色后本轮词组不会消失，再次点击唯一已选颜色才刷新。</p>

              <div className="quickFilters quickEquivalentFilters">
                <input className="search" value={quickEquivalentQuery} onChange={(event) => setQuickEquivalentQuery(event.target.value)} placeholder="搜索任一单词或共同含义…" />
                <RangePicker label="选择等价词范围" itemLabel="Set" options={Array.from({ length: 29 }, (_, item) => item + 1)} selected={quickEquivalentSets} onChange={changeQuickEquivalentSets} />
                <select aria-label="选择等价词提示方向" value={quickEquivalentCueMode} onChange={(event) => changeQuickEquivalentCueMode(event.target.value as EquivalentCueMode)}>
                  <option value="left">等价词 1 → 其余两项（默认）</option>
                  <option value="right">等价词 2 → 其余两项</option>
                  <option value="meaning">共同含义 → 两个词</option>
                  <option value="mixed">三向混合</option>
                </select>
                <button className="filterReset" onClick={clearQuickEquivalentRatingFilters}>{quickEquivalentRatingFilters.length ? `显示全部 · 已选 ${quickEquivalentRatingFilters.length} 类` : "当前显示全部颜色"}</button>
              </div>
              <ShuffleControls enabled={quickShuffle.equivalents.enabled} onToggle={() => toggleQuickShuffle("equivalents")} onReshuffle={() => reshuffleQuickType("equivalents")} />

              <p className="quickCount">当前范围 {quickEquivalentPairs.length} 组 · 正在显示 {filteredQuickEquivalentPairs.length} 组 · 当前提示：{quickEquivalentActivePrompt ?? "无匹配词组"}</p>

              <div className="shortcutBar" aria-label="等价词速刷快捷键">
                <span><kbd>↑</kbd><kbd>←</kbd> 上一组</span><span><kbd>↓</kbd><kbd>→</kbd> 下一组</span><span><kbd>Space</kbd> 朗读已显示单词</span><span><kbd>Enter</kbd> 逐项揭晓 → 重遮</span><span><kbd>1</kbd> 没想起</span><span><kbd>2</kbd> 部分</span><span><kbd>3</kbd> 都清楚</span>
              </div>

              <div className="quickTable equivalentQuickTable" role="table" aria-label="等价词快速过词表">
                <div className="quickRow quickHeader" role="row"><span>等价词 1</span><span>等价词 2</span><span>共同含义</span><span>当前方向掌握程度</span></div>
                {filteredQuickEquivalentPairs.map((pair) => {
                  const revealStage = quickEquivalentRevealStages[pair.id] ?? 0;
                  const memoryOpen = quickEquivalentMemoryOpen.includes(pair.id);
                  const quickTips = memoryOpen ? buildEquivalentMemoryTips(pair.left, pair.right, pair.meaning, EQUIVALENTS) : [];
                  const direction = quickEquivalentDirection(pair, quickEquivalentCueMode);
                  const rating = quickEquivalentRatingFor(quickEquivalentRatings, pair.id, direction);
                  const active = pair.id === quickEquivalentActivePairId;
                  const leftVisible = direction === "left" || revealStage >= 1;
                  const rightVisible = direction === "right"
                    || (direction === "left" && revealStage >= 1)
                    || (direction === "meaning" && revealStage >= 2);
                  const meaningVisible = direction === "meaning" || revealStage >= 2;
                  return (
                    <div className={`quickRow ${active ? "keyboardActive" : ""} ${rating ? `rated-${rating}` : ""}`} role="row" aria-current={active ? "true" : undefined} key={pair.id} ref={(element) => { quickEquivalentRowRefs.current[pair.id] = element; }}>
                      <button className={`quickPairWord ${leftVisible ? "revealed" : ""} ${direction === "left" ? "cueCell" : ""}`} onClick={() => { setQuickEquivalentActiveId(pair.id); if (!leftVisible) setQuickEquivalentRevealStage(pair.id, 1); pronounce(pair.left); }} aria-expanded={leftVisible}>
                        {leftVisible ? <><strong>{pair.left}</strong><small>Set {String(pair.set).padStart(2, "0")}{direction === "left" ? " · 当前提示" : ""}</small></> : <span>点击揭晓等价词 1</span>}
                      </button>
                      <button className={`quickPairWord ${rightVisible ? "revealed" : ""} ${direction === "right" ? "cueCell" : ""}`} onClick={() => {
                        setQuickEquivalentActiveId(pair.id);
                        if (!rightVisible) setQuickEquivalentRevealStage(pair.id, direction === "meaning" ? 2 : 1);
                        if (!rightVisible && direction === "meaning" && revealStage === 0) pronounceMany([pair.left, pair.right]);
                        else pronounce(pair.right);
                      }} aria-expanded={rightVisible}>
                        {rightVisible ? <><strong>{pair.right}</strong><small>Set {String(pair.set).padStart(2, "0")}{direction === "right" ? " · 当前提示" : ""}</small></> : <span>点击揭晓等价词 2</span>}
                      </button>
                      <div className="quickMeaningCell">
                        <button className={`quickMeaning ${meaningVisible ? "revealed" : ""} ${direction === "meaning" ? "cueCell" : ""}`} onClick={() => { setQuickEquivalentActiveId(pair.id); if (!meaningVisible) setQuickEquivalentRevealStage(pair.id, 2); }} aria-expanded={meaningVisible}>
                          {meaningVisible ? <>{pair.meaning}{direction === "meaning" && <small className="cueLabel">当前提示</small>}</> : <span>点击揭晓共同含义</span>}
                        </button>
                        <button className={`quickTipToggle ${memoryOpen ? "active" : ""}`} onClick={() => { setQuickEquivalentActiveId(pair.id); toggleQuickEquivalentMemory(pair.id); }} aria-expanded={memoryOpen}>✦ {memoryOpen ? "收起" : "记忆提示"}</button>
                      </div>
                      <div className="trafficLights" role="group" aria-label={`${pair.left} 与 ${pair.right} 当前提示方向掌握程度`}>
                        <button className={rating === "unknown" ? "active red" : "red"} onClick={() => rateQuickEquivalentInPlace(pair.id, direction, "unknown")} title="没想起（快捷键 1）"><i /><span>没想起</span></button>
                        <button className={rating === "fuzzy" ? "active yellow" : "yellow"} onClick={() => rateQuickEquivalentInPlace(pair.id, direction, "fuzzy")} title="只想起部分（快捷键 2）"><i /><span>部分</span></button>
                        <button className={rating === "familiar" ? "active green" : "green"} onClick={() => rateQuickEquivalentInPlace(pair.id, direction, "familiar")} title="都清楚（快捷键 3）"><i /><span>都清楚</span></button>
                      </div>
                      {meaningVisible && <APlusNotes words={[pair.left,pair.right]}/>}
                      {memoryOpen && (
                        <aside className="quickMemoryPanel" aria-label={`${pair.left} 与 ${pair.right} 的记忆提示`}>
                          <div className="quickMemoryHead"><strong>{pair.left} ↔ {pair.right}</strong><span>两词线索 + 共同义</span></div>
                          <div className="quickMemoryCards">
                            {quickTips.map((tip) => <article key={`${tip.label}-${tip.title}`}><span>{tip.label}</span><b>{tip.title}</b><p>{tip.detail}</p></article>)}
                          </div>
                        </aside>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : quickType === "a-plus" ? (
            <>
              <div className="notebookMode aPlusModeSwitch" aria-label="等价词学习模式"><button type="button" aria-pressed={aPlusMode==="scan"} onClick={()=>setAPlusMode("scan")}>速刷与笔记</button><button type="button" aria-pressed={aPlusMode==="test"} onClick={()=>setAPlusMode("test")}>开始测试</button></div>
              {aPlusMode === "test" ? <APlusTest pronounce={pronounce}/> : <>
              <div className="libraryHead">
                <div>
                  <p className="eyebrow">A+ GRE QUICK EQUIVALENCE SCAN</p>
                  <h1>A加GRE版等价词</h1>
                  <p className="quickIntro">PDF 共800条、80个 List。可以由核心词、整组六选二等价词或中文释义任一方向开始回忆。</p>
                </div>
                <div className="libraryActions">
                  <RevealControls total={filteredAPlusEntries.length} shown={filteredAPlusEntries.filter((entry) => aPlusRevealStages[entry.id] === 2 && aPlusMeaningOverrides[entry.id] !== false).length} hidden={filteredAPlusEntries.filter((entry) => !aPlusRevealStages[entry.id] && aPlusMeaningOverrides[entry.id] !== true).length} showLabel="全部揭晓" hideLabel="重新遮挡" onShow={() => {setAPlusMeaningOverrides({});setAPlusRevealStages(Object.fromEntries(filteredAPlusEntries.map((entry) => [entry.id, 2])));}} onHide={() => {setAPlusMeaningOverrides(Object.fromEntries(filteredAPlusEntries.map(entry=>[entry.id,false])));setAPlusRevealStages({});}} />
                </div>
              </div>

              <div className="quickStats" aria-label="A加GRE版等价词掌握程度统计">
                <button aria-pressed={aPlusRatingFilters.includes("unknown")} className={aPlusRatingFilters.includes("unknown") ? "active red" : "red"} onClick={() => toggleAPlusRatingFilter("unknown")}><i />没想起 <strong>{aPlusRatingCounts.unknown}</strong></button>
                <button aria-pressed={aPlusRatingFilters.includes("fuzzy")} className={aPlusRatingFilters.includes("fuzzy") ? "active yellow" : "yellow"} onClick={() => toggleAPlusRatingFilter("fuzzy")}><i />只想起部分 <strong>{aPlusRatingCounts.fuzzy}</strong></button>
                <button aria-pressed={aPlusRatingFilters.includes("familiar")} className={aPlusRatingFilters.includes("familiar") ? "active green" : "green"} onClick={() => toggleAPlusRatingFilter("familiar")}><i />都清楚 <strong>{aPlusRatingCounts.familiar}</strong></button>
                <button aria-pressed={aPlusRatingFilters.includes("unrated")} className={aPlusRatingFilters.includes("unrated") ? "active" : ""} onClick={() => toggleAPlusRatingFilter("unrated")}>未标记 <strong>{aPlusRatingCounts.unrated}</strong></button>
              </div>
              <p className="filterHint">可同时选择多个颜色；改色后本轮词条不会消失，再次点击唯一已选颜色才刷新。</p>

              <div className="quickFilters quickEquivalentFilters">
                <input className="search" value={aPlusQuery} onChange={(event) => setAPlusQuery(event.target.value)} placeholder="搜索核心词、任一等价词或中文…" />
                <RangePicker label="选择 A+ 范围" itemLabel="List" options={Array.from({ length: 80 }, (_, item) => item + 1)} selected={aPlusLists} onChange={changeAPlusLists} />
                <select aria-label="选择A加GRE版提示方向" value={aPlusCueMode} onChange={(event) => changeAPlusCueMode(event.target.value as APlusCueMode)}>
                  <option value="word">核心词 → 等价词 + 释义</option>
                  <option value="equivalents">等价词组 → 核心词 + 释义</option>
                  <option value="meaning">中文释义 → 核心词 + 等价词</option>
                  <option value="mixed">三向混合</option>
                </select>
                <button className="filterReset" onClick={clearAPlusRatingFilters}>{aPlusRatingFilters.length ? `显示全部 · 已选 ${aPlusRatingFilters.length} 类` : "当前显示全部颜色"}</button>
              </div>
              <ShuffleControls enabled={quickShuffle["a-plus"].enabled} onToggle={() => toggleQuickShuffle("a-plus")} onReshuffle={() => reshuffleQuickType("a-plus")} />

              <p className="quickCount">当前范围 {aPlusEntries.length}条 · 正在显示 {filteredAPlusEntries.length}条 · 当前提示：{aPlusActivePrompt ?? "无匹配词条"}</p>

              <div className="shortcutBar" aria-label="A加GRE版等价词速刷快捷键">
                <span><kbd>↑</kbd><kbd>←</kbd> 上一条</span><span><kbd>↓</kbd><kbd>→</kbd> 下一条</span><span><kbd>Space</kbd> 朗读已显示单词</span><span><kbd>Enter</kbd> 逐项揭晓 → 重遮</span><span><kbd>1</kbd> 没想起</span><span><kbd>2</kbd> 部分</span><span><kbd>3</kbd> 都清楚</span>
              </div>

              <APlusNotesProvider onOpenGlee={word=>{setGleeEditWord(word);setQuickType("mindmap");}}>
              <APlusWordMarksProvider>
              <div className="quickTable equivalentQuickTable aPlusQuickTable" role="table" aria-label="A加GRE版等价词速刷表">
                <div className="quickRow quickHeader" role="row"><span>核心词</span><span>六选二等价词</span><span>PDF 释义</span><span>当前方向掌握程度</span></div>
                {filteredAPlusEntries.map((entry) => {
                  const revealStage = aPlusRevealStages[entry.id] ?? 0;
                  const direction = aPlusDirection(entry, aPlusCueMode);
                  const rating = aPlusRatingFor(aPlusRatings, entry.id, direction);
                  const active = entry.id === aPlusActiveEntry?.id;
                  const wordVisible = direction === "word" || revealStage >= 1;
                  const equivalentsVisible = direction === "equivalents"
                    || (direction === "word" && revealStage >= 1)
                    || (direction === "meaning" && revealStage >= 2);
                  const meaningVisible = aPlusMeaningOverrides[entry.id] ?? (direction === "meaning" || revealStage >= 2);
                  return (
                    <div className={`quickRow ${active ? "keyboardActive" : ""} ${rating ? `rated-${rating}` : ""}`} role="row" aria-current={active ? "true" : undefined} key={entry.id} ref={(element) => { aPlusRowRefs.current[entry.id] = element; }}>
                      <div className={`quickPairWord ${wordVisible ? "revealed" : ""}`}>
                        {wordVisible ? <><WordNoteCard word={entry.word} pronounce={pronounce}/><small>List {entry.list} · #{entry.number}</small></> : <button onClick={()=>{setAPlusActiveId(entry.id);setAPlusRevealStage(entry.id,1);}}>点击揭晓核心词</button>}
                      </div>
                      <div className={`quickPairWord aPlusEquivalentCell ${equivalentsVisible ? "revealed" : ""} ${direction === "equivalents" ? "cueCell" : ""}`}>
                        {equivalentsVisible ? <><div className="aPlusEquivalentWords">{entry.equivalents.map((word) => <WordNoteCard key={word} word={word} pronounce={pronounce}/>)}</div><small>{entry.equivalents.length}个等价词{direction === "equivalents" ? " · 当前提示" : ""}</small></> : <button type="button" className="aPlusGroupReveal" onClick={()=>{setAPlusActiveId(entry.id);setAPlusRevealStage(entry.id,direction === "meaning" ? 2 : 1);}}>点击揭晓 {entry.equivalents.length} 个等价词</button>}
                      </div>
                      <button className={`quickMeaning ${meaningVisible ? "revealed" : ""} ${direction === "meaning" ? "cueCell" : ""}`} onClick={() => { setAPlusActiveId(entry.id); setAPlusMeaningOverrides(s=>({...s,[entry.id]:!meaningVisible})); }} aria-expanded={meaningVisible}>
                        {meaningVisible ? <>{entry.meaning}{direction === "meaning" && <small className="cueLabel">当前提示</small>}</> : <span>点击揭晓PDF释义</span>}
                      </button>
                      <div className="trafficLights" role="group" aria-label={`${entry.word} 当前提示方向掌握程度`}>
                        <button className={rating === "unknown" ? "active red" : "red"} onClick={() => rateAPlusInPlace(entry.id, direction, "unknown")} title="没想起（快捷键 1）"><i /><span>没想起</span></button>
                        <button className={rating === "fuzzy" ? "active yellow" : "yellow"} onClick={() => rateAPlusInPlace(entry.id, direction, "fuzzy")} title="只想起部分（快捷键 2）"><i /><span>部分</span></button>
                        <button className={rating === "familiar" ? "active green" : "green"} onClick={() => rateAPlusInPlace(entry.id, direction, "familiar")} title="都清楚（快捷键 3）"><i /><span>都清楚</span></button>
                      </div>

                    </div>
                  );
                })}
              </div>
              </APlusWordMarksProvider>
              </APlusNotesProvider>
              </>}
            </>
          ) : quickType === "glee" ? (
            <>
              <div className="libraryHead">
                <div>
                  <p className="eyebrow">GLEE GRE CORE 1500</p>
                  <h1>GLEE必备1500词</h1>
                  <p className="quickIntro">共30个 List、1500词。先凭英文词回忆GRE中文义，再揭晓英文考法；List 1–9 还可展开查看你整理的记忆锚点、词根词缀与辨析笔记。</p>
                </div>
                <div className="libraryActions">
                  <RevealControls total={filteredGleeWords.length} shown={filteredGleeWords.filter((word) => gleeRevealStages[word.id] === 2).length} hidden={filteredGleeWords.filter((word) => !gleeRevealStages[word.id]).length} showLabel="显示当前答案" hideLabel="隐藏全部答案" onShow={() => setGleeRevealStages(Object.fromEntries(filteredGleeWords.map((word) => [word.id, 2])))} onHide={() => setGleeRevealStages({})} />
                </div>
              </div>

              <div className="quickStats" aria-label="GLEE必备1500词掌握程度统计">
                <button aria-pressed={gleeRatingFilters.includes("unknown")} className={gleeRatingFilters.includes("unknown") ? "active red" : "red"} onClick={() => toggleGleeRatingFilter("unknown")}><i />不认识 <strong>{gleeRatingCounts.unknown}</strong></button>
                <button aria-pressed={gleeRatingFilters.includes("fuzzy")} className={gleeRatingFilters.includes("fuzzy") ? "active yellow" : "yellow"} onClick={() => toggleGleeRatingFilter("fuzzy")}><i />模糊 <strong>{gleeRatingCounts.fuzzy}</strong></button>
                <button aria-pressed={gleeRatingFilters.includes("familiar")} className={gleeRatingFilters.includes("familiar") ? "active green" : "green"} onClick={() => toggleGleeRatingFilter("familiar")}><i />熟悉 <strong>{gleeRatingCounts.familiar}</strong></button>
                <button aria-pressed={gleeRatingFilters.includes("unrated")} className={gleeRatingFilters.includes("unrated") ? "active" : ""} onClick={() => toggleGleeRatingFilter("unrated")}>未标记 <strong>{gleeRatingCounts.unrated}</strong></button>
              </div>
              <p className="filterHint">可同时选择多个颜色；改色后本轮单词不会消失，再次点击唯一已选颜色才刷新。</p>

              <div className="quickFilters">
                <input className="search" value={gleeQuery} onChange={(event) => setGleeQuery(event.target.value)} placeholder="搜索单词、中文释义或英文考法…" />
                <RangePicker label="选择 GLEE 范围" itemLabel="List" options={Array.from({ length: 30 }, (_, item) => item + 1)} selected={gleeLists} onChange={changeGleeLists} />
                <button className="filterReset" onClick={clearGleeRatingFilters}>{gleeRatingFilters.length ? `显示全部 · 已选 ${gleeRatingFilters.length} 类` : "当前显示全部颜色"}</button>
              </div>
              <ShuffleControls enabled={quickShuffle.glee.enabled} onToggle={() => toggleQuickShuffle("glee")} onReshuffle={() => reshuffleQuickType("glee")} />

              <p className="quickCount">当前范围 {gleeWords.length}词 · 正在显示 {filteredGleeWords.length}词 · 当前：{gleeActiveWord?.word ?? "无匹配单词"}</p>

              <div className="shortcutBar" aria-label="GLEE必备1500词速刷快捷键">
                <span><kbd>↑</kbd><kbd>←</kbd> 上一词</span><span><kbd>↓</kbd><kbd>→</kbd> 下一词</span><span><kbd>Space</kbd> 发音</span><span><kbd>Enter</kbd> 中文义 → 英文考法 → 重遮</span><span><kbd>1</kbd> 红灯 + 答案</span><span><kbd>2</kbd> 黄灯 + 答案</span><span><kbd>3</kbd> 绿灯 + 答案</span>
              </div>

              <div className="quickTable gleeQuickTable" role="table" aria-label="GLEE必备1500词速刷表">
                <div className="quickRow quickHeader" role="row"><span>单词</span><span>GRE中文释义</span><span>GRE英文考法</span><span>掌握程度</span></div>
                {filteredGleeWords.map((word) => {
                  const revealStage = gleeRevealStages[word.id] ?? 0;
                  const meaningVisible = revealStage >= 1;
                  const englishVisible = revealStage >= 2;
                  const memoryOpen = gleeMemoryOpen.includes(word.id);
                  const quickTips = workbookMemoryTips(word);
                  const rating = gleeRatings[word.id];
                  const active = word.id === gleeActiveWord?.id;
                  return (
                    <div className={`quickRow ${active ? "keyboardActive" : ""} ${rating ? `rated-${rating}` : ""}`} role="row" aria-current={active ? "true" : undefined} key={word.id} ref={(element) => { gleeRowRefs.current[word.id] = element; }}>
                      <button className="quickWord" onClick={() => { setGleeActiveId(word.id); pronounce(word.word); }} aria-label={`朗读 ${word.word}`}>
                        <strong>{word.word}</strong><small>List {String(word.list).padStart(2, "0")} · #{word.number} · PDF第{word.page}页</small>
                      </button>
                      <div className="quickMeaningCell">
                        <button className={`quickMeaning ${meaningVisible ? "revealed" : ""}`} onClick={() => setGleeRevealStage(word.id, meaningVisible ? 0 : 1)} aria-expanded={meaningVisible}>
                          {meaningVisible ? word.meaning : <span>点击揭晓GRE中文释义</span>}
                        </button>
                        {quickTips.length > 0 && <button className={`quickTipToggle ${memoryOpen ? "active" : ""}`} onClick={() => { setGleeActiveId(word.id); toggleGleeMemory(word.id); }} aria-expanded={memoryOpen}>✦ {memoryOpen ? "收起" : "我的笔记"}</button>}
                      </div>
                      <button className={`quickMeaning gleeEnglish ${englishVisible ? "revealed" : ""}`} onClick={() => setGleeRevealStage(word.id, englishVisible ? 1 : 2)} aria-expanded={englishVisible}>
                        {englishVisible ? word.english : <span>点击揭晓GRE英文考法</span>}
                      </button>
                      <div className="trafficLights" role="group" aria-label={`${word.word} 掌握程度`}>
                        <button className={rating === "unknown" ? "active red" : "red"} onClick={() => rateGleeInPlace(word.id, "unknown")} title="不认识（快捷键 1）"><i /><span>不认识</span></button>
                        <button className={rating === "fuzzy" ? "active yellow" : "yellow"} onClick={() => rateGleeInPlace(word.id, "fuzzy")} title="模糊（快捷键 2）"><i /><span>模糊</span></button>
                        <button className={rating === "familiar" ? "active green" : "green"} onClick={() => rateGleeInPlace(word.id, "familiar")} title="熟悉（快捷键 3）"><i /><span>熟悉</span></button>
                      </div>
                      {meaningVisible && <div className="sharedMemoryRow"><SharedWordMemory word={word.word}/></div>}
                      {memoryOpen && quickTips.length > 0 && (
                        <aside className="quickMemoryPanel" aria-label={`${word.word} 的电子笔记`}>
                          <div className="quickMemoryHead"><strong>{word.word} 的记忆线索</strong><span>List {String(word.list).padStart(2, "0")} · 我的电子笔记</span></div>
                          <div className="quickMemoryCards">
                            {quickTips.map((tip) => <article key={`${tip.label}-${tip.title}`}><span>{tip.label}</span><b>{tip.title}</b><p>{tip.detail}</p></article>)}
                          </div>
                        </aside>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : quickType === "mindmap" ? (
            <GleeMindMapLibrary editWord={gleeEditWord} onTargetHandled={()=>setGleeEditWord(null)} />
          ) : (
            <>
              <div className="libraryHead">
                <div>
                  <p className="eyebrow">GRE MATH QUICK SCAN</p>
                  <h1>数学词汇</h1>
                  <p className="quickIntro">按数学主题自由组合速刷。先看英文术语主动回忆，再揭晓 PDF 中文义；移动到下一词时会自动朗读。</p>
                </div>
                <div className="libraryActions">
                  <RevealControls total={filteredMathWords.length} shown={filteredMathWords.filter((word) => mathRevealed.includes(word.id)).length} onShow={() => setMathRevealed(filteredMathWords.map((word) => word.id))} onHide={() => setMathRevealed([])} />
                </div>
              </div>

              <div className="quickStats" aria-label="数学词汇掌握程度统计">
                <button aria-pressed={mathRatingFilters.includes("unknown")} className={mathRatingFilters.includes("unknown") ? "active red" : "red"} onClick={() => toggleMathRatingFilter("unknown")}><i />不认识 <strong>{mathRatingCounts.unknown}</strong></button>
                <button aria-pressed={mathRatingFilters.includes("fuzzy")} className={mathRatingFilters.includes("fuzzy") ? "active yellow" : "yellow"} onClick={() => toggleMathRatingFilter("fuzzy")}><i />模糊 <strong>{mathRatingCounts.fuzzy}</strong></button>
                <button aria-pressed={mathRatingFilters.includes("familiar")} className={mathRatingFilters.includes("familiar") ? "active green" : "green"} onClick={() => toggleMathRatingFilter("familiar")}><i />熟悉 <strong>{mathRatingCounts.familiar}</strong></button>
                <button aria-pressed={mathRatingFilters.includes("unrated")} className={mathRatingFilters.includes("unrated") ? "active" : ""} onClick={() => toggleMathRatingFilter("unrated")}>未标记 <strong>{mathRatingCounts.unrated}</strong></button>
              </div>
              <p className="filterHint">可同时选择多个颜色；改色后本轮词条不会消失，再次点击唯一已选颜色才刷新。</p>

              <div className="quickFilters mathQuickFilters">
                <input className="search" value={mathQuery} onChange={(event) => setMathQuery(event.target.value)} placeholder="搜索术语、中文释义或数学主题…" />
                <CategoryPicker options={MATH_CATEGORIES} selected={mathCategories} onChange={changeMathCategories} />
                <button className="filterReset" onClick={clearMathRatingFilters}>{mathRatingFilters.length ? `显示全部 · 已选 ${mathRatingFilters.length} 类` : "当前显示全部颜色"}</button>
              </div>
              <ShuffleControls enabled={quickShuffle.math.enabled} onToggle={() => toggleQuickShuffle("math")} onReshuffle={() => reshuffleQuickType("math")} />

              <p className="quickCount">当前范围 {mathWords.length}词 · 正在显示 {filteredMathWords.length}词 · 当前：{mathActiveWord?.term ?? "无匹配词"}</p>

              <div className="shortcutBar" aria-label="数学词汇速刷快捷键">
                <span><kbd>↑</kbd><kbd>←</kbd> 上一词</span><span><kbd>↓</kbd><kbd>→</kbd> 下一词</span><span><kbd>Space</kbd> 发音</span><span><kbd>Enter</kbd> 显示 / 隐藏释义</span><span><kbd>1</kbd> 红灯 + 释义</span><span><kbd>2</kbd> 黄灯 + 释义</span><span><kbd>3</kbd> 绿灯 + 释义</span>
              </div>

              <div className="quickTable mathQuickTable" role="table" aria-label="数学词汇速刷表">
                <div className="quickRow quickHeader" role="row"><span>英文术语</span><span>PDF 中文释义</span><span>数学类别</span><span>掌握程度</span></div>
                {filteredMathWords.map((word: MathVocabularyEntry) => {
                  const meaningVisible = mathRevealed.includes(word.id);
                  const rating = mathRatings[word.id];
                  const active = word.id === mathActiveWord?.id;
                  return (
                    <div className={`quickRow ${active ? "keyboardActive" : ""} ${rating ? `rated-${rating}` : ""}`} role="row" aria-current={active ? "true" : undefined} key={word.id} ref={(element) => { mathRowRefs.current[word.id] = element; }}>
                      <button className="quickWord" onClick={() => { setMathActiveId(word.id); pronounce(word.term); }} aria-label={`朗读 ${word.term}`}>
                        <strong>{word.term}</strong><small>原书第 {word.page} 页</small>
                      </button>
                      <button className={`quickMeaning ${meaningVisible ? "revealed" : ""}`} onClick={() => toggleMathMeaning(word.id)} aria-expanded={meaningVisible}>
                        {meaningVisible ? word.meaning : <span>点击揭晓中文释义</span>}
                      </button>
                      <button className="mathCategoryCell" onClick={() => setMathActiveId(word.id)}>{word.category}</button>
                      <div className="trafficLights" role="group" aria-label={`${word.term} 掌握程度`}>
                        <button className={rating === "unknown" ? "active red" : "red"} onClick={() => rateMathInPlace(word.id, "unknown")} title="不认识（快捷键 1）"><i /><span>不认识</span></button>
                        <button className={rating === "fuzzy" ? "active yellow" : "yellow"} onClick={() => rateMathInPlace(word.id, "fuzzy")} title="模糊（快捷键 2）"><i /><span>模糊</span></button>
                        <button className={rating === "familiar" ? "active green" : "green"} onClick={() => rateMathInPlace(word.id, "familiar")} title="熟悉（快捷键 3）"><i /><span>熟悉</span></button>
                      </div>
                      {meaningVisible && <div className="sharedMemoryRow"><SharedWordMemory word={word.term}/></div>}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      )}

      {view === "study" && (
        <section className="study">
          <div className="studyHead">
            <div>
              <p className="eyebrow">RETRIEVAL SESSION</p>
              <h1>今日训练</h1>
            </div>
            <div className="studyControls">
              <button
                className={`autoSpeakToggle ${autoSpeak ? "active" : ""}`}
                type="button"
                aria-pressed={autoSpeak}
                onClick={() => setAutoSpeak((value) => !value)}
              >
                <span aria-hidden="true">{autoSpeak ? "●" : "○"}</span>
                自动读音
              </button>
              <label className="studyListPicker">
                <span>学习范围</span>
                <select value={studyList} onChange={(event) => changeStudyList(event.target.value)}>
                  <option value="plan">第 {currentPlanDay} 天任务</option>
                  {availableLists.map(([list, count]) => (
                    <option value={list} key={list}>List {String(list).padStart(2, "0")} · {count} 词</option>
                  ))}
                  <option value="all">全部 List</option>
                </select>
              </label>
              <div className="stageSwitch" aria-label="当前双阶段训练进度">
                <span className={currentWordStage === "choice" ? "active" : "done"}>1 选择辨义</span>
                <i>→</i>
                <span className={currentWordStage === "recall" ? "active" : ""}>2 遮挡回忆</span>
              </div>
            </div>
          </div>

          <div className="sessionProgress">
            <span style={{ width: `${Math.min(100, ((index % 20) / 20) * 100)}%` }} />
          </div>
          <p className="sessionLabel">
            {studyList === "all" ? "全部 List" : studyList === "plan" ? `第 ${currentPlanDay} 天 · ${todayLists.length ? todayLists.map((item) => `List ${item}`).join(" / ") : "综合复习"}` : `List ${String(studyList).padStart(2, "0")}`}
            {" · "}已作答 {index} · 队列中 {wordRetries.length} 个阶段任务 · {currentWordStage === "choice" ? "第一关：选择最准确的中文释义" : "第二关：不看选项主动回忆"}
          </p>

          <article className="quizCard">
            <div className="wordLine">
              <div>
                <div className="wordMeta">
                  <span className="listBadge">LIST {String(current.list ?? "—").padStart(2, "0")}</span>
                  {readyWordRetry && (
                    <span className="retryBadge">
                      {readyWordRetry.reason === "bridge" ? "选择已通过 · 遮挡回忆" : `本关返场 · 还需清楚 ${readyWordRetry.passes} 次`}
                    </span>
                  )}
                  <span>{current.pos}</span>
                </div>
                <h2>{current.word}</h2>
                <p>{current.phonetic}</p>
              </div>
              <button onClick={speak} aria-label={`朗读 ${current.word}`}>↗ 声音</button>
            </div>

            {currentWordStage === "choice" ? (
              <div className="options">
                {options.map((option, optionIndex) => {
                  const isCorrect = option.id === current.id;
                  const isSelected = selected === option.id;
                  const state = revealed ? (isCorrect ? "correct" : isSelected ? "wrong" : "muted") : "";
                  return (
                    <button key={option.id} className={state} onClick={() => choose(option)}>
                      <span>{String.fromCharCode(65 + optionIndex)}</span>{option.meaning}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="recallPanel">
                {!revealed ? (
                  <>
                    <p>不要急着翻面。先用 3–5 秒，在脑中说出它的核心含义。</p>
                    <button className="reveal" onClick={() => setRevealed(true)}>我已回忆，显示答案</button>
                  </>
                ) : (
                  <div className="answer">
                    <span>正确释义</span>
                    <strong>{current.meaning}</strong>
                  </div>
                )}
              </div>
            )}

            {revealed && (
              <div className="feedback">
                <div>
                  <span>{currentWordStage === "choice" && selected === current.id ? "选择正确，完成自评后排入遮挡回忆" : currentWordStage === "choice" ? "选择辨义还需要加强" : "现在诚实自评主动回忆结果"}</span>
                  <SharedWordMemory word={current.word}/>
                  <p>
                    {current.list && <small>来源：List {String(current.list).padStart(2, "0")} · PDF 第 {current.page} 页</small>}
                  </p>
                </div>
                <div className="gradeButtons">
                  <button onClick={() => grade("wrong")}><b>1</b> 没想起</button>
                  <button onClick={() => grade(currentWordStage === "choice" && selected !== current.id ? "wrong" : "fuzzy")}><b>2</b> 模糊</button>
                  <button className="good" onClick={() => grade(currentWordStage === "choice" && selected !== current.id ? "wrong" : "correct")}><b>3</b> 清楚</button>
                </div>
              </div>
            )}
          </article>
          <div className="shortcutBar studyShortcutBar" aria-label="全能词训练快捷键">
            <span><kbd>A</kbd>–<kbd>D</kbd> 选择释义</span>
            <span><kbd>Enter</kbd> 揭晓遮挡答案</span>
            <span><kbd>Space</kbd> 发音</span>
            <span><kbd>1</kbd> 没想起</span>
            <span><kbd>2</kbd> 模糊</span>
            <span><kbd>3</kbd> 清楚</span>
          </div>
          <p className="shortcut">选择辨义通过后穿插 5 词进入遮挡回忆；两关分别返场：没想起隔 3 题并需清楚 2 次，模糊隔 6 题并需清楚 1 次。</p>
        </section>
      )}

      {view === "equivalents" && (
        <section className="study equivalents">
          <div className="studyHead">
            <div>
              <p className="eyebrow">SENTENCE EQUIVALENCE</p>
              <h1>等价词训练</h1>
            </div>
            <div className="studyControls">
              <button
                className={`autoSpeakToggle ${autoSpeak ? "active" : ""}`}
                type="button"
                aria-pressed={autoSpeak}
                onClick={() => setAutoSpeak((value) => !value)}
              >
                <span aria-hidden="true">{autoSpeak ? "●" : "○"}</span>
                自动读音
              </button>
              <label className="studyListPicker">
                <span>学习范围</span>
                <select value={equivalentSet} onChange={(event) => changeEquivalentSet(event.target.value)}>
                  <option value="plan">第 {currentPlanDay} 天任务</option>
                  {Array.from({ length: 29 }, (_, item) => item + 1).map((set) => (
                    <option value={set} key={set}>Set {String(set).padStart(2, "0")} · {EQUIVALENTS.filter((pair) => pair.set === set).length} 组</option>
                  ))}
                  <option value="all">全部 Set</option>
                </select>
              </label>
              <div className="modeSwitch" role="group" aria-label="等价词训练模式">
                <button className={equivalentMode === "learn" ? "active" : ""} onClick={() => { setEquivalentMode("learn"); resetEquivalentQuestion(); }}>成组学习</button>
                <button className={equivalentMode === "test" ? "active" : ""} onClick={() => { setEquivalentMode("test"); resetEquivalentQuestion(); }}>六选二通关</button>
              </div>
            </div>
          </div>

          <div className="sessionProgress">
            <span style={{ width: `${Math.min(100, ((equivalentIndex % 20) / 20) * 100)}%` }} />
          </div>
          <p className="sessionLabel">
            {equivalentSet === "all" ? "全部 Set" : equivalentSet === "plan" ? `第 ${currentPlanDay} 天 · ${todaySets.length ? todaySets.map((item) => `Set ${item}`).join(" / ") : "综合复习"}` : `Set ${String(equivalentSet).padStart(2, "0")}`}
            {" · "}已作答 {equivalentIndex} · 本轮待返场 {equivalentRetries.length} · {equivalentMode === "learn" ? "同时记住共同含义和等价关系" : "先选词对，再确认共同含义"}
          </p>

          <article className="quizCard equivalentCard">
            <div className="equivalentTopline">
              <div className="wordMeta">
                <span className="listBadge">SET {String(currentPair.set).padStart(2, "0")}</span>
                {readyEquivalentRetry && <span className="retryBadge">返场 · 还需通过 {readyEquivalentRetry.passes} 次</span>}
              </div>
              <button onClick={() => pronounceMany([currentPair.left, currentPair.right])}>↗ 朗读词对</button>
            </div>

            {equivalentMode === "learn" ? (
              <>
                <div className="pairDisplay">
                  <strong>{currentPair.left}</strong>
                  <span>↔</span>
                  <strong>{currentPair.right}</strong>
                </div>
                <div className="commonMeaning">
                  <span>共同含义</span>
                  <b>{currentPair.meaning}</b>
                  <small>来源：等价词表 Set {String(currentPair.set).padStart(2, "0")} · PDF 第 {currentPair.page} 页</small>
                </div>
                <div className="equivalentActions">
                  <button onClick={() => gradeEquivalent("wrong")}>没记住 · 隔 3 组返场</button>
                  <button className="good" onClick={() => gradeEquivalent("correct")}>词义和关系都记住了 →</button>
                </div>
              </>
            ) : (
              <>
                {equivalentStage === "pair" && (
                  <>
                    <div className="testPrompt">
                      <span>STEP 1 / 2</span>
                      <h2>选出意思等价的两个词</h2>
                      <p>模拟 GRE 六选二：必须恰好选择两个。</p>
                    </div>
                    <div className="sixOptions">
                      {equivalentOptions.options.map((word) => (
                        <button
                          key={word}
                          className={equivalentSelected.includes(word) ? "selected" : ""}
                          onClick={() => toggleEquivalentWord(word)}
                        >
                          <span>{equivalentSelected.includes(word) ? "✓" : "○"}</span>{word}
                        </button>
                      ))}
                    </div>
                    <button className="testContinue" disabled={equivalentSelected.length !== 2} onClick={confirmEquivalentPair}>确认词对，继续判断词义 →</button>
                  </>
                )}

                {equivalentStage === "meaning" && (
                  <>
                    <div className={`pairResult ${pairCorrect ? "correct" : "wrong"}`}>
                      <span>{pairCorrect ? "词对选择正确" : "词对选择错误"}</span>
                      <strong>{currentPair.left} ↔ {currentPair.right}</strong>
                    </div>
                    <div className="testPrompt">
                      <span>STEP 2 / 2</span>
                      <h2>它们共同表示什么？</h2>
                    </div>
                    <div className="meaningOptions">
                      {equivalentOptions.meanings.map((meaning) => (
                        <button className={meaningSelected === meaning ? "selected" : ""} key={meaning} onClick={() => setMeaningSelected(meaning)}>{meaning}</button>
                      ))}
                    </div>
                    <button className="testContinue" disabled={!meaningSelected} onClick={finishEquivalentTest}>提交整题 →</button>
                  </>
                )}

                {equivalentStage === "result" && (
                  <div className="finalResult">
                    <span className={pairCorrect && meaningSelected === currentPair.meaning ? "pass" : "fail"}>
                      {pairCorrect && meaningSelected === currentPair.meaning ? "通关：词对和含义都正确" : "本题未通关：两步必须全部正确"}
                    </span>
                    <div className="pairDisplay compact">
                      <strong>{currentPair.left}</strong><span>↔</span><strong>{currentPair.right}</strong>
                    </div>
                    <b>{currentPair.meaning}</b>
                    <small>PDF 第 {currentPair.page} 页 · 答错后 10 分钟再次出现</small>
                    <button className="testContinue" onClick={() => gradeEquivalent(pairCorrect && meaningSelected === currentPair.meaning ? "correct" : "wrong")}>记录结果，下一组 →</button>
                  </div>
                )}
              </>
            )}
          </article>
          <p className="shortcut">没记住或六选二未通关：隔 3 组返场，并需连续通过 2 次；跨学习日按第 2 / 4 / 8 / 14 天再次检验。</p>
        </section>
      )}

      {view === "library" && (
        <section className="library">
          <div className="libraryHead">
            <div><p className="eyebrow">VOCABULARY LIBRARY</p><h1>词库与记录</h1></div>
            <div className="libraryActions">
              <input ref={fileInput} type="file" accept=".csv,.tsv,.json" onChange={(event) => importFile(event.target.files?.[0])} hidden />
              <a href={import.meta.env.BASE_URL+"GRE全能词.csv"} download>下载 CSV 词库</a>
              <a href={import.meta.env.BASE_URL+"GRE等价词表.csv"} download>下载等价词 CSV</a>
              <button onClick={() => fileInput.current?.click()}>导入词库</button>
              <button className="solid" onClick={exportBackup}>备份记录</button>
            </div>
          </div>
          <div className="importNote">
            <strong>{words.length === SOURCE_WORDS.length ? `《GRE全能词》完整词库：${words.length} 词` : `已载入 ${words.length} 个词`}</strong>
            <span>覆盖 28 个 List；同时支持导入自定义 CSV / TSV / JSON 词库。</span>
            {importMessage && <em>{importMessage}</em>}
          </div>
          <div className="filterBar">
            <input className="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索英文或中文释义…" />
            <select aria-label="按 List 筛选" value={listFilter} onChange={(event) => setListFilter(event.target.value)}>
              <option value="all">全部 List</option>
              {Array.from({ length: 28 }, (_, index) => (
                <option value={index + 1} key={index + 1}>List {String(index + 1).padStart(2, "0")}</option>
              ))}
            </select>
          </div>
          <div className="wordTable" role="table">
            <div className="tableRow tableHeader" role="row"><span>单词</span><span>核心释义</span><span>掌握阶段</span><span>下次复习</span></div>
            {filteredWords.slice(0, 200).map((word) => {
              const item = store.progress[word.id];
              return (
                <div className="tableRow" role="row" key={word.id}>
                  <span><strong>{word.word}</strong><small>List {String(word.list ?? "—").padStart(2, "0")} · {word.pos} {word.phonetic}</small></span>
                  <span>{word.meaning}</span>
                  <span><i className={`level level${Math.min(5, item?.level ?? 0)}`}>{item?.level >= 5 ? "稳定" : item?.level >= 2 ? "学习中" : "新词"}</i></span>
                  <span>{formatDue(item?.dueAt ?? 0, item?.dueDay, currentPlanDay)}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
