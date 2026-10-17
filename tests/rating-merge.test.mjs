import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './helpers/load-ts.mjs';
const {mergeWorkspaceSnapshots,mergeImportedRatings,stampRatingChanges,ratingClockKey}=loadTs('community/ratingMerge.ts');
const empty=()=>({version:1,rows:[],storage:{}});
function rated(values,module='words',time=0){const s=empty();s.storage[module==='bb'?'gre-bb-ratings-v1':'gre-quick-ratings-v1']=JSON.stringify(values);if(time)stampRatingChanges({getItem:k=>s.storage[k]??null,setItem:(k,v)=>s.storage[k]=v},module,values,time);return s;}
const ratings=s=>JSON.parse(s.storage['gre-quick-ratings-v1']??'{}');
test('phone marks word 1 and tablet marks word 2: both survive in storage and SQL',()=>{
 const base=empty(),phone=rated({one:'familiar'},'words',100),tablet=rated({two:'familiar'},'words',200);
 const result=mergeWorkspaceSnapshots(base,phone,tablet);assert.deepEqual(ratings(result),{one:'familiar',two:'familiar'});
 assert.deepEqual(Object.fromEntries(result.rows.map(r=>[r.key,JSON.parse(r.value)])),{'quick-rating:words:one':'familiar','quick-rating:words:two':'familiar'});
 assert.deepEqual(ratings(mergeWorkspaceSnapshots(base,tablet,phone)),{two:'familiar',one:'familiar'});
});
test('a later same-word edit wins, even when a device has older unchanged local ratings',()=>{
 const base=rated({one:'unknown'},'words',100),older=rated({one:'fuzzy'},'words',200),newer=rated({one:'familiar'},'words',300);
 assert.equal(ratings(mergeWorkspaceSnapshots(base,older,newer)).one,'familiar');
 assert.equal(ratings(mergeWorkspaceSnapshots(base,newer,older)).one,'familiar');
 assert.equal(ratings(mergeWorkspaceSnapshots(newer,newer,rated({one:'unknown'},'words',400))).one,'unknown');
});
test('legacy pending records are retained, but an ambiguous conflict never silently overwrites',()=>{
 const local=rated({one:'unknown'});local.storage['gre-rating-cloud-pending:words']='{"one":"familiar"}';
 const result=mergeWorkspaceSnapshots(empty(),local,rated({two:'familiar'}));assert.deepEqual(ratings(result),{one:'familiar',two:'familiar'});assert.equal(result.storage['gre-rating-cloud-pending:words'],'{}');
 assert.throws(()=>mergeWorkspaceSnapshots(undefined,rated({one:'familiar'}),rated({one:'unknown'})),/旧版红黄绿/);
 assert.equal(ratings(mergeWorkspaceSnapshots(rated({one:'unknown'}),rated({one:'familiar'}),rated({one:'unknown'}))).one,'familiar');
});
test('safe independent note changes merge and conflicting notes stop the upload',()=>{
 const base=rated({one:'unknown'});base.storage.note='base';base.storage.range='[]';
 const local=structuredClone(base);local.storage.note='phone';
 const remote=structuredClone(base);remote.storage.theme='sage';
 assert.deepEqual(mergeWorkspaceSnapshots(base,local,remote).storage,{note:'phone',range:'[]',theme:'sage','gre-quick-ratings-v1':'{"one":"unknown"}'});
 remote.storage.note='tablet';assert.throws(()=>mergeWorkspaceSnapshots(base,local,remote),/同一份笔记/);assert.equal(local.storage.note,'phone');
});
test('ratings-only import keeps current notes, theme, tests and unrelated modules',()=>{
 const current=rated({one:'familiar'},'words',100);current.storage.note='private';current.storage.theme='antique';current.rows.push({key:'test:1',value:'completed',revision:1,updated_at:'2026-01-01'});
 const file=rated({two:'familiar'},'words',200);file.storage.note='old';file.storage.theme='cream';file.storage['gre-bb-ratings-v1']='{"group":"fuzzy"}';
 const merged=mergeImportedRatings(current,file);assert.deepEqual(ratings(merged),{one:'familiar',two:'familiar'});assert.equal(merged.storage.note,'private');assert.equal(merged.storage.theme,'antique');assert.equal(merged.rows.find(r=>r.key==='test:1').value,'completed');assert.equal(JSON.parse(merged.storage['gre-bb-ratings-v1']).group,'fuzzy');
});
test('clock writes affect only actual changes and remain monotonic if the device clock moves back',()=>{
 const s={};const storage={getItem:k=>s[k]??null,setItem:(k,v)=>s[k]=v};stampRatingChanges(storage,'words',{one:'familiar'},200);stampRatingChanges(storage,'words',{},300);stampRatingChanges(storage,'words',{two:'fuzzy'},100);
 const clocks=JSON.parse(s[ratingClockKey]);assert.equal(clocks.words.one.at,200);assert.equal(clocks.words.two.at,201);assert.equal(Object.keys(clocks).length,1);
});

test('device-specific range choices do not block independent-word rating sync',()=>{
 const base=rated({},'words',1);base.storage['gre-last-quick-type-v1']='words';
 const local=rated({one:'familiar'},'words',100);local.storage['gre-last-quick-type-v1']='bb';
 const remote=rated({two:'familiar'},'words',200);remote.storage['gre-last-quick-type-v1']='a-plus';
 const result=mergeWorkspaceSnapshots(base,local,remote);assert.deepEqual(ratings(result),{one:'familiar',two:'familiar'});assert.equal(result.storage['gre-last-quick-type-v1'],'bb');
});
