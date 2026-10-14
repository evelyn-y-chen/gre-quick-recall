import {cloud} from './cloud';
export type UsageEvent='app_open'|'study_start'|'word_review'|'note_save'|'practice_complete'|'slip_export'|'slip_import'|'module_open';
export type UsageModule='all_words'|'a_plus'|'bb'|'glee'|'reading'|'cloze'|'math'|'mind_map'|'notebook'|'other';
const CONSENT='lemnota-usage-consent-v1',DEVICE='lemnota-usage-device-v1',QUEUE='lemnota-usage-queue-v1';
type Pending={id:string;event:UsageEvent;module:UsageModule;count:number;created:number;locked?:boolean};
let timer:ReturnType<typeof setTimeout>|undefined,busy=false,attempts=0;
export function analyticsConsent(){try{return localStorage.getItem(CONSENT)==='yes';}catch{return false;}}
export function setAnalyticsConsent(value:boolean){try{localStorage.setItem(CONSENT,value?'yes':'no');if(!value){localStorage.removeItem(QUEUE);clearTimeout(timer);}window.dispatchEvent(new Event('lemnota-usage-consent'));}catch{}}
function pending():Pending[]{try{const rows=JSON.parse(localStorage.getItem(QUEUE)??'[]');return Array.isArray(rows)?rows.filter(row=>validUsage(row)&&row.created>Date.now()-86400000).slice(-100):[];}catch{return [];}}
const events=['app_open','study_start','word_review','note_save','practice_complete','slip_export','slip_import','module_open'],modules=['all_words','a_plus','bb','glee','reading','cloze','math','mind_map','notebook','other'];
export function validUsage(row:any):row is Pending{return !!row&&/^[0-9a-f-]{36}$/i.test(row.id)&&events.includes(row.event)&&modules.includes(row.module)&&Number.isInteger(row.count)&&row.count>=1&&row.count<=50&&Number.isFinite(row.created)&&(row.locked===undefined||typeof row.locked==='boolean')&&Object.keys(row).every(k=>['id','event','module','count','created','locked'].includes(k));}
export function trackUsage(event:UsageEvent,module:UsageModule='other'){
 if(!analyticsConsent()||!cloud)return;try{const rows=pending(),last=rows.at(-1);if(last&&!last.locked&&last.event===event&&last.module===module&&last.count<50)last.count++;else rows.push({id:crypto.randomUUID(),event,module,count:1,created:Date.now()});localStorage.setItem(QUEUE,JSON.stringify(rows.slice(-100)));attempts=0;clearTimeout(timer);timer=setTimeout(()=>void flushUsage(),1500);}catch{}
}
export async function flushUsage(){
 if(busy||!analyticsConsent()||!cloud)return;busy=true;
 try{let visitor=localStorage.getItem(DEVICE);if(!visitor){visitor=crypto.randomUUID();localStorage.setItem(DEVICE,visitor);}
 const batch=pending();batch.forEach(row=>{row.locked=true;});localStorage.setItem(QUEUE,JSON.stringify(batch));for(const row of batch){if(!analyticsConsent())break;const {error}=await cloud.rpc('record_usage',{p_visitor:visitor,p_batch:row.id,p_event:row.event,p_module:row.module,p_count:row.count});if(error)throw error;const rows=pending();const current=rows.find(r=>r.id===row.id);if(current&&current.count>row.count){current.id=crypto.randomUUID();current.count-=row.count;}else{const i=rows.findIndex(r=>r.id===row.id);if(i>=0)rows.splice(i,1);}if(analyticsConsent())localStorage.setItem(QUEUE,JSON.stringify(rows));}
 attempts=0;
 }catch{if(++attempts<3&&analyticsConsent())timer=setTimeout(()=>void flushUsage(),5000*attempts);}finally{busy=false;if(!attempts&&analyticsConsent()&&pending().length)timer=setTimeout(()=>void flushUsage(),1500);}
}
export function recordAppOpen(){if(!analyticsConsent())return;try{const key='lemnota-usage-open-v1',last=Number(localStorage.getItem(key)??0);if(Date.now()-last>30*60000){localStorage.setItem(key,String(Date.now()));trackUsage('app_open');}else void flushUsage();}catch{}}
export function trackLearningClick(event:React.MouseEvent){const target=event.target as HTMLElement;if(!target.closest)return;const module:UsageModule=target.closest('.bbQuick')?'bb':target.closest('.aPlusQuickTable,.aPlusTest')?'a_plus':target.closest('.allWordsMemoryTable')?'all_words':target.closest('.gleeQuickTable')?'glee':target.closest('.mathQuickTable')?'math':target.closest('.mindMap')?'mind_map':target.closest('.notebook')?'notebook':'other';
 if(target.closest('.trafficLights button'))trackUsage('word_review',module);
 else if(target.closest('.quickMeaning[aria-expanded="false"]'))trackUsage('word_review',module);
 else if(target.closest('.quickTypeSwitch button'))trackUsage('module_open',module);
}
