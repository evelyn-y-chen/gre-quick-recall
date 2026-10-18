import {studyStorage} from './storage';
import {validLearningPlanDay,type LearningPlanRating} from './learningPlanModel';
import {wordMemoryKey} from '../app/wordMemoryModel';
export const STUDY_ANSWER_PREFIX='lemnota-plan-answer:study-log:';
/** Real word assessments are useful even when no long-term plan exists. */
export function recordStudyAnswers(words:string[],rating:LearningPlanRating,day:string){
 if(!validLearningPlanDay(day)||!['red','yellow','green'].includes(rating))return;
 const rank={red:0,yellow:1,green:2};
 for(const raw of new Set(words)){const id=wordMemoryKey(raw);if(!id||id.length>500||/[\u0000-\u001f\u007f]/.test(id))continue;
  const key=STUDY_ANSWER_PREFIX+encodeURIComponent(id)+':'+day;let old:LearningPlanRating|undefined;try{old=JSON.parse(studyStorage.getItem(key)??'null');}catch{}
  if(!old||!Object.hasOwn(rank,old)||rank[rating]<rank[old])studyStorage.setItem(key,JSON.stringify(rating));
 }
}
