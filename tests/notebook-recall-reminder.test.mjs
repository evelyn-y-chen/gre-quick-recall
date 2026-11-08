import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {loadTs} from './helpers/load-ts.mjs';

function host(file,props,imports={},initial=Date.parse('2026-11-08T01:00:00Z')){
 let clock=initial,cursor=0,dirty=true,closed=false,tree;
 const hooks=[],effects=[],timers=new Map(),listeners=new Map();let timerId=0;
 const react={
  useState(initial){const i=cursor++;if(!(i in hooks))hooks[i]=typeof initial==='function'?initial():initial;return [hooks[i],value=>{if(closed)throw Error('Updated unmounted component');hooks[i]=typeof value==='function'?value(hooks[i]):value;dirty=true;}];},
  useMemo(create,deps){const i=cursor++,old=hooks[i];if(!old||deps.some((value,index)=>!Object.is(value,old.deps[index])))hooks[i]={deps,value:create()};return hooks[i].value;},
  useEffect(effect,deps){const i=cursor++,old=hooks[i];if(!old||deps.some((value,index)=>!Object.is(value,old.deps[index]))){hooks[i]={deps,cleanup:old?.cleanup};effects.push(()=>{hooks[i].cleanup?.();hooks[i].cleanup=effect();});}},
 };
 const jsx=(type,props)=>({type,props:props??{}});
 class ClockDate extends Date {constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}}
 const browser={setTimeout(fn,delay){const id=++timerId;timers.set(id,{fn,at:clock+delay});return id;},clearTimeout(id){timers.delete(id);},addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
 const document={visibilityState:'visible',addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
 const exports={},compiled=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 new Function('require','exports','window','document','Date',compiled)(name=>{
  if(name==='react')return react;if(name==='react/jsx-runtime')return {jsx,jsxs:jsx};
  if(name==='./notebookRecallModel')return loadTs('app/notebookRecallModel.ts');
  assert.ok(name in imports,'Unexpected import '+name);return imports[name];
 },exports,browser,document,ClockDate);
 function render(){for(let n=0;n<20;n++){cursor=0;dirty=false;tree=exports.default(props);while(effects.length)effects.shift()();if(!dirty)return;}throw Error('Did not settle');}
 function nodes(node){if(!arguments.length)node=tree;return node&&typeof node==='object'?Array.isArray(node)?node.flatMap(node=>nodes(node)):[node,...nodes(node.props?.children)]:[];}
 const text=node=>node==null||typeof node==='boolean'?'':Array.isArray(node)?node.map(text).join(''):typeof node==='object'?text(node.props?.children):String(node);
 async function settle(){for(let n=0;n<8;n++){await Promise.resolve();if(dirty)render();}}
 render();
 return {nodes,text,settle,get tree(){return tree;},click(label){const button=nodes().find(node=>node.type==='button'&&text(node)===label);assert.ok(button,'Missing '+label);button.props.onClick();render();},setTime(value){nodes().find(node=>node.type==='input'&&node.props.type==='datetime-local').props.onChange({target:{value}});render();},advance(ms){clock+=ms;for(const [id,timer]of timers)if(timer.at<=clock){timers.delete(id);timer.fn();}render();},event(name){listeners.get(name)?.();render();},close(){hooks.forEach(hook=>hook?.cleanup?.());closed=true;},get timerCount(){return timers.size;}};
}
const attempt=(result,i)=>({id:'try-'+i,answer:'my answer',checked:true,result});
const word=(id,results)=>({id,word:id,meaning:'Meaning',note:'Note',origin:'Source',recalls:results.map(attempt)});

test('review tools select current wrong words, all words or a priority group and save a future local-time reminder',()=>{
 const batch={id:'batch',source:'Source',date:'2026-11-08',words:[word('passed',['correct']),word('focus',['incorrect','incorrect','incorrect']),word('one-error',['incorrect'])]};
 const starts=[],updates=[],view=host('app/NotebookRecallTools.tsx',{batch,onStart:ids=>starts.push(ids),onUpdate:next=>updates.push(next)});
 try{
  view.click('只重过错词 · 2');assert.deepEqual(starts.pop(),['focus','one-error']);view.click('全部再过 · 3');assert.deepEqual(starts.pop(),['passed','focus','one-error']);
  view.click('重点攻克1');view.click('开始所选 1 词过关');assert.deepEqual(starts.pop(),['focus']);
  view.setTime('2030-01-01T09:30');view.click('预约下次过关 · 1 词');
  assert.deepEqual(updates[0].recallReminder.wordIds,['focus']);assert.equal(updates[0].recallReminder.label,'重点攻克');assert.ok(Number.isFinite(Date.parse(updates[0].recallReminder.at)));assert.equal(updates[0].words,batch.words);
  view.setTime('2020-01-01T09:30');view.click('预约下次过关 · 1 词');assert.equal(updates.length,1);assert.ok(view.text(view.tree).includes('请选择未来的提醒时间'));
 }finally{view.close();}
});

test('a due reminder opens its exact collection, can be dismissed and appears again on a later visit without deleting it',async()=>{
 const clock=Date.parse('2026-11-08T01:00:00Z'),saved={id:'one',source:'Day8',recallReminder:{id:'reminder',at:new Date(clock+1000).toISOString(),wordIds:['w'],label:'易错词'}},opened=[];
 const imports={'../community/api':{appFetch:async()=>({ok:true,json:async()=>({batches:[saved]})})},'../db/notebookStore':{subscribeNotebookChanges:()=>()=>{}}};
 const view=host('app/NotebookReviewReminder.tsx',{onOpen:id=>opened.push(id)},imports,clock);
 try{
  await view.settle();assert.equal(view.tree,null);assert.equal(view.timerCount,1);
  view.advance(1001);assert.equal(view.tree.props.role,'dialog');assert.ok(view.text(view.tree).includes('Day8'));
  view.click('现在过关');assert.deepEqual(opened,['one']);assert.equal(view.tree,null);assert.equal(saved.recallReminder.id,'reminder');
 }finally{view.close();}
 const reopened=host('app/NotebookReviewReminder.tsx',{onOpen(){}},imports,clock+2000);
 try{await reopened.settle();assert.equal(reopened.tree.props.role,'dialog');reopened.click('×');assert.equal(reopened.tree,null);}finally{reopened.close();}
});

test('successful notebook saves refresh only summaries; cancellation and unmount remove obsolete reminder work',async()=>{
 let saved=[],changed,reads=0;const imports={'../community/api':{appFetch:async()=>{reads++;return {ok:true,json:async()=>({batches:saved})};}},'../db/notebookStore':{subscribeNotebookChanges:fn=>{changed=fn;return()=>{changed=null;};}}};
 const view=host('app/NotebookReviewReminder.tsx',{onOpen(){}},imports);
 await view.settle();assert.equal(reads,1);assert.equal(view.tree,null);
 saved=[{id:'batch',source:'New',recallReminder:{id:'appointment',at:'2026-11-08T00:00:00Z',wordIds:['w'],label:'本轮错词'}}];changed();await view.settle();assert.equal(view.tree.props.role,'dialog');
 saved=[];changed();await view.settle();assert.equal(view.tree,null);assert.equal(reads,3);
 view.close();assert.equal(changed,null);assert.equal(view.timerCount,0);
});
