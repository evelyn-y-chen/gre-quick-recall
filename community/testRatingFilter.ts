import type {Rating} from '../app/ratingSyncModel';
export type TestColor=Rating|'unrated';
export const testColors=[{id:'unknown',label:'红灯 · 不认识'},{id:'fuzzy',label:'黄灯 · 模糊'},{id:'familiar',label:'绿灯 · 熟悉'},{id:'unrated',label:'未标记'}] as const;
export function termRating(deck:string,id:string,ratings:Record<string,Rating>):TestColor{
 const ids=deck==='bb'?[id,id.replace(/:\d+$/,'')]:deck==='a-plus'?[id+':word',id+':equivalents',id+':meaning',id]:[id];
 const marks=ids.map(key=>ratings[key]).filter(Boolean);
 return marks.includes('unknown')?'unknown':marks.includes('fuzzy')?'fuzzy':marks.includes('familiar')?'familiar':'unrated';
}
export function matchesTestColors(deck:string,id:string,ratings:Record<string,Rating>,colors:TestColor[]){return colors.includes(termRating(deck,id,ratings));}
export const ratingKeys:Record<string,string>={words:'gre-quick-ratings-v1',bb:'gre-bb-ratings-v1','a-plus':'gre-a-plus-equivalent-quick-ratings-v1'};
