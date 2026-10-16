import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const password='safe-password-123';
const tokenFor=subject=>`${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:subject})).toString('base64url')}.signature`;
const tokens={access_token:tokenFor('existing-account'),refresh_token:'refresh-test-token'};
const result=(username='evelyn',recoveryCode)=>({data:{username,session:{...tokens},...(recoveryCode?{recoveryCode}:{})},error:null});
const settings={external:{github:true,google:false,email:true},disable_signup:false};
const accountSession={user:{id:'existing-account',user_metadata:{}},access_token:tokenFor('existing-account'),refresh_token:'existing-refresh-token'};
const otherSession={user:{id:'other-account',user_metadata:{}},access_token:tokenFor('other-account'),refresh_token:'other-refresh-token'};

// Execute the actual Account component and helpers with a small hook host.
// Supabase, the clock and downloads are controlled; no account or network is used.
function account({enabled=true,session=null,responses=[],sessionResponses=[],configuration=settings,hangSettingsFirst=false,prepare=true}={}){
 let hooks=[],effects=[],cursor=0,dirty=false,tree,closed=0,disposed=false,clock=0,timerId=0,readCount=0,prepareCount=0,currentSession=session;
 const calls=[],sessions=[],downloads=[],signals=[],blobs=[],isolatedOptions=[],timers=new Map(),cache=new Map();
 let preparation=prepare;
 const react={
  useState(initial){const i=cursor++;if(!(i in hooks))hooks[i]=typeof initial==='function'?initial():initial;return [hooks[i],value=>{const next=typeof value==='function'?value(hooks[i]):value;if(!Object.is(next,hooks[i])){hooks[i]=next;dirty=true;}}];},
  useRef(initial){const i=cursor++;return hooks[i]??(hooks[i]={current:initial});},
  useEffect(effect,deps){const i=cursor++,old=hooks[i];if(!old||!deps||deps.some((value,n)=>!Object.is(value,old.deps?.[n]))){hooks[i]={deps,cleanup:old?.cleanup};effects.push(()=>{hooks[i].cleanup?.();hooks[i].cleanup=effect();});}},
 };
 const jsx=(type,props)=>({type,props:props??{}});
 const client={
  functions:{async invoke(name,options){calls.push({name,...structuredClone(options)});const next=responses.shift();return typeof next==='function'?await next():next??result();}},
  auth:{
   async setSession(value){sessions.push(structuredClone(value));const next=sessionResponses.shift();const target=JSON.parse(Buffer.from(value.access_token.split('.')[1],'base64url').toString()).sub;const identity=currentSession?.user.id===target?currentSession.user:{id:target,user_metadata:{}};const response=typeof next==='function'?await next(value):next??{data:{session:{user:identity,...value}},error:null};if(response.data?.session){currentSession=response.data.session;render();}return response;},
   async signInWithOAuth(options){calls.push({name:'oauth',options});return {data:{},error:null};},
   async signInWithPassword(){throw Error('Legacy password checking must use an isolated client');},
   async signOut(){currentSession=null;render();return {error:null};},
  },
 };
 const browserURL={createObjectURL(blob){blobs.push(blob);return 'blob:recovery-test';},revokeObjectURL(){}};
 function load(name){
  if(name==='react')return react;
  if(name==='@supabase/supabase-js')return {createClient(_url,_key,options){isolatedOptions.push(options);return {auth:{async signInWithPassword(options){calls.push({name:'email-password',options});return {data:{session:{...accountSession,...tokens}},error:null};}}};}};
  if(name==='react/jsx-runtime')return {jsx,jsxs:jsx,Fragment:'Fragment'};
  if(name==='./publicCloud.json')return {default:{usernameLoginEnabled:enabled,emailRegistrationEnabled:false,url:'https://test.supabase.co',publishableKey:'public-test-key'}};
  if(name==='./cloud')return {cloud:client,readLoginSettings(signal){readCount++;signals.push(signal);return hangSettingsFirst&&readCount===1?new Promise(()=>{}):Promise.resolve(configuration);}};
  if(!['./Account','./loginProviders','./usernameAuth'].includes(name))throw Error('Unexpected import: '+name);
  if(cache.has(name))return cache.get(name);
  const module={exports:{}};cache.set(name,module.exports);
  const source=readFileSync('community/'+name.slice(2)+(name==='./Account'?'.tsx':'.ts'),'utf8').replaceAll('import.meta.env.','testEnv.');
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','module','exports','testEnv','location','setTimeout','clearTimeout','URL','document',compiled)(load,module,module.exports,{BASE_URL:'/gre-quick-recall/'},{origin:'https://evelyn-y-chen.github.io'},(fn,delay)=>{const id=++timerId;timers.set(id,{at:clock+delay,fn});return id;},id=>timers.delete(id),Object.assign(class extends URL {},browserURL),{createElement(){return {click(){downloads.push({href:this.href,name:this.download});}};}});
  cache.set(name,module.exports);return module.exports;
 }
 const Component=load('./Account').default;
 function render(){if(disposed)return tree;for(let attempt=0;attempt<10;attempt++){dirty=false;cursor=0;tree=Component({session:currentSession,onClose(){closed++;},beforeLogin:async()=>{prepareCount++;return typeof preparation==='function'?await preparation():preparation;}});while(effects.length)effects.shift()();if(!dirty)return;}throw Error('Hooks did not settle');}
 function nodes(node){if(node==null||typeof node!=='object')return [];if(Array.isArray(node))return node.flatMap(nodes);return [node,...nodes(node.props?.children)];}
 function text(node){if(Array.isArray(node))return node.map(text).join('');if(node==null||typeof node==='boolean')return '';if(typeof node==='object')return text(node.props?.children);return String(node);}
 function find(type,label){return nodes(tree).find(node=>node.type===type&&text(node).includes(label));}
 async function flush(){for(let n=0;n<6;n++){await new Promise(resolve=>setImmediate(resolve));render();}}
 function input(label){const node=nodes(tree).find(node=>node.type==='label'&&text(node)===label);assert.ok(node,'Missing input label: '+label);return nodes(node).find(child=>child.type==='input');}
 function formFor(label){const button=find('button',label);assert.ok(button,'Missing button: '+label);const form=nodes(tree).find(node=>node.type==='form'&&nodes(node).includes(button));assert.ok(form,'Missing form for '+label);return {button,form};}
 async function submit(label){const {button,form}=formFor(label);assert.equal(!!button.props.disabled,false,'Disabled button: '+label);form.props.onSubmit({preventDefault(){}});await flush();}
 render();
 return {
  calls,sessions,downloads,blobs,signals,isolatedOptions,load,render,flush,input,find,session:()=>currentSession,text:()=>text(tree),closed:()=>closed,prepareCount:()=>prepareCount,
  fill(label,value){const node=input(label);assert.equal(!!node.props.disabled,false,'Disabled input: '+label);node.props.onChange({target:{value}});render();},
  async click(label){const button=find('button',label);assert.ok(button,'Missing button: '+label);assert.equal(!!button.props.disabled,false,'Disabled button: '+label);button.props.onClick();await flush();},
  submit,
  submitRaw(label){formFor(label).form.props.onSubmit({preventDefault(){}});render();},
  register(){const choice=nodes(tree).find(node=>node.type==='input'&&node.props.type==='checkbox');assert.ok(choice);choice.props.onChange({target:{checked:true}});render();},
  setPrepare(value){preparation=value;},
  async advance(ms){clock+=ms;for(const [id,timer] of [...timers])if(timer.at<=clock){timers.delete(id);timer.fn();}await flush();},
  switchSession(value){currentSession=value;render();},
  close(){disposed=true;for(const entry of hooks)entry?.cleanup?.();},
 };
}

function credentials(view,name='evelyn',secret=password){view.fill('用户名',name);view.fill('密码',secret);}

test('username login canonicalizes Unicode names and establishes only the returned token pair',async()=>{
 const view=account();try{await view.flush();credentials(view,' ＥＶＥＬＹＮ ');await view.submit('用户名登录');
  assert.deepEqual(view.calls,[{name:'username-auth',body:{action:'login',username:'evelyn',password}}]);assert.deepEqual(view.sessions,[tokens]);assert.equal(view.closed(),1);assert.equal(view.prepareCount(),1);
 }finally{view.close();}
});

test('the release gate blocks username APIs while preserving available social and existing email-password login',async()=>{
 const view=account({enabled:false});try{await view.flush();assert.match(view.text(),/用户名登录正在配置，暂未开放/);credentials(view);view.submitRaw('用户名登录');await view.flush();assert.deepEqual(view.calls,[]);
  assert.equal(view.find('button','使用 GitHub 登录').props.disabled,false);assert.equal(view.find('button','使用 Google 登录').props.disabled,true);
  view.fill('邮箱','old@example.test');view.fill('邮箱账号的密码','legacy');await view.submit('已有邮箱账号登录');assert.equal(view.calls[0].name,'email-password');assert.equal(view.closed(),1);assert.deepEqual(view.isolatedOptions[0].auth,{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'lemnota-password-check'});
 }finally{view.close();}
});

test('registration validates confirmation and UTF-8 byte limits before making any request',async()=>{
 const view=account();try{await view.flush();view.register();credentials(view);view.fill('再次输入密码','different-password');await view.submit('创建账号');assert.match(view.text(),/两次输入的密码不一致/);assert.deepEqual(view.calls,[]);assert.equal(view.prepareCount(),0);
  view.fill('密码','密'.repeat(25));view.fill('再次输入密码','密'.repeat(25));await view.submit('创建账号');assert.match(view.text(),/10–72/);assert.deepEqual(view.calls,[]);
  const helper=view.load('./usernameAuth');assert.equal(helper.validAccountPassword('密'.repeat(24)),true);assert.equal(helper.validAccountPassword('密'.repeat(25)),false);assert.equal(helper.validAccountPassword('x'.repeat(9)),false);assert.equal(helper.validAccountPassword('x'.repeat(72)),true);
  assert.equal(helper.validUsername('𠮷'.repeat(24)),true);assert.equal(helper.validUsername('𠮷'.repeat(25)),false);assert.equal(helper.validUsername('../person'),false);
 }finally{view.close();}
});

test('registration retains its recovery code through setSession and closes only after explicit acknowledgement',async()=>{
 let completeSession;const sessionPending=new Promise(resolve=>{completeSession=resolve;});
 const view=account({responses:[result('evelyn','RESTORE-ONE-TIME')],sessionResponses:[()=>sessionPending]});
 try{await view.flush();view.register();credentials(view);view.fill('再次输入密码',password);view.submitRaw('创建账号');await view.flush();
  assert.equal(view.input('账号恢复码').props.value,'RESTORE-ONE-TIME');assert.equal(view.closed(),0);assert.equal(view.find('button','已保存，重试登录').props.disabled,true);assert.deepEqual(view.sessions,[tokens]);
  completeSession({data:{session:{...accountSession,...tokens}},error:null});await view.flush();assert.equal(view.closed(),0);assert.equal(view.input('账号恢复码').props.value,'RESTORE-ONE-TIME');
  assert.equal(view.find('button','×').props.disabled,true);await view.click('下载恢复码 .txt');assert.match(view.downloads[0].name,/evelyn.*\.txt$/);const file=await view.blobs[0].text();assert.match(file,/RESTORE-ONE-TIME/);assert.doesNotMatch(file,/safe-password-123|access-test-token|refresh-test-token/);
  await view.click('已保存，继续');assert.equal(view.closed(),1);
 }finally{view.close();}
});

test('a failed session import keeps the recovery code available and can retry without registering twice',async()=>{
 const view=account({responses:[result('evelyn','PRESERVE-THIS-CODE')],sessionResponses:[{data:{session:null},error:Error('internal token failure')}]});
 try{await view.flush();view.register();credentials(view);view.fill('再次输入密码',password);await view.submit('创建账号');
  assert.equal(view.closed(),0);assert.equal(view.input('账号恢复码').props.value,'PRESERVE-THIS-CODE');assert.match(view.text(),/登录尚未完成/);
  await view.click('已保存，重试登录');assert.equal(view.closed(),1);assert.equal(view.calls.length,1);assert.equal(view.sessions.length,2);
 }finally{view.close();}
});

test('recovery sends the saved code and new password, then requires saving the rotated code',async()=>{
 const view=account({responses:[result('evelyn','NEW-RECOVERY-CODE')]});try{await view.flush();await view.click('使用恢复码找回账号');view.fill('用户名','evelyn');view.fill('恢复码',' OLD-RECOVERY-CODE ');view.fill('新密码',password);view.fill('再次输入密码',password);await view.submit('验证恢复码并设置新密码');
  assert.deepEqual(view.calls[0].body,{action:'recover',username:'evelyn',password,recoveryCode:'OLD-RECOVERY-CODE'});assert.equal(view.input('账号恢复码').props.value,'NEW-RECOVERY-CODE');assert.equal(view.closed(),0);await view.click('已保存，继续');assert.equal(view.closed(),1);
 }finally{view.close();}
});

test('linking uses the captured session authorization without sending a user ID, and conflicts never look successful',async()=>{
 const conflict={data:null,error:{context:new Response(JSON.stringify({error:'用户名已被使用，请换一个。',code:'username_taken'}),{status:409})}};
 const view=account({session:accountSession,responses:[conflict,result('evelyn','LINKED-RECOVERY-CODE')]});try{await view.flush();assert.match(view.text(),/保留已有笔记及学习进度/);credentials(view);view.fill('再次输入密码',password);await view.submit('保存用户名与密码');
  assert.match(view.text(),/用户名已被使用/);assert.deepEqual(view.sessions,[]);assert.doesNotMatch(view.text(),/恢复码只在这里显示一次/);assert.equal(view.closed(),0);
  await view.submit('保存用户名与密码');assert.equal(view.calls[1].headers.Authorization,'Bearer '+accountSession.access_token);assert.deepEqual(Object.keys(view.calls[1].body).sort(),['action','password','username']);assert.equal(view.calls[1].body.action,'link');assert.equal(view.input('账号恢复码').props.value,'LINKED-RECOVERY-CODE');assert.equal(view.closed(),0);
 }finally{view.close();}
});

test('prepareLogin failure and duplicate submits cannot send credentials or overwrite the current workspace',async()=>{
 let resolvePreparation;const pending=new Promise(resolve=>{resolvePreparation=resolve;});const view=account({prepare:()=>pending});
 try{await view.flush();credentials(view);view.submitRaw('用户名登录');view.submitRaw('用户名登录');await view.flush();assert.equal(view.prepareCount(),1);assert.deepEqual(view.calls,[]);
  resolvePreparation(false);await view.flush();assert.match(view.text(),/本机记录还没有保存/);assert.deepEqual(view.calls,[]);assert.deepEqual(view.sessions,[]);
  view.setPrepare(true);let finish;const response=new Promise(resolve=>{finish=resolve;});
  // A second held request validates the lock across the network phase too.
  const other=account({responses:[()=>response]});try{await other.flush();credentials(other);other.submitRaw('用户名登录');other.submitRaw('用户名登录');await other.flush();assert.equal(other.calls.length,1);finish(result());await other.flush();assert.equal(other.closed(),1);}finally{other.close();}
 }finally{view.close();}
});

test('rate limits and malformed or secret-bearing failures stay readable and do not expose credentials',async()=>{
 const view=account({responses:[
  {data:null,error:{context:new Response(JSON.stringify({error:'slow down',code:'rate_limited'}),{status:429})}},
  {data:null,error:Error('raw internal '+password+' access-test-token')},
  {data:{error:'upstream echoed '+password,code:'bad_request'},error:null},
  {data:{username:'evelyn',session:tokens},error:null},
 ]});try{await view.flush();credentials(view);await view.submit('用户名登录');assert.match(view.text(),/操作太频繁/);assert.equal(view.closed(),0);
  await view.submit('用户名登录');assert.match(view.text(),/暂时不可用/);assert.doesNotMatch(view.text(),/safe-password-123|access-test-token/);
  await view.submit('用户名登录');assert.doesNotMatch(view.text(),/safe-password-123/);assert.deepEqual(view.sessions,[]);
  view.register();credentials(view);view.fill('再次输入密码',password);await view.submit('创建账号');assert.match(view.text(),/信息不完整/);assert.deepEqual(view.sessions,[]);assert.equal(view.closed(),0);
 }finally{view.close();}
});

test('social-provider settings time out after 15 seconds and can be checked again without enabling unavailable providers',async()=>{
 const view=account({hangSettingsFirst:true,configuration:{external:{github:true,google:true,email:false}}});try{await view.flush();assert.equal(view.find('button','使用 GitHub 登录').props.disabled,true);await view.advance(15_000);assert.equal(view.signals[0].aborted,true);assert.match(view.text(),/超时/);
  await view.click('重新检查');assert.equal(view.find('button','使用 Google 登录').props.disabled,false);await view.click('使用 Google 登录');assert.equal(view.calls[0].name,'oauth');assert.equal(view.calls[0].options.options.redirectTo,'https://evelyn-y-chen.github.io/gre-quick-recall/');assert.equal(view.find('button','已有邮箱账号登录').props.disabled,true);
 }finally{view.close();}
});


test('an existing username account rotates its recovery code with current credentials and stays on the same user ID',async()=>{
 const session={...accountSession,user:{...accountSession.user,user_metadata:{username:'evelyn'}}};
 const view=account({session,responses:[result('evelyn','ROTATED-RECOVERY-CODE')]});
 try{await view.flush();assert.match(view.text(),/账号登录方式/);assert.match(view.text(),/旧恢复码会立即失效/);assert.equal(view.input('用户名').props.readOnly,true);
  view.fill('用户名','another-person');assert.equal(view.input('用户名').props.value,'evelyn');
  await view.submit('验证密码并生成新恢复码');assert.match(view.text(),/请输入当前密码/);assert.equal(view.calls.length,0);
  view.fill('当前密码','old-pass');await view.submit('验证密码并生成新恢复码');
  assert.deepEqual(view.calls[0],{name:'username-auth',body:{action:'rotate',username:'evelyn',password:'old-pass'},headers:{Authorization:'Bearer '+session.access_token}});
  assert.equal(view.session().user.id,session.user.id);assert.equal(view.input('账号恢复码').props.value,'ROTATED-RECOVERY-CODE');assert.equal(view.closed(),0);
  await view.click('已保存，继续');assert.equal(view.closed(),1);
 }finally{view.close();}
});

test('accounts missing username metadata can switch from linking to managing an existing mapping',async()=>{
 const view=account({session:accountSession,responses:[result('evelyn','ROTATED-WITHOUT-METADATA')]});
 try{await view.flush();await view.click('已有用户名？管理恢复码');assert.equal(view.input('用户名').props.readOnly,false);view.fill('用户名','evelyn');view.fill('当前密码',password);await view.submit('验证密码并生成新恢复码');assert.equal(view.calls[0].body.action,'rotate');assert.equal(view.session().user.id,accountSession.user.id);assert.equal(view.input('账号恢复码').props.value,'ROTATED-WITHOUT-METADATA');}finally{view.close();}
});

test('an outside account switch while prepareLogin is pending invalidates the old dialog before any request',async()=>{
 let finish;const wait=new Promise(resolve=>{finish=resolve;});const view=account({session:accountSession,prepare:()=>wait});
 try{await view.flush();credentials(view);view.fill('再次输入密码',password);view.submitRaw('保存用户名与密码');await view.flush();view.switchSession(otherSession);finish(true);await view.flush();assert.deepEqual(view.calls,[]);assert.deepEqual(view.sessions,[]);assert.match(view.text(),/账号已切换/);assert.equal(view.session().user.id,'other-account');}finally{view.close();}
});

test('a pending link response never establishes its old account after another account is selected',async()=>{
 let finish;const wait=new Promise(resolve=>{finish=resolve;});const view=account({session:accountSession,responses:[()=>wait]});
 try{await view.flush();credentials(view);view.fill('再次输入密码',password);view.submitRaw('保存用户名与密码');await view.flush();assert.equal(view.calls[0].headers.Authorization,'Bearer '+accountSession.access_token);
  view.switchSession(otherSession);finish(result('evelyn','OLD-ACCOUNT-RECOVERY'));await view.flush();assert.deepEqual(view.sessions,[]);assert.equal(view.session().user.id,'other-account');assert.doesNotMatch(view.text(),/OLD-ACCOUNT-RECOVERY/);assert.match(view.text(),/账号已切换/);
 }finally{view.close();}
});

test('a pending guest login cannot replace a separately signed-in account',async()=>{
 let finish;const wait=new Promise(resolve=>{finish=resolve;});const view=account({responses:[()=>wait]});
 try{await view.flush();credentials(view);view.submitRaw('用户名登录');await view.flush();view.switchSession(otherSession);finish(result());await view.flush();assert.deepEqual(view.sessions,[]);assert.equal(view.session().user.id,'other-account');assert.equal(view.closed(),0);}finally{view.close();}
});

test('an unmounted login ignores its outstanding API response and never calls setSession',async()=>{
 let finish;const wait=new Promise(resolve=>{finish=resolve;});const view=account({responses:[()=>wait]});
 await view.flush();credentials(view);view.submitRaw('用户名登录');await view.flush();view.close();finish(result());await view.flush();assert.deepEqual(view.sessions,[]);assert.equal(view.closed(),0);
});

test('only the intended JWT subject is allowed during setSession, and a later outside account wins over its late write',async()=>{
 let finish;const wait=new Promise(resolve=>{finish=resolve;});const view=account({responses:[result()],sessionResponses:[()=>wait]});
 try{await view.flush();credentials(view);view.submitRaw('用户名登录');await view.flush();assert.equal(view.sessions.length,1);
  view.switchSession(otherSession);finish({data:{session:{...accountSession,...tokens}},error:null});await view.flush();
  assert.equal(view.sessions.length,2);assert.deepEqual(view.sessions[1],{access_token:otherSession.access_token,refresh_token:otherSession.refresh_token});assert.equal(view.session().user.id,'other-account');assert.equal(view.closed(),0);assert.match(view.text(),/账号已切换/);
 }finally{view.close();}
});

test('an ordinary own setSession event retains the one-time recovery screen instead of treating it as an outside switch',async()=>{
 const view=account({responses:[result('evelyn','OWN-SESSION-RECOVERY')]});try{await view.flush();view.register();credentials(view);view.fill('再次输入密码',password);await view.submit('创建账号');assert.equal(view.input('账号恢复码').props.value,'OWN-SESSION-RECOVERY');assert.doesNotMatch(view.text(),/账号已切换/);assert.equal(view.closed(),0);}finally{view.close();}
});


test('linking never accepts another user subject or displays its recovery code',async()=>{
 const foreign={...result('evelyn','NOT-OUR-RECOVERY'),data:{...result('evelyn','NOT-OUR-RECOVERY').data,session:{access_token:otherSession.access_token,refresh_token:otherSession.refresh_token}}};
 const view=account({session:accountSession,responses:[foreign]});try{await view.flush();credentials(view);view.fill('再次输入密码',password);await view.submit('保存用户名与密码');assert.deepEqual(view.sessions,[]);assert.match(view.text(),/账号信息不一致/);assert.doesNotMatch(view.text(),/NOT-OUR-RECOVERY/);assert.equal(view.session().user.id,accountSession.user.id);}finally{view.close();}
});
