import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

// Exercise the real observer against a large word list, with explicit layout
// counters. Typing outside a label must never cause a full-list measurement.
async function environment(count=400){
 let mutation,resize,nextFrame=0,scans=0,reads=0;
 const frames=new Map(),listeners=new Map(),observed=new Set();
 class Element {
  constructor(label=false,parent=null){this.nodeType=1;this.label=label;this.parentElement=parent;this.children=[];parent?.children.push(this);this.isConnected=true;this.width=100;this.naturalWidth=160;this.fontSize='';this.measured=0;
   this.style={removeProperty:()=>{this.fontSize='';},setProperty:(_,value)=>{this.fontSize=value;}};
  }
  matches(){return this.label;}
  closest(){return this.label?this:this.parentElement?.closest()??null;}
  querySelectorAll(){scans++;return this.children.flatMap(child=>[...(child.label?[child]:[]),...child.querySelectorAll()]);}
  getClientRects(){return this.isConnected?[{}]:[];}
  get clientWidth(){reads++;this.measured++;return this.width;}
  get scrollWidth(){reads++;return this.naturalWidth*(parseFloat(this.fontSize)||20)/20;}
 }
 const body=new Element(),labels=Array.from({length:count},()=>new Element(true,new Element(false,body))),note=new Element(false,body);
 const document={body,fonts:{ready:Promise.resolve()}};
 const window={addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
 class ResizeObserver {constructor(fn){resize=fn;}observe(node){observed.add(node);}unobserve(node){observed.delete(node);}disconnect(){observed.clear();}}
 class MutationObserver {constructor(fn){mutation=fn;}observe(){}disconnect(){mutation=null;}}
 const exports={};
 const compiled=ts.transpileModule(fs.readFileSync('app/wordFitObserver.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('exports','document','window','ResizeObserver','MutationObserver','requestAnimationFrame','cancelAnimationFrame','getComputedStyle',compiled)(exports,document,window,ResizeObserver,MutationObserver,fn=>{const id=++nextFrame;frames.set(id,fn);return id;},id=>frames.delete(id),()=>({fontSize:'20px'}));
 const stop=exports.observeWordFit();await Promise.resolve();
 const frame=()=>{const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn());};frame();
 return {labels,note,body,stop,frame,observed,Element,get reads(){return reads;},get scans(){return scans;},get pendingFrames(){return frames.size;},
  text(node){mutation([{type:'characterData',target:{nodeType:3,parentElement:node}}]);},
  add(parent,node){mutation([{type:'childList',target:parent,addedNodes:[node],removedNodes:[]}]);},
  remove(node){node.isConnected=false;mutation([{type:'childList',target:node.parentElement,addedNodes:[],removedNodes:[node]}]);},
  size(parent,width){resize([{target:parent,contentRect:{width}}]);},
  resizeWindow(){listeners.get('resize')?.();},
 };
}

test('100 note/status edits do not rescan or measure any of 400 English labels',async()=>{
 const env=await environment();try{
  const reads=env.reads,scans=env.scans;
  for(let i=0;i<100;i++){env.text(env.note);env.frame();}
  assert.equal(env.reads,reads);assert.equal(env.scans,scans);assert.equal(env.pendingFrames,0);
  assert.ok(env.labels.every(label=>label.scrollWidth<=label.clientWidth+1));
 }finally{env.stop();}
});

test('a changed or newly added word fits only that word, including long labels',async()=>{
 const env=await environment();try{
  const before=env.labels.map(label=>label.measured),scans=env.scans;
  env.labels[13].naturalWidth=240;env.text(env.labels[13]);env.frame();
  assert.equal(env.scans,scans);
  assert.equal(env.labels[13].measured,before[13]+1);
  assert.ok(env.labels.every((label,index)=>index===13||label.measured===before[index]));
  assert.ok(env.labels[13].scrollWidth<=env.labels[13].clientWidth+1);
  const parent=new env.Element(false,env.body),added=new env.Element(true,parent),reads=env.reads;
  env.add(env.body,parent);env.frame();
  assert.equal(env.reads-reads,2);assert.ok(added.fontSize);assert.ok(env.observed.has(parent));
 }finally{env.stop();}
});

test('height-only resize is ignored, while word width and window resize still refit labels',async()=>{
 const env=await environment();try{
  const parent=env.labels[0].parentElement;
  env.size(parent,100);env.frame();const reads=env.reads;
  env.size(parent,100);env.frame();assert.equal(env.reads,reads);
  env.labels[0].width=80;env.size(parent,80);env.frame();assert.equal(env.reads,reads+2);
  env.resizeWindow();env.frame();assert.ok(env.reads>reads+2);
 }finally{env.stop();}
});

test('removed labels stop observing their parents and disposal cancels pending layout work',async()=>{
 const env=await environment(1),parent=env.labels[0].parentElement;
 env.remove(env.labels[0]);env.frame();assert.equal(env.observed.has(parent),false);
 const added=new env.Element(true,new env.Element(false,env.body));env.add(env.body,added);assert.equal(env.pendingFrames,1);
 const reads=env.reads;env.stop();env.frame();assert.equal(env.reads,reads);assert.equal(env.observed.size,0);
});
