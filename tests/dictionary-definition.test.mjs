import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './helpers/load-ts.mjs';
const {applyDictionaryDefinition,dictionarySources}=loadTs('app/dictionaryDefinition.ts');
test('append preserves previous meanings and sources and does not duplicate repeated application',()=>{
 const a=applyDictionaryDefinition('old meaning','my source','new meaning','dictcn',true);
 assert.equal(a.meaning,'old meaning\nnew meaning');assert.equal(a.origin,'my source\n'+dictionarySources.dictcn);assert.deepEqual(applyDictionaryDefinition(a.meaning,a.origin,'new meaning','dictcn',true),a);
});
test('explicit replacement updates only definition and definition source',()=>{
 assert.deepEqual(applyDictionaryDefinition('old','old source',' new ','merriam',false),{meaning:'new',origin:dictionarySources.merriam});
 assert.deepEqual(applyDictionaryDefinition('','','new','ecdict',true),{meaning:'new',origin:dictionarySources.ecdict});
});
test('empty input, oversized text and oversized origins fail without truncation',()=>{
 assert.throws(()=>applyDictionaryDefinition('old','source',' ','dictcn',true),/先粘贴/);assert.throws(()=>applyDictionaryDefinition('x'.repeat(4000),'source','new','dictcn',true),/4000/);assert.throws(()=>applyDictionaryDefinition('old','s'.repeat(1000),'new','dictcn',true),/1000/);
});
