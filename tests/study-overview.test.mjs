import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
function loader(){const cache=new Map();function load(file){file=path.resolve(file);if(!path.extname(file))file+=fs.existsSync(file+'.ts')?'.ts':'.json';if(cache.has(file))return cache.get(file);if(file.endsWith('.json'))return JSON.parse(fs.readFileSync(file));const out={};cache.set(file,out);new Function('exports','require',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText)(out,name=>load(path.resolve(path.dirname(file),name)));return out;}return load;}
const load=loader(),m=load('community/studyOverviewModel.ts'),checks=load('community/planTaskChecks.ts'),sync=load('community/ratingMerge.ts'),storage=load('community/storage.ts'),goals=load('community/studyRoundStore.ts');
const today='2026-10-18',units=[{id:'a:list-1',deckId:'a',deckName:'A',label:'List 01',words:[{id:'alpha'},{id:'beta'}]},{id:'b:list-1',deckId:'b',deckName:'B',label:'List 01',words:[{id:'alpha'},{id:'gamma'}]}];
const record=(unit,n,day,done=true)=>[m.roundKey(unit,n),JSON.stringify(m.checkedRound(unit,n,day,done,today))];
test('past round dates work without a plan; correcting and unchecking removes the superseded encounter only',()=>{
 const s=Object.fromEntries([record(units[0].id,1,'2026-10-17'),record(units[0].id,2,today)]);let p=m.studyOverview(s,units,today);assert.equal(p.rows[0].doneCount,2);assert.equal(p.memory.get('alpha').firstDay,'2026-10-17');
 s[m.roundKey(units[0].id,1)]=JSON.stringify(m.checkedRound(units[0].id,1,'2026-10-15',true,today));p=m.studyOverview(s,units,today);assert.equal(p.memory.get('alpha').firstDay,'2026-10-15');assert.equal(p.memory.get('alpha').lastDay,today);
 s[m.roundKey(units[0].id,2)]=JSON.stringify(m.checkedRound(units[0].id,2,today,false,today));p=m.studyOverview(s,units,today);assert.equal(p.memory.get('alpha').lastDay,'2026-10-15');assert.equal(p.days[0].reviewIds[0],units[0].id);assert.equal(p.days[1].reviewIds.length,0);assert.equal(Object.keys(s).length,2);
});
test('forecast counts only the next real review, deduplicates shared due words, and never invents new learning',()=>{
 const s=Object.fromEntries([record(units[0].id,1,'2026-10-15'),record(units[1].id,1,'2026-10-15')]),p=m.studyOverview(s,units,today);assert.equal(p.days[0].reviewIds.length,2);assert.equal(p.days[0].reviewWords.size,3);assert.ok(p.days.slice(1).every(d=>d.reviewIds.length===0));assert.ok(p.days.every(d=>d.newIds.length===0));
});
test('old manual confirmations remain readable and explicit date overrides never leave the old date active',()=>{
 const c={taskId:'past',unitId:units[0].id,day:'2026-10-14',wordIds:['alpha','beta'],done:true},key=checks.taskCheckKey('old',c.taskId),s={[key]:JSON.stringify(c),'lemnota-learning-plan-v1':'unmodified legacy config'};
 assert.equal(m.studyOverview(s,units,today).rows[0].doneCount,1);s[m.roundKey(c.unitId,1)]=JSON.stringify(m.checkedRound(c.unitId,1,'2026-10-17',true,today));assert.equal(m.studyOverview(s,units,today).memory.get('alpha').firstDay,'2026-10-17');assert.equal(s[key],JSON.stringify(c));
});
test('real dated colors work without plan settings and a manual undo cannot erase actual self-checks',()=>{
 const s={'lemnota-plan-answer:study-log:alpha:2026-10-17':'"red"',...Object.fromEntries([record(units[0].id,1,'2026-10-15',false)])},p=m.studyOverview(s,units,today);assert.equal(p.days[0].reviewIds.length,0);assert.equal(p.memory.get('alpha').color,'red');assert.equal(p.rows[0].doneCount,0);assert.equal(s['lemnota-plan-answer:study-log:alpha:2026-10-17'],'"red"');
});
test('different devices merge independent List rounds; same-round conflicts remain protected',()=>{
 const empty={version:1,rows:[],storage:{}},phone={...empty,storage:Object.fromEntries([record(units[0].id,1,today)])},tablet={...empty,storage:Object.fromEntries([record(units[1].id,1,today)])},merged=sync.mergeWorkspaceSnapshots(empty,phone,tablet);assert.equal(m.studyOverview(merged.storage,units,today).rows.filter(r=>r.doneCount===1).length,2);
 assert.throws(()=>sync.mergeWorkspaceSnapshots(empty,phone,{...empty,storage:Object.fromEntries([record(units[0].id,1,'2026-10-17')])}),/两台设备修改了同一份/);
});
test('daily completion, master undo, date correction and recheck use one stable round key',()=>{
 storage.loadStorage({});const goal={id:'goal1',unitId:units[0].id,kind:'new',day:today,done:true};storage.studyStorage.setItem('lemnota-daily-goal:'+today+':goal1',JSON.stringify(goal));goals.completeGoalRound(goal,units,today);let r=m.readListRounds(storage.exportStorage());assert.equal(r.length,1);assert.equal(r[0].round,1);assert.equal(goals.goalRoundDone(goal),true);
 storage.studyStorage.setItem(m.roundKey(goal.unitId,1),JSON.stringify({...r[0],done:false}));assert.equal(goals.goalRoundDone(goal),false);assert.equal(m.studyOverview(storage.exportStorage(),units,today).rows[0].doneCount,0);
 goals.completeGoalRound(goal,units,today);r=m.readListRounds(storage.exportStorage());assert.equal(r.length,1);assert.equal(r[0].done,true);const review={...goal,id:'goal2',kind:'review'};goals.completeGoalRound(review,units,today);assert.equal(m.readListRounds(storage.exportStorage()).length,2);assert.equal(m.studyOverview(storage.exportStorage(),units,today).rows[0].doneCount,2);
});
test('invalid or future dates cannot be saved or counted',()=>{assert.throws(()=>m.checkedRound('a',1,'2026-02-30',true,today));assert.throws(()=>m.checkedRound('a',1,'2026-10-19',true,today));assert.throws(()=>m.checkedRound('a',31,today,true,today));const future=JSON.stringify({unitId:units[0].id,round:1,day:'2026-10-19',done:true});assert.equal(m.studyOverview({[m.roundKey(units[0].id,1)]:future},units,today).rows[0].doneCount,0);});
test('legacy automatic completions come from actual dates; untouched future reservations do not enter the table',()=>{
 const s={'lemnota-learning-plan-v1':JSON.stringify({config:{id:'old',startDay:'2026-10-15'}}),'lemnota-learning-agenda:old':JSON.stringify({planId:'old',tasks:[{id:'done',unitId:units[0].id,day:'2026-10-15',kind:'new',wordIds:['alpha','beta']},{id:'future',unitId:units[1].id,day:'2026-10-19',kind:'new',wordIds:['alpha','gamma']}]}),'lemnota-plan-answer:old:alpha:2026-10-15':'"green"','lemnota-plan-answer:old:beta:2026-10-16':'"red"'},before=JSON.stringify(s),p=m.studyOverview(s,units,today);
 assert.equal(p.rows[0].rounds.get(1).day,'2026-10-16');assert.equal(p.rows[1].doneCount,0);assert.equal(JSON.stringify(s),before);
});
