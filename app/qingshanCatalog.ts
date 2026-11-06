import precise from './qingshanPrecise.json';
import rare from './qingshanRare.json';

export type QingshanDeck='qingshan-precise'|'qingshan-rare';
export type QingshanEntry={id:string;word:string;list:number;group:string;number:number;page:number;commonMeaning:string;specialMeaning:string;meaning:string};
type SourceTable={title:string;intro:string;commonLabel:string;specialLabel:string;entries:QingshanEntry[]};
export const qingshanDecks:Record<QingshanDeck,SourceTable>={
 'qingshan-precise':{title:'青山精准释义',commonLabel:'词典释义',specialLabel:'精准释义',entries:precise,intro:'青山学堂 GRE 词表 · 精准释义 V1.0。保留原表词汇、词典释义与精准释义，按原表页码选择范围；重复行与空白格按原表保留。'},
 'qingshan-rare':{title:'青山熟词僻义',commonLabel:'常见释义',specialLabel:'重要僻义',entries:rare,intro:'青山学堂 GRE 词表 · 熟词僻义 V1.0。保留原表词汇、常见释义与重要僻义，按原表页码选择范围；重复行与空白格按原表保留。'},
};
export const qingshanRatingKeys:Record<QingshanDeck,string>={'qingshan-precise':'gre-qingshan-precise-ratings-v1','qingshan-rare':'gre-qingshan-rare-ratings-v1'};
