import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModel} from './helpers/load-model.mjs';
const m=loadModel('community/practiceProgressMerge.ts');
const {mergeWorkspaceSnapshots}=loadModel('community/ratingMerge.ts');
const key='lemnota-practice-words',reviewKey='lemnota-practice-review-words-v1';
const result=(done=false,errors=0,streak=0)=>({done,errors,streak});
const run=(changes={})=>({sessionId:'same-session',queue:['a','b','c'],direction:'en-zh',pair:false,review:false,phase:'meaning',results:{},options:[],selected:null,meaningOK:false,turn:0,...changes});
const snap=(storage={},rows=[])=>({version:1,rows,storage:Object.fromEntries(Object.entries(storage).map(([k,v])=>[k,JSON.stringify(v)]))});
const read=(s,k=key)=>JSON.parse(s.storage[k]);
const h=(lastDay='2026-11-02',reviews=1,level=0,due='2026-11-03')=>({lastDay,reviews,level,due});

test('same-session continuation restores advanced queue without rewriting unrelated data',()=>{
 const old=run(),newer=run({queue:['b','c'],turn:1,results:{a:result(true,0,1)}});
 const rows=[{key:'private-note',value:'keep',revision:1,updated_at:'today'}],current=snap({[key]:old,note:'current note','community-theme':'sage'},rows),backup=snap({[key]:newer,note:'older note','community-theme':'antique'});
 const before=structuredClone(current),out=m.mergeImportedPractice(current,backup);
 assert.equal(read(out).turn,1);assert.deepEqual(read(out).queue,['b','c']);assert.equal(out.storage.note,current.storage.note);assert.equal(out.storage['community-theme'],current.storage['community-theme']);assert.deepEqual(out.rows,rows);assert.deepEqual(current,before);
 assert.deepEqual(m.practiceProgressSummary(out),[{key,label:'全能词',remaining:2,answers:1,completed:1}]);
});
test('importing an older same-session backup cannot roll a test backwards',()=>{
 const old=run(),newer=run({queue:['c'],turn:2,results:{a:result(true,0,1),b:result(true,0,1)}});
 assert.deepEqual(read(m.mergeImportedPractice(snap({[key]:newer}),snap({[key]:old}))),newer);
});
test('auto sync selects the same proven descendant on either side',()=>{
 const base=snap({[key]:run()}),older=snap({[key]:run({queue:['b','c'],turn:1,results:{a:result(true,0,1)}})}),newer=snap({[key]:run({queue:['c'],turn:2,results:{a:result(true,0,1),b:result(true,0,1)}})});
 assert.equal(read(mergeWorkspaceSnapshots(base,older,newer)).turn,2);assert.equal(read(mergeWorkspaceSnapshots(base,newer,older)).turn,2);
});
test('different sessions and divergent word results remain conflicts even with a larger turn count',()=>{
 const a=run({queue:['b','c'],turn:10,results:{a:result(true,0,1)}}),b=run({queue:['a','c'],turn:20,results:{b:result(true,0,1)}});
 assert.throws(()=>m.mergeImportedPractice(snap({[key]:a}),snap({[key]:b})),/分支/);
 assert.throws(()=>m.mergeImportedPractice(snap({[key]:a}),snap({[key]:{...a,sessionId:'other-session'}})),/分支/);
});
test('completion/error regressions and unknown queue members cannot masquerade as continuations',()=>{
 const before=run({queue:['b','c'],turn:2,results:{a:result(true,2,2)}});
 for(const candidate of [run({queue:['c'],turn:3,results:{a:result(false,2,0)}}),run({queue:['c'],turn:3,results:{a:result(true,1,2)}}),{...before,queue:['z'],turn:8}])assert.throws(()=>m.mergeImportedPractice(snap({[key]:before}),snap({[key]:candidate})),/分支/);
});
test('review records for different words combine and later dated review can advance',()=>{
 const base=snap({[reviewKey]:{a:h()}}),local=snap({[reviewKey]:{a:h('2026-11-03',2,1,'2026-11-05'),b:h()}}),remote=snap({[reviewKey]:{a:h(),c:h()}});
 const out=read(mergeWorkspaceSnapshots(base,local,remote),reviewKey);assert.deepEqual(Object.keys(out).sort(),['a','b','c']);assert.equal(out.a.lastDay,'2026-11-03');
});
test('ambiguous same-day review schedules require review instead of manufacturing a count',()=>{
 const current=snap({[reviewKey]:{a:h()}}),incoming=snap({[reviewKey]:{a:h('2026-11-02',2,1,'2026-11-04')}});
 assert.throws(()=>m.mergeImportedPractice(current,incoming),/分支/);
});
test('import of review schedules unions missing words and preserves current-only history',()=>{
 const out=m.mergeImportedPractice(snap({[reviewKey]:{a:h(),b:h()}}),snap({[reviewKey]:{a:h(),c:h()}}));
 assert.deepEqual(Object.keys(read(out,reviewKey)).sort(),['a','b','c']);
});
test('invalid test payloads and missing progress abort without mutation',()=>{
 const current=snap({[key]:run()}),copy=structuredClone(current);
 assert.throws(()=>m.mergeImportedPractice(current,snap({[key]:{...run(),queue:['a','a']}})),/格式/);
 assert.throws(()=>m.mergeImportedPractice(current,snap({note:'not a test'})),/没有/);assert.deepEqual(current,copy);
});
test('ungraded option repair never changes graded progress or permits feedback rollback',()=>{
 const current=run({options:[{word:'new'}],selected:null}),repaired={...current,options:[{word:'old'}],selected:0};
 assert.equal(read(m.mergeImportedPractice(snap({[key]:current}),snap({[key]:repaired}))).turn,0);
 const feedback=run({phase:'feedback',results:{a:result(true,0,1)}});
 assert.equal(read(m.mergeImportedPractice(snap({[key]:feedback}),snap({[key]:current}))).phase,'feedback');
});
test('notebook practice scopes remain isolated and summary never includes note text',()=>{
 const one='lemnota-practice-notebook-scope_one',two='lemnota-practice-notebook-scope_two',current=snap({[one]:run(),note:'secret'}),incoming=snap({[two]:run({sessionId:'other'})});
 const out=m.mergeImportedPractice(current,incoming);assert.ok(out.storage[one]);assert.ok(out.storage[two]);assert.equal(m.practiceProgressSummary(out).length,2);assert.equal(JSON.stringify(m.practiceProgressSummary(out)).includes('secret'),false);
});
