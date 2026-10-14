import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const ts=createRequire(import.meta.url)('typescript');
const module={exports:{}};
new Function('exports','module',ts.transpileModule(readFileSync('community/workspacePlan.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(module.exports,module);
const {workspacePlan}=module.exports;
const snapshot=(word)=>({version:1,rows:[],storage:{note:word}});
test('a new device loads cloud progress; an empty account never silently adopts guest data',()=>{
 const remote={revision:4,payload:snapshot('account only')};
 assert.deepEqual(workspacePlan(undefined,remote).payload,remote.payload);
 assert.equal(workspacePlan(undefined,null).payload,undefined);
});
test('pending offline edits resume only when their cloud base still matches',()=>{
 const cache={revision:2,cloudRevision:4,pending:true,payload:snapshot('offline changes')};
 assert.equal(workspacePlan(cache,{revision:4,payload:snapshot('older cloud')}).payload,cache.payload);
 const conflict=workspacePlan(cache,{revision:5,payload:snapshot('other device')});
 assert.equal(conflict.payload.storage.note,'other device');
 assert.equal(conflict.conflict,cache.payload);
 assert.equal(conflict.pending,false);
});
test('an empty account and stale cached account do not overwrite each other',()=>{
 const cache={revision:3,cloudRevision:2,pending:true,payload:snapshot('keep me')};
 assert.equal(workspacePlan(cache,null).conflict,cache.payload);
 const saved={...cache,pending:false};
 assert.equal(workspacePlan(saved,{revision:7,payload:snapshot('latest')}).payload.storage.note,'latest');
});
