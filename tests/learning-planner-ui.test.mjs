import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const firstDay='2026-10-17';
const fixtureCatalog={decks:[{id:'glee',name:'GLEE',count:4},{id:'bb',name:'BB 六选二',count:2}],words:[
 {id:'apple',word:'apple',occurrences:[{deckId:'glee',deckName:'GLEE',entryId:'glee-1',meaning:'苹果的释义',list:1},{deckId:'bb',deckName:'BB 六选二',entryId:'bb-1',meaning:'另一处苹果释义',list:1}]},
 {id:'banal',word:'banal',occurrences:[{deckId:'glee',deckName:'GLEE',entryId:'glee-2',meaning:'平凡的释义',list:1}]},
 {id:'candid',word:'candid',occurrences:[{deckId:'glee',deckName:'GLEE',entryId:'glee-3',meaning:'坦诚的释义',list:2}]},
 {id:'daunt',word:'daunt',occurrences:[{deckId:'glee',deckName:'GLEE',entryId:'glee-4',meaning:'威吓的释义',list:2}]},
 {id:'epigram',word:'epigram',occurrences:[{deckId:'bb',deckName:'BB 六选二',entryId:'bb-2',meaning:'警句的释义',list:3}]},
]};
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};

/** Execute the real planner, settings, runner, store and scheduling model.
 * Only the catalog, IO and heavy shared-memory subtree are controlled. */
function planner({seed=true,cap=2,day=firstDay,paused=false,persistResponses=[]}={}){
 const fibers=new Map(),modules=new Map(),calls=[],timers=new Map(),windowListeners=new Map(),documentListeners=new Map();
 let active=null,cursor=0,tree,dirty=false,clock=day,apiGeneration=4,timerId=0,closed=0,durable=null;
 const document={body:{style:{overflow:''}},addEventListener(name,callback){documentListeners.set(name,callback);},removeEventListener(name){documentListeners.delete(name);}};
 const window={addEventListener(name,callback){windowListeners.set(name,callback);},removeEventListener(name){windowListeners.delete(name);}};
 const react={
  useState(initial){const slot=cursor++,fiber=active;if(!(slot in fiber.hooks))fiber.hooks[slot]=typeof initial==='function'?initial():initial;return [fiber.hooks[slot],next=>{if(!fiber.alive)return;const value=typeof next==='function'?next(fiber.hooks[slot]):next;if(!Object.is(value,fiber.hooks[slot])){fiber.hooks[slot]=value;dirty=true;}}];},
  useRef(initial){const slot=cursor++;return active.hooks[slot]??(active.hooks[slot]={current:initial});},
  useMemo(factory,deps){const slot=cursor++,old=active.hooks[slot];if(!old||deps.some((value,n)=>!Object.is(value,old.deps[n])))active.hooks[slot]={deps,value:factory()};return active.hooks[slot].value;},
  useEffect(effect,deps){const slot=cursor++,fiber=active,old=fiber.hooks[slot];if(!old||!deps||deps.some((value,n)=>!Object.is(value,old.deps?.[n]))){fiber.hooks[slot]={deps,cleanup:old?.cleanup};fiber.effects.push(()=>{fiber.hooks[slot].cleanup?.();fiber.hooks[slot].cleanup=effect();});}},
 };
 const jsx=(type,props,key)=>({type,props:props??{},key});
 function selectPlanWords(words,deckIds){const selected=new Set(deckIds);return words.map(word=>({...word,occurrences:word.occurrences.filter(o=>selected.has(o.deckId))})).filter(word=>word.occurrences.length);}
 const catalog={getLearningPlanCatalog:()=>structuredClone(fixtureCatalog),selectPlanWords,getPlanRatingWords:()=>[]};
 function load(name){
  if(name==='react')return react;if(name==='react/jsx-runtime')return {jsx,jsxs:jsx,Fragment:'Fragment'};
  if(name==='./api')return {getWorkspaceGeneration:()=>apiGeneration};
  if(name==='./database')return {exportWorkspace:()=>({version:1,rows:[],storage:load('./storage').exportStorage()})};
  if(name==='./workspacePersistence')return {async persistLearningWorkspace(epoch){assert.equal(epoch,apiGeneration);calls.push({epoch,storage:load('./storage').exportStorage()});const response=persistResponses.shift();const result=typeof response==='function'?await response():response instanceof Error?await Promise.reject(response):response??{destination:'account',synced:true};durable=structuredClone(calls.at(-1).storage);return result;}};
  if(name==='./learningPlanCatalog')return catalog;
  if(name==='../app/wordMemoryModel')return {wordMemoryKey:word=>word.trim().toLowerCase()};
  if(name==='../app/SharedWordMemory')return {default:()=>jsx('div',{'data-memory-stub':true,children:'记忆方法'}),SharedWordMemoryProvider:({children})=>children};
  if(name.endsWith('.css'))return {};
  if(modules.has(name))return modules.get(name);
  const module={exports:{}};modules.set(name,module.exports);
  const file='community/'+name.slice(2)+(['./LearningPlanner','./ListStudy'].includes(name)?'.tsx':'.ts');
  const source=fs.readFileSync(file,'utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','module','exports','window','document','setInterval','clearInterval',compiled)(load,module,module.exports,window,document,callback=>{const id=++timerId;timers.set(id,callback);return id;},id=>timers.delete(id));
  if(name==='./practiceReviewModel')module.exports.reviewDay=()=>clock;
  modules.set(name,module.exports);return module.exports;
 }
 const storage=load('./storage'),store=load('./learningPlanStore'),model=load('./learningPlanModel');
 if(seed)store.saveLearningPlanSettings({id:'plan-test',deckIds:['glee'],startDay:firstDay,targetDay:firstDay,dailyCap:cap},paused,firstDay);
 const Root=load('./LearningPlanner').default;
 function resolve(node,path){
  if(node==null||typeof node!=='object')return node;
  if(Array.isArray(node))return node.map((child,index)=>resolve(child,path+'/'+(child?.key??index)));
  if(typeof node.type==='function'){
   const key=path+':'+node.type.name+':'+(node.key??'');let fiber=fibers.get(key);
   if(!fiber){fiber={hooks:[],effects:[],alive:true,visited:true};fibers.set(key,fiber);}fiber.visited=true;
   const previous=active,previousCursor=cursor;active=fiber;cursor=0;const child=node.type(node.props);active=previous;cursor=previousCursor;
   return {...node,rendered:resolve(child,key+'/rendered')};
  }
  return {...node,props:{...node.props,children:resolve(node.props.children,path+'/children')}};
 }
 function render(){
  for(let attempt=0;attempt<30;attempt++){
   dirty=false;for(const fiber of fibers.values())fiber.visited=false;
   tree=resolve(jsx(Root,{onClose(){closed++;}}),'root');
   for(const [key,fiber] of fibers)if(!fiber.visited){fiber.alive=false;for(const hook of fiber.hooks)hook?.cleanup?.();fibers.delete(key);}
   for(const fiber of fibers.values())while(fiber.effects.length)fiber.effects.shift()();
   if(!dirty)return tree;
  }
  throw Error('Planner did not settle');
 }
 function nodes(node){if(arguments.length===0)node=tree;if(node==null||typeof node!=='object')return [];if(Array.isArray(node))return node.flatMap(child=>nodes(child));return [node,...nodes(node.rendered??node.props?.children)];}
 function text(node){if(arguments.length===0)node=tree;if(Array.isArray(node))return node.map(child=>text(child)).join('');if(node==null||typeof node==='boolean')return '';if(typeof node==='object')return text(node.rendered??node.props?.children);return String(node);}
 function scope(className){const found=nodes().find(node=>typeof node.props?.className==='string'&&node.props.className.split(' ').includes(className));assert.ok(found,'Missing scope '+className);return found;}
 function find(type,label,within=tree){return nodes(within).find(node=>node.type===type&&text(node)===label);}
 async function flush(){for(let n=0;n<8;n++){await new Promise(resolve=>setImmediate(resolve));render();}}
 async function click(label,within=tree){const button=find('button',label,within);assert.ok(button,'Missing button '+label);assert.equal(!!button.props.disabled,false,'Disabled '+label);button.props.onClick?.();render();await flush();}
 function change(aria,value){const input=nodes().find(node=>node.type==='input'&&node.props['aria-label']===aria);assert.ok(input,'Missing input '+aria);input.props.onChange({target:{value}});render();}
 async function submit(label){const button=find('button',label);assert.ok(button,'Missing submit '+label);assert.equal(!!button.props.disabled,false);const form=nodes().find(node=>node.type==='form'&&nodes(node).includes(button));assert.ok(form);form.props.onSubmit({preventDefault(){}});render();await flush();}
 render();
 return {calls,store,model,storage,render,flush,text,nodes,find,scope,click,change,submit,get durable(){return durable;},get closed(){return closed;},get state(){return store.readLearningPlanStore();},get selectedIds(){const state=store.readLearningPlanStore();return state?selectPlanWords(fixtureCatalog.words,state.config.deckIds).map(w=>w.id):[];},queuePersistence(...responses){persistResponses.push(...responses);},toggleDeck(name){const label=nodes().find(node=>node.type==='label'&&text(node).startsWith(name));assert.ok(label,'Missing deck '+name);nodes(label).find(node=>node.type==='input').props.onChange({target:{}});render();},async advanceDay(value,notify=true){clock=value;if(notify){for(const callback of timers.values())callback();windowListeners.get('focus')?.();}await flush();},close(){for(const fiber of fibers.values()){fiber.alive=false;for(const hook of fiber.hooks)hook?.cleanup?.();}fibers.clear();}};
}

const studyWord=view=>view.nodes(view.scope('learningStudyPanel')).find(node=>node.type==='button'&&String(node.props['aria-label']??'').startsWith('朗读 '))?.props['aria-label'];

test('creating and adjusting a plan keeps its ID and independent daily answers',async()=>{
 const view=planner({seed:false});try{
  await view.click('制定学习计划');view.toggleDeck('BB 六选二');view.change('目标首轮完成日期',firstDay);view.change('每日总量上限','2');await view.submit('生成我的计划');
  assert.deepEqual(view.state.config.deckIds,['glee','bb']);assert.equal(view.state.config.dailyCap,2);assert.equal(view.calls.length,1);assert.match(view.text(),/计划已同步到账号/);
  const id=view.state.config.id;view.store.recordLearningPlanWord(view.state,view.selectedIds,'apple','red',firstDay);view.store.recordLearningPlanWord(view.state,view.selectedIds,'banal','yellow',firstDay);await view.flush();
  await view.click('调整计划');view.toggleDeck('GLEE');view.change('每日总量上限','3');view.change('目标首轮完成日期','2026-10-25');await view.submit('保存调整');
  assert.equal(view.state.config.id,id);assert.deepEqual(view.state.config.deckIds,['bb']);assert.equal(view.state.answers.apple[firstDay],'red');assert.equal(view.state.answers.banal[firstDay],'yellow');assert.equal(view.state.config.dailyCap,3);assert.equal(view.calls.length,2);
 }finally{view.close();}
});

test('today starts an independent word queue and revealing meanings alone records no completion',async()=>{
 const view=planner();try{
  await view.click('打开今日第一组');assert.equal(studyWord(view),'朗读 apple');
  assert.equal(view.find('button','想起来了',view.scope('learningStudyPanel')).props.disabled,true);assert.doesNotMatch(view.text(view.scope('learningStudyPanel')),/苹果的释义/);
  await view.click('先回想一下，再看释义 ↓');assert.match(view.text(view.scope('learningStudyPanel')),/苹果的释义/);assert.deepEqual(view.state.answers,{});assert.equal(view.calls.length,0);
 }finally{view.close();}
});

test('a rating must finish persistence before Next, then advances only the assigned queue and finishes',async()=>{
 const view=planner();try{
  await view.click('打开今日第一组');await view.click('先回想一下，再看释义 ↓');const held=deferred();view.queuePersistence(()=>held.promise);
  await view.click('想起来了');assert.equal(view.find('button','下一个词 →',view.scope('learningStudyPanel')),undefined);assert.equal(view.find('button','没想起',view.scope('learningStudyPanel')).props.disabled,true);
  held.resolve({destination:'account',synced:true});await view.flush();assert.ok(view.find('button','下一个词 →',view.scope('learningStudyPanel')));await view.click('下一个词 →');assert.equal(studyWord(view),'朗读 banal');
  await view.click('先回想一下，再看释义 ↓');await view.click('没想起');await view.click('下一个词 →');
  assert.match(view.text(view.scope('learningStudyPanel')),/这一组已完成/);assert.equal(studyWord(view),undefined);assert.equal(view.state.answers.apple[firstDay],'green');assert.equal(view.state.answers.banal[firstDay],'red');assert.equal(view.calls.length,2);
  assert.equal(view.state.answers.candid,undefined);assert.equal(view.state.answers.daunt,undefined);await view.click('返回我的计划');assert.equal(view.find('button','请先调整计划').props.disabled,true);
 }finally{view.close();}
});

test('local persistence failure stays on the current word, keeps the answer and retries idempotently',async()=>{
 const view=planner();try{
  await view.click('打开今日第一组');await view.click('先回想一下，再看释义 ↓');view.queuePersistence(Error('本机保存失败，请重试。'));await view.click('有点模糊');
  assert.match(view.text(view.scope('learningStudyPanel')),/本机保存失败/);assert.equal(view.find('button','下一个词 →',view.scope('learningStudyPanel')),undefined);assert.equal(studyWord(view),'朗读 apple');
  await view.click('有点模糊');assert.ok(view.find('button','下一个词 →',view.scope('learningStudyPanel')));assert.equal(view.calls.length,2);assert.deepEqual(view.state.answers.apple,{[firstDay]:'yellow'});
 }finally{view.close();}
});

test('an offline account result reports only local preservation and never claims account synchronization',async()=>{
 const view=planner();try{
  await view.click('打开今日第一组');await view.click('先回想一下，再看释义 ↓');view.queuePersistence({destination:'account',synced:false,message:'已保存到本机，账号同步尚未完成。'});await view.click('没想起');
  const content=view.text(view.scope('learningStudyPanel'));assert.match(content,/账号同步尚未完成/);assert.doesNotMatch(content,/已同步到账号|这次想起来了/);assert.equal(view.state.answers.apple[firstDay],'red');
 }finally{view.close();}
});

test('crossing midnight before the clock refresh cannot write the old day and then rolls onto the actual new day',async()=>{
 const view=planner();try{
  await view.click('打开今日第一组');await view.click('先回想一下，再看释义 ↓');await view.advanceDay('2026-10-18',false);await view.click('想起来了');
  assert.match(view.text(view.scope('learningStudyPanel')),/新的一天开始了/);assert.deepEqual(view.state.answers,{});assert.equal(view.calls.length,0);
  await view.advanceDay('2026-10-18');await view.click('想起来了');assert.deepEqual(view.state.answers,{});await view.click('保存并返回');await view.click('打开今日第一组');await view.click('先回想一下，再看释义 ↓');await view.click('想起来了');assert.deepEqual(view.state.answers.apple,{'2026-10-18':'green'});assert.equal(view.calls.length,1);
 }finally{view.close();}
});

test('pausing an open task blocks an answer and a fully used daily cap does not assign an extra word',async()=>{
 const paused=planner();try{
  await paused.click('打开今日第一组');await paused.click('先回想一下，再看释义 ↓');paused.store.pauseLearningPlan(true);await paused.flush();await paused.click('想起来了');
  assert.match(paused.text(paused.scope('learningStudyPanel')),/计划已暂停/);assert.deepEqual(paused.state.answers,{});assert.equal(paused.calls.length,0);
 }finally{paused.close();}
 const capped=planner({cap:2});try{
  await capped.click('打开今日第一组');await capped.click('先回想一下，再看释义 ↓');capped.store.recordLearningPlanWord(capped.state,capped.selectedIds,'banal','green',firstDay);capped.store.recordLearningPlanWord(capped.state,capped.selectedIds,'candid','green',firstDay);await capped.flush();await capped.click('想起来了');
  assert.match(capped.text(capped.scope('learningStudyPanel')),/任务已更新/);assert.equal(capped.state.answers.apple,undefined);assert.equal(capped.calls.length,0);
 }finally{capped.close();}
});

test('closing keeps completed words and reopening resumes the remaining assigned task without grading reveals',async()=>{
 const view=planner();try{
  await view.click('打开今日第一组');await view.click('先回想一下，再看释义 ↓');await view.click('保存并返回');assert.deepEqual(view.state.answers,{});
  await view.click('打开今日第一组');assert.equal(studyWord(view),'朗读 apple');await view.click('先回想一下，再看释义 ↓');await view.click('想起来了');await view.click('保存并返回');
  await view.click('打开今日第一组');assert.equal(studyWord(view),'朗读 banal');assert.deepEqual(view.state.answers.apple,{[firstDay]:'green'});assert.equal(view.calls.length,1);
 }finally{view.close();}
});

test('not-started and initially paused plans never open a task queue or generate answers',async()=>{
 const future=planner({day:'2026-10-16'});try{
  assert.equal(future.find('button','今天暂无待学 List').props.disabled,true);assert.equal(future.nodes().some(node=>node.props?.['aria-label']==='今日学习任务'),false);assert.deepEqual(future.state.answers,{});assert.equal(future.calls.length,0);
 }finally{future.close();}
 const paused=planner({paused:true});try{
  assert.match(paused.text(),/计划已暂停/);assert.equal(paused.find('button','今天暂无待学 List').props.disabled,true);assert.equal(paused.nodes().some(node=>node.props?.['aria-label']==='今日学习任务'),false);assert.deepEqual(paused.state.answers,{});
  await paused.click('继续计划');assert.equal(paused.state.paused,false);assert.equal(paused.find('button','打开今日第一组').props.disabled,false);assert.equal(paused.calls.length,1);
 }finally{paused.close();}
});

test('invalid adjustments cannot replace settings or discard existing answer keys',async()=>{
 const view=planner();try{
  view.store.recordLearningPlanWord(view.state,view.selectedIds,'apple','green',firstDay);await view.flush();const before=view.storage.exportStorage();
  await view.click('调整计划');view.change('每日总量上限','0');assert.equal(view.find('button','保存调整').props.disabled,true);
  const form=view.nodes().find(node=>node.type==='form');form.props.onSubmit({preventDefault(){}});await view.flush();assert.match(view.text(),/请检查词表、日期及每日上限/);
  assert.deepEqual(view.storage.exportStorage(),before);assert.equal(view.calls.length,0);
 }finally{view.close();}
});
