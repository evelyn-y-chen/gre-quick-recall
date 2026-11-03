import words from './zhangWords.json';
import pairs from './zhangPairs.json';
export type ZhangDeck='zhang-words'|'zhang-pairs';
export type ZhangEntry={id:string;word:string;list:number;group:string;number:number;page:number;meaning:string;synonyms:string;phonetic?:string;english?:string;exampleEnglish?:string;exampleChinese?:string;sourceMeaning?:string;sourceExample?:string};
export const zhangDecks:Record<ZhangDeck,{title:string;entries:ZhangEntry[];intro:string}>={
 'zhang-words':{title:'张巍镇考3000词',entries:words,intro:'2026年乱序版 · 保留原 List 1–30、两组补充重点单词及原书「2025年最新真题词汇」。英文解释、中文释义分开显示，音标、等价词和例句按原表保留。'},
 'zhang-pairs':{title:'张巍等价词',entries:pairs,intro:'2026年版 · 保留原表五天任务及每行等价词组。同组词是原题语境中的等价关系，不一定在所有语境中同义。'}
};
export const zhangRatingKeys:Record<ZhangDeck,string>={'zhang-words':'gre-zhang-words-ratings-v1','zhang-pairs':'gre-zhang-pairs-ratings-v1'};
export const zhangSynonyms=(entry:ZhangEntry)=>entry.synonyms.split(/[,，;；\n]+/).map(s=>s.trim()).filter(Boolean);
