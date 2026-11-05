import {isAmbiguousQuizDistractor,areQuizMorphologicalVariants,selectQuizDistractors} from '../app/quizDistractors';
export type Term={id:string;word:string;meaning:string;list:number;synonyms?:string[]};
export type Direction='en-zh'|'zh-en';
export type Choice={word:string;meaning:string;correct:boolean};
export const normalize=(s:string)=>s.trim().toLowerCase().replace(/\s+/g,' ');
export function shuffle<T>(values:T[]):T[]{const out=[...values];for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
export function relatedWords(word:string,links:string[][]){const found=new Set([normalize(word)]);let changed=true;while(changed){changed=false;for(const group of links)if(group.some(w=>found.has(normalize(w))))for(const w of group){const k=normalize(w);if(!found.has(k)){found.add(k);changed=true;}}}return found;}
export function optionsFor(term:Term,pool:Term[],direction:Direction,links:string[][],synonyms=false):Choice[]{
 const blocked=relatedWords(term.word,links);for(const w of term.synonyms??[])blocked.add(normalize(w));
 const answer=synonyms?{word:term.synonyms?.[0]??'',meaning:pool.find(t=>normalize(t.word)===normalize(term.synonyms?.[0]??''))?.meaning??term.meaning,correct:true}:{word:term.word,meaning:term.meaning,correct:true};
 const seen=new Set([normalize(direction==='en-zh'&&!synonyms?answer.meaning:answer.word)]);
 const candidates=selectQuizDistractors(term,shuffle(pool).filter(t=>{const label=normalize(direction==='en-zh'&&!synonyms?t.meaning:t.word);if(!label||seen.has(label)||blocked.has(normalize(t.word))||isAmbiguousQuizDistractor(term,t)||isAmbiguousQuizDistractor(answer,t)||areQuizMorphologicalVariants(answer.word,t.word))return false;seen.add(label);return true;}),synonyms?5:3);
 return shuffle([answer,...candidates.map(t=>({word:t.word,meaning:t.meaning,correct:false}))]);
}
export function refreshPracticeOptions<T extends {queue:string[];phase:string;direction:Direction;options:Choice[];selected:number|null}>(run:T,pool:Term[],links:string[][]):T {
 const term=pool.find(item=>item.id===run.queue[0]);
 if (!term || run.phase==='feedback') return run;
 const related=relatedWords(term.word,links);
 for (const word of term.synonyms??[]) related.add(normalize(word));
 const positives=run.options.filter(option=>option.correct);
 const unsafe=run.options.some((option,index)=>!option.correct&&(run.options.slice(0,index).some(other=>!other.correct&&(isAmbiguousQuizDistractor(other,option)||areQuizMorphologicalVariants(other.word,option.word)))||related.has(normalize(option.word))||isAmbiguousQuizDistractor(term,option)||areQuizMorphologicalVariants(term.word,option.word)||positives.some(answer=>isAmbiguousQuizDistractor(answer,option)||areQuizMorphologicalVariants(answer.word,option.word))));
 return unsafe?{...run,options:optionsFor(term,pool,run.direction,links,run.phase==='synonym'),selected:null}:run;
}
export type Result={streak:number;errors:number;done:boolean};
export function grade(previous:Result|undefined,correct:boolean):Result{const errors=(previous?.errors??0)+(correct?0:1),streak=correct?(previous?.streak??0)+1:0;return {streak,errors,done:correct&&(errors===0||streak>=2)};}

export function answerStep(phase:'meaning'|'synonym',pair:boolean,correct:boolean,meaningOK:boolean){
 if(phase==='meaning'&&pair&&correct)return {phase:'synonym' as const,meaningOK:true,correct:false,feedbackStep:'meaning' as const};
 return {phase:'feedback' as const,meaningOK:phase==='meaning'?correct:meaningOK,correct:correct&&(phase==='meaning'||meaningOK),feedbackStep:phase};
}
