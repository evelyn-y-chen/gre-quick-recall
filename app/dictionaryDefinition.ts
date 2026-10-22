export type DictionarySource = 'merriam' | 'dictcn' | 'ecdict';
export const dictionarySources:Record<DictionarySource,string> = {
 merriam:'词典 · 韦氏词典（Merriam-Webster）',dictcn:'词典 · 海词词典（Dict.cn）',ecdict:'词典 · ECDICT',
};
/** Only an explicit replacement discards the previous definition and its sources. */
export function applyDictionaryDefinition(meaning:string,origin:string,text:string,source:DictionarySource,append:boolean){
 const definition=text.trim();if(!definition)throw Error('请先粘贴或选择需要的释义。');
 const previous=meaning.trim();
 const next=append&&previous?(previous===definition||previous.endsWith('\n'+definition)?previous:previous+'\n'+definition):definition;
 const sources=append&&previous?origin.split('\n').map(s=>s.trim()).filter(Boolean):[];
 const nextOrigin=[...new Set([...sources,dictionarySources[source]])].join('\n');
 if(next.length>4000)throw Error('释义超过 4000 字，请精简后再填入；原释义没有改变。');
 if(nextOrigin.length>1000)throw Error('来源超过 1000 字，请先精简已有来源；原内容没有改变。');
 return {meaning:next,origin:nextOrigin};
}
