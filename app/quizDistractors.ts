type QuizWord={word:string;meaning:string};
const spelling=(word:string)=>word.normalize("NFKC").trim().toLowerCase().replace(/[\s‐‑–—]+/g,"-");
// Exclusion pairs are semantically overlapping or easy to misread in this quiz;
// they are never added to the set of correct synonyms.
const confusablePairs=[new Set(["synonymous","like-minded"]),new Set(["fusty","platitudinous"])];
export function areQuizWordsConfusable(a:string,b:string) {
  const left=spelling(a),right=spelling(b);
  return left===right || confusablePairs.some(pair=>pair.has(left)&&pair.has(right));
}
const meaningAliases=new Map([
  ["显而易见","明显"],["显然","明显"],
  ["没有危害","无害"],["无危害","无害"],
]);
export function quizMeaningKeys(meaning:string) {
  return new Set(meaning.normalize("NFKC").replace(/【[^】]*】/g,"").replace(/[（(][^）)]*[）)]/g,"")
    .split(/[\n;/、，,；|]/).map(part=>part.trim()
      .replace(/^(?:(?:(?:adj|adv|vt|vi|v|n|a|prep|conj|pron)\.\s*)|(?:(?:形容词|副词|动词|名词|及物动词|不及物动词)\s*[:：]?\s*))+/i,"")
      .replace(/[的地]$/g,"").toLowerCase().replace(/[\s.。…·:：]/g,""))
    .map(part=>meaningAliases.get(part)??part).filter(part=>part.length>=2));
}
/** Exclude alternatives with an already-correct sense; never turn them into synonyms. */
export function isAmbiguousQuizDistractor(answer:QuizWord,candidate:QuizWord) {
  if (areQuizWordsConfusable(answer.word,candidate.word)) return true;
  const senses=quizMeaningKeys(answer.meaning);
  return [...quizMeaningKeys(candidate.meaning)].some(sense=>senses.has(sense));
}

/** Exact regular family forms only: closeness itself is not morphological evidence. */
function morphologicalForms(word:string):Set<string>{
 const value=spelling(word),forms=new Set([value]);
 if(!/^[a-z]+$/.test(value))return forms;
 const add=(form:string)=>{if(form.length>=4)forms.add(form);};
 const suffixes=["s","es","ed","ing","ly","ness","ment","ments","ity","ities","ive","ance","ances","ence","ences","ent","ant","ion","tion","sion","ation","ition","ization","isation","ize","ise","ify"];
 for(const suffix of suffixes)if(value.endsWith(suffix)&&value.length-suffix.length>=4){
  const base=value.slice(0,-suffix.length);add(base);
  if(suffix==="ed"||suffix==="ing"){
   add(base+"e");
   if(/([b-df-hj-np-tv-z])\1$/.test(base))add(base.slice(0,-1));
  }
 }
 for(const [suffix,replacement] of [["ies","y"],["ied","y"],["ily","y"],["iness","y"],["ility","le"],["ivity","ive"],["osity","ous"]])if(value.endsWith(suffix))add(value.slice(0,-suffix.length)+replacement);
 return forms;
}
export function areQuizMorphologicalVariants(a:string,b:string){
 const left=morphologicalForms(a),right=morphologicalForms(b);
 return [...left].some(form=>right.has(form));
}
function editDistanceWithinThree(left:string,right:string){
 if(Math.abs(left.length-right.length)>3)return 4;
 let previous=Array.from({length:right.length+1},(_,index)=>index);
 for(let i=1;i<=left.length;i++){
  const current=[i];let minimum=i;
  for(let j=1;j<=right.length;j++){
   const value=Math.min(current[j-1]+1,previous[j]+1,previous[j-1]+Number(left[i-1]!==right[j-1]));
   current[j]=value;minimum=Math.min(minimum,value);
  }
  if(minimum>3)return 4;
  previous=current;
 }
 return previous[right.length];
}
/** Prefer safe lookalikes; shuffled input order breaks ties and supplies fallbacks. */
export function rankQuizDistractors<T extends QuizWord>(answer:T,candidates:T[]):T[]{
 const answerSpelling=spelling(answer.word);
 return candidates.filter(candidate=>!isAmbiguousQuizDistractor(answer,candidate)&&!areQuizMorphologicalVariants(answer.word,candidate.word))
  .map((candidate,index)=>{
   const candidateSpelling=spelling(candidate.word),distance=editDistanceWithinThree(answerSpelling,candidateSpelling);
   const close=distance>0&&distance<=3&&distance/Math.max(answerSpelling.length,candidateSpelling.length)<=.4;
   return {candidate,index,close,distance};
  }).sort((a,b)=>Number(b.close)-Number(a.close)||(a.close&&b.close?a.distance-b.distance:0)||a.index-b.index).map(item=>item.candidate);
}
