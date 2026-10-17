import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const modules=new Map();
function load(name){if(modules.has(name))return modules.get(name);const exports={};modules.set(name,exports);const code=ts.transpileModule(fs.readFileSync('community/'+name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('exports','require',code)(exports,path=>load(path.replace('./','')));return exports;}
const model=load('learningPlanModel');
const {createLearningPlan:create,validLearningPlan:valid,loadLearningPlan:read,recordLearningPlanAnswer:answer,scheduleLearningPlan:schedule,projectLearningPlan:project}=model;
const day='2026-10-17';
const config=patch=>({id:'plan-1',deckIds:['all','bb'],startDay:day,targetDay:'2026-10-19',dailyCap:2,...patch});
const record=(state,ids,id,rating,date=day)=>answer(state,ids,id,rating,date);

test('learning plan configuration and events validate, round-trip and detach without dropping deselected words',()=>{
 const input=config();const state=create(input);input.deckIds.push('later');assert.deepEqual(state.config.deckIds,['all','bb']);
 const learned=record(state,['a','b'],'b','yellow'),restored=read(JSON.stringify(learned));assert.equal(valid(restored),true);assert.deepEqual(restored,learned);
 restored.answers.b[day]='red';assert.equal(learned.answers.b[day],'yellow');assert.equal(schedule(learned,['a'],day).learnedCount,0);assert.equal(learned.answers.b[day],'yellow');
 for(const saved of ['no json','null','[]','42',JSON.stringify({...state,version:2}),JSON.stringify({...state,answers:{a:{'2026-02-30':'green'}}}),JSON.stringify({...state,answers:{a:{[day]:'blue'}}})])assert.equal(read(saved),null);
 for(const patch of [{dailyCap:0},{dailyCap:1.5},{startDay:'2026-2-03'},{targetDay:'2026-10-16'},{deckIds:[]}])assert.throws(()=>create(config(patch)),RangeError);
});

test('stable unique catalog order removes overlapping deck IDs and gives due reviews priority',()=>{
 const ids=['a','b','a','c','b','d'];let state=create(config());
 assert.deepEqual(schedule(state,ids,day).newIds,['a','b']);assert.equal(schedule(state,ids,day).totalWords,4);
 state=record(state,ids,'b','green');state=record(state,ids,'a','green');
 const due=schedule(state,ids,'2026-10-18');assert.deepEqual(due.reviewIds,['a','b']);assert.deepEqual(due.newIds,[]);assert.equal(due.totalCount,2);
});

test('missing one or several days does not manufacture completion or advance the curve',()=>{
 const ids=['a','b','c','d'];let state=create(config());state=record(state,ids,'a','green');state=record(state,ids,'b','green');
 const saved=JSON.stringify(state);
 for(const date of ['2026-10-18','2026-10-19','2026-10-25']){const current=schedule(state,ids,date);assert.deepEqual(current.reviewIds,['a','b']);assert.equal(current.completedIds.length,0);assert.deepEqual(current.newIds,[]);}
 const forecast=project(state,ids,'2026-10-25');assert.equal(JSON.stringify(state),saved);assert.deepEqual(forecast.today.reviewIds,['a','b']);assert.equal(forecast.days[0].completedCount,0);
});

test('partially completed days count each word once and leave only remaining review capacity',()=>{
 const ids=['a','b','c'];let state=create(config());state=record(state,ids,'a','green');state=record(state,ids,'b','green');
 state=record(state,ids,'a','green','2026-10-18');const today=schedule(state,ids,'2026-10-18');
 assert.deepEqual(today.completedIds,['a']);assert.deepEqual(today.completedNewIds,[]);assert.deepEqual(today.completedReviewIds,['a']);assert.deepEqual(today.reviewIds,['b']);assert.deepEqual(today.newIds,[]);assert.equal(today.totalCount,2);
 assert.equal(record(state,ids,'a','green','2026-10-18'),state);
});

test('red and yellow reset the next day and a better same-day answer cannot undo a failure',()=>{
 const ids=['a'];let state=create(config());state=record(state,ids,'a','green');
 state=record(state,ids,'a','green','2026-10-18');state=record(state,ids,'a','green','2026-10-20');state=record(state,ids,'a','green','2026-10-24');
 state=record(state,ids,'a','red','2026-10-25');const failed=state;
 assert.equal(record(state,ids,'a','green','2026-10-25'),failed);assert.equal(record(state,ids,'a','yellow','2026-10-25'),failed);
 assert.deepEqual(schedule(state,ids,'2026-10-26').reviewIds,['a']);
 state=record(state,ids,'a','yellow','2026-10-26');assert.deepEqual(schedule(state,ids,'2026-10-27').reviewIds,['a']);
 state=record(state,ids,'a','green','2026-10-27');assert.deepEqual(schedule(state,ids,'2026-10-28').reviewIds,[]);assert.deepEqual(schedule(state,ids,'2026-10-29').reviewIds,['a']);
 assert.equal(schedule(state,ids,'2026-10-25').completedIds.length,1);
});

test('early green practice contributes actual workload without upgrading or postponing an existing due date',()=>{
 const ids=['a'];let state=create(config());state=record(state,ids,'a','green');state=record(state,ids,'a','green','2026-10-18');
 state=record(state,ids,'a','green','2026-10-19');assert.equal(schedule(state,ids,'2026-10-19').completedIds.length,1);
 assert.deepEqual(schedule(state,ids,'2026-10-20').reviewIds,['a']);
 state=record(state,ids,'a','green','2026-10-20');assert.deepEqual(schedule(state,ids,'2026-10-23').reviewIds,[]);assert.deepEqual(schedule(state,ids,'2026-10-24').reviewIds,['a']);
});

test('six successful due reviews complete finite consolidation rather than occupying every later month',()=>{
 const ids=['a'];let state=create(config());state=record(state,ids,'a','green');
 for(const [date,next] of [['2026-10-18','2026-10-20'],['2026-10-20','2026-10-24'],['2026-10-24','2026-10-31'],['2026-10-31','2026-11-15'],['2026-11-15','2026-12-15']]){
  assert.deepEqual(schedule(state,ids,date).reviewIds,['a']);state=record(state,ids,'a','green',date);assert.deepEqual(schedule(state,ids,next).reviewIds,['a']);
 }
 state=record(state,ids,'a','green','2026-12-15');assert.deepEqual(schedule(state,ids,'2027-01-14').reviewIds,[]);assert.deepEqual(schedule(state,ids,'2027-12-15').reviewIds,[]);
 const projection=project(state,ids,'2027-01-14');assert.equal(projection.expectedFirstPassDay,day);assert.equal(projection.simulationTruncated,false);assert.equal(projection.simulatedTasks,0);
 state=record(state,ids,'a','red','2027-01-14');assert.deepEqual(schedule(state,ids,'2027-01-15').reviewIds,['a']);
});

test('forecast rolls missed work forward, respects total capacity and includes consolidation before first-pass completion',()=>{
 const ids=['a','b','c','d','e','f'],state=create(config());const result=project(state,ids,day);
 assert.equal(result.expectedFirstPassDay,'2026-10-22');assert.equal(result.targetReachable,false);assert.equal(result.delayDays,3);
 assert.equal(result.days.length,7);assert.ok(result.days.every(d=>d.totalCount<=state.config.dailyCap));
 assert.deepEqual(result.days.slice(0,3).map(d=>[d.newCount,d.reviewCount]),[[2,0],[0,2],[2,0]]);
 assert.equal(result.assumption,'all-future-answers-green');assert.deepEqual(state.answers,{});
 const missed=project(state,ids,'2026-10-20');assert.equal(missed.expectedFirstPassDay,'2026-10-25');assert.equal(missed.delayDays,6);
});

test('start dates, pauses and real events remain separate from hypothetical forecasts',()=>{
 const ids=['a','b','c'];let state=create(config({startDay:'2026-10-20',targetDay:'2026-10-25'}));
 assert.deepEqual(schedule(state,ids,day).newIds,[]);assert.equal(record(state,ids,'a','green',day),state);
 const result=project(state,ids,day);assert.ok(result.days.slice(0,3).every(d=>d.totalCount===0));assert.equal(result.expectedFirstPassDay,'2026-10-22');
 state=record(state,ids,'a','green','2026-10-20');const paused={...state,paused:true},before=JSON.stringify(paused.answers);
 assert.deepEqual(schedule(paused,ids,'2026-10-25').reviewIds,[]);assert.equal(record(paused,ids,'b','green','2026-10-25'),paused);assert.equal(project(paused,ids,'2026-10-25').expectedFirstPassDay,null);assert.equal(JSON.stringify(paused.answers),before);
 assert.deepEqual(schedule({...paused,paused:false},ids,'2026-10-25').reviewIds,['a']);
});

test('outside self-study above the cap is retained and deselecting a deck does not reclaim completed capacity',()=>{
 const ids=['a','b','c','d'];let state=create(config());
 for(const id of ['a','b','c'])state=record(state,ids,id,'green');
 assert.equal(schedule(state,ids,day).completedIds.length,3);assert.deepEqual(schedule(state,ids,day).newIds,[]);assert.equal(schedule(state,ids,day).remainingCapacity,0);
 assert.equal(schedule(state,['d'],day).completedIds.length,3);assert.deepEqual(schedule(state,['d'],day).newIds,[]);assert.equal(state.answers.a[day],'green');
 assert.equal(record(state,['d'],'a','red'),state);const changed=record(state,ids,'a','red');assert.equal(changed.answers.a[day],'red');assert.equal(schedule(changed,ids,day).completedIds.length,3);
});

test('Beijing days, leap dates, unknown future events and empty catalogs cannot fake completion or loop indefinitely',()=>{
 const {reviewDay}=load('practiceReviewModel');assert.equal(reviewDay(new Date('2026-10-17T15:59:59Z')),'2026-10-17');assert.equal(reviewDay(new Date('2026-10-17T16:00:00Z')),'2026-10-18');
 let state=create(config({startDay:'2028-02-28',targetDay:'2028-03-01'}));state=record(state,['a'],'a','green','2028-02-28');assert.deepEqual(schedule(state,['a'],'2028-02-29').reviewIds,['a']);
 const future={...create(config()),answers:{a:{'2026-10-25':'green'}}};assert.equal(schedule(future,['a'],day).learnedCount,0);assert.deepEqual(schedule(future,['a'],day).newIds,['a']);
 const empty=project(create(config()),[],day);assert.equal(empty.expectedFirstPassDay,null);assert.equal(empty.simulationTruncated,false);assert.equal(empty.simulatedTasks,0);assert.ok(empty.days.every(d=>d.totalCount===0));
 const unusual=record(create(config()),['__proto__'],'__proto__','green');assert.equal(valid(read(JSON.stringify(unusual))),true);assert.equal(schedule(unusual,['__proto__'],day).learnedCount,1);
});

test('50k-word projections have bounded work, finite first-pass dates and no deadline-forced increase',()=>{
 const ids=Array.from({length:50_000},(_,i)=>'word-'+i),state=create(config({dailyCap:30,targetDay:'2026-11-01'}));
 const result=project(state,ids,day);assert.equal(result.simulationTruncated,false);assert.ok(result.expectedFirstPassDay);assert.equal(result.targetReachable,false);assert.ok(result.delayDays>0);
 assert.ok(result.simulatedTasks<=50_000*7);assert.ok(result.days.every(d=>d.totalCount<=30));assert.deepEqual(result.today.newIds,ids.slice(0,30));
 assert.throws(()=>project(state,[...ids,'overflow'],day),RangeError);
});

test('a later first-pass target creates a lighter new-word budget without forcing the daily cap',()=>{
 const ids=Array.from({length:20},(_,i)=>'w'+i);
 const close=create(config({dailyCap:20,targetDay:day})),later=create(config({dailyCap:20,targetDay:'2026-11-17'}));
 assert.equal(schedule(close,ids,day).newIds.length,20);assert.equal(schedule(later,ids,day).newIds.length,1);
 assert.equal(project(close,ids,day).days[0].newCount,20);assert.equal(project(later,ids,day).days[0].newCount,1);
});

test('partially finishing a daily new-word budget never replenishes it on every answer',()=>{
 const ids=Array.from({length:20},(_,i)=>'w'+i);let state=create(config({dailyCap:20,targetDay:'2026-10-26'}));
 assert.equal(schedule(state,ids,day).newIds.length,2);state=record(state,ids,'w0','green');
 assert.equal(schedule(state,ids,day).newIds.length,1);state=record(state,ids,'w1','green');
 const current=schedule(state,ids,day);assert.equal(current.newIds.length,0);assert.equal(current.completedIds.length,2);assert.equal(current.remainingCapacity,18);
 assert.equal(project(state,ids,day).days[0].newCount,2);
});

test('the seven-day forecast matches real daily schedules when future answers are all green',()=>{
 const ids=Array.from({length:20},(_,i)=>'w'+i);let state=create(config({dailyCap:4,targetDay:'2026-11-05'}));
 const forecast=project(state,ids,day);
 for(let offset=0;offset<7;offset++){
  const date=new Date(Date.parse(day+'T00:00:00Z')+offset*86_400_000).toISOString().slice(0,10),current=schedule(state,ids,date),expected=forecast.days[offset];
  assert.equal(current.newIds.length,expected.newCount,date+' new');assert.equal(current.reviewIds.length,expected.reviewCount,date+' review');assert.equal(current.totalCount,expected.totalCount,date+' total');
  for(const id of [...current.reviewIds,...current.newIds])state=record(state,ids,id,'green',date);
 }
});

test('a partial current day is included once in the forecast while its remaining tasks match the schedule',()=>{
 const ids=Array.from({length:20},(_,i)=>'w'+i);let state=create(config({dailyCap:4,targetDay:'2026-10-26'}));
 state=record(state,ids,'w0','green');const current=schedule(state,ids,day),forecast=project(state,ids,day);
 assert.equal(forecast.days[0].completedCount,1);assert.equal(forecast.days[0].newCount,current.completedNewIds.length+current.newIds.length);
 assert.equal(forecast.days[0].reviewCount,current.completedReviewIds.length+current.reviewIds.length);assert.equal(forecast.days[0].totalCount,current.totalCount);
 assert.deepEqual(current.newIds,['w1']);
});
