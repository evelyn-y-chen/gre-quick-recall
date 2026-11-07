import precise from './qingshanPrecise.json';
import rare from './qingshanRare.json';

export type QingshanDeck='qingshan-precise'|'qingshan-rare';
export type QingshanEntry={id:string;word:string;list:number;group:string;number:number;page:number;commonMeaning:string;specialMeaning:string;meaning:string};
export type QingshanDisplayEntry=QingshanEntry&{sourceRows:QingshanEntry[]};
type Rating='unknown'|'fuzzy'|'familiar';
/** Source rows stay intact for saved tests and recovery. Only adjacent rows in
 * the same source group share one displayed word and its two meaning cells. */
export function groupQingshanRows(source:QingshanEntry[]):QingshanDisplayEntry[] {
 const grouped:QingshanDisplayEntry[]=[];
 const lines=(rows:QingshanEntry[],field:'commonMeaning'|'specialMeaning'|'meaning')=>[...new Set(rows.map(row=>row[field]).filter(text=>text.trim()))].join('\n');
 for(const row of source){
  const previous=grouped.at(-1),last=previous?.sourceRows.at(-1);
  if(previous&&last&&previous.word.trim().toLowerCase()===row.word.trim().toLowerCase()&&previous.list===row.list&&previous.group===row.group&&previous.page===row.page&&last.number+1===row.number){
   const sourceRows=[...previous.sourceRows,row];
   grouped[grouped.length-1]={...previous,sourceRows,commonMeaning:lines(sourceRows,'commonMeaning'),specialMeaning:lines(sourceRows,'specialMeaning'),meaning:lines(sourceRows,'meaning')};
  }else grouped.push({...row,sourceRows:[row]});
 }
 return grouped;
}
/** Never recolor stored rows just because their display is merged. When old
 * marks differ, show the least familiar existing mark until the next self-test. */
export function qingshanDisplayRating(entry:QingshanDisplayEntry,ratings:Record<string,Rating>):Rating|undefined {
 const values=entry.sourceRows.map(row=>ratings[row.id]);
 return (['unknown','fuzzy','familiar'] as const).find(rating=>values.includes(rating));
}
export function qingshanRowLabel(entry:QingshanDisplayEntry){return entry.sourceRows.length>1?`第 ${entry.number}–${entry.sourceRows.at(-1)!.number} 行`:`第 ${entry.number} 行`;}
type SourceTable={title:string;intro:string;commonLabel:string;specialLabel:string;entries:QingshanEntry[]};
export const qingshanDecks:Record<QingshanDeck,SourceTable>={
 'qingshan-precise':{title:'青山精准释义',commonLabel:'词典释义',specialLabel:'精准释义',entries:precise,intro:'青山学堂 GRE 词表 · 精准释义 V1.0。保留原表词汇、词典释义与精准释义，按原表页码选择范围；同一页连续重复的单词合为一行，两列释义分别换行保留。'},
 'qingshan-rare':{title:'青山熟词僻义',commonLabel:'常见释义',specialLabel:'重要僻义',entries:rare,intro:'青山学堂 GRE 词表 · 熟词僻义 V1.0。保留原表词汇、常见释义与重要僻义，按原表页码选择范围；同一页连续重复的单词合为一行，两列释义分别换行保留。'},
};
export const qingshanRatingKeys:Record<QingshanDeck,string>={'qingshan-precise':'gre-qingshan-precise-ratings-v1','qingshan-rare':'gre-qingshan-rare-ratings-v1'};
