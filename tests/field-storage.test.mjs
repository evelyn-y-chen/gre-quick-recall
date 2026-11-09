import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import initSqlJs from 'sql.js';
import {loadTs} from './helpers/load-ts.mjs';

test('real database writes stamp only changed fields; failed CAS cannot falsely mark an edit as saved',async()=>{
 const storage=loadTs('community/storage.ts'),runtime=loadTs('db/runtime.ts'),fields=loadTs('community/fieldMerge.ts'),out={};
 const code=ts.transpileModule(fs.readFileSync('community/database.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('exports','require',code)(out,name=>name==='sql.js'?{default:options=>initSqlJs({...options,locateFile:()=>path.resolve('node_modules/sql.js/dist/sql-wasm.wasm')})}:name.endsWith('.wasm?url')?{default:'test-wasm'}:name==='./storage'?storage:runtime);
 const old=JSON.stringify({id:'one',source:'来源',date:'2026-11-09',words:[{id:'word',word:'lucid',meaning:'清楚的',note:'原笔记',origin:'来源'}]});
 await out.openWorkspace({version:1,rows:[{key:'vocab-notebook:one',value:old,revision:1,updated_at:'2026-11-09T01:00:00Z'}],storage:{}});
 let changes=0;out.onWorkspaceChange(()=>changes++);
 const next=JSON.parse(old);next.words[0].meaning='清楚易懂的';
 const sql='UPDATE mind_map_state SET value=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE key=? AND revision=? RETURNING revision';
 const saved=await runtime.getRuntimeDatabase().prepare(sql).bind(JSON.stringify(next),'vocab-notebook:one',1).first();assert.equal(saved.revision,2);assert.equal(changes,1);
 const clocks=fields.readFieldClocks(out.exportWorkspace().storage[fields.fieldClockKey]);
 assert.ok(clocks[JSON.stringify(['rows','vocab-notebook:one','words','@word','meaning'])]);
 assert.equal(clocks[JSON.stringify(['rows','vocab-notebook:one','words','@word','note'])],undefined);
 const before=out.exportWorkspace().storage[fields.fieldClockKey];
 assert.equal(await runtime.getRuntimeDatabase().prepare(sql).bind(old,'vocab-notebook:one',1).first(),null);assert.equal(changes,1);assert.equal(out.exportWorkspace().storage[fields.fieldClockKey],before);
 await runtime.getRuntimeDatabase().prepare('INSERT INTO mind_map_state (key,value,revision) VALUES (?,?,1)').bind('word-memory:new','{"text":"新笔记"}').run();assert.equal(changes,2);
 assert.ok(fields.readFieldClocks(out.exportWorkspace().storage[fields.fieldClockKey])[JSON.stringify(['rows','word-memory:new','text'])]);
 await out.openWorkspace();assert.equal(out.exportWorkspace().rows.length,0);assert.equal(out.exportWorkspace().storage[fields.fieldClockKey],undefined,'Workspace switch clears the previous account clocks');
});

test('storage stamps actual typing time, preserves plain-text encoding, and never stamps a loaded snapshot as a new edit',()=>{
 const storage=loadTs('community/storage.ts'),fields=loadTs('community/fieldMerge.ts');
 storage.loadStorage({settings:'{"one":1,"two":2}'});assert.equal(storage.exportStorage()[fields.fieldClockKey],undefined);
 storage.studyStorage.setItem('settings','{"one":3,"two":2}');const clocks=fields.readFieldClocks(storage.exportStorage()[fields.fieldClockKey]);
 assert.ok(clocks['["storage","settings","one"]']);assert.equal(clocks['["storage","settings","two"]'],undefined);
 const before=storage.exportStorage()[fields.fieldClockKey];storage.studyStorage.setItem('settings','{"one":3,"two":2}');assert.equal(storage.exportStorage()[fields.fieldClockKey],before);
 const merger=fields.createFieldMerger(undefined,storage.exportStorage()[fields.fieldClockKey],undefined);
 assert.equal(merger.merge('storage','new-key',undefined,'plain text',undefined),'plain text');
});
