import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const ts=createRequire(import.meta.url)('typescript');

// Exercise component events and effect requests with a small hook host; no real account or network is used.
function panel({session=null,admin=false,failFirstSubmit=false}={}){
 const hooks=[],calls=[],effects=[],clients=[];let cursor=0,tree,failed=false;
 const storage=new Map();
 const originalStorage=globalThis.localStorage;
 globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
 const slot=()=>cursor++;
 const react={
  useState(initial){const i=slot();if(!(i in hooks))hooks[i]=typeof initial==='function'?initial():initial;return [hooks[i],value=>{hooks[i]=typeof value==='function'?value(hooks[i]):value;}];},
  useRef(initial){const i=slot();return hooks[i]??(hooks[i]={current:initial});},
  useMemo(factory,deps){const i=slot();if(!hooks[i]||deps.some((dep,n)=>dep!==hooks[i].deps[n]))hooks[i]={value:factory(),deps};return hooks[i].value;},
  useEffect(effect,deps){const i=slot();if(!hooks[i]||deps.some((dep,n)=>dep!==hooks[i].deps[n])){hooks[i]?.cleanup?.();hooks[i]={deps,cleanup:null};effects.push(()=>{hooks[i].cleanup=effect();});}}
 };
 const jsx=(type,props)=>({type,props:props??{}}),module={exports:{}};
 const source=readFileSync('community/Feedback.tsx','utf8').replaceAll('import.meta.env.','testEnv.');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const createClient=(_url,_key,options)=>{const client={token:options.accessToken,rpc:async(name,args)=>{calls.push({name,args,token:await options.accessToken()});if(name==='submit_feedback_v2'&&failFirstSubmit&&!failed){failed=true;return {data:null,error:{code:'FETCH_ERROR'}};}return {data:name==='list_feedback_v2'?[]:args.p_id,error:null};}};clients.push(client);return client;};
 new Function('require','module','exports','testEnv',compiled)(name=>{if(name==='react')return react;if(name==='react/jsx-runtime')return {jsx,jsxs:jsx};if(name==='@supabase/supabase-js')return {createClient};if(name==='./publicCloud.json')return {default:{url:'https://example.supabase.co',publishableKey:'public-key'}};throw Error(name);},module,module.exports,{});
 const Component=module.exports.default;
 function render(){cursor=0;tree=Component({session,admin,onClose(){}});while(effects.length)effects.shift()();return tree;}
 function nodes(node){if(node==null||typeof node!=='object')return [];if(Array.isArray(node))return node.flatMap(nodes);return [node,...nodes(node.props?.children)];}
 function text(node){if(Array.isArray(node))return node.map(text).join('');if(node==null||typeof node==='boolean')return '';if(typeof node==='object')return text(node.props?.children);return String(node);}
 function find(type,label){return nodes(tree).find(node=>node.type===type&&text(node).includes(label));}
 async function flush(){for(let n=0;n<4;n++){await new Promise(resolve=>setImmediate(resolve));render();}}
 render();
 return {calls,clients,render,flush,nodes:()=>nodes(tree),find,text:()=>text(tree),body(value){find('textarea','').props.onChange({target:{value}});render();},async click(label){const button=find('button',label);assert.ok(button,`Missing button: ${label}`);assert.equal(!!button.props.disabled,false,`Disabled button: ${label}`);await button.props.onClick();await flush();},close(){for(const entry of hooks)entry?.cleanup?.();globalThis.localStorage=originalStorage;}};
}
const session={user:{id:'account-a'},access_token:'captured-account-token'};

test('guests submit only publicly without a login gate; retries keep the same request and guest key',async()=>{
 const view=panel({failFirstSubmit:true});
 try{
  await view.flush();assert.match(view.text(),/This suggestion will be public/);assert.equal(view.find('button','我的反馈'),undefined);assert.equal(view.nodes().filter(n=>n.type==='input'&&n.props.type==='radio').length,0);
  view.body('A public idea');await view.click('Post publicly');assert.match(view.text(),/Could not send/);await view.click('Post publicly');
  const submitted=view.calls.filter(c=>c.name==='submit_feedback_v2');assert.equal(submitted.length,2);assert.deepEqual(submitted[0],submitted[1]);assert.equal(submitted[0].args.p_public,true);assert.equal(submitted[0].token,null);assert.match(submitted[0].args.p_guest_key,/^[0-9a-f-]{36}$/);assert.match(view.text(),/suggestion and the author’s reply are public/);
 }finally{view.close();}
});

test('signed-in feedback defaults to private and returns to the account-only list',async()=>{
 const view=panel({session});
 try{
  await view.flush();const choices=view.nodes().filter(n=>n.type==='input'&&n.props.type==='radio');assert.equal(choices[0].props.checked,true);assert.equal(choices[1].props.checked,false);
  view.body('A private concern');await view.click('Send privately');const submitted=view.calls.find(c=>c.name==='submit_feedback_v2');assert.equal(submitted.args.p_public,false);assert.equal(submitted.args.p_guest_key,null);assert.equal(submitted.token,session.access_token);assert.equal(view.calls.filter(c=>c.name==='list_feedback_v2').at(-1).args.p_scope,'mine');assert.match(view.text(),/author’s private reply/);
 }finally{view.close();}
});

test('signed-in people can explicitly choose public, and administrators request the protected all-feedback scope',async()=>{
 const view=panel({session});
 try{
  await view.flush();view.nodes().filter(n=>n.type==='input'&&n.props.type==='radio')[1].props.onChange();view.render();view.body('A shared idea');await view.click('Post publicly');assert.equal(view.calls.find(c=>c.name==='submit_feedback_v2').args.p_public,true);assert.equal(view.calls.filter(c=>c.name==='list_feedback_v2').at(-1).args.p_scope,'public');
 }finally{view.close();}
 const owner=panel({session,admin:true});
 try{await owner.flush();assert.equal(owner.calls[0].args.p_scope,'admin');assert.equal(owner.calls[0].token,session.access_token);assert.equal(owner.find('textarea',''),undefined);}finally{owner.close();}
});
