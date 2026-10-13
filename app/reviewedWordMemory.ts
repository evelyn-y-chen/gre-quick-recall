import edits from "./wordMemoryEdits.json";
// Editorial revisions are tied to the exact reviewed paragraphs. This is not
// fuzzy matching: modified text, numbers, negation and new notes stay intact.
const key=(text:string)=>text.normalize("NFC").replace(/\s+/g," ").trim();
type Edit={original:string;text:string};
const rules:Record<string,Edit>=edits;
export function simplifyReviewedMemory(word:string,text:string){
 const name=word.normalize("NFC").trim().toLowerCase().replace(/\s+/g," ");
 if(!Object.hasOwn(rules,name)||!text.trim())return text;
 const rule=rules[name];
 const original=rule.original.split(/\n\s*\n/).map(key).filter(Boolean);
 const blocks=text.split(/\n\s*\n/),present=new Set(blocks.map(key));
 if(!original.every(block=>present.has(block)))return text;
 const reviewed=new Set(original);let inserted=false;
 return blocks.flatMap(block=>{
  if(!reviewed.has(key(block)))return [block];
  if(inserted)return [];
  inserted=true;return [rule.text];
 }).join("\n\n");
}
