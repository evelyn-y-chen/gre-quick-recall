import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const cache=new Map();
function load(file){file=path.resolve(file);if(!path.extname(file))file+=fs.existsSync(file+'.ts')?'.ts':'.json';if(cache.has(file))return cache.get(file);if(file.endsWith('.json'))return JSON.parse(fs.readFileSync(file));const out={};cache.set(file,out);new Function('exports','require',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText)(out,name=>load(path.resolve(path.dirname(file),name)));return out;}
const {buildPlannedLists:build,scheduleListPlan:schedule,projectListPlan:project}=load('community/listLearningPlanModel.ts');
const {createLearningPlan,recordLearningPlanAnswer:record}=load('community/learningPlanModel.ts');
const {getLearningPlanCatalog:getCatalog}=load('community/learningPlanCatalog.ts');
const day='2026-10-17';
const plan=(changes={})=>createLearningPlan({id:'test',deckIds:['glee'],startDay:day,targetDay:day,dailyCap:null,...changes});
const unit=(id,words,deck='glee')=>({id,deckId:deck,deckName:deck,label:id,words:words.map(id=>({id,word:id,occurrences:[]}))});
function answer(s,units,word,color='green',date=day){return record(s,units.flatMap(u=>u.words.map(w=>w.id)),word,color,date);}
function finish(s,units,u,date=day,color='green'){for(const w of u.words)s=answer(s,units,w.id,color,date);return s;}

test('real source Lists keep BB volumes separate and count actual distinct words, never a fixed size',()=>{
 const catalog=getCatalog(),units=build(catalog.words,['bb','words']);const source=JSON.parse(fs.readFileSync('app/bbEquivalents.json'));
 const first=units.find(u=>u.id==='bb:上-list-1');assert.ok(first);assert.ok(units.some(u=>u.id==='bb:中-list-16'));assert.ok(units.some(u=>u.id==='bb:下-list-31'));
 const raw=source.filter(e=>e.volume==='上'&&e.list===1);assert.equal(first.words.length,new Set(raw.flatMap(e=>e.words.map(w=>w.word.trim().toLowerCase()))).size);
 assert.deepEqual(first.words.slice(0,2).map(w=>w.word),raw[0].words.map(w=>w.word));
 assert.ok(units.filter(u=>u.deckId==='words').some(u=>u.words.length!==100));assert.equal(new Set(units.map(u=>u.id)).size,units.length);
});
test('an optional word cap is genuinely empty, and a too-large List is blocked whole',()=>{
 const units=[unit('one',['a','b','c'])],s=plan();assert.deepEqual(schedule(s,units,day).newIds,['one']);
 const capped=plan({dailyCap:2}),p=project(capped,units,day);assert.deepEqual(p.today.newIds,[]);assert.equal(p.today.blocked[0].wordCount,3);assert.equal(p.today.blocked[0].reason,'limit');assert.equal(p.expectedFirstPassDay,null);assert.deepEqual(capped.answers,{});
});
test('multi-bank repeats count once per day but retain whole source Lists',()=>{
 const units=[unit('one',['a','b']),unit('two',['b','c'],'bb')],s=plan({deckIds:['glee','bb'],dailyCap:3}),today=schedule(s,units,day);
 assert.deepEqual(today.newIds,['one','two']);assert.equal(today.assignedWordCount,3);assert.equal(today.blocked.length,0);
 let current=answer(s,units,'a');assert.equal(schedule(current,units,day).learnedCount,0);
 current=answer(current,units,'b');assert.equal(schedule(current,units,day).learnedCount,1);assert.deepEqual(schedule(current,units,day).required.two,['c']);
 current=answer(current,units,'c');assert.equal(schedule(current,units,day).learnedCount,2);assert.equal(schedule(current,units,day).completedWordCount,3);
});
test('future new work never invents review tasks or writes answers',()=>{
 const units=[unit('one',['a','b']),unit('two',['c'])],s=plan({targetDay:'2026-10-20'}),before=structuredClone(s),p=project(s,units,day);
 assert.ok(p.days.some(d=>d.newCount));assert.ok(p.days.every(d=>d.reviewCount===0));assert.deepEqual(s,before);
});
test('only actual full-List completion creates its next review; future rounds are not simulated',()=>{
 const units=[unit('one',['a','b'])];let s=answer(plan(),units,'a');assert.ok(project(s,units,day).days.every(d=>!d.reviewCount));
 s=answer(s,units,'b');let p=project(s,units,day);assert.deepEqual(p.days.filter(d=>d.reviewCount).map(d=>d.day),['2026-10-18']);
 s=finish(s,units,units[0],'2026-10-18');p=project(s,units,'2026-10-18');assert.deepEqual(p.days.filter(d=>d.reviewCount).map(d=>d.day),['2026-10-20']);
 assert.equal(p.today.completedReviewIds.length,1);
});
test('partial due review waits for all actual answers and a red result resets the interval',()=>{
 const units=[unit('one',['a','b'])];let s=finish(plan(),units,units[0]);s=answer(s,units,'a','red','2026-10-18');
 const partial=schedule(s,units,'2026-10-18');assert.deepEqual(partial.reviewIds,['one']);assert.deepEqual(partial.required.one,['b']);assert.equal(partial.completedReviewIds.length,0);
 s=answer(s,units,'b','green','2026-10-18');assert.deepEqual(project(s,units,'2026-10-18').days.filter(d=>d.reviewCount).map(d=>d.day),['2026-10-19']);
});
test('daily List allocation is stable after finishing a List and does not refill itself',()=>{
 const units=[unit('one',['a']),unit('two',['b']),unit('three',['c'])],s=plan({targetDay:'2026-10-19'});
 assert.deepEqual(schedule(s,units,day).newIds,['one']);const done=finish(s,units,units[0]);assert.deepEqual(schedule(done,units,day).newIds,[]);assert.deepEqual(schedule(done,units,day).completedNewIds,['one']);
});
test('missed days replan to the actual day and show delay without silently lifting the cap',()=>{
 const units=[unit('one',['a']),unit('two',['b']),unit('three',['c'])],s=plan({dailyCap:1,targetDay:'2026-10-19'});
 const p=project(s,units,'2026-10-19');assert.deepEqual(p.today.newIds,['one']);assert.equal(p.expectedFirstPassDay,'2026-10-21');assert.equal(p.delayDays,2);assert.equal(p.targetReachable,false);assert.ok(p.days.every(d=>d.wordCount<=1));assert.equal(s.config.dailyCap,1);
});
test('unfit due Lists block new work and early practice never skips a due round',()=>{
 const units=[unit('one',['a','b']),unit('two',['c'])];let s=finish(plan({dailyCap:2}),units,units[0]);
 s={...s,config:{...s.config,dailyCap:1}};const p=project(s,units,'2026-10-18');assert.deepEqual(p.today.newIds,[]);assert.equal(p.today.blocked[0].id,'one');
});
test('pausing and future starts do not create real completion, including in the forecast',()=>{
 const units=[unit('one',['a'])],s={...plan(),paused:true};assert.ok(project(s,units,day).days.every(d=>!d.totalCount));assert.equal(project(s,units,day).expectedFirstPassDay,null);
 const future=plan({startDay:'2026-10-20',targetDay:'2026-10-21'});assert.deepEqual(schedule(future,units,day).newIds,[]);assert.equal(project(future,units,day).days.find(d=>d.day==='2026-10-20').newCount,1);assert.deepEqual(future.answers,{});
});
test('forecast today agrees with actual allocation through partial and completed Lists',()=>{
 const units=[unit('one',['a','b']),unit('two',['b','c']),unit('three',['d'])];
 for(const cap of [null,1,2,3,4])for(const done of [0,1,2,3,4]){
  let s=plan({dailyCap:cap});for(const w of ['a','b','c','d'].slice(0,done))s=answer(s,units,w);
  const p=project(s,units,day);assert.deepEqual(p.days[0].newIds,p.today.newIds);assert.deepEqual(p.days[0].reviewIds,p.today.reviewIds);assert.equal(p.days[0].wordCount,p.today.completedWordCount+p.today.assignedWordCount);
 }
});

test('a long target period spaces whole Lists instead of assigning one every day until an early finish',()=>{
 const units=[unit('one',['a']),unit('two',['b']),unit('three',['c'])],s=plan({targetDay:'2026-10-25'});
 const p=project(s,units,day);assert.deepEqual(p.days.map(d=>d.newCount),[1,0,0,1,0,0,1]);assert.equal(p.expectedFirstPassDay,'2026-10-23');
});
