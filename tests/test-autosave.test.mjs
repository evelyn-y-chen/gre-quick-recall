import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=ts.transpileModule(fs.readFileSync('community/testExperience.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function host(){
 let slots=[],cursor=0,effects=[],timers=new Map(),id=0,generation=7,revision=1,enabled=true,output,calls=0,resolve;
 const events=new Map();
 const react={useState(init){const i=cursor++;if(!(i in slots))slots[i]=typeof init==='function'?init():init;return [slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v];},useRef(v){const i=cursor++;return slots[i]??(slots[i]={current:v});},useEffect(fn,deps){const i=cursor++,old=slots[i];if(!old||deps.some((v,j)=>v!==old.deps[j])){old?.cleanup?.();slots[i]={deps};effects.push(()=>slots[i].cleanup=fn());}}};
 const exports={};new Function('require','exports','setTimeout','clearTimeout','window',source)(name=>name==='react'?react:name==='react/jsx-runtime'?{}:name==='./api'?{getWorkspaceGeneration:()=>generation}:name==='./storage'?{}:{persistLearningWorkspace:()=>{calls++;return new Promise(r=>resolve=r);}},exports,fn=>{timers.set(++id,fn);return id;},n=>timers.delete(n),{addEventListener:(k,v)=>events.set(k,v),removeEventListener:k=>events.delete(k)});
 const render=()=>{cursor=0;output=exports.useTestAutosave(revision,enabled,7);for(const effect of effects.splice(0))effect();};render();
 return {render,change(){revision++;render();},online(){events.get('online')?.();render();},fire(){for(const [n,fn] of [...timers]){timers.delete(n);fn();}},async finish(value){resolve(value);await Promise.resolve();await Promise.resolve();render();},switch(){generation=8;},get calls(){return calls;},get status(){render();return output.status;},close(){for(const slot of slots)slot?.cleanup?.();}};
}
test('answer changes coalesce and only confirmed account delivery says saved to account',async()=>{
 const h=host();try{h.change();h.change();h.fire();assert.equal(h.calls,1);assert.match(h.status,/正在自动保存/);await h.finish({destination:'account',synced:true});assert.match(h.status,/已自动保存到账号/);}finally{h.close();}
});
test('offline account delivery is not advertised as synced and reconnect retries',async()=>{
 const h=host();try{h.fire();await h.finish({destination:'account',synced:false});assert.match(h.status,/同步待完成/);h.online();h.fire();assert.equal(h.calls,2);await h.finish({destination:'account',synced:true});assert.match(h.status,/已自动保存到账号/);}finally{h.close();}
});
test('a late old-save response cannot confirm a newer answer or a different workspace',async()=>{
 const h=host();try{h.fire();h.change();await h.finish({destination:'account',synced:true});assert.match(h.status,/正在自动保存/);h.fire();h.switch();await h.finish({destination:'account',synced:true});assert.doesNotMatch(h.status,/已自动保存到账号/);}finally{h.close();}
});
