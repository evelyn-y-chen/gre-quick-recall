import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
function module(file,dependencies={}){const out={};const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;new Function('exports','require',js)(out,name=>dependencies[name]??{});return out;}
const db=module('community/database.ts');
const {makeSlip,readSlip}=module('community/slip.ts',{'./database':db});
const snapshot={version:1,rows:[{key:'word-memory:example',value:'{"text":"我的记法"}',revision:2,updated_at:'2026-10-14'}],storage:{'lemnota-username':'小词','lemnota-practice-words':'{"queue":["l01-dubious"]}','community-theme':'sage','gre-bb-ratings-v1':'{"bb-upper-001":"fuzzy"}'}};
test('learning slips round-trip notes, ratings and theme and accept old backups',()=>{const slip=JSON.parse(JSON.stringify(makeSlip(snapshot)));assert.equal(slip.format,'gre-learning-slip');assert.deepEqual(readSlip(slip),snapshot);assert.deepEqual(readSlip(snapshot),snapshot);});
test('invalid and duplicate-row slips are rejected before import',()=>{for(const value of [null,{}, {format:'gre-learning-slip',version:9,payload:snapshot},{...snapshot,rows:[snapshot.rows[0],snapshot.rows[0]]},{...snapshot,storage:{theme:123}}])assert.throws(()=>readSlip(value));});
