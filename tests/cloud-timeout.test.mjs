import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
function harness(){
 const timers=new Map();let next=0;const out={};
 const js=ts.transpileModule(fs.readFileSync('community/cloudTimeout.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 new Function('exports','setTimeout','clearTimeout',js)(out,(fn,ms)=>{const id=++next;timers.set(id,{fn,ms});return id;},id=>timers.delete(id));
 return {run:out.withCloudTimeout,timers,expire(){for(const t of [...timers.values()])t.fn();}};
}
test('a stalled cloud request is aborted and rejects even if the SDK ignores abort',async()=>{
 const h=harness();let signal,finish;
 const pending=h.run(s=>{signal=s;return new Promise(resolve=>{finish=resolve;});});
 await Promise.resolve();assert.equal(signal.aborted,false);assert.equal([...h.timers.values()][0].ms,15000);
 h.expire();await assert.rejects(pending,/账号连接超时/);assert.equal(signal.aborted,true);
 finish('late result');await Promise.resolve();await assert.rejects(pending,/账号连接超时/);
});
test('successful and failed cloud requests clear the timeout without changing their result',async()=>{
 const h=harness();assert.equal(await h.run(async()=>42),42);await Promise.resolve();assert.equal(h.timers.size,0);
 await assert.rejects(h.run(async()=>{throw Error('network failure');}),/network failure/);await Promise.resolve();assert.equal(h.timers.size,0);
});
