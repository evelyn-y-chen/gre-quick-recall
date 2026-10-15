import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const TODAY='2026-10-15', TOMORROW='2026-10-16';
const words=[
 {id:'w1',word:'alpha',meaning:'甲',list:1},{id:'w2',word:'bravo',meaning:'乙',list:1},
 {id:'w3',word:'charlie',meaning:'丙',list:2},{id:'w4',word:'delta',meaning:'丁',list:2},
 {id:'w5',word:'echo',meaning:'戊',list:3},{id:'w6',word:'foxtrot',meaning:'己',list:3},
 {id:'w7',word:'golf',meaning:'庚',list:3},{id:'w8',word:'hotel',meaning:'辛',list:3},
];
const bb=[
 {id:'b1',list:1,words:[{word:'abate',meaning:'减弱'},{word:'diminish',meaning:'减少'}]},
 {id:'b2',list:2,words:[{word:'abundant',meaning:'丰富的'},{word:'plentiful',meaning:'充足的'}]},
 {id:'b3',list:3,words:[{word:'concise',meaning:'简明的'},{word:'terse',meaning:'简洁的'}]},
 {id:'b4',list:3,words:[{word:'diligent',meaning:'勤奋的'},{word:'industrious',meaning:'勤勉的'}]},
];
const runKey=deck=>'lemnota-practice-'+deck;
const reviewKey=deck=>'lemnota-practice-review-'+deck+'-v1';
const passed={streak:1,errors:0,done:true};
const mature={level:5,due:'2026-11-20',lastDay:'2026-10-01',reviews:10};

// Run the real component and scheduling model in a tiny synchronous hook host.
// Only vocabulary, unrelated telemetry/notes, browser events and the clock are substituted.
function practice({deck='words',data={}}={}){
 const nativeDate=Date;
 class FixedDate extends nativeDate{constructor(...args){super(...(args.length?args:['2026-10-15T04:00:00Z']));}static now(){return nativeDate.parse('2026-10-15T04:00:00Z');}}
 const modules=new Map();let uuid=0,hooks=[],effects=[],cursor=0,dirty=false,tree,closed=0;
 const listeners=new Map();
 const browser={addEventListener(name,fn){listeners.set(name,fn);},removeEventListener(name,fn){if(listeners.get(name)===fn)listeners.delete(name);}};
 const doc={...browser,body:{style:{overflow:''}}};
 const slot=()=>cursor++;
 const react={
  useState(initial){const i=slot();if(!(i in hooks))hooks[i]=typeof initial==='function'?initial():initial;return [hooks[i],value=>{const next=typeof value==='function'?value(hooks[i]):value;if(!Object.is(hooks[i],next)){hooks[i]=next;dirty=true;}}];},
  useRef(initial){const i=slot();return hooks[i]??(hooks[i]={current:initial});},
  useEffect(effect,deps){const i=slot(),old=hooks[i];if(!old||!deps||deps.some((dep,n)=>dep!==old.deps?.[n])){hooks[i]={deps,cleanup:old?.cleanup};effects.push(()=>{hooks[i].cleanup?.();hooks[i].cleanup=effect();});}},
 };
 const jsx=(type,props)=>({type,props:props??{}});
 function load(name){
  if(name==='react')return react;
  if(name==='react/jsx-runtime')return {jsx,jsxs:jsx};
  if(name.endsWith('/vocabulary.json'))return {default:words};
  if(name.endsWith('/bbEquivalents.json'))return {default:bb};
  if(name.endsWith('/aPlusEquivalents.json')||name.endsWith('/equivalents.json'))return {default:[]};
  if(name==='../app/SharedWordMemory')return {default:()=>null};
  if(name==='./analytics')return {trackUsage(){}};
  if(name==='./practiceCompletions')return {recordCompletedPractice(){},recordPracticeWord(){},recordPracticeWords(){}};
  if(!['./storage','./practiceModel','./practiceReviewModel','./Practice'].includes(name))throw Error('Unexpected import: '+name);
  if(modules.has(name))return modules.get(name);
  const module={exports:{}};modules.set(name,module.exports);
  const source=readFileSync('community/'+name.slice(2)+(name==='./Practice'?'.tsx':'.ts'),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  new Function('require','module','exports','Date','window','document','setInterval','clearInterval','crypto',code)(load,module,module.exports,FixedDate,browser,doc,()=>1,()=>{},{randomUUID:()=>`test-session-${++uuid}`});
  modules.set(name,module.exports);return module.exports;
 }
 const storage=load('./storage');storage.loadStorage(data);
 const Component=load('./Practice').default;
 function render(){
  for(let attempt=0;attempt<10;attempt++){
   dirty=false;cursor=0;tree=Component({deck,onClose(){closed++;}});
   while(effects.length)effects.shift()();
   if(!dirty)return tree;
  }
  throw Error('Hook host did not settle');
 }
 function nodes(node){if(node==null||typeof node!=='object')return [];if(Array.isArray(node))return node.flatMap(nodes);return [node,...nodes(node.props?.children)];}
 function text(node){if(Array.isArray(node))return node.map(text).join('');if(node==null||typeof node==='boolean')return '';if(typeof node==='object')return text(node.props?.children);return String(node);}
 function find(type,label){return nodes(tree).find(node=>node.type===type&&text(node).includes(label));}
 function click(label){const button=find('button',label);assert.ok(button,`Missing button: ${label}`);assert.equal(!!button.props.disabled,false,`Disabled button: ${label}`);button.props.onClick({type:'click',preventDefault(){},stopPropagation(){}});render();}
 function read(key){return JSON.parse(storage.studyStorage.getItem(key)??'null');}
 function clean(){for(const entry of hooks)entry?.cleanup?.();hooks=[];effects=[];cursor=0;}
 render();
 return {
  click,find,text:()=>text(tree),snapshot:()=>storage.exportStorage(),run:()=>read(runKey(deck)),history:()=>read(reviewKey(deck)),
  range(from,to){const inputs=nodes(tree).filter(node=>node.type==='input'&&node.props.type==='number');assert.equal(inputs.length,2);inputs[0].props.onChange({target:{value:String(from)}});inputs[1].props.onChange({target:{value:String(to)}});render();},
  answer(correct){const run=read(runKey(deck));const index=run.options.findIndex(option=>option.correct===correct);assert.ok(index>=0,'Expected an answer choice');const choices=nodes(tree).filter(node=>node.type==='button'&&Object.hasOwn(node.props,'aria-pressed'));choices[index].props.onClick({type:'click'});render();click('提交答案');},
  remount(nextDeck=deck,workspace){clean();if(workspace)storage.loadStorage(workspace);deck=nextDeck;render();},
  close:clean,closed:()=>closed,
 };
}

function legacyRun(ids,results,pair=false){return {queue:ids,direction:'en-zh',pair,results,phase:'meaning',options:[],selected:null,meaningOK:false,turn:3};}

for(const deck of ['words','bb']){
 test(`${deck} migrates only answered legacy entries and starts due review across List boundaries`,()=>{
  const ids=deck==='words'?['w1','w3','w2']:['b1:0','b2:0','b1:1'];
  const view=practice({deck,data:{[runKey(deck)]:JSON.stringify(legacyRun(ids,{[ids[0]]:passed,[ids[1]]:{streak:0,errors:1,done:false},[ids[2]]:{streak:0,errors:0,done:false}},deck==='bb'))}});
  try{
   assert.ok(view.find('button','开始到期复习'));
   assert.deepEqual(Object.keys(view.history()).sort(),ids.slice(0,2).sort());
   for(const record of Object.values(view.history()))assert.equal(record.due,TODAY);
   view.range(3,3);view.click('开始到期复习');
   assert.deepEqual([...view.run().queue].sort(),ids.slice(0,2).sort());
   assert.equal(view.run().review,true);
  }finally{view.close();}
 });
}

test('starting a new test uses the selected Lists even when there are due words elsewhere',()=>{
 const view=practice({data:{[reviewKey('words')]:JSON.stringify({w1:{level:0,due:TODAY,lastDay:'',reviews:0}})}});
 try{view.range(2,2);view.click('开始新测试');assert.deepEqual([...view.run().queue].sort(),['w3','w4']);assert.equal(view.run().review,false);}finally{view.close();}
});

test('a correct BB meaning is intermediate and leaves its existing review schedule untouched',()=>{
 const view=practice({deck:'bb',data:{[reviewKey('bb')]:JSON.stringify({'b1:0':mature,'b1:1':mature})}});
 try{
  view.click('开始新测试');const id=view.run().queue[0],before=view.history();
  view.answer(true);assert.equal(view.run().phase,'synonym');assert.deepEqual(view.history(),before);
  view.answer(true);assert.equal(view.run().phase,'feedback');assert.equal(view.run().results[id].done,true);
  assert.deepEqual(view.history(),before,'Early correct practice must retain the next review date');
 }finally{view.close();}
});

for(const stage of ['meaning','synonym'])for(const failure of ['wrong','uncertain']){
 test(`BB ${stage} ${failure} answer immediately resets a previously passed word for tomorrow`,()=>{
  const view=practice({deck:'bb',data:{[reviewKey('bb')]:JSON.stringify({'b1:0':mature,'b1:1':mature})}});
  try{
   view.click('开始新测试');const id=view.run().queue[0];
   if(stage==='synonym'){view.answer(true);assert.equal(view.run().phase,'synonym');assert.deepEqual(view.history()[id],mature);}
   if(failure==='wrong')view.answer(false);else view.click('不确定');
   assert.equal(view.run().phase,'feedback');assert.equal(view.run().feedbackStep,stage);
   assert.deepEqual(view.history()[id],{level:0,due:TOMORROW,lastDay:TODAY,reviews:11});
   if(stage==='meaning')assert.match(view.text(),/已跳过选同义词/);
  }finally{view.close();}
 });
}

test('same-day returned word successes cannot upgrade a reset curve, and closing preserves it',()=>{
 const model={};new Function('exports',ts.transpileModule(readFileSync('community/practiceModel.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(model);
 const restored=legacyRun(['w1'],{});restored.options=model.optionsFor(words[0],words,'en-zh',[]);
 const view=practice({data:{[runKey('words')]:JSON.stringify(restored),[reviewKey('words')]:JSON.stringify({w1:mature})}});
 try{
  view.click('继续上次测试');view.answer(false);const reset=view.history();
  assert.equal(reset.w1.due,TOMORROW);view.click('下一题');view.answer(true);assert.equal(view.run().results.w1.done,false);assert.deepEqual(view.history(),reset);
  view.click('下一题');view.answer(true);assert.equal(view.run().results.w1.done,true);assert.deepEqual(view.history(),reset);
  view.click('保存并返回');assert.equal(view.closed(),1);view.remount();assert.deepEqual(view.history(),reset);
 }finally{view.close();}
});

test('review schedules remain isolated by deck and by the active learning workspace',()=>{
 const first={w1:{level:0,due:TODAY,lastDay:'',reviews:0}};
 const second={'b1:0':{level:2,due:'2026-10-19',lastDay:'2026-10-15',reviews:3}};
 const view=practice({data:{[reviewKey('words')]:JSON.stringify(first),[reviewKey('bb')]:JSON.stringify(second)}});
 try{
  assert.deepEqual(view.history(),first);view.remount('bb');assert.deepEqual(view.history(),second);
  const accountA=view.snapshot();view.remount('bb',{});assert.deepEqual(view.history(),{});
  view.remount('words');assert.deepEqual(view.history(),{});
  view.remount('words',accountA);assert.deepEqual(view.history(),first);
  view.remount('bb');assert.deepEqual(view.history(),second);
 }finally{view.close();}
});
