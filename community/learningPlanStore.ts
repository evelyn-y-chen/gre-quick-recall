import {readPlanChecks} from './planTaskChecks';
import {selectPlannedLists} from './listLearningPlanModel';
import {exportStorage,studyStorage} from './storage';
import {exportWorkspace} from './database';
import {createLearningPlan,loadLearningPlan,recordLearningPlanAnswer,validLearningPlanDay,type LearningPlanConfig,type LearningPlanRating,type LearningPlanState} from './learningPlanModel';
import {getLearningPlanCatalog,getPlanRatingWords,selectPlanWords} from './learningPlanCatalog';
import {wordMemoryKey} from '../app/wordMemoryModel';
import {reviewDay} from './practiceReviewModel';
import type {Ratings} from '../app/ratingSyncModel';
export const LEARNING_PLAN_KEY='lemnota-learning-plan-v1';
export const PLAN_ANSWER_PREFIX='lemnota-plan-answer:';
export function planAnswerKey(planId:string,wordId:string,day:string){return `${PLAN_ANSWER_PREFIX}${planId}:${encodeURIComponent(wordId)}:${day}`;}
export function readLearningPlanStore(storage=exportStorage()):LearningPlanState|null{
 const raw=storage[LEARNING_PLAN_KEY];if(!raw)return null;
 try{
  const settings=JSON.parse(raw),prefix=`${PLAN_ANSWER_PREFIX}${settings.config?.id}:`,answers:LearningPlanState['answers']=Object.create(null);
  for(const [key,value] of Object.entries(storage))if(key.startsWith(prefix)){
   const suffix=key.slice(prefix.length),split=suffix.lastIndexOf(':');if(split<0)continue;
   try{const encoded=suffix.slice(0,split),word=decodeURIComponent(encoded),day=suffix.slice(split+1);if(!word||word.length>500||/[\u0000-\u001f\u007f]/.test(word)||encodeURIComponent(word)!==encoded||!validLearningPlanDay(day))continue;
    const rating=JSON.parse(value);if(rating==='red'||rating==='yellow'||rating==='green')(answers[word]??={})[day]=rating;
   }catch{}
  }
  const result=loadLearningPlan(JSON.stringify({...settings,answers}));if(result){const extra=readPlanChecks(storage,result.config.id);result.studied=extra.studied;result.taskChecks=extra.checks;}return result;
 }catch{return null;}
}
export function readPlanBaseline():string|null{
 try{const saved=JSON.parse(studyStorage.getItem(LEARNING_PLAN_KEY)??'null');return validLearningPlanDay(saved?.baselineFirstPassDay)?saved.baselineFirstPassDay:null;}catch{return null;}
}
export function saveLearningPlanSettings(config:LearningPlanConfig,paused=false,baselineFirstPassDay:string|null=null){
 const checked=createLearningPlan(config);
 studyStorage.setItem(LEARNING_PLAN_KEY,JSON.stringify({version:1,config:checked.config,paused,baselineFirstPassDay}));
}
export function pauseLearningPlan(paused:boolean){
 const raw=studyStorage.getItem(LEARNING_PLAN_KEY);if(!raw)return;
 const current=readLearningPlanStore();if(!current)throw Error('学习计划暂时无法读取，请先导出便笺留底。');
 studyStorage.setItem(LEARNING_PLAN_KEY,JSON.stringify({...JSON.parse(raw),paused}));
}
/** Real daily answers are separate keys so two devices can merge different words. */
let staticCatalog:ReturnType<typeof getLearningPlanCatalog>|undefined;
export function recordLearningPlanWords(words:string[],rating:LearningPlanRating,today=reviewDay(),notebookWords:string[]=[]){
 let state=readLearningPlanStore();if(!state||state.paused||today<state.config.startDay)return false;
 const catalog=state.config.deckIds.includes("notebook")?getLearningPlanCatalog(exportWorkspace()):(staticCatalog??=getLearningPlanCatalog());
 const scoped=new Set(selectPlannedLists(catalog.words,state.config).flatMap(u=>u.words.map(w=>w.id)));
 const selected=selectPlanWords(catalog.words,state.config.deckIds).filter(w=>scoped.has(w.id));
 const ids=[...new Set([...selected.map(w=>w.id),...(state.config.deckIds.includes("notebook")?notebookWords.map(wordMemoryKey):[])])],known=new Set(ids);let changed=false;
 for(const raw of new Set(words)){
  const id=wordMemoryKey(raw);if(!known.has(id))continue;
  const next=recordLearningPlanAnswer(state,ids,id,rating,today),value=next.answers[id]?.[today];
  if(value&&value!==state.answers[id]?.[today]){studyStorage.setItem(planAnswerKey(state.config.id,id,today),JSON.stringify(value));changed=true;}
  state=next;
 }
 return changed;
}
export function recordLearningPlanWord(state:LearningPlanState,wordIds:string[],wordId:string,rating:LearningPlanRating,today=reviewDay()){
 const current=readLearningPlanStore();if(!current||current.config.id!==state.config.id||JSON.stringify(current.config.deckIds)!==JSON.stringify(state.config.deckIds))throw Error('学习计划已切换，请在当前学习空间重新操作。');
 const next=recordLearningPlanAnswer(current,wordIds,wordId,rating,today),value=next.answers[wordId]?.[today];
 if(value&&value!==current.answers[wordId]?.[today])studyStorage.setItem(planAnswerKey(state.config.id,wordId,today),JSON.stringify(value));
 return next;
}
export function recordLearningPlanRatings(module:string,changes:Ratings){
 const state=readLearningPlanStore();if(!state||state.paused)return;
 const grouped:Record<LearningPlanRating,string[]>={red:[],yellow:[],green:[]};
 for(const [id,value] of Object.entries(changes))grouped[value==='familiar'?'green':value==='fuzzy'?'yellow':'red'].push(...getPlanRatingWords(module,id));
 for(const rating of ['red','yellow','green'] as const)if(grouped[rating].length)recordLearningPlanWords(grouped[rating],rating);
}
