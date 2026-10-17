import {recordCompletedPractice,recordPracticeWord} from './practiceCompletions';
import {recordLearningPlanWords} from './learningPlanStore';
import {trackUsage} from './analytics';
import * as mindMap from '../app/api/mind-map/route';
import * as memory from '../app/api/word-memory/route';
import * as ratings from '../app/api/quick-ratings/route';
import * as notebook from '../app/api/notebook/route';
import * as test from '../app/api/a-plus-test/route';
import {byId as aPlusById} from '../app/aPlusTestModel';
import * as notes from '../app/api/a-plus-notes/route';
const routes:Record<string,any>={'/api/mind-map':mindMap,'/api/word-memory':memory,'/api/quick-ratings':ratings,'/api/notebook':notebook,'/api/a-plus-test':test,'/api/a-plus-notes':notes};
let queue=Promise.resolve();let generation=0;
export function getWorkspaceGeneration(){return generation;}
export async function awaitWorkspaceApiIdle(){await queue;}
export async function switchWorkspace(task:()=>Promise<void>){generation++;const pending=queue.then(task);queue=pending.catch(()=>{});return pending;}
export function appFetch(input:RequestInfo|URL,init?:RequestInit):Promise<Response>{
 const raw=typeof input==='string'?input:input instanceof URL?input.href:input.url;
 const url=new URL(raw,location.origin);const route=routes[url.pathname];
 if(!route){const adjusted=raw.startsWith('/')?import.meta.env.BASE_URL+raw.slice(1):raw;return fetch(adjusted,init);}
 const epoch=generation;const run=async()=>{if(epoch!==generation)return Response.json({error:'学习空间已切换，请重新操作。'},{status:409});const method=(init?.method??'GET').toUpperCase();if(!route[method])return new Response(null,{status:405});const response=await route[method](new Request(url,init));if(response.ok&&method!=='GET'){if(url.pathname==='/api/a-plus-test'){try{const payload=JSON.parse(String(init?.body??'{}'));if(payload.session?.stage==='feedback'&&payload.session.question){const word=aPlusById.get(payload.session.question.entryId)?.word;if(word){recordPracticeWord(word,'a-plus');const result=payload.session.progress?.[payload.session.question.entryId];if(result&&Number.isInteger(result.correct))recordLearningPlanWords([word],result.correct>0?'green':'red');}}if(payload.session?.stage==='complete'&&typeof payload.session.id==='string')recordCompletedPractice('a-plus-full:'+payload.session.id,'a-plus');}catch{}}if(url.pathname==='/api/word-memory')trackUsage('note_save');else if(url.pathname==='/api/mind-map')trackUsage('note_save','mind_map');}return response;};
 const pending=queue.then(run);queue=pending.then(()=>{},()=>{});return pending;
}
