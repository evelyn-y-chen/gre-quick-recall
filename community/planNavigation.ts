import type {PlannedList} from './listLearningPlanModel';
export type PlanNavigation={id:string;deckId:string;list?:number;volume?:string;category?:string;batchId?:string;method?:'self'|'test'};
export function planNavigation(unit:PlannedList,id:string):PlanNavigation{
 const source=unit.words.flatMap(w=>w.occurrences).find(o=>o.deckId===unit.deckId);
 return {id,deckId:unit.deckId,list:source?.list,volume:source?.volume,category:source?.category,batchId:source?.groupId};
}
