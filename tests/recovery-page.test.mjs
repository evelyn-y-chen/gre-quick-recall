import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync('public/recover.html','utf8').split('<script>')[1].split('</script>')[0];
const snapshot=(count,draft='')=>({version:1,rows:[],storage:{'lemnota-username':'test learner','gre-bb-ratings-v1':JSON.stringify(Object.fromEntries(Array.from({length:count},(_,i)=>['bb-'+i,'familiar']))),...(draft?{'gre-shared-word-memory-drafts-v1':JSON.stringify({example:{text:draft,revision:0}})}:{})}});
function page(entries,{missing=false}={}){
 const elements=new Map(),transactions=[],downloads=[];let opens=0,closed=false,aborted=false;
 function element(tag){return {tag,children:[],events:{},textContent:'',disabled:false,append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;},addEventListener(name,fn){this.events[name]=fn;},click(){return this.events.click?.();}};}
 const document={getElementById(id){if(!elements.has(id))elements.set(id,element('div'));if(id==='export'&&!elements.get(id).initialized){elements.get(id).disabled=true;elements.get(id).initialized=true;}return elements.get(id);},createElement:element};
 const db={objectStoreNames:{contains:name=>name==='workspaces'},transaction(name,mode){transactions.push({name,mode});const tx={objectStore(){return {getAll:()=>({result:entries.map(x=>x[1])}),getAllKeys:()=>({result:entries.map(x=>x[0])})};}};queueMicrotask(()=>tx.oncomplete());return tx;},close(){closed=true;}};
 const indexedDB={open(name,version){opens++;assert.equal(name,'gre-personal-workspace-v1');assert.equal(version,1);const request={result:db,transaction:{abort(){aborted=true;}}};queueMicrotask(()=>missing?request.onupgradeneeded():request.onsuccess());return request;}};
 const URL={createObjectURL(blob){downloads.push(blob);return 'blob:test';},revokeObjectURL(){}};
 vm.runInNewContext(source,{document,indexedDB,Date,Map,JSON,Object,Array,String,Error,Number,Blob,URL,setTimeout:()=>{}});
 const allText=()=>{const visit=e=>[e.textContent,...e.children.map(visit)].join('\n');return [...elements.values()].map(visit).join('\n');};
 return {elements,transactions,downloads,allText,scan:()=>elements.get('scan').click(),export:()=>elements.get('export').click(),get opens(){return opens;},get closed(){return closed;},get aborted(){return aborted;}};
}
test('rescue page waits for an explicit read-only scan and includes hidden conflict, baseline and note drafts',async()=>{
 const live=snapshot(39),lost=snapshot(301,'unsaved BB note');
 const p=page([['account:A',{revision:10,payload:live,basePayload:lost}],['conflict:A',{revision:3,pending:false,payload:lost}]]);
 assert.equal(p.opens,0);assert.equal(p.elements.get('export').disabled,true);
 await p.scan();assert.deepEqual(p.transactions,[{name:'workspaces',mode:'readonly'}]);assert.equal(p.closed,true);
 assert.match(p.allText(),/301 条标记/);assert.match(p.allText(),/1 个词/);assert.match(p.allText(),/找到 3 份/);
 p.export();const bundle=JSON.parse(await p.downloads[0].text());assert.equal(bundle.format,'lemnota-device-recovery-bundle');assert.equal(bundle.copies.length,3);assert.deepEqual(bundle.copies[1].payload,lost);assert.deepEqual(bundle.copies[2].payload,lost);
});
test('a missing database is aborted instead of creating an empty workspace',async()=>{
 const p=page([],{missing:true});await p.scan();assert.equal(p.aborted,true);assert.deepEqual(p.transactions,[]);assert.equal(p.elements.get('export').disabled,true);assert.match(p.allText(),/原来使用的浏览器/);
});
test('checkpoint copies remain separate and downloads retain exact personal contents',async()=>{
 const older=snapshot(300,'keep exact note'),current=snapshot(39);const entries=[['local',{revision:2,payload:current,history:[{id:'before',createdAt:'2026-10-17T09:00:00Z',reason:'before import',payload:older}]}]];
 const before=structuredClone(entries),p=page(entries);await p.scan();p.export();assert.deepEqual(entries,before);const bundle=JSON.parse(await p.downloads[0].text());assert.equal(bundle.copies.length,2);assert.deepEqual(bundle.copies[1].payload,older);
});
