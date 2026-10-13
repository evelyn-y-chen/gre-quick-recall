import bbData from "./bbEquivalents.json";
import equivalentData from "./equivalents.json";
import aPlusData from "./aPlusEquivalents.json";
import gleeData from "./glee1500.json";
import fillData from "./lcljFill.json";
import readingData from "./lcljReading.json";
import mathData from "./lcljMath.json";
import { MATH_WORDS } from "./mathVocabulary";
import { GLEE_MIND_MAPS, type GleeMindMap } from "./gleeMindMaps";
import { GLEE_TABLE_LISTS, type GleeTableList } from "./gleeTableLists";

export type CatalogWord = { id: string; word: string; meaning: string; note: string; origin: string; module: string };
export function buildNotebookCatalog(words: Array<{ id: string; word: string; meaning: string; list?: number; note?: string }>, maps: GleeMindMap[] = GLEE_MIND_MAPS, tables: GleeTableList[] = GLEE_TABLE_LISTS) {
  const out: CatalogWord[] = [];
  function add(id: string, word: string, meaning: string, module: string, location: string, note = "") {
    out.push({ id: `${module}:${id}`, word, meaning, module, origin: `${module} · ${location}`, note });
  }
  words.forEach((w) => add(w.id,w.word,w.meaning,"全能词",w.list ? `List ${w.list}` : "自定义词库",w.note));
  bbData.forEach((e)=>e.words.forEach((w,i)=>add(`${e.id}-${i}`,w.word,w.meaning,"BB六选二",`${e.volume}册 · List ${e.list} · 第 ${e.number} 组 · PDF 第 ${e.page} 页`)));
  equivalentData.forEach((w) => [w.left,w.right].forEach((word,i) => add(`${w.id}-${i}`,word,w.meaning,"等价词",`Set ${w.set}`,`等价词：${w.left} ↔ ${w.right}`)));
  aPlusData.forEach((w) => [w.word,...w.equivalents].forEach((word,i) => add(`${w.id}-${i}`,word,w.meaning,"A加GRE等价词",`List ${w.list} · #${w.number}`,`同组：${[w.word,...w.equivalents].join(" / ")}`)));
  gleeData.forEach((w) => add(w.id,w.word,w.meaning,"GLEE必备1500词",`List ${w.list}`,w.english));
  maps.forEach((m) => m.branches.forEach((b,bi) => b.words.forEach((w,wi) => add(`${m.id}-${bi}-${wi}`,w.word,w.gloss ?? "","GLEE词汇导图",`List ${m.list} · ${b.title}`,w.memory))));
  tables.forEach((t) => t.words.forEach((w) => add(`${t.id}-${w.id}`,w.word,w.gloss,"GLEE表格速刷",`List ${t.list}`,w.memory)));
  MATH_WORDS.forEach((w) => add(w.id,w.term,w.meaning,"数学词汇",`${w.category} · 第 ${w.page} 页`));
  fillData.forEach((w) => add(w.id,w.word,w.meaning,"填空高频3000词",`List ${w.list}`));
  readingData.forEach((w,i) => add(w.id,w.word,`本义：${w.meaning}\n文中义：${w.context}\n对应选项：${w.equivalent}`,"阅读核心300词",`List ${Math.floor(i/50)+1} · ${w.category} · ${w.passage}`));
  mathData.forEach((w) => add(w.id,w.word,w.meaning,"数学词汇索引",`${w.category} · 第 ${w.page} 页`));
  return out;
}
