import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const terms = ['alpha','bravo','charlie','delta','echo','foxtrot','golf','hotel'].map((word, i) => ({ id: `a${i+1}`, word, meaning: ['甲一含义','乙二含义','丙三含义','丁四含义','戊五含义','己六含义','庚七含义','辛八含义'][i], list: 1, number: i+1, equivalents: [`${word}-syn`,`${word}-equivalent`] }));
const bb = Array.from({length:4}, (_,i) => ({id:`b${i+1}`,list:1,volume:'上',number:i+1,words:[{word:terms[i*2].word,meaning:terms[i*2].meaning},{word:terms[i*2+1].word,meaning:terms[i*2+1].meaning}]}));

// Execute the actual components, key handlers, grading models and receipt model.
// Substitute only fixture vocabulary, IO/telemetry, the clock and React's hook host.
function harness(kind, {deck='words', mode='single', data={}, notebook, persistence, putGate, chips=false}={}) {
  const modules = new Map(), storage = new Map(Object.entries(data)), io = [], learning = [], events = new Map(), instances = new Map();
  let active, dirty = false, tree, seed = null, revision = 4, tick = 0, generation = 7, closed = 0, persistImpl = persistence;
  const persists=[];
  const browser = {addEventListener(name, fn) {const set=events.get(name)??new Set();set.add(fn);events.set(name,set);},removeEventListener(name,fn){events.get(name)?.delete(fn);}};
  const document = {...browser,body:{style:{overflow:''}}};
  const jsx = (type, props, key) => ({type,props:props??{},key});
  const react = {
    useState(initial){const host=active,index=host.cursor++;if(!(index in host.hooks))host.hooks[index]=typeof initial==='function'?initial():initial;return [host.hooks[index],next=>{const value=typeof next==='function'?next(host.hooks[index]):next;if(!Object.is(value,host.hooks[index])){host.hooks[index]=value;dirty=true;}}];},
    useMemo(fn,deps){const host=active,index=host.cursor++,old=host.hooks[index];if(!old||deps.some((v,i)=>!Object.is(v,old.deps[i])))host.hooks[index]={deps,value:fn()};return host.hooks[index].value;},
    useRef(initial){const host=active,index=host.cursor++;return host.hooks[index]??(host.hooks[index]={current:initial});},
    useEffect(effect,deps){const host=active,index=host.cursor++,old=host.hooks[index];if(!old||!deps||deps.length!==old.deps?.length||deps.some((value,n)=>!Object.is(value,old.deps[n]))){host.hooks[index]={deps,cleanup:old?.cleanup};host.effects.push(()=>{host.hooks[index].cleanup?.();host.hooks[index].cleanup=effect();});}},
  };
  const memory={records:Object.fromEntries(terms.flatMap(term=>[term.word,...term.equivalents].map(word=>[word,{text:`当时的笔记 ${word}`}]))),drafts:{}};
  async function appFetch(url, options) {
    if(options?.method==='PUT'){io.push(JSON.parse(options.body));if(putGate)await putGate;revision++;return {ok:true,json:async()=>({revision})};}
    assert.equal(url,'/api/a-plus-test');return {ok:true,json:async()=>({session:seed,revision,history:{}})};
  }
  function load(filename) {
    const full=path.resolve(filename);if(full.endsWith('.json'))return {default:JSON.parse(fs.readFileSync(full,'utf8'))};if(modules.has(full))return modules.get(full);
    const exported={};modules.set(full,exported);
    const code=ts.transpileModule(fs.readFileSync(full,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
    new Function('require','exports','window','document','setInterval','clearInterval','crypto',code)(name=>{
      if(name==='react')return react;if(name==='react/jsx-runtime')return {jsx,jsxs:jsx};if(name==='react-dom')return {createPortal:node=>node};
      if(name.endsWith('/storage'))return {studyStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)}};
      if(name.endsWith('/api'))return {appFetch,getWorkspaceGeneration:()=>generation};
      if(name.endsWith('/workspacePersistence'))return {persistLearningWorkspace:async expected=>{persists.push({generation:expected,storage:Object.fromEntries(storage),localPuts:io.length});return persistImpl?persistImpl():{destination:'device',synced:true};}};
      if(name.endsWith('/analytics'))return {trackUsage(){}};
      if(name.endsWith('/learningPlanStore'))return {recordLearningPlanWords:(...args)=>learning.push(args)};
      if(name.endsWith('/practiceCompletions'))return {recordCompletedPractice(){},recordPracticeWord(){},recordPracticeWords(){}};
      if(name.endsWith('/SharedWordMemory'))return {default:props=>jsx('aside',{'aria-label':'memory',children:`记忆笔记 ${props.word}`}),useWordMemory:()=>memory};
      if(name.endsWith('/SelectionChips'))return {default:props=>chips?jsx('div',{'aria-label':props.label,children:props.options.map(option=>jsx('button',{onClick:()=>props.onChange(props.exclusive?[option.id]:props.selected.includes(option.id)?props.selected.filter(id=>id!==option.id):[...props.selected,option.id]),children:option.label}))}):null};
      if(name.endsWith('/NotebookFrequency'))return {default:()=>null};
      if(name.endsWith('/vocabulary.json'))return {default:terms};
      if(name.endsWith('/aPlusEquivalents.json'))return {default:terms};
      if(name.endsWith('/bbEquivalents.json'))return {default:bb};
      if(name.endsWith('/equivalents.json'))return {default:[]};
      assert.ok(name.startsWith('.'),`Unexpected import ${name}`);
      const source=path.resolve(path.dirname(full),name);return load(fs.existsSync(source)?source:fs.existsSync(source+'.ts')?source+'.ts':source+'.tsx');
    },exported,browser,document,()=>1,()=>{},{randomUUID:()=>`fixture-${++tick}`});return exported;
  }
  const aPlusModel=load('app/aPlusTestModel.ts');
  if(kind==='aplus')seed=aPlusModel.createSession({lists:[1],order:'sequential',mode},()=>.4,['a1','a2']);
  const practiceScope=deck==='notebook'?'notebook-'+notebook.id:deck;
  if(kind==='recall')seed=load('community/recallModel.ts').createRecallRun(['a1','a2'],{mode:'strict',retry:'all'});
  const Component=kind==='recall'?load('community/RecallTest.tsx').RecallTest:load(kind==='aplus'?'app/APlusTest.tsx':'community/Practice.tsx').default;
  function expand(node, address='root', hidden=false) {
    if(node==null||typeof node!=='object')return node;
    if(Array.isArray(node))return node.map((child,i)=>expand(child,`${address}.${child?.key??i}`,hidden));
    if(typeof node.type==='function'){
      const identity=address+':'+(node.type.name||'component')+':'+(node.key??'');
      let host=instances.get(identity);if(!host){host={hooks:[],effects:[],cursor:0,seen:false};instances.set(identity,host);}host.seen=true;host.cursor=0;active=host;
      return expand(node.type(node.props),identity,hidden);
    }
    const masked=hidden||!!node.props.hidden;
    return {...node,hidden:masked,props:{...node.props,children:expand(node.props.children,address+'.children',masked)}};
  }
  function render() {
    for(let n=0;n<20;n++){
      dirty=false;for(const host of instances.values())host.seen=false;
      tree=expand(jsx(Component,kind==='recall'?{initial:seed,pool:terms,scope:deck,title:'测试词表',onClose(){closed++;}}:kind==='aplus'?{pronounce(){}}:{deck,notebook,onClose(){closed++;}}));
      for(const [key,host] of instances){if(!host.seen){for(const hook of host.hooks)hook?.cleanup?.();instances.delete(key);}else while(host.effects.length)host.effects.shift()();}
      if(!dirty)return;
    }throw Error('Component host did not settle');
  }
  function nodes(node, includeHidden=false){if(arguments.length===0)node=tree;if(node==null||typeof node!=='object')return [];if(Array.isArray(node))return node.flatMap(child=>nodes(child,includeHidden));if(node.hidden&&!includeHidden)return [];return [node,...nodes(node.props.children,includeHidden)];}
  function text(node){if(arguments.length===0)node=tree;if(node==null||typeof node==='boolean')return '';if(Array.isArray(node))return node.map(text).join('');if(typeof node!=='object')return String(node);return node.hidden?'':text(node.props.children);}
  async function settle(){for(let n=0;n<12;n++){await Promise.resolve();if(dirty)render();}}
  function findButton(label){const found=nodes().find(node=>node.type==='button'&&text(node).includes(label));assert.ok(found,`Missing button ${label}`);return found;}
  async function click(label){const button=findButton(label);assert.ok(!button.props.disabled,`Disabled ${label}`);button.props.onClick({preventDefault(){},stopPropagation(){}});render();await settle();}
  async function key(key, extra={}){let prevented=false;const target={closest:()=>null};const event={key,code:key,repeat:false,isComposing:false,ctrlKey:false,metaKey:false,altKey:false,shiftKey:false,target,preventDefault(){prevented=true;},stopImmediatePropagation(){},...extra};for(const callback of [...events.get('keydown')??[]])callback(event);render();await settle();return prevented;}
  render();
  return {settle,click,key,nodes,text,io,learning,storage,persists,closed:()=>closed,setGeneration(value){generation=value;},setPersistence(fn){persistImpl=fn;},async select(label,value){const node=nodes().find(node=>node.type==='select'&&node.props['aria-label']===label);assert.ok(node);node.props.onChange({target:{value}});render();await settle();},model:aPlusModel,initial:()=>structuredClone(seed),run:()=>JSON.parse(storage.get('lemnota-practice-'+practiceScope)??'null'),history:()=>JSON.parse(storage.get('lemnota-practice-review-'+practiceScope+'-v1')??'null'),recallRun:()=>JSON.parse(storage.get('lemnota-recall-'+practiceScope+'-v1')??'null'),currentAPlus:()=>structuredClone(io.at(-1)?.session??seed),async ready(){await settle();await click(kind==='aplus'?'继续上次测试':'开始新测试');},close(){for(const host of instances.values())for(const hook of host.hooks)hook?.cleanup?.();}};
}

for(const mode of ['single','multiple'])test(`A+ ${mode} keyboard A–F selects visible answers, U keeps existing uncertain grading`,async()=>{
 const view=harness('aplus',{mode});try{
  await view.ready();const before=view.currentAPlus(),correctMeaning=before.question.meanings.indexOf(terms[0].meaning);
  await view.key(String.fromCharCode(97+correctMeaning));assert.equal(view.io.length,0,'Selecting is not grading');
  assert.ok(view.nodes().some(node=>node.type==='button'&&node.props['aria-pressed']===true&&view.text(node).includes(terms[0].meaning)));
  await view.key('Enter');assert.equal(view.currentAPlus().stage,'synonyms');
  await view.key('a');await view.key('f');
  let chosen=view.nodes().filter(node=>node.type==='input'&&node.props['aria-keyshortcuts']&&node.props.checked).map(node=>node.props['aria-keyshortcuts']);
  assert.deepEqual(chosen,mode==='single'?['F']:['A','F']);
  if(mode==='multiple'){await view.key('a');chosen=view.nodes().filter(node=>node.type==='input'&&node.props['aria-keyshortcuts']&&node.props.checked).map(node=>node.props['aria-keyshortcuts']);assert.deepEqual(chosen,['F'],'Pressing a selected multi-choice letter toggles it off');}
  await view.key('u');assert.equal(view.currentAPlus().stage,'synonyms','U selects uncertain before explicit confirmation');
  assert.equal(view.nodes().filter(node=>node.type==='input'&&node.props['aria-keyshortcuts']&&node.props.checked).length,0);
  await view.key('Enter');const graded=view.currentAPlus();assert.equal(graded.stage,'feedback');assert.equal(graded.synonymUncertain,true);assert.deepEqual(graded.selected,[]);assert.equal(graded.progress.a1.attempts,1);assert.equal(graded.progress.a1.hadError,true);assert.ok(view.text().includes('本轮第 1 次作答'));assert.ok(view.text().includes('还需连续答对 2 次'));
 }finally{view.close();}
});

test('A+ U in meaning step immediately reaches existing skipped-synonym feedback after confirmation',async()=>{
 const view=harness('aplus');try{await view.ready();await view.key('u');assert.equal(view.io.length,0);await view.key('Enter');const result=view.currentAPlus();assert.equal(result.stage,'feedback');assert.equal(result.synonymSkipped,true);assert.equal(result.meaningChoice,'不确定');assert.equal(result.progress.a1.meaningErrors,1);assert.deepEqual(result.progress.a1.missed,{});}finally{view.close();}
});

for(const kind of ['aplus','practice'])test(`${kind} previous-word history is read-only and preserves the current unsubmitted answer`,async()=>{
 const view=harness(kind);try{
  await view.ready();await view.key('u');if(kind==='aplus')await view.key('Enter');
  await view.click(kind==='aplus'?'继续下一题':'下一题');
  await view.key('b');const before=kind==='aplus'?view.currentAPlus():view.run(),writes=view.io.length,storage=[...view.storage],learning=structuredClone(view.learning);
  await view.click('上一词回看');assert.ok(view.text().includes('只读回看'));assert.ok(view.text().includes('正确答案'));assert.ok(view.text().includes('当时的笔记'));assert.ok(view.text().includes('本轮第 1 次作答'),'Read-only receipt preserves the exact per-word attempt count');
  for(const key of ['a','f','u','Enter'])await view.key(key);
  assert.deepEqual(kind==='aplus'?view.currentAPlus():view.run(),before);assert.equal(view.io.length,writes);assert.deepEqual([...view.storage],storage);assert.deepEqual(view.learning,learning);
  assert.equal(view.nodes().filter(node=>node.type==='textarea').length,0,'Historical note receipts must not expose a note editor');
  await view.click('返回当前题');
  if(kind==='aplus')assert.ok(view.nodes().some(node=>node.type==='button'&&node.props['aria-keyshortcuts']==='B'&&node.props['aria-pressed']===true));
  else assert.equal(view.run().selected,1);
  assert.deepEqual(kind==='aplus'?view.currentAPlus():view.run(),before,'Returning cannot rewind grading state');
 }finally{view.close();}
});

for(const kind of ['aplus','practice'])test(`${kind} shortcuts ignore typing, composition, modifiers and repeated keydown`,async()=>{
 const view=harness(kind);try{
  await view.ready();const storage=[...view.storage];
  for(const extra of [{repeat:true},{isComposing:true},{ctrlKey:true},{metaKey:true},{altKey:true},{shiftKey:true},{target:{closest:selector=>selector.includes('textarea')?{}:null}}]){
   for(const key of ['a','u','Enter'])await view.key(key,extra);
  }
  assert.equal(view.io.length,0);assert.deepEqual([...view.storage],storage);
  await view.key('a');if(kind==='aplus')assert.ok(view.nodes().some(node=>node.type==='button'&&node.props['aria-keyshortcuts']==='A'&&node.props['aria-pressed']===true));else assert.equal(view.run().selected,0);
 }finally{view.close();}
});

for(const deck of ['words','bb'])test(`${deck} A–F and U route through the existing practice result and review scheduler`,async()=>{
 const view=harness('practice',{deck});try{await view.ready();await view.key('f');if(deck==='bb')assert.equal(view.run().selected,5);else assert.equal(view.run().selected,null,'E/F do not invent choices for a four-choice question');await view.key('a');assert.equal(view.run().selected,0);await view.key('u');const result=view.run(),id=result.queue[0];assert.equal(result.phase,'feedback');assert.equal(result.results[id].errors,1);assert.equal(result.results[id].done,false);assert.equal(view.history()[id].level,0);assert.equal(view.history()[id].reviews,1);assert.ok(view.text().includes('本轮第 1 次作答'));assert.ok(view.text().includes('还需连续答对 2 次'));}finally{view.close();}
});


test('notebook practice uses the selected collection pool and its own session/review keys without List controls',async()=>{
 const notebook={id:'collection-one',source:'Synthetic selected collection',terms:terms.slice(0,4).map(term=>({...term,note:'My collection note',origin:'My collection source',rating:'unknown'}))};
 const oldWordsRun=JSON.stringify({unrelated:'existing full-word run'}),view=harness('practice',{deck:'notebook',notebook,data:{'lemnota-practice-words':oldWordsRun}});
 let saved;
 try{
  await view.settle();assert.ok(view.text().includes(notebook.source));assert.equal(view.nodes().filter(node=>node.type==='input'&&node.props.type==='number').length,0,'A notebook selection must not acquire unrelated List filters');
  await view.ready();assert.ok(view.run().queue.every(id=>notebook.terms.some(term=>term.id===id)));assert.equal(view.run().queue.length,4);
  assert.equal(view.storage.get('lemnota-practice-words'),oldWordsRun);
  await view.key('u');assert.ok(view.text().includes('My collection note'));assert.ok(view.text().includes('My collection source'));assert.ok(view.text().includes('本轮第 1 次作答'));
  assert.ok(view.storage.has('lemnota-practice-notebook-collection-one'));assert.ok(view.storage.has('lemnota-practice-review-notebook-collection-one-v1'));
  saved=Object.fromEntries(view.storage);
 }finally{view.close();}
 const next=harness('practice',{deck:'notebook',notebook:{...notebook,id:'collection-two'},data:saved});
 try{await next.settle();assert.ok(!next.text().includes('继续上次测试'),'A different collection cannot resume the first collection run');await next.ready();assert.equal(next.run().turn,0);assert.deepEqual(next.history(),{});assert.equal(next.storage.get('lemnota-practice-notebook-collection-one'),saved['lemnota-practice-notebook-collection-one']);}finally{next.close();}
});


test('paired practice counts one complete word attempt, not each meaning/synonym step',async()=>{
 const view=harness('practice',{deck:'a-plus'});try{
  await view.settle();await view.select('测试内容','true');await view.ready();
  const before=view.run(),correct=before.options.findIndex(option=>option.correct);await view.key(String.fromCharCode(97+correct));await view.key('Enter');
  const halfway=view.run();assert.equal(halfway.phase,'synonym');assert.deepEqual(halfway.attemptCounts,{});assert.deepEqual(halfway.results,{});assert.deepEqual(view.history(),{});
  await view.key('u');const final=view.run(),id=final.queue[0];assert.equal(final.phase,'feedback');assert.equal(final.attemptCounts[id],1);assert.equal(view.history()[id].reviews,1);assert.ok(view.text().includes('本轮第 1 次作答'));
 }finally{view.close();}
});


for(const kind of ['practice','aplus'])test(`${kind} save/exit waits for verified persistence and keeps cloud-pending or failed saves visible`,async()=>{
 let release;const delayed=new Promise(resolve=>{release=resolve;});
 const view=harness(kind,{persistence:()=>delayed});try{
  await view.ready();if(kind==='practice')await view.key('a');else{await view.key('u');await view.key('Enter');}
  const before=kind==='practice'?view.run():view.currentAPlus();
  await view.click(kind==='practice'?'保存并返回':'保存并返回设置');
  assert.ok(view.text().includes('正在核对本机与账号保存'));assert.equal(view.closed(),0);assert.equal(view.persists.length,1);assert.equal(view.persists[0].generation,7);
  if(kind==='practice')assert.deepEqual(JSON.parse(view.persists[0].storage['lemnota-practice-words']),before,'Current run must be mirrored before the workspace flush starts');
  await view.key('u');await view.key('Escape');assert.equal(view.persists.length,1,'Repeated exit requests join the current save');assert.deepEqual(kind==='practice'?view.run():view.currentAPlus(),before,'Keyboard grading cannot race the exit snapshot');
  release({destination:'account',synced:false,message:'已保存到本机，账号同步尚未完成。'});await view.settle();
  assert.equal(view.closed(),0);assert.ok(view.text().includes('账号同步尚未完成'));if(kind==='aplus')assert.ok(view.text().includes('保存并返回设置'),'Cloud-pending must keep the test screen open');
  view.setPersistence(()=>{throw Error('其他标签页已经更新记录');});await view.key('Escape');
  assert.equal(view.closed(),0);assert.ok(view.text().includes('其他标签页已经更新记录'));assert.ok(view.text().includes('暂未退出'));
  view.setPersistence(()=>({destination:'device',synced:true}));await view.click(kind==='practice'?'保存并返回':'保存并返回设置');
  if(kind==='practice')assert.equal(view.closed(),1);else assert.ok(view.text().includes('继续上次测试'),'Successful checked save returns to setup');
 }finally{view.close();}
});

for(const kind of ['practice','aplus'])test(`${kind} an old-generation save cannot write or close the next workspace`,async()=>{
 const view=harness(kind);try{
  await view.ready();view.setGeneration(8);view.storage.clear();view.storage.set('new-account-only','preserve');
  await view.click(kind==='practice'?'保存并返回':'保存并返回设置');
  assert.equal(view.persists.length,0);assert.equal(view.closed(),0);assert.deepEqual([...view.storage],[['new-account-only','preserve']]);assert.ok(view.text().includes('学习空间已切换'));
 }finally{view.close();}
});

test('A+ save/exit joins the current local API write before flushing or pausing',async()=>{
 let finishPut;const putGate=new Promise(resolve=>{finishPut=resolve;});const view=harness('aplus',{putGate});
 try{
  await view.ready();await view.key('u');await view.key('Enter');assert.equal(view.io.length,1);
  await view.click('保存并返回设置');assert.equal(view.persists.length,0,'Busy local PUT must not be mistaken for a completed save');assert.ok(view.text().includes('正在核对本机与账号保存'));
  finishPut();await view.settle();assert.equal(view.persists.length,1);assert.ok(view.text().includes('继续上次测试'));assert.equal(view.persists[0].localPuts,1,'The exit joins rather than duplicates the graded write');
 }finally{view.close();}
});


for(const kind of ['practice','aplus'])test(`${kind} late save confirmation cannot close a replaced workspace`,async()=>{
 let complete;const waiting=new Promise(resolve=>{complete=resolve;});const view=harness(kind,{persistence:()=>waiting});try{
  await view.ready();await view.click(kind==='practice'?'保存并返回':'保存并返回设置');assert.equal(view.persists.length,1);
  view.setGeneration(8);view.storage.clear();view.storage.set('new-account-only','preserve');complete({destination:'account',synced:true});await view.settle();
  assert.equal(view.closed(),0);assert.deepEqual([...view.storage],[['new-account-only','preserve']]);assert.ok(view.text().includes('学习空间已切换'));
 }finally{view.close();}
});


test('recall clicks reveal, allow corrections, persist immediately and never write traffic lights or review dates',async()=>{
 const originalRating='{"a1":"familiar"}',view=harness('recall',{data:{'gre-quick-ratings-v1':originalRating}});
 try{
  assert.ok(!view.text().includes('甲一含义'));await view.key('3');assert.match(view.text(),/甲一含义/);assert.match(view.text(),/本词第 1 次判断/);assert.equal(view.recallRun().selection,'familiar');assert.match(view.text(),/首遍熟悉，直接过关/);
  await view.key('1');assert.equal(view.recallRun().selection,'unknown');assert.equal(view.recallRun().turn,0);assert.match(view.text(),/连续达标 0\/2/);
  await view.key('Enter');assert.equal(view.recallRun().turn,1);assert.equal(view.recallRun().results.a1.attempts,1);assert.equal(view.recallRun().results.a1.rating,'unknown');
  assert.equal(view.storage.get('gre-quick-ratings-v1'),originalRating);assert.equal(view.storage.has('lemnota-practice-review-words-v1'),false);assert.deepEqual(view.learning,[]);
  await view.click('上一词回看');assert.match(view.text(),/你的选择：不认识/);assert.match(view.text(),/当时的笔记 alpha/);
  const saved=JSON.stringify(view.recallRun());await view.key('3');assert.equal(JSON.stringify(view.recallRun()),saved);
  await view.click('返回当前题');await view.key('2');await view.click('保存并返回');assert.equal(view.closed(),1);assert.equal(view.persists.at(-1).storage['lemnota-recall-words-v1'],view.storage.get('lemnota-recall-words-v1'));
 }finally{view.close();}
});

test('recall pending, failed or old-workspace saves keep the dialog open and never discard the current card',async()=>{
 let resolve;const gate=new Promise(r=>resolve=r),view=harness('recall',{persistence:()=>gate});
 try{
  await view.key('2');const selection=view.recallRun().selection;const closing=view.click('保存并返回');assert.equal(view.closed(),0);
  view.setGeneration(8);resolve({destination:'account',synced:true});await closing;await view.settle();assert.equal(view.closed(),0);assert.equal(view.recallRun().selection,selection);assert.match(view.text(),/学习空间已切换/);
 }finally{view.close();}
 const pending=harness('recall',{persistence:async()=>({destination:'device',synced:false,message:'账号待同步'})});
 try{await pending.key('1');await pending.click('保存并返回');assert.equal(pending.closed(),0);assert.match(pending.text(),/账号待同步/);}finally{pending.close();}
});


test('due review offers both formats and flashcards reuse the same overdue words across Lists',async()=>{
 const old={a1:{level:0,due:'2020-01-01',lastDay:'2020-01-01',reviews:2}};
 const view=harness('practice',{chips:true,data:{'lemnota-practice-review-words-v1':JSON.stringify(old)}});
 try{
  await view.click('翻卡自测');await view.click('开始到期复习');assert.equal(view.recallRun().review,true);assert.deepEqual(view.recallRun().order,['a1']);
  await view.key('3');assert.deepEqual(view.history(),old,'revealing and changing do not alter the schedule');await view.key('2');assert.deepEqual(view.history(),old);await view.key('3');await view.key('Enter');assert.equal(view.recallRun().queue.length,0);assert.equal(view.history().a1.level,1);assert.equal(view.history().a1.reviews,3);assert.equal(view.run(),null,'the multiple-choice session is untouched');assert.equal(view.learning.length,0);
 }finally{view.close();}
});
