import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const ts=createRequire(import.meta.url)('typescript');
function collector(rpc){const values=new Map(),module={exports:{}};globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};globalThis.window={dispatchEvent(){}};
const code=ts.transpileModule(readFileSync('community/analytics.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
new Function('require','module','exports',code)(()=>({cloud:{rpc}}),module,module.exports);return {api:module.exports,values,dispose(){module.exports.setAnalyticsConsent(false);delete globalThis.localStorage;delete globalThis.window;}};}
test('usage collection is off by default and only sends bounded aggregate fields after opt-in',async()=>{const calls=[],h=collector(async(name,p)=>{calls.push({name,p});return {error:null};});try{
 h.api.trackUsage('note_save');await h.api.flushUsage();assert.equal(calls.length,0);
 h.api.setAnalyticsConsent(true);h.api.trackUsage('note_save');await h.api.flushUsage();assert.equal(calls.length,1);
 assert.deepEqual(Object.keys(calls[0].p).sort(),['p_batch','p_count','p_event','p_module','p_visitor']);assert.equal(calls[0].p.p_count,1);assert.equal(calls[0].p.p_event,'note_save');
 assert.equal(h.api.validUsage({id:crypto.randomUUID(),event:'note_save',module:'other',count:1,created:Date.now(),text:'private note'}),false);
 h.api.setAnalyticsConsent(false);h.api.trackUsage('word_review','bb');await h.api.flushUsage();assert.equal(calls.length,1);assert.equal(h.values.has('lemnota-usage-queue-v1'),false);
}finally{h.dispose();}});
test('a lost acknowledgement preserves batch IDs and cannot lose or duplicate later events',async()=>{let fail=true,total=0;const receipts=new Set(),h=collector(async(name,p)=>{if(!receipts.has(p.p_batch)){receipts.add(p.p_batch);total+=p.p_count;}if(fail){fail=false;return {error:{message:'lost response'}};}return {error:null};});try{
 h.api.setAnalyticsConsent(true);h.api.trackUsage('word_review','bb');await h.api.flushUsage();
 h.api.trackUsage('word_review','bb');await h.api.flushUsage();assert.equal(total,2);assert.equal(JSON.parse(h.values.get('lemnota-usage-queue-v1')).length,0);
}finally{h.dispose();}});
test('malformed, excessive and non-usage records never leave the queue',async()=>{const calls=[],h=collector(async(n,p)=>{calls.push(p);return {error:null};});try{
 h.api.setAnalyticsConsent(true);h.values.set('lemnota-usage-queue-v1',JSON.stringify([{id:crypto.randomUUID(),event:'note_save',module:'other',count:100000,created:Date.now()},{id:crypto.randomUUID(),event:'note_save',module:'other',count:1,created:Date.now(),email:'private@example.test'}]));await h.api.flushUsage();assert.equal(calls.length,0);
}finally{h.dispose();}});

test('old consent does not authorize the new required-analytics notice',async()=>{const calls=[],h=collector(async(n,p)=>{calls.push(p);return {error:null};});try{h.values.set('lemnota-usage-consent-v1','yes');assert.equal(h.api.analyticsConsent(),false);h.api.trackUsage('app_open');await h.api.flushUsage();assert.equal(calls.length,0);h.api.setAnalyticsConsent(true);assert.equal(h.api.analyticsConsent(),true);h.api.setAnalyticsConsent(false);assert.equal(h.api.analyticsConsent(),false);}finally{h.dispose();}});
