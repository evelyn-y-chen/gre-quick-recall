import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
function bridge(){const module={exports:{}};new Function('exports','module',ts.transpileModule(readFileSync('community/workspacePersistence.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(module.exports,module);return module.exports;}

test('the workspace persistence bridge rejects unready and stale callers without invoking another workspace',async()=>{
 const api=bridge();let calls=0;
 await assert.rejects(api.persistLearningWorkspace(0),/尚未准备好/);
 const dispose=api.registerWorkspacePersistence({key:'account:A',generation:3,persist:async()=>{calls++;return {destination:'account',synced:true};}});
 await assert.rejects(api.persistLearningWorkspace(2),/学习空间已切换/);assert.equal(calls,0);
 assert.deepEqual(await api.persistLearningWorkspace(3),{destination:'account',synced:true});assert.equal(calls,1);
 dispose();await assert.rejects(api.persistLearningWorkspace(3),/尚未准备好/);
});

test('an old registration cleanup cannot unregister the next account and late old results are rejected',async()=>{
 const api=bridge();let resolve;const pending=new Promise(done=>{resolve=done;});
 const oldDispose=api.registerWorkspacePersistence({key:'account:A',generation:3,persist:()=>pending});
 const old=api.persistLearningWorkspace(3).then(()=>null,error=>error);
 const dispose=api.registerWorkspacePersistence({key:'account:B',generation:4,persist:async()=>({destination:'account',synced:true})});
 oldDispose();assert.equal((await api.persistLearningWorkspace(4)).synced,true);
 resolve({destination:'account',synced:true});assert.match((await old).message,/学习空间已切换/);
 dispose();
});
