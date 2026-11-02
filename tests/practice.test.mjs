import test from 'node:test';import assert from 'node:assert/strict';import {loadModel} from './helpers/load-model.mjs';
const model=loadModel('community/practiceModel.ts');
const {grade,optionsFor}=model;
test('first success completes; mistakes reset streak and require two consecutive successes',()=>{assert.equal(grade(undefined,true).done,true);let r=grade(undefined,false);r=grade(r,true);assert.equal(r.done,false);r=grade(r,false);assert.equal(r.streak,0);r=grade(r,true);assert.equal(r.done,false);assert.equal(grade(r,true).done,true);});
test('choices exclude linked synonyms and duplicate labels in both directions',()=>{const term={id:'a',word:'a',meaning:'甲',list:1,synonyms:['b']};const pool=[term,{id:'b',word:'b',meaning:'甲同义',list:1},{id:'c',word:'c',meaning:'相关',list:1},...Array.from({length:12},(_,i)=>({id:String(i),word:'word'+i,meaning:'义'+i,list:1}))];for(const direction of ['en-zh','zh-en'])for(const synonyms of [true,false]){const opts=optionsFor(term,pool,direction,[['a','b'],['b','c']],synonyms);assert.equal(opts.length,synonyms?6:4);assert.equal(opts.filter(o=>o.correct).length,1);assert.ok(opts.filter(o=>!o.correct).every(o=>!['a','b','c'].includes(o.word)));assert.equal(new Set(opts.map(o=>direction==='en-zh'&&!synonyms?o.meaning:o.word)).size,opts.length);}});

test('paired A+ and BB practice only asks synonyms after a correct meaning',()=>{for(const pair of [true,false]){const wrong=model.answerStep('meaning',pair,false,false);assert.equal(wrong.phase,'feedback');assert.equal(wrong.correct,false);assert.equal(wrong.meaningOK,false);assert.equal(wrong.feedbackStep,'meaning');}const right=model.answerStep('meaning',true,true,false);assert.equal(right.phase,'synonym');assert.equal(right.meaningOK,true);assert.equal(model.answerStep('synonym',true,true,true).correct,true);assert.equal(model.answerStep('synonym',true,false,true).correct,false);});

const term=(id,word,meaning)=>({id,word,meaning,list:1});
test('live practice excludes the reported ambiguous pairs in both question directions and either order',()=>{
 for(const [left,right] of [['synonymous','like-minded'],['fusty','platitudinous']])for(const reverse of [false,true])for(const direction of ['en-zh','zh-en']){
  const [answerWord,excludedWord]=reverse?[right,left]:[left,right];
  const answer=term('answer',answerWord,'题目原义'),excluded=term('excluded',excludedWord,'其他义项'),safe=term('safe','mountain','高山');
  const choices=optionsFor(answer,[answer,excluded,safe],direction,[]);
  assert.equal(choices.filter(option=>option.correct).length,1);
  assert.equal(choices.find(option=>option.correct).word,answerWord,'Excluding ambiguity must never change the correct answer');
  assert.ok(!choices.some(option=>option.word===excludedWord),`${answerWord} must not treat ${excludedWord} as wrong in ${direction}`);
  assert.ok(choices.some(option=>option.word==='mountain'));
 }
});

test('live practice excludes family POS variants and prioritizes a safe lookalike over distant fallbacks',()=>{
 const collect=term('collect','collect','收集'),family=[term('collection','collection','藏品'),term('collected','collected','镇定的')],safe=term('safe','connect','连接');
 for(const direction of ['en-zh','zh-en'])assert.deepEqual(optionsFor(collect,[collect,...family,safe],direction,[]).map(option=>option.word).sort(),['collect','connect']);
 const affect=term('affect','affect','影响'),effect=term('effect','effect','结果');
 const distant=['mountain','ocean','lantern','galaxy','breeze','transparent'].map((word,i)=>term('far'+i,word,'不同义项'+i));
 const originalRandom=Math.random;try{
  Math.random=()=>.999999; // Preserve input order so a last-position lookalike must earn its place.
  for(const direction of ['en-zh','zh-en']){
   const choices=optionsFor(affect,[affect,...distant,effect],direction,[]);
   assert.equal(choices.length,4);assert.ok(choices.some(option=>option.word==='effect'&&!option.correct));assert.equal(choices.filter(option=>option.correct).length,1);
  }
 }finally{Math.random=originalRandom;}
});

test('resuming repairs only an ungraded unsafe choice list while historical feedback and grading stay untouched',()=>{
 const answer=term('answer','fusty','霉味的'),unsafe=term('unsafe','platitudinous','陈词滥调的'),safe=term('safe','mountain','高山');
 const old={queue:[answer.id],phase:'meaning',direction:'en-zh',selected:1,options:[{word:answer.word,meaning:answer.meaning,correct:true},{word:unsafe.word,meaning:unsafe.meaning,correct:false}],turn:12,results:{answer:{streak:1,errors:2,done:false}},attemptCounts:{answer:3},lookback:[{id:'earlier-receipt'}]};
 const before=structuredClone(old),refreshed=model.refreshPracticeOptions(old,[answer,unsafe,safe],[]);
 assert.notEqual(refreshed,old);assert.equal(refreshed.selected,null);assert.ok(!refreshed.options.some(option=>option.word===unsafe.word));
 assert.equal(refreshed.results,old.results);assert.equal(refreshed.lookback,old.lookback);assert.equal(refreshed.attemptCounts,old.attemptCounts);assert.equal(refreshed.turn,12);assert.deepEqual(old,before);
 const feedback={...old,phase:'feedback'};assert.equal(model.refreshPracticeOptions(feedback,[answer,unsafe,safe],[]),feedback,'Submitted feedback is an immutable answer receipt');
 const safeRun={...old,options:refreshed.options};assert.equal(model.refreshPracticeOptions(safeRun,[answer,unsafe,safe],[]),safeRun,'A safe saved question and its unsubmitted selection remain intact');
});
