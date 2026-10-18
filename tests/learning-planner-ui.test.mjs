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
function planner({seed=true,cap=2,day=firstDay,paused=false,persistResponses=[],overview=false}={}){
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
  const base='community/'+name.slice(2),file=base+(fs.existsSync(base+'.tsx')?'.tsx':'.ts');
  const source=fs.readFileSync(file,'utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','module','exports','window','document','setInterval','clearInterval',compiled)(load,module,module.exports,window,document,callback=>{const id=++timerId;timers.set(id,callback);return id;},id=>timers.delete(id));
  if(name==='./practiceReviewModel')module.exports.reviewDay=()=>clock;
  modules.set(name,module.exports);return module.exports;
 }
 const storage=load('./storage'),store=load('./learningPlanStore'),model=load('./learningPlanModel');
 if(seed)store.saveLearningPlanSettings({id:'plan-test',deckIds:['glee'],startDay:firstDay,targetDay:firstDay,dailyCap:cap},paused,firstDay);
 const Root=load(overview?'./LearningOverview':'./LearningPlanner').default;
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
   tree=resolve(jsx(Root,{onClose(){closed++;},onOpenList(unit){calls.push({type:'open',unit});}}),'root');
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
 function change(aria,value){const input=nodes().find(node=>['input','select'].includes(node.type)&&node.props['aria-label']===aria);assert.ok(input,'Missing input '+aria);input.props.onChange({target:{value}});render();}
 async function submit(label){const button=find('button',label);assert.ok(button,'Missing submit '+label);assert.equal(!!button.props.disabled,false);const form=nodes().find(node=>node.type==='form'&&nodes(node).includes(button));assert.ok(form);form.props.onSubmit({preventDefault(){}});render();await flush();}
 render();
 return {calls,store,model,storage,render,flush,text,nodes,find,scope,click,change,submit,get agenda(){const state=store.readLearningPlanStore();return state?load('./learningAgendaModel').readAgenda(storage.studyStorage.getItem(load('./learningAgendaModel').agendaKey(state.config.id)),state.config.id):null;},switchGeneration(){apiGeneration++;},get durable(){return durable;},get closed(){return closed;},get state(){return store.readLearningPlanStore();},async pressAria(label){const button=nodes().find(n=>n.type==='button'&&n.props['aria-label']===label);assert.ok(button,'Missing '+label);assert.ok(!button.props.disabled);button.props.onClick();render();await flush();},get selectedIds(){const state=store.readLearningPlanStore();return state?selectPlanWords(fixtureCatalog.words,state.config.deckIds).map(w=>w.id):[];},queuePersistence(...responses){persistResponses.push(...responses);},toggleDeck(name){const label=nodes().find(node=>node.type==='label'&&text(node).startsWith(name));assert.ok(label,'Missing deck '+name);nodes(label).find(node=>node.type==='input').props.onChange({target:{}});render();},async advanceDay(value,notify=true){clock=value;if(notify){for(const callback of timers.values())callback();windowListeners.get('focus')?.();}await flush();},close(){for(const fiber of fibers.values()){fiber.alive=false;for(const hook of fiber.hooks)hook?.cleanup?.();}fibers.clear();}};
}

const studyWord=view=>view.nodes(view.scope('learningStudyPanel')).find(node=>node.type==='button'&&String(node.props['aria-label']??'').startsWith('朗读 '))?.props['aria-label'];

test('a generated draft does not activate or persist until explicit confirmation',async()=>{
 const v=planner({seed:false,cap:null});try{
  await v.click('制定学习计划');await v.submit('生成草案');assert.equal(v.state,null);assert.equal(v.calls.length,0);assert.match(v.text(),/先看草案，再决定/);
  await v.click('返回调整');assert.equal(v.state,null);await v.submit('生成草案');await v.click('确认并采用这份安排');assert.ok(v.state);assert.ok(v.agenda);assert.equal(v.agenda.approvedOn,firstDay);assert.equal(v.calls.length,1);assert.deepEqual(v.state.answers,{});
 }finally{v.close();}
});

test('opening a task navigates to the original List and never creates another word queue',async()=>{
 const v=planner();try{
  await v.click('查看并确认安排');assert.equal(v.calls.length,0);await v.click('确认并采用这份安排');await v.click('打开今日第一组');
  assert.equal(v.calls.at(-1).type,'open');assert.equal(v.calls.at(-1).unit.deckId,'glee');assert.equal(v.calls.at(-1).unit.label,'List 01');assert.deepEqual(v.state.answers,{});assert.equal(v.nodes().some(n=>n.props?.['aria-label']==='今日学习任务'),false);
 }finally{v.close();}
});

test('ordinary word ratings finish the same approved task, including red and yellow',async()=>{
 const v=planner();try{
  await v.click('查看并确认安排');await v.click('确认并采用这份安排');v.store.recordLearningPlanWords(['apple'],'red',firstDay);await v.flush();assert.match(v.text(),/本轮待自测 1 词/);
  v.store.recordLearningPlanWords(['banal'],'yellow',firstDay);await v.flush();assert.match(v.text(),/今天的安排已完成/);assert.ok(v.nodes(v.scope('learningTodo')).some(n=>n.type==='s'&&v.text(n)==='GLEE · List 01'));assert.equal(v.nodes(v.scope('learningTodo')).filter(n=>n.type==='li').length,1);assert.deepEqual(v.state.answers,{apple:{[firstDay]:'red'},banal:{[firstDay]:'yellow'}});
  assert.equal(v.agenda.tasks.filter(t=>t.day===firstDay).length,1);assert.equal(v.agenda.tasks[0].wordIds.length,2);
 }finally{v.close();}
});

test('unfinished Lists carry only their remaining words into a new unapproved draft',async()=>{
 const v=planner();try{
  await v.click('查看并确认安排');await v.click('确认并采用这份安排');v.store.recordLearningPlanWords(['apple'],'green',firstDay);await v.flush();await v.advanceDay('2026-10-18');assert.match(v.text(),/之前未完成/);
  const before=v.storage.exportStorage();await v.click('查看并确认安排');assert.match(v.text(),/从 2026-10-17 顺延/);assert.deepEqual(v.storage.exportStorage(),before);
  await v.click('确认并采用这份安排');assert.equal(v.agenda.approvedOn,'2026-10-18');assert.deepEqual(v.agenda.tasks.find(t=>t.unitId==='glee:list-1').wordIds,['banal']);assert.equal(v.state.answers.apple[firstDay],'green');
 }finally{v.close();}
});

test('manual scheduling changes dates and task kind without grading or removing real history',async()=>{
 const v=planner({cap:null});try{
  await v.click('调整每日安排');await v.click('自己安排');v.change('移动到日期','2026-10-19');await v.click('移动当天任务');await v.click('移除安排');v.change('当天学习类型','review');await v.click('List 012 词');assert.deepEqual(v.state.answers,{});
  await v.click('确认并采用这份安排');assert.equal(v.agenda.mode,'manual');assert.equal(v.agenda.tasks[0].day,'2026-10-19');assert.equal(v.agenda.tasks.find(t=>t.unitId==='glee:list-1').kind,'review');assert.deepEqual(v.state.answers,{});
 }finally{v.close();}
});

test('a combined whole-List cap must be resolved before confirmation',async()=>{
 const v=planner({cap:2});try{
  await v.click('调整每日安排');await v.click('List 022 词');assert.match(v.text(),/超过你设置的 2 词上限/);assert.equal(v.find('button','确认并采用这份安排').props.disabled,true);assert.equal(v.agenda,null);assert.deepEqual(v.state.answers,{});
 }finally{v.close();}
});

test('a cloud-pending result preserves the approved local agenda without claiming cloud success',async()=>{
 const v=planner();try{
  v.queuePersistence({destination:'account',synced:false,message:'本机已存，账号同步待重试。'});await v.click('查看并确认安排');await v.click('确认并采用这份安排');assert.ok(v.agenda);assert.match(v.text(),/账号同步待重试/);assert.doesNotMatch(v.text(),/计划已同步到账号/);
 }finally{v.close();}
});

test('a failed durable save keeps the editor open and can be retried',async()=>{
 const v=planner();try{
  v.queuePersistence(Error('本机保存失败'));await v.click('查看并确认安排');await v.click('确认并采用这份安排');assert.match(v.text(),/本机保存失败/);assert.ok(v.find('button','确认并采用这份安排'));await v.click('确认并采用这份安排');assert.match(v.text(),/计划已同步到账号/);assert.equal(v.calls.length,2);
 }finally{v.close();}
});

test('a stale editor cannot confirm across midnight or into another workspace',async()=>{
 const v=planner();try{
  await v.click('调整每日安排');await v.advanceDay('2026-10-18',false);await v.click('确认并采用这份安排');assert.match(v.text(),/日期已变化/);assert.equal(v.agenda,null);assert.equal(v.calls.length,0);
 }finally{v.close();}
 const w=planner();try{
  await w.click('调整每日安排');w.switchGeneration();await w.click('确认并采用这份安排');assert.match(w.text(),/学习空间已切换/);assert.equal(w.agenda,null);assert.equal(w.calls.length,0);
 }finally{w.close();}
});

test('invalid config remains only an unsaved form and a paused plan cannot open learning tasks',async()=>{
 const v=planner();try{
  const before=v.storage.exportStorage();await v.click('调整目标与词表');v.change('每日总量上限','0');assert.equal(v.find('button','预览调整后的安排').props.disabled,true);assert.deepEqual(v.storage.exportStorage(),before);
 }finally{v.close();}
 const p=planner({paused:true});try{assert.equal(p.find('button','查看并确认安排').props.disabled,true);assert.deepEqual(p.state.answers,{});}finally{p.close();}
});

test('an auto draft with an oversized whole List cannot silently confirm an empty todo',async()=>{
 const v=planner({cap:1});try{await v.click('调整每日安排');assert.match(v.text(),/超过每日上限，尚未排入/);assert.equal(v.find('button','确认并采用这份安排').props.disabled,true);assert.equal(v.agenda,null);}finally{v.close();}
});
test('adjusting a target preserves manually chosen List dates until the draft is confirmed',async()=>{
 const v=planner({cap:null});try{await v.click('调整每日安排');await v.click('自己安排');v.change('移动到日期','2026-10-20');await v.click('移动当天任务');await v.click('确认并采用这份安排');await v.click('调整目标与词表');v.change('目标首轮完成日期','2026-10-25');await v.submit('预览调整后的安排');assert.equal(v.agenda.tasks[0].day,'2026-10-20');await v.click('确认并采用这份安排');assert.equal(v.agenda.mode,'manual');assert.equal(v.agenda.tasks[0].day,'2026-10-20');assert.equal(v.state.config.targetDay,'2026-10-25');}finally{v.close();}
});

test('a new-plan durable save failure can retry its own locally written settings safely',async()=>{
 const v=planner({seed:false});try{v.queuePersistence(Error('本机保存失败'));await v.click('制定学习计划');await v.submit('生成草案');await v.click('确认并采用这份安排');assert.match(v.text(),/本机保存失败/);assert.ok(v.find('button','确认并采用这份安排'));await v.click('确认并采用这份安排');assert.match(v.text(),/计划已同步到账号/);assert.equal(v.calls.length,2);}finally{v.close();}
});

 test('a new manual plan can be checked and reopened without replacing its real traffic light answers',async()=>{
 const v=planner({seed:false,cap:null});try{await v.click('制定学习计划');await v.submit('生成草案');await v.click('确认并采用这份安排');assert.equal(v.state.config.completionMode,'manual');v.store.recordLearningPlanWords(['apple'],'red',firstDay);v.store.recordLearningPlanWords(['banal'],'yellow',firstDay);await v.flush();const answers=structuredClone(v.state.answers);await v.pressAria('完成 GLEE List 01');assert.ok(v.nodes(v.scope('learningTodo')).some(n=>n.type==='s'));assert.deepEqual(v.state.answers,answers);await v.pressAria('取消完成 GLEE List 01');assert.equal(v.nodes(v.scope('learningTodo')).some(n=>n.type==='s'),false);assert.deepEqual(v.state.answers,answers);}finally{v.close();}
});
 test('the quick daily checklist works without creating a long-term plan',async()=>{
 const v=planner({seed:false,cap:null});try{await v.click('＋ 添加今天的 List');await v.click('List 012 词');await v.click('List 022 词');await v.click('加入今日清单（2 个 List）');assert.equal(v.state,null);await v.pressAria('完成 GLEE List 01');assert.ok(v.nodes(v.scope('dailyGoals')).some(n=>n.type==='s'));await v.pressAria('取消完成 GLEE List 01');assert.equal(v.nodes(v.scope('dailyGoals')).some(n=>n.type==='s'),false);assert.equal(v.state,null);await v.advanceDay('2026-10-18');assert.match(v.text(v.scope('dailyGoals')),/从 2026-10-17 顺延/);}finally{v.close();}
});

 test('switching an existing automatic plan to manual retains its already completed Lists',async()=>{
 const v=planner({cap:null});try{await v.click('查看并确认安排');await v.click('确认并采用这份安排');v.store.recordLearningPlanWords(['apple','banal'],'green',firstDay);await v.flush();const answers=structuredClone(v.state.answers),oldId=v.agenda.tasks.find(t=>t.unitId==='glee:list-1').id;await v.click('调整目标与词表');await v.submit('预览调整后的安排');await v.click('确认并采用这份安排');assert.equal(v.state.config.completionMode,'manual');assert.equal(v.state.taskChecks[oldId],true);assert.deepEqual(v.state.answers,answers);assert.ok(v.nodes(v.scope('learningTodo')).some(n=>n.type==='s'&&v.text(n)==='GLEE · List 01'));}finally{v.close();}
});


test('the live overview has no long-term setup and supports past dates, corrections and undo',async()=>{
 const v=planner({seed:false,overview:true});try{
  assert.equal(v.find('button','制定学习计划'),undefined);v.change('总表词表','glee');
  await v.pressAria('修改 GLEE List 01 第 1 轮 日期');v.change('修改实际完成日期','2026-10-16');await v.click('保存完成日期');
  assert.ok(v.nodes().some(n=>n.props?.['aria-label']==='取消完成 GLEE List 01 第 1 轮'));assert.equal(v.state,null);
  assert.ok(v.nodes().some(n=>n.props?.['aria-label']==='2026-10-19 待复习 1 组'));
  await v.pressAria('修改 GLEE List 01 第 1 轮 日期');v.change('修改实际完成日期','2026-10-15');await v.click('保存完成日期');
  assert.ok(v.nodes().some(n=>n.props?.['aria-label']==='2026-10-18 待复习 1 组'));
  assert.ok(v.nodes().some(n=>n.props?.['aria-label']==='2026-10-19 待复习 0 组'));
  await v.pressAria('取消完成 GLEE List 01 第 1 轮');assert.ok(v.nodes().some(n=>n.props?.['aria-label']==='2026-10-18 待复习 0 组'));
  assert.equal(Object.keys(v.storage.exportStorage()).filter(k=>k.startsWith('lemnota-list-round:')).length,1);
 }finally{v.close();}
});
test('today goals and master table share one completion and corrections survive reopening',async()=>{
 const v=planner({seed:false,overview:true});try{
  v.change('总表词表','glee');await v.click('＋ 添加今天的 List');await v.click('List 012 词');await v.click('加入今日清单（1 个 List）');await v.pressAria('完成 GLEE List 01');
  assert.ok(v.nodes().some(n=>n.props?.['aria-label']==='取消完成 GLEE List 01 第 1 轮'));await v.pressAria('取消完成 GLEE List 01 第 1 轮');
  assert.ok(v.nodes(v.scope('dailyGoals')).some(n=>n.props?.['aria-label']==='完成 GLEE List 01'));
  await v.pressAria('完成 GLEE List 01');assert.equal(Object.keys(v.storage.exportStorage()).filter(k=>k.startsWith('lemnota-list-round:')).length,1);
  await v.pressAria('修改 GLEE List 01 第 1 轮 日期');v.change('修改实际完成日期','2026-10-14');await v.click('保存完成日期');
  assert.ok(v.nodes(v.scope('dailyGoals')).some(n=>n.props?.['aria-label']==='取消完成 GLEE List 01'));assert.equal(v.state,null);
 }finally{v.close();}
});
test('overview prevents writes from a stale account and does not claim failed saves succeeded',async()=>{
 const v=planner({seed:false,overview:true});try{v.change('总表词表','glee');v.queuePersistence(Error('本机保存失败'));await v.pressAria('完成 GLEE List 01 第 1 轮');assert.match(v.text(),/本机保存失败/);assert.doesNotMatch(v.text(),/已同步到账号/);await v.click('重试同步');assert.match(v.text(),/已同步到账号/);const before=v.storage.exportStorage();v.switchGeneration();await v.pressAria('完成 GLEE List 02 第 1 轮');assert.deepEqual(v.storage.exportStorage(),before);assert.match(v.text(),/学习空间或日期已变化/);}finally{v.close();}
});

test('checking the master table also checks an existing daily goal, without an extra round',async()=>{
 const v=planner({seed:false,overview:true});try{v.change('总表词表','glee');await v.click('＋ 添加今天的 List');await v.click('List 012 词');await v.click('加入今日清单（1 个 List）');await v.pressAria('完成 GLEE List 01 第 1 轮');assert.ok(v.nodes(v.scope('dailyGoals')).some(n=>n.props?.['aria-label']==='取消完成 GLEE List 01'));await v.pressAria('取消完成 GLEE List 01');assert.ok(v.nodes().some(n=>n.props?.['aria-label']==='完成 GLEE List 01 第 1 轮'));assert.equal(Object.keys(v.storage.exportStorage()).filter(k=>k.startsWith('lemnota-list-round:')).length,1);}finally{v.close();}
});
