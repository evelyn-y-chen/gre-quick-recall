import {studyStorage} from './storage';
import {COMPLETIONS,TESTED_WORDS} from './personalProgressModel';
export function recordCompletedPractice(id:string,module:string){try{const old=JSON.parse(studyStorage.getItem(COMPLETIONS)??'{}');const records=old&&typeof old==='object'&&!Array.isArray(old)?old:{};if(!records[id])studyStorage.setItem(COMPLETIONS,JSON.stringify({...records,[id]:{module,completedAt:new Date().toISOString()}}));}catch{}}

export function recordPracticeWords(words:string[],module:string){try{const old=JSON.parse(studyStorage.getItem(TESTED_WORDS)??'{}');const records=old&&typeof old==='object'&&!Array.isArray(old)?old:{};const current={...records[module]};let changed=false;for(const word of words){const key=word.trim().toLowerCase().replace(/\s+/g,' ');if(key&&current[key]!==true){current[key]=true;changed=true;}}if(changed)studyStorage.setItem(TESTED_WORDS,JSON.stringify({...records,[module]:current}));}catch{}}
export function recordPracticeWord(word:string,module:string){recordPracticeWords([word],module);}
