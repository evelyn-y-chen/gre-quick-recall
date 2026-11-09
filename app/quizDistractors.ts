import {quizSenseCatalog,quizSpelling,areKnownQuizEquivalents,quizWordPartsOfSpeech} from './quizSenseCatalog';
type QuizWord={word:string;meaning:string};
const spelling=quizSpelling;
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
 ['令人不快','令人不愉快','不愉快','不快','恶心','恶心做作','作呕','反胃','反感','令人作呕','令人厌恶','厌恶','令人讨厌','讨厌','令人厌烦','厌烦','难吃','难闻','恶臭','刺鼻','难以下咽','倒胃口','腻味'],
 ['恶意','恶毒','恶性','邪恶','狠毒','歹毒','阴险','险恶','怨恨','憎恨','仇恨','敌意','诋毁','污蔑','诽谤','中伤','贬损','贬低','诬蔑','诬陷','说坏话'],
 ['有害','危害','伤害','损害','损伤','损坏','破坏','摧毁','毁灭','有毒','毒害'],
 ['脆弱','易受影响','易受伤害','易受感染','易受攻击','易损坏'],
 ['装病','诈病','佯病'],['天真','单纯','不世故','质朴','朴实'],
 ['做作','矫揉造作','装腔作势','故作姿态','装模作样'],
 ['伤感','多愁善感','感伤','过度伤感'],['机敏','敏锐','敏捷','灵敏'],
 ['焦虑','忧虑','担忧','担心','不安'],['尴尬','窘迫','羞愧','羞耻','惭愧'],
 ['无礼','粗鲁','粗暴','粗俗','不礼貌','失礼'],['礼貌','彬彬有礼','有礼','文雅'],
 ['温和','温柔','和蔼','和善','友善','友好','亲切'],['好斗','争强好胜','挑衅','咄咄逼人'],
 ['冷淡','冷漠','漠不关心'],['勤俭','节俭','俭朴','节约'],
 ['浪费','挥霍','奢侈','铺张'],['谨小慎微','小心谨慎','谨慎','审慎'],
 ['精确','准确','精准','精密'],['错误','有误','不正确','失误'],
 ['真实','真切','真正','如实'],['虚假','虚构','捏造','伪造','虚伪','虚幻'],
 ['偏离','偏差','背离','偏移'],['不正常','反常','异常','畸形'],
 ['恰当','合宜','适宜','适当'],['中立','客观','不偏不倚','公正'],
 ['多样','多种多样','各式各样','形形色色','多元'],['单调','乏味','无聊','枯燥'],
 ['复杂','错综复杂','繁杂','复杂难懂'],['简单','简易','容易','轻松'],
 ['困难','艰难','艰巨','艰辛','费力','难以实现'],['勤奋','刻苦','努力','用功'],
 ['缓慢','迟缓','迟钝','缓缓'],['迅速','快速','飞快','急速','急剧'],
 ['犹豫','迟疑','踌躇','举棋不定'],['果断','坚决','决断'],
 ['强硬','严厉','严苛','苛刻','苛严'],['宽容','宽厚','宽宏大量','宽大','宽恕','原谅'],
 ['劝说','劝服','说服','劝导'],['安慰','慰藉','抚慰','安抚'],
 ['激怒','惹怒','使恼怒','使愤怒','使生气'],['惩罚','处罚','惩戒','惩处'],
 ['赞美','欣赏','赞赏','赞誉','赞扬'],['轻视','藐视','鄙视','蔑视','看不起'],
 ['隐藏','隐瞒','掩盖','掩饰','遮掩','遮蔽'],['揭露','暴露','揭示','披露'],
 ['削弱','缓解','舒缓','减轻','缓和'],['拒绝','回绝','否决','否认'],
 ['结束','终结','终止','停止','中止'],['开始','开端','起始','发端'],
 ['恢复','复原','康复','修复','修补','修缮'],['改善','改进','完善','提高','提升'],
 ['模仿','仿效','效仿','模拟','仿造'],['推测','猜测','猜想','揣测','臆测','假设'],
 ['预测','预言','预示','预兆'],['怀疑','质疑','疑虑','不信任'],
 ['确信','确定','肯定','深信','坚信'],['有利','有益','有益处','有帮助'],
 ['必要','必需','不可或缺','必不可少'],['不必要','多余','冗余','可有可无'],
 ['琐碎','细枝末节','微小','细微','细小','渺小'],['广泛','广阔','宽广','广大','广博'],
 ['孤立','隔离','疏远','隔绝'],['紧密','密切','亲密','紧凑'],
 ['顺从','服从','听从','屈服','驯服'],['反抗','叛逆','叛乱','造反'],
 ['安静','寂静','沉默','缄默','默不作声'],['嘈杂','喧闹','吵闹','喧嚣'],
 ['傲慢','骄傲','高傲','自大','自负'],['绝望','无望','不抱希望'],
 ['成功','成就','成果','建树'],['失败','挫败','失利'],
 ['热心','热切','渴望','热望','切望','急切'],
 ['变化','变动','改变','变幻','易变','多变','动态','不稳定','不稳','波动','反复无常','变化莫测','变幻莫测'],
 ['活力','活跃','活泼','精力充沛','生机勃勃','充满生气','充满活力'],
 ['持续','连续','不间断','不断进行','进行中','延续','连贯'],

];
const meaningAliases=new Map(meaningFamilies.flatMap(group=>group.map(sense=>[sense,group[0]] as const)));
const cacheLimit=6000,meaningCache=new Map<string,ReadonlySet<string>>(),wordCache=new Map<string,ReadonlySet<string>>();
function remember(cache:Map<string,ReadonlySet<string>>,key:string,value:ReadonlySet<string>){if(cache.size>=cacheLimit)cache.delete(cache.keys().next().value!);cache.set(key,value);return value;}
// Match a sense inside a longer gloss, while preserving explicit negation.
function containsSense(part:string,sense:string){
 for(let at=part.indexOf(sense);at>=0;at=part.indexOf(sense,at+1)){
  const before=part.slice(0,at);
  if(!/(?:不|非|无|未|没|没有|并非|难以)(?:太|够|很|完全|那么|十分|特别|容易|易于)*$/.test(before))return true;
 }
 return false;
}
function meaningKeys(meaning:string):ReadonlySet<string>{
 const cached=meaningCache.get(meaning);if(cached)return cached;
 const parts=meaning.normalize("NFKC").replace(/【[^】]*】/g,"").replace(/[（(][^）)]*[）)]/g,"")
  .split(/[\n;/、，,；|]/).map(part=>part.trim()
   .replace(/^(?:[①-⑳\d]+[.)、]?\s*|(?:(?:adj|adv|vt|vi|v|n|a|prep|conj|pron|phrase)\.\s*)|(?:(?:形容词|副词|动词|名词|及物动词|不及物动词)\s*[:：]?\s*))+/i,"")
   .replace(/^(?:非常|十分|极其|极为|相当|比较|稍微|较为|过于|过分)+/,"")
   .replace(/[的地]$/g,"").replace(/([\u4e00-\u9fff]{2,})性$/,"$1").toLowerCase().replace(/[\s.。…·:：]/g,"")).filter(part=>part.length>=2);
 const keys=new Set(parts.map(part=>meaningAliases.get(part)??part));
 for(const part of parts)for(const group of meaningFamilies)if(group.some(sense=>containsSense(part,sense)))keys.add(group[0]);
 return remember(meaningCache,meaning,keys);
}
export function quizMeaningKeys(meaning:string){return new Set(meaningKeys(meaning));}
function wordMeaningKeys(term:QuizWord):ReadonlySet<string>{
 const word=spelling(term.word),key=word+'\0'+term.meaning,cached=wordCache.get(key);if(cached)return cached;
 const keys=new Set(meaningKeys(term.meaning));
 for(const meaning of quizSenseCatalog.get(word)??[])for(const sense of meaningKeys(meaning))keys.add(sense);
 return remember(wordCache,key,keys);
}
/** Exclude any overlapping known sense, including senses recorded in another deck. */
export function isAmbiguousQuizDistractor(answer:QuizWord,candidate:QuizWord){
 if(areQuizWordsConfusable(answer.word,candidate.word)||areKnownQuizEquivalents(answer.word,candidate.word))return true;
 const left=wordMeaningKeys(answer),right=wordMeaningKeys(candidate);
 for(const sense of right)if(left.has(sense))return true;
 // A gloss can describe the same idea with an extra qualifier, e.g. 恶心做作.
 for(const a of left)for(const b of right)if(/[\u4e00-\u9fff]{2}/.test(a)&&/[\u4e00-\u9fff]{2}/.test(b)&&((a.length<b.length&&containsSense(b,a))||(b.length<a.length&&containsSense(a,b))))return true;
 return false;
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
 for(const [suffix,replacement] of [["ies","y"],["ied","y"],["ily","y"],["iness","y"],["ility","le"],["ivity","ive"],["osity","ous"],["iety","e"],["ity","e"],["cy","t"],["acy","ate"],["iation","y"],["sion","de"],["ation","e"],["ication","y"],["able","e"],["ive","e"],["ious","e"],["ancy","ant"],["ency","ent"]])if(value.endsWith(suffix))add(value.slice(0,-suffix.length)+replacement);
 return forms;
}
export function quizMorphologyKeys(word:string){return morphologicalForms(word);}
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

/** Keep selected wrong answers distinct from one another as well as the target. */
export function isQuizPosMismatch(answer:QuizWord,candidate:QuizWord){
 const pos=quizWordPartsOfSpeech(answer),other=quizWordPartsOfSpeech(candidate);
 return !!pos.size&&!!other.size&&![...pos].some(value=>other.has(value));
}
export function rankQuizPosDistractors<T extends QuizWord>(answer:T,candidates:T[]):T[]{
 const pos=quizWordPartsOfSpeech(answer);
 const ranked=rankQuizDistractors(answer,candidates).map((candidate,index)=>{
  const other=quizWordPartsOfSpeech(candidate),matches=[...pos].some(value=>other.has(value));return {candidate,index,matches,wrongPos:!!pos.size&&!!other.size&&!matches};
 }).filter(item=>!item.wrongPos).sort((a,b)=>Number(b.matches)-Number(a.matches)||a.index-b.index);
 return ranked.map(item=>item.candidate);
}
export function selectQuizDistractors<T extends QuizWord>(answer:T,candidates:T[],count:number):T[]{
 if(count<=0)return [];
 const selected:T[]=[];
 for(const candidate of rankQuizPosDistractors(answer,candidates)){
  if(selected.some(other=>isAmbiguousQuizDistractor(other,candidate)||areQuizMorphologicalVariants(other.word,candidate.word)))continue;
  selected.push(candidate);if(selected.length>=count)break;
 }
 return selected;
}
