import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const cache=new Map();
function load(file){file=path.resolve(file);if(!path.extname(file))file+=fs.existsSync(file+'.ts')?'.ts':'.json';if(cache.has(file))return cache.get(file);if(file.endsWith('.json'))return JSON.parse(fs.readFileSync(file));const out={};cache.set(file,out);new Function('exports','require',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText)(out,name=>load(path.resolve(path.dirname(file),name)));return out;}
const model=load('community/learningPlanModel.ts'),lists=load('community/listLearningPlanModel.ts'),agenda=load('community/learningAgendaModel.ts');
const day='2026-10-17',unit=(id,words,deck='glee')=>({id,deckId:deck,deckName:deck,label:id,words:words.map(id=>({id,word:id,occurrences:[]}))});
const plan=(extra={})=>model.createLearningPlan({id:'agenda-test',deckIds:['glee','bb'],startDay:day,targetDay:day,dailyCap:null,...extra});
function mark(s,units,word,color,date=day){return model.recordLearningPlanAnswer(s,units.flatMap(u=>u.words.map(w=>w.id)),word,color,date);}

test('one List can generate red, yellow and green suggestions on different dates from real ratings',()=>{
 const units=[unit('one',['a','b','c'])];let s=plan();for(const [w,c] of [['a','red'],['b','yellow'],['c','green']])s=mark(s,units,w,c);
 assert.deepEqual(lists.projectListPlan(s,units,day).days.filter(d=>d.reviewCount).map(d=>d.day),['2026-10-18','2026-10-19','2026-10-20']);
 const p=agenda.proposeAgenda(s,units,day);assert.deepEqual(p.tasks.map(t=>[t.day,t.wordIds]),[['2026-10-18',['a']],['2026-10-19',['b']],['2026-10-20',['c']]]);
});
test('preview, forecast and date edits never mutate real answers or the previously approved agenda',()=>{
 const units=[unit('one',['a','b']),unit('two',['c'])],s=plan(),before=structuredClone(s),draft=agenda.proposeAgenda(s,units,day);
 agenda.agendaForecast(draft,s,units,day);const previous=structuredClone(draft);agenda.proposeAgenda(s,units,'2026-10-18',draft);assert.deepEqual(draft,previous);assert.deepEqual(s,before);
});
test('missed partial work carries only unfinished words and pushes a new whole List past a hard cap',()=>{
 const units=[unit('one',['a','b']),unit('two',['c','d'])];let s=plan({dailyCap:2});const initial=agenda.proposeAgenda(s,units,day);s=mark(s,units,'a','green');
 const next=agenda.proposeAgenda(s,units,'2026-10-18',initial),carry=next.tasks.find(t=>t.carriedFrom);
 assert.equal(carry.day,'2026-10-18');assert.deepEqual(carry.wordIds,['b']);assert.equal(next.tasks.find(t=>t.unitId==='two').day,'2026-10-19');assert.deepEqual(agenda.agendaCapProblems(next,s,'2026-10-18'),[]);assert.equal(agenda.agendaReady(initial,s,units,'2026-10-18'),false);
});
test('a List larger than the cap stays whole and requires the learner to adjust',()=>{
 const units=[unit('one',['a','b','c'])],s=plan({dailyCap:2}),p={...agenda.proposeAgenda(s,units,day),tasks:[{id:'manual',unitId:'one',kind:'new',day,wordIds:['a','b','c']}]};
 assert.deepEqual(agenda.agendaCapProblems(p,s,day),[{day,count:3,cap:2}]);assert.equal(p.tasks[0].wordIds.length,3);
});
test('cap accounting deduplicates words shared by different source Lists and current-day answers',()=>{
 const units=[unit('one',['a','b']),unit('two',['b','c'],'bb')];let s=plan({dailyCap:3});s=mark(s,units,'a','yellow');const p=agenda.proposeAgenda(s,units,day);
 assert.deepEqual(agenda.agendaCapProblems(p,s,day),[]);assert.equal(lists.scheduleListPlan(s,units,day).completedWordCount,1);
});
test('a manual review uses the chosen date while the next advice still comes from actual history',()=>{
 const units=[unit('one',['a'])];let s=mark(plan(),units,'a','green');const p=agenda.proposeAgenda(s,units,day);p.mode='manual';p.tasks[0].day='2026-10-22';
 assert.equal(agenda.agendaForecast(p,s,units,day).days.find(d=>d.reviewCount).day,'2026-10-22');assert.equal(lists.wordReview(s,'a',day).due,'2026-10-20');
 s=mark(s,units,'a','red','2026-10-22');assert.deepEqual(agenda.pendingTaskWords(p.tasks[0],s,'2026-10-22'),[]);assert.equal(lists.wordReview(s,'a','2026-10-22').due,'2026-10-23');
});
test('confirming an empty manual day can mean rest without manufacturing completion',()=>{
 const units=[unit('one',['a'])],s=plan(),p={...agenda.proposeAgenda(s,units,day),mode:'manual',tasks:[]};
 assert.equal(agenda.agendaReady(p,s,units,day),true);assert.deepEqual(s.answers,{});assert.equal(agenda.agendaForecast(p,s,units,day).expectedFirstPassDay,null);
});
test('new-word future reservations never invent a next review or fictitious success',()=>{
 const units=[unit('one',['a']),unit('two',['b'])],s=plan(),p=agenda.proposeAgenda(s,units,day);
 assert.ok(p.tasks.every(t=>t.kind==='new'));assert.ok(agenda.agendaForecast(p,s,units,day).days.every(d=>d.reviewCount===0));assert.deepEqual(s.answers,{});
});
test('only a new actual day advances a due green; early repeated greens cannot fast-forward',()=>{
 const units=[unit('one',['a'])];let s=mark(plan(),units,'a','green');s=mark(s,units,'a','green','2026-10-18');assert.equal(lists.wordReview(s,'a','2026-10-18').due,'2026-10-20');s=mark(s,units,'a','green','2026-10-20');assert.equal(lists.wordReview(s,'a','2026-10-20').due,'2026-10-27');
});
test('agenda parsing rejects invalid dates, another plan and duplicate task IDs while preserving its input',()=>{
 const units=[unit('one',['a'])],s=plan(),p=agenda.proposeAgenda(s,units,day);assert.ok(agenda.readAgenda(JSON.stringify(p),s.config.id));
 assert.equal(agenda.readAgenda(JSON.stringify(p),'other'),null);assert.equal(agenda.readAgenda(JSON.stringify({...p,tasks:[...p.tasks,...p.tasks]}),s.config.id),null);assert.equal(agenda.readAgenda(JSON.stringify({...p,approvedOn:'2026-02-30'}),s.config.id),null);
});
test('a selected-deck change cannot open tasks that no longer belong to the plan',()=>{
 const units=[unit('one',['a']),unit('two',['b'],'bb')],s=plan(),p=agenda.proposeAgenda(s,units,day);
 assert.deepEqual(agenda.validAgendaTasks(p,[units[0]]).map(t=>t.unitId),['one']);
});
test('source navigation carries the actual BB volume/List and math category without changing ratings',()=>{
 const nav=load('community/planNavigation.ts');const bb={...unit('bb:下-list-31',['a'],'bb')};bb.words[0].occurrences=[{deckId:'bb',entryId:'bb-lower-1',list:31,volume:'下'}];assert.deepEqual(nav.planNavigation(bb,'target'),{id:'target',deckId:'bb',list:31,volume:'下',category:undefined,batchId:undefined});
});
test('adopting old ratings reads correct A+ directions and BB groups without inventing past learning dates',()=>{
 const existing=load('community/existingPlanRatings.ts'),words=[{id:'core',word:'core',occurrences:[{deckId:'a-plus',entryId:'p1',role:'core',slot:0}]},{id:'synonym',word:'synonym',occurrences:[{deckId:'a-plus',entryId:'p1',role:'equivalent',slot:1},{deckId:'bb',entryId:'b1',slot:0}]},{id:'other',word:'other',occurrences:[{deckId:'bb',entryId:'b1',slot:1}]}];
 const snapshot={rows:[{key:'quick-rating:a-plus:p1:word',value:'"familiar"'}],storage:{'gre-a-plus-equivalent-quick-ratings-v1':'{"p1:equivalents":"fuzzy"}','gre-bb-ratings-v1':'{"b1":"unknown"}'}};const before=structuredClone(snapshot);
 assert.deepEqual({...existing.existingPlanRatings(snapshot,words,['a-plus','bb'])},{core:'green',synonym:'red',other:'red'});assert.deepEqual(snapshot,before);
});

test('a first green after an uncertain color starts at three days, not an advanced green interval',()=>{
 const units=[unit('one',['a'])];let s=mark(plan(),units,'a','red');s=mark(s,units,'a','green','2026-10-18');assert.equal(lists.wordReview(s,'a','2026-10-18').due,'2026-10-21');s=mark(s,units,'a','green','2026-10-21');assert.equal(lists.wordReview(s,'a','2026-10-21').due,'2026-10-28');
});
test('an old planned date cannot backdate a real first encounter in the completion estimate',()=>{
 const units=[unit('one',['a'])];let s=mark(plan(),units,'a','green','2026-10-20');const p={version:1,planId:s.config.id,approvedOn:day,mode:'manual',tasks:[{id:'old',unitId:'one',kind:'new',day,wordIds:['a']}]};assert.equal(agenda.agendaForecast(p,s,units,'2026-10-20').expectedFirstPassDay,'2026-10-20');
});

test('an auto draft names every remaining List beyond the seven-day chart so each date can be edited',()=>{
 const units=Array.from({length:12},(_,i)=>unit('list'+i,['w'+i]));const s=plan({targetDay:'2026-10-28'}),p=agenda.proposeAgenda(s,units,day);assert.equal(p.tasks.length,12);assert.equal(p.tasks.at(-1).day,'2026-10-28');assert.equal(new Set(p.tasks.map(t=>t.unitId)).size,12);assert.deepEqual(s.answers,{});
});

test('removing a new task from a confirmed auto schedule is respected until requesting fresh suggestions',()=>{
 const units=[unit('one',['a']),unit('two',['b'])],s=plan(),p=agenda.proposeAgenda(s,units,day);p.tasks=p.tasks.filter(t=>t.unitId==='one');assert.equal(agenda.proposeAgenda(s,units,day,p).tasks.some(t=>t.unitId==='two'),false);assert.equal(agenda.proposeAgenda(s,units,day,p,true).tasks.some(t=>t.unitId==='two'),true);
});
