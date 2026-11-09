import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './helpers/load-ts.mjs';
const {verifyCloudReceipt}=loadTs('community/cloudReceipt.ts');
const snapshot=()=>({version:1,rows:[{key:'vocab-notebook:one',value:'{"words":["one","two","three","four"]}',revision:1,updated_at:'2026-11-09'}],storage:{theme:'cream',note:'保留笔记'}});
test('cloud receipt must contain all newly saved notebook words, not just a successful response or a larger count',()=>{
 const expected=snapshot();assert.doesNotThrow(()=>verifyCloudReceipt(expected,2,{revision:2,payload:structuredClone(expected)}));
 const missing=snapshot();missing.rows[0].value='{"words":["one"]}';assert.throws(()=>verifyCloudReceipt(expected,2,{revision:2,payload:missing}),/核验未通过/);
 assert.throws(()=>verifyCloudReceipt(expected,2,null),/尚未确认/);assert.throws(()=>verifyCloudReceipt(expected,2,{revision:1,payload:expected}),/尚未确认/);
});
test('a concurrent newer save requests another merge; JSON property ordering alone does not fail verification',()=>{
 const expected=snapshot(),reordered=snapshot();reordered.storage={note:'保留笔记',theme:'cream'};
 assert.doesNotThrow(()=>verifyCloudReceipt(expected,2,{revision:2,payload:reordered}));
 assert.throws(()=>verifyCloudReceipt(expected,2,{revision:3,payload:reordered}),error=>error.code==='WORKSPACE_CONFLICT');
});
