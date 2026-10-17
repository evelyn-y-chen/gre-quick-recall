import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './helpers/load-ts.mjs';
const model=loadTs('community/personalProgressModel.ts');
const catalogs=[{id:'words',name:'words',module:'words',storageKey:'ratings',entries:[{id:'a',words:['Candid']},{id:'b',words:['candid']},{id:'c',words:['novel']}]},{id:'a-plus',name:'A+',module:'a-plus',storageKey:'ap',entries:[{id:'p',words:['Candid','frank']} ]},{id:'bb',name:'BB',module:'bb',storageKey:'bb',entries:[{id:'g',words:['plain','clear']}]},{id:'notebook',name:'Notebook',module:'notebook',storageKey:'',entries:[]}];
test('personal progress deduplicates words and directions, ranks top three and uses conservative conflicting ratings',()=>{const r=model.summarizeProgress({storage:{ratings:JSON.stringify({a:'familiar',b:'familiar',c:'fuzzy'}),ap:JSON.stringify({'p:word':'familiar','p:meaning':'unknown'}),bb:JSON.stringify({g:'familiar'})},rows:[]},catalogs);assert.equal(r.studied,5);assert.equal(r.familiar,2);assert.equal(r.top.length,3);assert.equal(r.top.find(x=>x.id==='words').total,2);assert.equal(r.top.find(x=>x.id==='a-plus').unknown,2);});
test('saved rows and notebook count without depending on private analytics; practice completion IDs deduplicate',()=>{const r=model.summarizeProgress({storage:{[model.COMPLETIONS]:JSON.stringify({'a-plus-full:run':{module:'a-plus',completedAt:'2026-10-15'}}),[model.TESTED_WORDS]:JSON.stringify({words:{novel:true}})},rows:[{key:'quick-rating:words:a',value:'"familiar"'},{key:'vocab-notebook:test',value:JSON.stringify({words:[{word:'candid',rating:'familiar'},{word:'custom',rating:'fuzzy'}]})},{key:'a-plus-test-session:v1',value:JSON.stringify({id:'run',stage:'complete'})}]},catalogs);assert.equal(r.tests,1);assert.equal(r.studied,3);assert.equal(r.familiar,1);assert.equal(r.top.find(x=>x.id==='words').studied,2);assert.equal(r.top.find(x=>x.id==='notebook').total,2);});
test('a different or empty workspace never inherits another workspace progress',()=>{const r=model.summarizeProgress({rows:[],storage:{ratings:'broken',bb:'null'}},catalogs);assert.equal(r.studied,0);assert.equal(r.familiar,0);assert.equal(r.tests,0);assert.deepEqual(r.top,[]);});

const today='2026-10-17';
const settings=(deckIds=['words','a-plus','bb','notebook'],id='current')=>JSON.stringify({version:1,config:{id,deckIds,startDay:'2026-10-01',targetDay:'2026-12-01',dailyCap:30},paused:false});
const answer=(word,day=today,plan='current')=>`lemnota-plan-answer:${plan}:${encodeURIComponent(word)}:${day}`;

test('real daily-plan answers contribute studied words and latest self-ratings without inventing completed tests',()=>{
 const snapshot={rows:[],storage:{'lemnota-learning-plan-v1':settings(),[answer('candid','2026-10-15')]:'"red"',[answer('candid','2026-10-16')]:'"yellow"',[answer('candid')]:'"green"',[answer('novel')]:'"yellow"',[answer('plain')]:'"red"'}};
 const r=model.summarizeProgress(snapshot,catalogs,today);
 assert.equal(r.studied,3);assert.equal(r.familiar,1);assert.equal(r.tests,0);
 const words=r.top.find(g=>g.id==='words'),ap=r.top.find(g=>g.id==='a-plus'),bb=r.top.find(g=>g.id==='bb');
 assert.equal(words.studied,2);assert.equal(words.familiar,1);assert.equal(words.fuzzy,1);
 assert.equal(ap.studied,1);assert.equal(ap.familiar,1);
 assert.equal(bb.studied,1);assert.equal(bb.unknown,1);
});

test('only the active plan and selected source membership count, while existing cumulative practice stays visible',()=>{
 const snapshot={rows:[],storage:{'lemnota-learning-plan-v1':settings(['words']),[answer('candid')]:'"green"',[answer('frank')]:'"green"',[answer('plain',today,'old-plan')]:'"green"',[model.TESTED_WORDS]:JSON.stringify({bb:{clear:true}}),[model.COMPLETIONS]:JSON.stringify({oldPractice:{module:'bb',completedAt:'2026-10-10'}})}};
 const r=model.summarizeProgress(snapshot,catalogs,today);
 assert.equal(r.studied,2);assert.equal(r.familiar,1);assert.equal(r.tests,1);
 assert.deepEqual(r.top.map(g=>g.id),['words','bb']);
 assert.equal(r.top.find(g=>g.id==='words').studied,1);
 assert.equal(r.top.find(g=>g.id==='bb').studied,1);
 const noCurrent=model.summarizeProgress({...snapshot,storage:{...snapshot.storage,'lemnota-learning-plan-v1':'broken'}},catalogs,today);
 assert.equal(noCurrent.studied,1);assert.equal(noCurrent.familiar,0);assert.equal(noCurrent.tests,1);
});

test('future, malformed and pre-start daily facts cannot manufacture progress',()=>{
 const snapshot={rows:[],storage:{'lemnota-learning-plan-v1':settings(['words']),[answer('candid','2026-10-16')]:'"yellow"',[answer('candid','2026-10-18')]:'"green"',[answer('novel','2026-02-30')]:'"green"',[answer('novel','2026-09-30')]:'"green"','lemnota-plan-answer:current:bad%ZZ:2026-10-17':'"green"',[answer('novel')]:'"blue"'}};
 const r=model.summarizeProgress(snapshot,catalogs,today);
 assert.equal(r.studied,1);assert.equal(r.familiar,0);assert.equal(r.top[0].fuzzy,1);assert.equal(r.tests,0);
 const next=model.summarizeProgress(snapshot,catalogs,'2026-10-18');assert.equal(next.familiar,1);
});

test('plan self-ratings respect conservative conflicting source ratings and global word deduplication',()=>{
 const snapshot={rows:[],storage:{'lemnota-learning-plan-v1':settings(['words','a-plus']),[answer('candid')]:'"green"',ratings:JSON.stringify({a:'fuzzy'}),ap:JSON.stringify({'p:word':'unknown'})}};
 const r=model.summarizeProgress(snapshot,catalogs,today);
 assert.equal(r.studied,2,'A+ group rating also describes its existing second word');
 assert.equal(r.familiar,0,'a newer plan green must not erase another source\'s uncertainty');
 assert.equal(r.top.find(g=>g.id==='words').fuzzy,1);
 assert.equal(r.top.find(g=>g.id==='a-plus').unknown,2);
 assert.equal(r.tests,0);
});

test('notebook-only daily tasks include custom saved and draft words, with drafts authoritative for their batch',()=>{
 const notebookWord=(id,word,meaning='完整释义')=>({id,word,meaning,note:'笔记',origin:'收藏'});
 const draft={id:'batch',source:'新来源',date:'2026-10-17',words:[notebookWord('custom','自定义 Planner 词'),notebookWord('shared','CANDID')]};
 const snapshot={rows:[{key:'vocab-notebook:batch',value:JSON.stringify({id:'batch',words:[{word:'removed',rating:'familiar'}]})},{key:'vocab-notebook:another',value:JSON.stringify({words:[{word:'other custom'}]})}],storage:{'lemnota-learning-plan-v1':settings(['notebook']),[answer('自定义 planner 词')]:'"green"',[answer('candid')]:'"yellow"',[answer('other custom')]:'"red"',[answer('removed')]:'"green"','gre-vocabulary-notebook-drafts-v1':JSON.stringify({batch:{batch:draft,revision:2}})}};
 const before=JSON.stringify(snapshot),r=model.summarizeProgress(snapshot,catalogs,today);
 assert.equal(r.studied,3);assert.equal(r.familiar,1);assert.equal(r.tests,0);
 assert.equal(r.top.length,1);assert.equal(r.top[0].id,'notebook');assert.equal(r.top[0].total,3);
 assert.deepEqual([r.top[0].familiar,r.top[0].fuzzy,r.top[0].unknown],[1,1,1]);
 assert.equal(JSON.stringify(snapshot),before);
});

test('paused current plans retain real progress, and reserved English spellings remain ordinary words',()=>{
 const special=[{id:'words',name:'Words',module:'words',storageKey:'ratings',entries:[{id:'p',words:['prototype']},{id:'c',words:['constructor']}]}];
 const value=JSON.parse(settings(['words']));value.paused=true;
 const r=model.summarizeProgress({rows:[],storage:{'lemnota-learning-plan-v1':JSON.stringify(value),[answer('prototype')]:'"green"',[answer('constructor')]:'"yellow"'}},special,today);
 assert.equal(r.studied,2);assert.equal(r.familiar,1);assert.equal(r.top[0].fuzzy,1);assert.equal(r.tests,0);
});
