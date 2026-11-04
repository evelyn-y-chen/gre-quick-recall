type QuizWord={word:string;meaning:string};
const spelling=(word:string)=>word.normalize("NFKC").trim().toLowerCase().replace(/[\s‐‑–—]+/g,"-");
// Exclusion pairs are semantically overlapping or easy to misread in this quiz;
// they are never added to the set of correct synonyms.
const confusablePairs=[new Set(["synonymous","like-minded"]),new Set(["fusty","platitudinous"])];
export function areQuizWordsConfusable(a:string,b:string) {
  const left=spelling(a),right=spelling(b);
  return left===right || confusablePairs.some(pair=>pair.has(left)&&pair.has(right));
}
// Broad study senses are exclusions only, not assertions of interchangeability.
const meaningFamilies=[
 ['明显','显而易见','显然','显著','清楚','清晰','明确'],['无害','没有危害','无危害'],
 ['陈腐','陈旧','过时','老套','平庸','平凡','陈词滥调'],['减少','减小','减弱','削弱','降低','缩减','减轻','缓和'],
 ['增加','增大','增强','加强','强化','加剧'],['丰富','充足','充裕','大量','众多','繁多'],
 ['稀少','缺乏','不足','匮乏','短缺'],['简洁','简明','简短','言简意赅'],['冗长','啰嗦','罗嗦','繁冗'],
 ['赞美','赞扬','称赞','颂扬','褒扬'],['批评','指责','责备','谴责','斥责'],
 ['反对','反抗','抵制','抗拒'],['支持','赞同','赞成','认可'],['阻碍','妨碍','阻挠','阻止'],
 ['促进','促使','推动'],['模糊','含糊','朦胧','不明确','不清楚'],
 ['短暂','短促','转瞬即逝','稍纵即逝'],['持久','长久','永久','永恒'],
 ['谨慎','小心','审慎','慎重'],['轻率','鲁莽','莽撞','草率'],
 ['勤奋','勤勉','勤劳','刻苦'],['懒惰','怠惰','懒散'],['诚实','正直','坦诚','真诚'],
 ['欺骗','欺诈','蒙骗','哄骗'],['虚伪','虚假','不真诚'],['傲慢','自大','自负','狂妄'],
 ['谦虚','谦逊','谦卑'],['顽固','固执','执拗','倔强'],['愤怒','愤慨','恼怒'],
 ['镇静','冷静','沉着','平静'],['害怕','恐惧','畏惧','恐慌'],['快乐','高兴','愉快','喜悦'],
 ['悲伤','悲痛','忧伤','哀伤'],['冷漠','漠然','无动于衷'],['热情','热忱','热心'],
 ['荒谬','荒唐','可笑'],['聪明','聪慧','机智','睿智'],['愚蠢','愚笨','笨拙'],
 ['慷慨','大方','不吝啬'],['吝啬','小气','悭吝'],['秘密','隐秘','隐蔽','隐匿'],
 ['相同','一致','同样','等同','相等'],['相似','类似','相像'],['重要','重大','关键','至关重要'],
 ['无关紧要','不重要','微不足道','琐碎'],['奇怪','古怪','怪异','离奇'],
 ['合适','适合','适当','恰当'],['偏见','偏心','偏袒'],['公正','公平','不偏不倚'],
 ['收集','搜集','聚集','集合'],['放弃','抛弃','舍弃'],['解释','阐明','说明'],
];
const meaningAliases=new Map(meaningFamilies.flatMap(group=>group.map(sense=>[sense,group[0]] as const)));
export function quizMeaningKeys(meaning:string) {
  return new Set(meaning.normalize("NFKC").replace(/【[^】]*】/g,"").replace(/[（(][^）)]*[）)]/g,"")
    .split(/[\n;/、，,；|]/).map(part=>part.trim()
      .replace(/^(?:(?:(?:adj|adv|vt|vi|v|n|a|prep|conj|pron)\.\s*)|(?:(?:形容词|副词|动词|名词|及物动词|不及物动词)\s*[:：]?\s*))+/i,"")
      .replace(/^(?:非常|十分|极其|相当|比较|稍微)/,"").replace(/[的地性]$/g,"").toLowerCase().replace(/[\s.。…·:：]/g,""))
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
 const suffixes=["s","es","ed","ing","ly","ness","ment","ments","ity","ities","ive","ance","ances","ence","ences","ent","ant","ion","tion","sion","ation","ition","ization","isation","ize","ise","ify","ous","al","ic","ical","able","ible","ful","less"];
 for(const suffix of suffixes)if(value.endsWith(suffix)&&value.length-suffix.length>=4){
  const base=value.slice(0,-suffix.length);add(base);
  if(suffix==="ed"||suffix==="ing"){
   add(base+"e");
   if(/([b-df-hj-np-tv-z])\1$/.test(base))add(base.slice(0,-1));
  }
 }
 for(const [suffix,replacement] of [["ies","y"],["ied","y"],["ily","y"],["iness","y"],["ility","le"],["ivity","ive"],["osity","ous"],["iety","e"],["ity","e"],["cy","t"],["acy","ate"],["iation","y"],["sion","de"],["ation","e"],["ication","y"],["able","e"],["ive","e"]])if(value.endsWith(suffix))add(value.slice(0,-suffix.length)+replacement);
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
