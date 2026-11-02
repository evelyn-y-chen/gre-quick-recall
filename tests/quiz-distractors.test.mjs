import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const model={};
new Function('exports',ts.transpileModule(fs.readFileSync('app/quizDistractors.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(model);
const {areQuizWordsConfusable,quizMeaningKeys,isAmbiguousQuizDistractor,areQuizMorphologicalVariants,rankQuizDistractors}=model;
const term=(word,meaning)=>({word,meaning});

test('manual ambiguity exclusions are symmetric and do not turn lookalikes into synonyms',()=>{
 for(const [left,right] of [['synonymous','like-minded'],['fusty','platitudinous']]){
  assert.equal(areQuizWordsConfusable(left,right),true);
  assert.equal(areQuizWordsConfusable(right,left),true);
  assert.equal(isAmbiguousQuizDistractor(term(left,'义项一'),term(right,'义项二')),true);
 }
 assert.equal(areQuizWordsConfusable('synonymous','LIKE MINDED'),true);
 assert.equal(areQuizWordsConfusable('affect','effect'),false);
});

test('meaning overlap ignores POS/source formatting and conservative CJK aliases',()=>{
 assert.equal(isAmbiguousQuizDistractor(term('answer','adj. 明显的；次要的'),term('candidate','【词库】形容词：显而易见的')),true);
 assert.deepEqual([...quizMeaningKeys('ａｄｊ． 无害的；n. 标记（来源注）')],['无害','标记']);
 assert.equal(isAmbiguousQuizDistractor(term('answer','无害的'),term('candidate','形容词:没有危害的')),true);
 assert.equal(isAmbiguousQuizDistractor(term('answer','影响'),term('candidate','结果')),false);
});

test('regular inflections and POS family variants cannot be distractors',()=>{
 for(const [left,right] of [['collect','collecting'],['collect','collected'],['happy','happiness'],['happy','happily'],['stable','stability'],['sensitive','sensitivity'],['curious','curiosity'],['differ','different'],['differ','difference'],['rationalize','rationalization'],['specific','specificity'],['effect','effective']]){
  assert.equal(areQuizMorphologicalVariants(left,right),true,left+' / '+right);
  assert.equal(areQuizMorphologicalVariants(right,left),true,right+' / '+left);
 }
 assert.equal(areQuizMorphologicalVariants('affect','effect'),false);
 assert.equal(areQuizMorphologicalVariants('ingenious','ingenuous'),false);
});

test('safe one-to-three-edit lookalikes precede unrelated fallback choices',()=>{
 const affect=term('affect','影响'),effect=term('effect','结果'),far=term('mountain','高山');
 assert.deepEqual(rankQuizDistractors(affect,[far,effect]),[effect,far]);
 const ingenious=term('ingenious','巧妙的'),ingenuous=term('ingenuous','天真的');
 assert.deepEqual(rankQuizDistractors(ingenious,[far,ingenuous]),[ingenuous,far]);
});

test('ranking excludes already-correct meanings, manual overlap and mere word-family POS changes',()=>{
 const answer=term('collect','收集'),sameMeaning=term('gather','v. 收集'),variant=term('collection','名词意义另列'),safe=term('connect','连接');
 assert.deepEqual(rankQuizDistractors(answer,[sameMeaning,variant,safe]),[safe]);
 assert.deepEqual(rankQuizDistractors(term('fusty','义项甲'),[term('platitudinous','义项乙')]),[]);
});

test('ties preserve prior shuffle, input objects/arrays remain unchanged, and safe fallback fills gaps',()=>{
 const answer=term('cater','提供餐饮'),first=term('later','后来'),second=term('water','水'),far1=term('mountain','山'),far2=term('transparent','透明');
 const input=[far1,second,far2,first],before=structuredClone(input);
 const result=rankQuizDistractors(answer,input);
 assert.deepEqual(result,[second,first,far1,far2]);
 assert.deepEqual(input,before);
 assert.equal(result[0],second);
 assert.notEqual(result,input);
});
