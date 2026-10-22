import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {loadTs} from './helpers/load-ts.mjs';
// Exercise real click handlers with controlled permission failures and late clipboard results.
function view(readText){
 let hooks=[],cursor=0,effects=[],tree,props={word:'recall',meaning:'original',origin:'my source'},applied=[];
 const react={useState(initial){const i=cursor++;if(!(i in hooks))hooks[i]=initial;return [hooks[i],v=>{hooks[i]=typeof v==='function'?v(hooks[i]):v;}];},useRef(initial){const i=cursor++;return hooks[i]??(hooks[i]={current:initial});},useEffect(fn,deps){const i=cursor++,old=hooks[i];if(!old||deps.some((x,j)=>x!==old.deps[j])){hooks[i]={deps};effects.push(fn);}}};
 const jsx=(type,props)=>({type,props:props??{}}),exports={};
 const code=ts.transpileModule(fs.readFileSync('app/DictionaryLookup.tsx','utf8').replaceAll('import.meta.env.BASE_URL',"'/'"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 new Function('require','exports','navigator',code)(name=>name==='react'?react:name==='react/jsx-runtime'?{jsx,jsxs:jsx}:name==='./dictionaryDefinition'?loadTs('app/dictionaryDefinition.ts'):name==='./DictionaryLinks'?{default:()=>null}:{appFetch:()=>{throw Error('unexpected lookup');}},exports,{clipboard:{readText}});
 const render=()=>{for(let n=0;n<2;n++){cursor=0;effects=[];tree=exports.default({...props,onApply:(meaning,origin)=>{applied.push({meaning,origin});props={...props,meaning,origin};}});effects.forEach(fn=>fn());}return tree;};
 function all(node){if(!node||typeof node!=='object')return [];return [node,...[node.props?.children].flat(Infinity).flatMap(all)];}
 const text=n=>typeof n==='string'?n:n&&typeof n==='object'?[n.props?.children].flat(Infinity).map(text).join(''):'';
 const find=(type,name)=>all(tree).find(n=>n.type===type&&(!name||text(n)===name));
 render();return {render,find,applied,text:()=>text(tree),word(word){props={...props,word};render();},click(name){const button=find('button',name);assert.ok(button,name);assert.ok(!button.props.disabled);const result=button.props.onClick();render();return result;},paste(value){find('textarea').props.onChange({target:{value}});render();}};
}
test('clipboard denial offers manual paste, and no clipboard access happens before a click',async()=>{
 let reads=0;const v=view(async()=>{reads++;throw Error('denied');});assert.equal(reads,0);v.click('从剪贴板粘贴');await new Promise(r=>setImmediate(r));v.render();assert.equal(reads,1);assert.match(v.text(),/手动|长按/);v.paste('a definition');v.click('追加粘贴的释义');assert.equal(v.applied[0].meaning,'original\na definition');assert.match(v.applied[0].origin,/my source\n词典 · 韦氏词典/);
});
test('a late clipboard result cannot populate another source or another word',async()=>{
 let resolve;const v=view(()=>new Promise(r=>resolve=r));v.click('从剪贴板粘贴');v.click('海词词典');resolve('stale merriam definition');await new Promise(r=>setImmediate(r));v.render();assert.equal(v.find('textarea').props.value,'');
 v.click('从剪贴板粘贴');v.word('different');resolve('stale recall definition');await new Promise(r=>setImmediate(r));v.render();assert.equal(v.find('textarea').props.value,'');assert.equal(v.applied.length,0);
});
test('manual editing during a clipboard read wins over the late clipboard contents',async()=>{
 let resolve;const v=view(()=>new Promise(r=>resolve=r));v.click('从剪贴板粘贴');v.paste('manual correction');resolve('old clipboard');await new Promise(r=>setImmediate(r));v.render();assert.equal(v.find('textarea').props.value,'manual correction');v.click('用粘贴内容替换释义');assert.equal(v.applied[0].meaning,'manual correction');
});
