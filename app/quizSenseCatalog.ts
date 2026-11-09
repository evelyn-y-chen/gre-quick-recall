import {qingshanDecks} from './qingshanCatalog';
import vocabulary from './vocabulary.json';
import equivalents from './equivalents.json';
import aplus from './aPlusEquivalents.json';
import bb from './bbEquivalents.json';
import glee from './glee1500.json';
import words from './zhangWords.json';
import pairs from './zhangPairs.json';
import jijing from './zhangJijing.json';
import fill from './lcljFill.json';
import reading from './lcljReading.json';
import mathIndex from './lcljMath.json';
import {MATH_WORDS} from './mathVocabulary';

export const quizSpelling=(word:string)=>word.normalize('NFKC').trim().toLowerCase().replace(/[\s‐‑–—]+/g,'-');
const meanings=new Map<string,Set<string>>();
export type QuizPartOfSpeech='adj'|'adv'|'n'|'v'|'prep'|'conj'|'pron';
const partsOfSpeech=new Map<string,Set<QuizPartOfSpeech>>();
export function quizPosLabels(text:string):Set<QuizPartOfSpeech>{
 const result=new Set<QuizPartOfSpeech>(),value=text.normalize('NFKC').toLowerCase();
 for(const match of value.matchAll(/\b(adj|adv|n|vt|vi|v|a|prep|conj|pron)\s*\./g))result.add((match[1]==='a'?'adj':match[1]==='vt'||match[1]==='vi'?'v':match[1]) as QuizPartOfSpeech);
 for(const [label,pos] of [['形容词','adj'],['副词','adv'],['名词','n'],['动词','v'],['介词','prep'],['连词','conj'],['代词','pron']] as const)if(value.includes(label))result.add(pos);
 return result;
}
function addPos(word:string,...labels:(string|undefined)[]){
 const key=quizSpelling(word),values=partsOfSpeech.get(key)??new Set<QuizPartOfSpeech>();for(const label of labels)if(label)for(const pos of quizPosLabels(label))values.add(pos);if(values.size)partsOfSpeech.set(key,values);
}
for(const row of vocabulary)addPos(row.word,row.pos,row.meaning);
for(const source of [aplus,glee,words,pairs,jijing,fill,reading,mathIndex])for(const row of source)addPos(row.word,row.meaning,'english' in row?row.english:undefined);
for(const deck of Object.values(qingshanDecks))for(const row of deck.entries)addPos(row.word,row.meaning,row.commonMeaning);
for(const group of bb)for(const row of group.words)addPos(row.word,row.meaning);
export function quizWordPartsOfSpeech(term:{word:string;meaning:string;pos?:string}):ReadonlySet<QuizPartOfSpeech>{
 const explicit=quizPosLabels((term.pos??'')+' '+term.meaning);if(explicit.size)return explicit;
 const known=partsOfSpeech.get(quizSpelling(term.word))??new Set<QuizPartOfSpeech>();
 if(known.has('adj')&&/的(?:[；;，,、]|$)/.test(term.meaning))return new Set(['adj']);
 return known;
}
function add(word:string,meaning:string){const key=quizSpelling(word);if(!key||!meaning.trim())return;let values=meanings.get(key);if(!values){values=new Set();meanings.set(key,values);}values.add(meaning);}
for(const source of [vocabulary,aplus,glee,words,pairs,jijing,fill,reading,mathIndex])for(const row of source)add(row.word,row.meaning);
for(const deck of Object.values(qingshanDecks))for(const row of deck.entries){add(row.word,row.meaning);add(row.word,row.commonMeaning);}
for(const pair of equivalents){add(pair.left,pair.meaning);add(pair.right,pair.meaning);}
for(const group of bb)for(const word of group.words)add(word.word,word.meaning);
for(const word of MATH_WORDS)add(word.term,word.meaning);
/** Static source senses only. Personal notebook text is never loaded here. */
export const quizSenseCatalog:ReadonlyMap<string,ReadonlySet<string>>=meanings;

// Source equivalence groups are exclusions for *all* decks, even where the two
// printed Chinese glosses differ. They do not create new correct-answer pairs.
const equivalentGroups:ReadonlySet<string>[]=[],memberships=new Map<string,Set<number>>();
function equivalentGroup(values:string[]){
 const group=new Set(values.map(quizSpelling).filter(word=>/^[a-z][a-z'\s-]*$/.test(word)));
 if(group.size<2)return;const id=equivalentGroups.push(group)-1;
 for(const word of group){let ids=memberships.get(word);if(!ids){ids=new Set();memberships.set(word,ids);}ids.add(id);}
}
for(const row of equivalents)equivalentGroup([row.left,row.right]);
for(const row of aplus)equivalentGroup([row.word,...row.equivalents]);
for(const group of bb)equivalentGroup(group.words.map(row=>row.word));
for(const row of [...words,...pairs,...jijing])equivalentGroup([row.word,...(row.synonyms??'').split(/[,，;；=＝\n]/)]);
export function areKnownQuizEquivalents(a:string,b:string){
 const left=quizSpelling(a),right=quizSpelling(b);if(left===right)return true;
 for(const id of memberships.get(left)??[])if(equivalentGroups[id].has(right))return true;
 return false;
}
