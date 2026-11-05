import type {Term} from './practiceModel';
export type RecallTerm=Term&{phonetic?:string;pos?:string;english?:string;exampleEnglish?:string;exampleChinese?:string;sourceMeaning?:string;sourceExample?:string;memory?:string;comparison?:string;related?:string;originalMemory?:string;group?:string;number?:number;page?:number;endPage?:number;volume?:string;origin?:string;note?:string};
/** Keep source columns readable and separate instead of flattening a row into a gloss. */
export function recallFields(term:RecallTerm){
 const fields=[
  ['中文释义',term.meaning],['音标',term.phonetic],['词性',term.pos],['英文解释',term.english],
  ['等价词',term.synonyms?.join(' · ')],['同组词与释义',term.related],['记忆方法',term.memory],['词义对照',term.comparison],
  ['英文例句',term.exampleEnglish],['例句译文',term.exampleChinese],['收集笔记',term.note],
  ['原文释义',term.sourceMeaning],['原文例句',term.sourceExample],['原文记法',term.originalMemory],
  ['来源',term.origin],
 ];
 return fields.filter((field):field is [string,string]=>typeof field[1]==='string'&&!!field[1].trim()).map(([label,value])=>({label,value}));
}
export function recallLocation(term:RecallTerm){return [term.origin?undefined:term.volume?`BB ${term.volume}册`:undefined,term.group??(!term.origin?`List ${term.list}`:undefined),term.number?`#${term.number}`:undefined,term.page?`原书第 ${term.page}${term.endPage&&term.endPage!==term.page?'–'+term.endPage:''} 页`:undefined].filter(Boolean).join(' · ');}
