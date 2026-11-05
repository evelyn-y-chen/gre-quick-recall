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
function add(word:string,meaning:string){const key=quizSpelling(word);if(!key||!meaning.trim())return;let values=meanings.get(key);if(!values){values=new Set();meanings.set(key,values);}values.add(meaning);}
for(const source of [vocabulary,aplus,glee,words,pairs,jijing,fill,reading,mathIndex])for(const row of source)add(row.word,row.meaning);
for(const pair of equivalents){add(pair.left,pair.meaning);add(pair.right,pair.meaning);}
for(const group of bb)for(const word of group.words)add(word.word,word.meaning);
for(const word of MATH_WORDS)add(word.term,word.meaning);
/** Static source senses only. Personal notebook text is never loaded here. */
export const quizSenseCatalog:ReadonlyMap<string,ReadonlySet<string>>=meanings;
