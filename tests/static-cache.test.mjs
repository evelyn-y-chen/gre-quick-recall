import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function worker({full=false}={}){
 const handlers={},deleted=[],put=[],fetched=[],known=new Map();const source=fs.readFileSync('public/sw.js','utf8').replace("const CACHE='gre-community-shell-development';","const CACHE='gre-community-shell-current';").replace('const ASSETS=null;',"const ASSETS=['assets/current.js','assets/current.css','assets/current.wasm'];");
 const self={registration:{scope:'https://example.test/gre/'},location:{origin:'https://example.test'},clients:{claim:async()=>{}},skipWaiting:()=>{},addEventListener:(name,run)=>handlers[name]=run};
 const caches={keys:async()=>['gre-community-shell-old1','gre-community-shell-old2','gre-community-shell-current','unrelated-user-cache'],delete:async k=>{deleted.push(k);},open:async()=>({match:async k=>known.get(k),put:async(k,v)=>{if(full)throw Error('quota');put.push(k);known.set(k,v);}})};
 vm.runInNewContext(source,{self,caches,URL,Set,fetch:async r=>{fetched.push(r.url);return {ok:true,clone(){return this;}};}});
 return {deleted,put,fetched,async activate(){let wait;handlers.activate({waitUntil:p=>wait=p});await wait;},async request(path,method='GET'){let response;handlers.fetch({request:{url:'https://example.test'+path,method},respondWith:p=>response=p});return response?await response:null;}};
}
test('activation removes only expired program caches, leaving unrelated storage alone',async()=>{const w=worker();await w.activate();assert.deepEqual(w.deleted,['gre-community-shell-old1','gre-community-shell-old2']);});
test('only current build assets are cached once; old assets, learning API and recovery are excluded',async()=>{const w=worker();await w.request('/gre/assets/current.js?v=1');await w.request('/gre/assets/current.js?v=2');assert.equal(w.fetched.length,1);assert.equal(w.put.length,1);for(const path of ['/gre/assets/old.js','/api/word-memory','/gre/recover.html','/gre/'])assert.equal(await w.request(path),null);assert.equal(await w.request('/gre/assets/current.js','POST'),null);});
test('a full cache never breaks a successful current script download',async()=>{const w=worker({full:true});assert.equal((await w.request('/gre/assets/current.js')).ok,true);});
