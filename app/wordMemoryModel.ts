export const wordMemoryKey=(word:string)=>word.normalize("NFC").trim().toLowerCase().replace(/\s+/g," ");
export type WordMemory={text:string;revision:number;sources:string[]};
// Only fold formatting-equivalent content. Keep numbers, negation, word spaces,
// roots and operators, so similar but distinct mnemonics are not discarded.
function memoryFingerprint(text:string){return text.normalize("NFKC").toLowerCase().replace(/[“”‘’「」『』"']/g,"").replace(/[，,。；;：:、！？!?]/g," ").replace(/\s+/g," ").trim();}
export function compactMemoryText(text:string){
 const paragraphs:string[]=[],seenParagraphs=new Set<string>(),seenLines=new Set<string>();
 for(const paragraph of text.replace(/\r\n?/g,"\n").split(/\n\s*\n/)){
  const trimmed=paragraph.trim();if(!trimmed)continue;
  const fingerprint=memoryFingerprint(trimmed);if(seenParagraphs.has(fingerprint))continue;seenParagraphs.add(fingerprint);
  const lines:string[]=[];
  for(const rawLine of trimmed.split("\n")){
   const line=rawLine.trim();if(!line)continue;
   const key=memoryFingerprint(line);
   // Short headings (e.g. “联想”) can legitimately label different stories.
   const standalone=key.length>=12||(/[=＝→]/.test(line)&&key.length>=6);
   if(standalone&&seenLines.has(key))continue;
   if(standalone)seenLines.add(key);lines.push(line);
  }
  if(lines.length)paragraphs.push(lines.join("\n"));
 }
 return paragraphs.join("\n\n");
}
export function mergeMemoryTexts(values:string[]){return compactMemoryText(values.filter(Boolean).join("\n\n"));}
export function addMemorySeed(index:Record<string,WordMemory>,word:string,text:string|undefined,source:string){
 const key=wordMemoryKey(word);if(!key||!text?.trim())return;
 const old=Object.hasOwn(index,key)?index[key]:undefined;index[key]={text:mergeMemoryTexts([old?.text??"",text]),revision:0,sources:[...new Set([...(old?.sources??[]),source])]};
}
