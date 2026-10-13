import type {Session} from "./aPlusTestModel";
export const REVIEW_INTERVALS=[1,2,4,7,15,30];
export type ReviewRecord={level:number;due:string;lastDay:string;reviews:number;retryWords:string[]};
export type ReviewHistory=Record<string,ReviewRecord>;
export function reviewDay(now=new Date()){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);}
export function addDays(day:string,n:number){return new Date(Date.parse(day+"T00:00:00Z")+n*86400000).toISOString().slice(0,10);}
export function readReviewHistory(session:(Session&{reviewHistory?:ReviewHistory})|null,today=reviewDay()):ReviewHistory{
 if(session?.reviewHistory)return session.reviewHistory;
 // Legacy snapshots have no trustworthy answer dates: make their tested words due now.
 return Object.fromEntries(Object.entries(session?.progress??{}).filter(([,p])=>p.attempts>0).map(([id,p])=>[id,{level:0,due:today,lastDay:"",reviews:0,retryWords:p.retryWords??[]} ]));
}
export function updateReviewHistory(history:ReviewHistory,previous:Session|null,next:Session,today=reviewDay()):ReviewHistory{
 const result={...history};
 for(const id of next.order){
  const p=next.progress[id],before=previous?.id===next.id?previous.progress[id]:undefined;
  if(!p.attempts||p.attempts<=(before?.attempts??0))continue;
  const old=result[id];
  // Any failure since the last saved snapshot counts, even if the UI already advanced.
  const sum=(values:Record<string,number>)=>Object.values(values).reduce((a,b)=>a+b,0);
  const failed=p.meaningErrors>(before?.meaningErrors??0)||sum(p.missed)>sum(before?.missed??{})||sum(p.extra)>sum(before?.extra??{});
  const advance=!!old&&old.lastDay!==today&&old.due<=today&&!failed&&p.done;
  const level=failed?0:advance?Math.min(old.level+1,REVIEW_INTERVALS.length-1):old?.level??0;
  const due=failed||!old||advance?addDays(today,REVIEW_INTERVALS[level]):old.due<=today?addDays(today,1):old.due;
  result[id]={level,due,lastDay:today,reviews:(old?.reviews??0)+p.attempts-(before?.attempts??0),retryWords:p.retryWords??[]};
 }
 return result;
}
export function dueReviewIds(history:ReviewHistory,today=reviewDay()){return Object.keys(history).filter(id=>history[id].due<=today).sort((a,b)=>history[a].due.localeCompare(history[b].due)||a.localeCompare(b));}

