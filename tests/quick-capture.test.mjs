import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModel} from './helpers/load-model.mjs';
const model=loadModel('app/quickCaptureModel.ts');
let counter=0;
const newId=()=>`capture-${++counter}`;
const receive=(draft,field,text)=>model.receiveCapture(draft,{field,text},newId);

test('copied definitions attach to the selected word, preserve earlier cards and survive reopening',()=>{
 let draft=receive(model.emptyCapture(),'word','candid');
 draft=receive(draft,'meaning','坦率的');
 draft=receive(draft,'meaning','坦率的');
 assert.equal(draft.cards[0].meaning,'坦率的');
 draft=receive(draft,'word','lucid');
 draft=receive(draft,'meaning','清晰的');
 assert.equal(draft.cards.length,2);
 assert.deepEqual(draft.cards.map(c=>[c.word,c.meaning]),[['candid','坦率的'],['lucid','清晰的']]);
 assert.deepEqual(model.readCaptureDraft(JSON.stringify(draft)),draft);
 draft=receive(draft,'word','');
 assert.equal(draft.cards[1].word,'lucid');
});

test('a definition received first is retained until its word is supplied',()=>{
 let draft=receive(model.emptyCapture(),'meaning','清晰的');
 draft=receive(draft,'word','lucid');
 assert.equal(draft.cards.length,1);
 assert.deepEqual([draft.cards[0].word,draft.cards[0].meaning],['lucid','清晰的']);
});

test('capture links round-trip punctuation and multiline Chinese without truncating oversized contents',()=>{
 const text='n. 倒数\n相互的 + A&B / 50% #1';
 assert.deepEqual(model.captureInput('#capture=meaning&text='+encodeURIComponent(text)),{field:'meaning',text});
 assert.equal(model.captureInput('#unrelated=true'),null);
 assert.throws(()=>model.captureInput('#capture=word&text='+ 'a'.repeat(301)),/300/);
 assert.throws(()=>receive(model.emptyCapture(),'meaning','字'.repeat(4001)),/4000/);
 assert.throws(()=>model.readCaptureDraft('{broken'));
});

test('retrying after a successful local write keeps one collection and one word',()=>{
 const draft=receive(receive(model.emptyCapture(),'word','candid'),'meaning','坦率的'),card=draft.cards[0];
 const first=model.captureIntoBatch(card,null,newId);
 const retried=model.captureIntoBatch(card,{...first,revision:1},newId);
 assert.equal(retried.batch.id,card.collectionId);
 assert.deepEqual(retried.batch,first.batch);
 assert.equal(retried.revision,1);
 assert.equal(retried.batch.words.length,1);
});

test('adding a meaning preserves existing attempts and word order while making new definitions visible',()=>{
 let card=receive(receive(model.emptyCapture(),'word','candid'),'meaning','坦率的').cards[0];
 const first=model.captureIntoBatch(card,null,newId);
 const word={...first.batch.words[0],rating:'familiar',briefMeaning:'坦率的',recalls:[{id:'r-1',answer:'坦率的',checked:true,result:'correct'}]};
 const previous={batch:{...first.batch,words:[word,{id:'another',word:'lucid',meaning:'清晰的',note:'',origin:''}]},revision:3};
 card={...card,target:first.batch.id,meaning:'公正的',origin:'海词词典'};
 const next=model.captureIntoBatch(card,previous,newId);
 assert.deepEqual(next.batch.words.map(w=>w.word),['candid','lucid']);
 assert.deepEqual(next.batch.words[0].recalls,word.recalls);
 assert.equal(next.batch.words[0].rating,'familiar');
 assert.equal(next.batch.words[0].briefMeaning,undefined);
 assert.match(next.batch.words[0].meaning,/坦率的/);
 assert.match(next.batch.words[0].meaning,/公正的/);
 assert.deepEqual(previous.batch.words[0],word);
 assert.throws(()=>model.captureIntoBatch(card,null,newId),/收集/);
});

test('one collection receives all reviewed words in order and retries keep the same contents',()=>{
 let draft=receive(model.emptyCapture(),'word','candid');
 draft=receive(draft,'meaning','坦率的');
 draft=receive(draft,'word','lucid');
 draft=receive(draft,'meaning','清晰的');
 const destination={...draft.cards[1],source:'阅读随手收词'};
 const next=model.capturesIntoBatch(draft.cards,destination,null,newId);
 assert.equal(next.batch.source,'阅读随手收词');
 assert.deepEqual(next.batch.words.map(word=>[word.word,word.meaning]),[['candid','【未填写来源】\n坦率的'],['lucid','【未填写来源】\n清晰的']]);
 assert.deepEqual(model.capturesIntoBatch(draft.cards,destination,next,newId),next);
});
