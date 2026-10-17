import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './helpers/load-ts.mjs';
const {mergeWorkspaceSnapshots}=loadTs('community/ratingMerge.ts');
const empty=()=>({version:1,rows:[],storage:{}});
const key=(word,day='2026-10-17',plan='plan-1')=>`lemnota-plan-answer:${plan}:${encodeURIComponent(word)}:${day}`;
const answered=(word,value,day,plan)=>({...empty(),storage:{[key(word,day,plan)]:JSON.stringify(value)}});
const merge=(a,b,base=empty())=>mergeWorkspaceSnapshots(base,a,b);

test('phone and tablet answers to different words or dates survive together',()=>{
 const phone=answered('words:one','green'),tablet=answered('bb:two/二','yellow');
 tablet.storage[key('words:one','2026-10-18')]='"green"';
 const result=merge(phone,tablet);
 assert.deepEqual(result.storage,{...phone.storage,...tablet.storage});
 assert.deepEqual(merge(tablet,phone),result);
 assert.deepEqual(result.rows,[],'Plan answers do not create or replace vocabulary SQL rows');
});

test('same-word same-day answers keep the lowest rating and count as one key',()=>{
 for(const [one,two,expected] of [['green','yellow','yellow'],['green','red','red'],['yellow','red','red'],['green','green','green']]){
  const phone=answered('words:one',one),tablet=answered('words:one',two);
  assert.deepEqual(merge(phone,tablet).storage,{[key('words:one')]:JSON.stringify(expected)});
  assert.deepEqual(merge(phone,tablet),merge(tablet,phone));
 }
 const red=answered('words:one','red'),green=answered('words:one','green');
 assert.equal(merge(green,green,red).storage[key('words:one')],'"red"','The base already records a real missed answer that day');
});

test('daily-answer merge is idempotent, commutative and associative',()=>{
 const a=answered('one','green'),b=answered('one','yellow'),c=answered('one','red');
 b.storage[key('two')]='"green"';c.storage[key('one','2026-10-18')]='"yellow"';
 assert.deepEqual(merge(a,a),a);
 assert.deepEqual(merge(a,b),merge(b,a));
 assert.deepEqual(merge(merge(a,b),c),merge(a,merge(b,c)));
 assert.deepEqual(merge(empty(),empty(),a),a,'Normal merging retains daily facts; explicit workspace replacement handles resets');
});

test('plan identity separates answer history and a leap date remains valid',()=>{
 const first=answered('one','red','2028-02-29','plan-1'),second=answered('one','green','2028-02-29','plan-2');
 assert.deepEqual(merge(first,second).storage,{...first.storage,...second.storage});
});

test('malformed keys and invalid answer values retain ordinary conflict protection',()=>{
 const malformed=[
  'lemnota-plan-answer:plan-1:one:2026-02-30',
  'lemnota-plan-answer:plan-1:one:2026-13-01',
  'lemnota-plan-answer:plan-1:raw:colon:2026-10-17',
  'lemnota-plan-answer:plan-1:bad%ZZ:2026-10-17',
  'lemnota-plan-answer:plan-1:%6fne:2026-10-17',
  'lemnota-plan-answer:plan-1:%00:2026-10-17',
  'lemnota-plan-answer::one:2026-10-17',
  'lemnota-plan-answer:plan/1:one:2026-10-17',
  'lemnota-plan-answer:plan-1:one:2026-10-17:extra',
 ];
 for(const field of malformed){
  const a={...empty(),storage:{[field]:'"red"'}},b={...empty(),storage:{[field]:'"green"'}};
  assert.throws(()=>merge(a,b),/同一份笔记或设置/);
  assert.deepEqual(merge(empty(),a).storage,a.storage,'Unrecognized keys are kept as ordinary storage, never interpreted as answers');
 }
 for(const raw of ['green','{"color":"green"}','null','"blue"']){
  const a={...empty(),storage:{[key('one')]:raw}},b=answered('one','red');
  assert.throws(()=>merge(a,b),/同一份笔记或设置/);
  assert.equal(a.storage[key('one')],raw);
 }
});

test('plan settings, private notes and unrelated storage keep their existing conflict rules',()=>{
 const settings='lemnota-learning-plan-v1';
 const config={version:1,config:{id:'plan-1',deckIds:['words'],startDay:'2026-10-17',targetDay:'2026-11-17',dailyCap:20},paused:false};
 const base={...empty(),storage:{[settings]:JSON.stringify(config),note:'original'}};
 const phone=structuredClone(base),tablet=structuredClone(base);
 phone.storage[settings]=JSON.stringify({...config,paused:true});phone.storage[key('one')]='"green"';
 tablet.storage[key('two')]='"red"';
 assert.deepEqual(merge(phone,tablet,base).storage,{...phone.storage,[key('two')]:'"red"'});
 tablet.storage[settings]=JSON.stringify({...config,config:{...config.config,dailyCap:30}});
 assert.throws(()=>merge(phone,tablet,base),/同一份笔记或设置/);
 tablet.storage[settings]=base.storage[settings];phone.storage.note='phone note';tablet.storage.note='tablet note';
 assert.throws(()=>merge(phone,tablet,base),/同一份笔记或设置/);
 assert.equal(phone.storage.note,'phone note');assert.equal(tablet.storage.note,'tablet note');
});
