import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModel} from './helpers/load-model.mjs';
const model=loadModel('app/quizDistractors.ts');
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
 const discreet=term('discreet','谨慎的'),discrete=term('discrete','分离的'),far=term('mountain','高山');
 assert.deepEqual(rankQuizDistractors(discreet,[far,discrete]),[discrete,far]);
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

test('broad study senses reject near meanings rather than asking for fine distinctions',()=>{
 for(const [a,b] of [['减少','削弱的'],['非常谨慎的','审慎的'],['陈旧的','平凡的'],['赞扬','颂扬'],['简洁的','言简意赅的'],['慷慨的','大方的']])assert.equal(isAmbiguousQuizDistractor(term('first',a),term('second',b)),true,a+'/'+b);
 for(const [a,b] of [['明显','不明显'],['谨慎','鲁莽'],['有害','无害'],['增加','减少']])assert.equal(isAmbiguousQuizDistractor(term('first',a),term('second',b)),false,a+'/'+b);
});
test('additional POS families are excluded without excluding unrelated lookalikes',()=>{
 for(const [a,b] of [['generous','generosity'],['decide','decision'],['accurate','accuracy'],['vary','variation'],['signify','signification'],['create','creative']])assert.equal(areQuizMorphologicalVariants(a,b),true,a+'/'+b);
 assert.equal(areQuizMorphologicalVariants('ingenious','ingenuous'),false);
});

test('unpleasantness and malice families are broad exclusions even with qualifiers or another source sense',()=>{
 for(const [word,meaning,other,otherMeaning] of [
  ['brackish','令人恶心的','mawkish','恶心做作的'],
  ['brackish','令人恶心的','mawkish','多愁善感的'],
  ['target','令人感到反感的','alternative','引起作呕的'],
  ['malice','恶意，怨恨','malign','邪恶的,恶毒的；贬损,诋毁'],
  ['malice','恶意','malicious','恶毒的'],
  ['malign','贬损，诋毁','malevolence','恶意，狠毒'],
  ['first','(1) adj. 令人不快的；(2) v. 妨碍','second','adj.略微恶心做作的'],
 ]){
  assert.equal(isAmbiguousQuizDistractor(term(word,meaning),term(other,otherMeaning)),true,word+'/'+other);
  assert.equal(isAmbiguousQuizDistractor(term(other,otherMeaning),term(word,meaning)),true,'reverse '+word+'/'+other);
 }
 for(const [a,b] of [['无恶意','恶意'],['并非邪恶','邪恶'],['不那么明显','明显'],['不必要','必要'],['不安全','安全']])assert.equal(isAmbiguousQuizDistractor(term('not-catalog-a',a),term('not-catalog-b',b)),false,a+'/'+b);
 assert.equal(isAmbiguousQuizDistractor(term('malice','恶意'),term('malinger','装病')),false,'A shared mal- spelling is not a reason to conflate meanings');
});

test('POS families cover malicious/malice and malignant/malignancy without relying on a common prefix',()=>{
 for(const [a,b] of [['malice','malicious'],['malign','malignant'],['malignant','malignancy'],['malevolent','malevolence']])assert.equal(areQuizMorphologicalVariants(a,b),true,a+'/'+b);
 assert.equal(areQuizMorphologicalVariants('malice','malinger'),false);
});

test('wrong options are also semantically distinct from each other; shortage does not reintroduce unsafe choices',()=>{
 const answer=term('not-a-real-word','高山'),candidates=[term('fake-one','令人作呕'),term('fake-two','非常恶心做作的'),term('fake-three','恶意怨恨'),term('fake-four','恶毒的诋毁'),term('fake-five','几何图形')];
 const selected=model.selectQuizDistractors(answer,candidates,5);assert.equal(selected.length,3);
 for(let i=0;i<selected.length;i++)for(let j=0;j<i;j++)assert.equal(isAmbiguousQuizDistractor(selected[i],selected[j]),false);
 assert.deepEqual(model.selectQuizDistractors(answer,candidates,0),[]);
});
