import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './helpers/load-ts.mjs';
const {readSavedRatings,writeSavedRatings}=loadTs('app/ratingStorage.ts');
test('a corrupt optional record cannot prevent other rating maps from restoring',()=>{
 const data={words:'{broken',bb:'{"one":"familiar"}',math:'{"two":"fuzzy"}'};const s={getItem:k=>data[k]??null,setItem:(k,v)=>data[k]=v};
 assert.equal(readSavedRatings(s,'words'),undefined);assert.deepEqual(readSavedRatings(s,'bb'),{one:'familiar'});assert.deepEqual(readSavedRatings(s,'math'),{two:'fuzzy'});
 writeSavedRatings(s,'words',{});assert.equal(data.words,'{broken');assert.equal(data['gre-rating-recovery:words'],'{broken');
 writeSavedRatings(s,'words',{recovered:'familiar'});assert.deepEqual(JSON.parse(data.words),{recovered:'familiar'});assert.equal(data['gre-rating-recovery:words'],'{broken');
});
test('null, arrays and invalid colors are never hydrated as ratings',()=>{
 for(const value of ['null','[]','{"one":"other"}']){const s={getItem:()=>value,setItem(){}};assert.equal(readSavedRatings(s,'ratings'),undefined);}
});
