import {useEffect,useRef,useState} from 'react';
import {createClient,type Session} from '@supabase/supabase-js';
import {cloud,readLoginSettings} from './cloud';
import publicConfig from './publicCloud.json';
import {enabledLoginProviders,emailPasswordAvailable,socialLoginOptions,type LoginProvider} from './loginProviders';
import {AccountMessage,accountFailureMessage,canonicalUsername,readUsernameResult,recoveryNote,tokenSubject,validateUsernameForm,type AccountTokens,type UsernameAction} from './usernameAuth';

type Recovery={username:string;code:string};
export default function Account({onClose,beforeLogin,session=null}:{onClose:()=>void;beforeLogin:()=>Promise<boolean>;session?:Session|null}){
 const initialUsername=typeof session?.user.user_metadata?.username==='string'?session.user.user_metadata.username:'';
 const [mode,setMode]=useState<UsernameAction>(()=>session?(initialUsername?'rotate':'link'):'login');
 const [username,setUsername]=useState(()=>initialUsername),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[recoveryCode,setRecoveryCode]=useState('');
 const [email,setEmail]=useState(''),[emailPassword,setEmailPassword]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[recovery,setRecovery]=useState<Recovery|null>(null),[sessionReady,setSessionReady]=useState(false);
 const [settings,setSettings]=useState<unknown>(null),[settingsError,setSettingsError]=useState(''),[check,setCheck]=useState(0);
 const locked=useRef(false),pendingTokens=useRef<AccountTokens|null>(null);
 const alive=useRef(true),version=useRef(0),expectedSubject=useRef(session?.user.id??null),currentSubject=useRef(session?.user.id??null),invalidated=useRef(false);
 const establishing=useRef<{subject:string|null;done?:boolean}|null>(null),externalSession=useRef<{session:Session|null;version:number}|null>(null);
 currentSubject.current=session?.user.id??null;
 if(establishing.current?.done&&currentSubject.current===establishing.current.subject){expectedSubject.current=currentSubject.current;establishing.current=null;}
 const sameSubject=currentSubject.current===expectedSubject.current||!!establishing.current?.subject&&currentSubject.current===establishing.current.subject;
 if(!sameSubject)invalidated.current=true;
 if(invalidated.current&&currentSubject.current!==establishing.current?.subject){
  const previous=externalSession.current?.session;
  if(!externalSession.current||previous?.user.id!==session?.user.id||previous?.access_token!==session?.access_token)externalSession.current={session,version:(externalSession.current?.version??0)+1};
 }
 const stale=invalidated.current;
 function isCurrent(ticket?:number){return alive.current&&!invalidated.current&&(ticket===undefined||ticket===version.current)&&(currentSubject.current===expectedSubject.current||!!establishing.current?.subject&&currentSubject.current===establishing.current.subject);}
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;version.current++;};},[]);
 useEffect(()=>{if(!stale)return;version.current++;locked.current=false;pendingTokens.current=null;setUsername('');setEmail('');setPassword('');setConfirmation('');setRecoveryCode('');setEmailPassword('');setRecovery(null);setSessionReady(false);setBusy(false);setMessage('账号已切换，请关闭并重新打开此窗口。');},[stale]);
 const providers=enabledLoginProviders(settings),usernameReady=(publicConfig as {usernameLoginEnabled?:boolean}).usernameLoginEnabled===true;
 const redirectTo=new URL(import.meta.env.BASE_URL,location.origin).href;
 useEffect(()=>{
  let active=true,timedOut=false;const controller=new AbortController();setSettings(null);setSettingsError('');
  let timer:ReturnType<typeof setTimeout>;
  const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{timedOut=true;controller.abort();reject(Error('timeout'));},15_000);});
  void Promise.race([readLoginSettings(controller.signal),timeout]).then(value=>{if(active)setSettings(value);}).catch(()=>{
   if(active)setSettingsError(timedOut?'读取登录方式超时，请检查网络后重新检查。':'暂时无法读取登录配置，请检查网络后重新检查。');
  }).finally(()=>clearTimeout(timer));
  return()=>{active=false;clearTimeout(timer);controller.abort();};
 },[check]);
 async function run(task:(ticket:number)=>Promise<void>){
  if(!cloud||locked.current||!isCurrent())return;const ticket=++version.current;locked.current=true;setBusy(true);setMessage('');
  try{const saved=await beforeLogin();if(!isCurrent(ticket))return;if(!saved)throw new AccountMessage('本机记录还没有保存，请先导出便笺再登录。');await task(ticket);}
  catch(error){if(isCurrent(ticket))setMessage(accountFailureMessage(error));}
  finally{if(alive.current&&ticket===version.current){locked.current=false;setBusy(false);}}
 }
 async function establishSession(ticket:number){
  if(!isCurrent(ticket))return false;
  if(!cloud||!pendingTokens.current)throw new AccountMessage('登录信息已失效，请重新登录。');
  const tokens=pendingTokens.current,target=tokenSubject(tokens.access_token);
  if((mode==='link'||mode==='rotate')&&target&&target!==expectedSubject.current)throw new AccountMessage('账号信息不一致，请关闭并重新打开登录窗口。');
  establishing.current={subject:target};
  try{
   const {data,error}=await cloud.auth.setSession(tokens);
   if(!isCurrent(ticket)){
    // The SDK cannot cancel setSession mid-flight. Restore a later externally selected
    // account after the old call finishes, rather than allowing its late write to win.
    let repaired=-1;
    for(let n=0;n<3&&alive.current&&externalSession.current&&externalSession.current.version!==repaired;n++){
     const external=externalSession.current;repaired=external.version;establishing.current={subject:external.session?.user.id??null};
     if(external.session)await cloud.auth.setSession({access_token:external.session.access_token,refresh_token:external.session.refresh_token});
     else await cloud.auth.signOut({scope:'local'});
    }
    return false;
   }
   if(error)throw error;if(!data.session)throw new AccountMessage('登录尚未完成，请重新尝试。');
   establishing.current={subject:data.session.user.id,done:true};pendingTokens.current=null;setSessionReady(true);return true;
  }finally{if(!establishing.current?.done)establishing.current=null;}
 }
 async function submit(event:React.FormEvent){
  event.preventDefault();if(!usernameReady||!cloud||locked.current||recovery||!isCurrent())return;
  const action=mode,name=canonicalUsername(username),secret=password,code=recoveryCode.trim(),authorization=session?.access_token;
  try{validateUsernameForm(name,secret,confirmation,action,code);}catch(error){setMessage(accountFailureMessage(error));return;}
  if((action==='link'||action==='rotate')&&!session){setMessage('请先登录原来的账号，再设置用户名与密码。');return;}
  await run(async ticket=>{
   const response=await cloud!.functions.invoke('username-auth',{
    body:{action,username:name,password:secret,...(action==='recover'?{recoveryCode:code}:{})},
    ...((action==='link'||action==='rotate')?{headers:{Authorization:`Bearer ${authorization}`}}:{}),
   });
   if(!isCurrent(ticket))return;
   const result=await readUsernameResult(response,action,[secret,code]);if(!isCurrent(ticket))return;
   const target=tokenSubject(result.session.access_token);
   if((action==='link'||action==='rotate')&&target&&target!==expectedSubject.current)throw new AccountMessage('账号信息不一致，请关闭并重新打开登录窗口。');
   pendingTokens.current=result.session;setPassword('');setConfirmation('');setRecoveryCode('');
   if(action!=='login')setRecovery({username:result.username,code:result.recoveryCode!});
   if(await establishSession(ticket)&&action==='login'&&isCurrent(ticket))onClose();
  });
 }
 async function passwordLogin(event:React.FormEvent){
  event.preventDefault();if(!cloud||!emailPasswordAvailable(settings)||locked.current||recovery||!isCurrent())return;
  const target=email.trim(),secret=emailPassword;
  await run(async ticket=>{
   // Check legacy credentials in memory so a late password response cannot switch
   // the shared browser account before the same subject guards used above run.
   const client=createClient(import.meta.env.VITE_SUPABASE_URL||publicConfig.url,import.meta.env.VITE_SUPABASE_ANON_KEY||publicConfig.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'lemnota-password-check'}});
   const {data,error}=await client.auth.signInWithPassword({email:target,password:secret});if(!isCurrent(ticket))return;if(error)throw error;
   if(!data.session)throw new AccountMessage('登录尚未完成，请重新尝试。');
   pendingTokens.current={access_token:data.session.access_token,refresh_token:data.session.refresh_token};setEmailPassword('');
   if(await establishSession(ticket)&&isCurrent(ticket))onClose();
  });
 }
 function changeMode(next:UsernameAction){if(locked.current||recovery||!isCurrent())return;setMode(next);setPassword('');setConfirmation('');setRecoveryCode('');setMessage('');}
 function downloadRecovery(){
  if(!recovery||!isCurrent())return;const url=URL.createObjectURL(new Blob([recoveryNote(recovery.username,recovery.code)],{type:'text/plain;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download=`词笺_${recovery.username}_恢复码.txt`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 async function finishRecovery(){if(locked.current||!isCurrent())return;if(sessionReady){onClose();return;}await run(async ticket=>{if(await establishSession(ticket)&&isCurrent(ticket))onClose();});}
 return <div className="communityModal" role="dialog" aria-modal="true" aria-label="账号登录"><section>
  <button className="modalClose" disabled={busy||!!recovery} aria-label="关闭登录" onClick={onClose}>×</button>
  <h2>{recovery?'请保存账号恢复码':mode==='rotate'?'账号登录方式':mode==='link'?'为当前账号设置用户名':mode==='recover'?'找回用户名账号':'登录词笺'}</h2>
  {stale?<section><p>账号已切换。为保护各账号的记录，请关闭此窗口后重新打开。</p><button onClick={onClose}>关闭此窗口</button></section>:recovery?<section className="accountRecovery" aria-label="账号恢复码"><p>用户名：<strong>{recovery.username}</strong></p><p>恢复码只在这里显示一次。请下载或复制保存；忘记密码时可以用它找回账号。不要公开或交给他人。</p><label>账号恢复码<input aria-label="账号恢复码" readOnly value={recovery.code} onFocus={event=>event.currentTarget.select()}/></label><p>找回账号后恢复码会更新，旧码失效。下载文件不包含密码或登录令牌。</p><div className="accountAlternatives"><button type="button" onClick={downloadRecovery}>下载恢复码 .txt</button><button type="button" className="primary" disabled={busy} onClick={()=>void finishRecovery()}>{sessionReady?'已保存，继续':'已保存，重试登录'}</button></div>{!sessionReady&&<small className="accountNotice">恢复码已生成，登录尚未完成。请先保存恢复码，再重试登录。</small>}</section>:<>
   <p>{mode==='rotate'?'验证当前密码后，可以生成新的账号恢复码。旧恢复码会立即失效，已有笔记和学习进度保留在当前账号。':mode==='link'?'这会为当前账号增加用户名和密码，保留已有笔记及学习进度。以后可用用户名或原来的登录方式进入同一账号。':'用用户名和密码登录，在其他设备继续笔记、红绿灯自测和测试进度。无需邮箱或验证邮件；不登录也可以用便笺保存。'}</p>
   {!usernameReady&&<p className="accountNotice" role="status">用户名登录正在配置，暂未开放。请先使用其他可用的登录方式。</p>}
   <form onSubmit={submit} aria-label="用户名账号"><label>用户名<input type="text" autoComplete="username" required maxLength={48} disabled={busy} readOnly={mode==='rotate'&&!!initialUsername} value={username} onChange={event=>{if(!locked.current&&(mode!=='rotate'||!initialUsername))setUsername(event.target.value);}}/></label><small className="accountNotice">3–24 个字母、汉字、数字、下划线或连字符，不区分大小写。这里的登录用户名与首页昵称是两项独立设置。</small>
    {mode==='recover'&&<label>恢复码<input type="text" autoComplete="off" required maxLength={200} disabled={busy} value={recoveryCode} onChange={event=>{if(!locked.current)setRecoveryCode(event.target.value);}}/></label>}
    <label>{mode==='recover'?'新密码':mode==='rotate'?'当前密码':'密码'}<input type="password" autoComplete={mode==='login'||mode==='rotate'?'current-password':'new-password'} required maxLength={72} disabled={busy} value={password} onChange={event=>{if(!locked.current)setPassword(event.target.value);}}/></label>
    {mode!=='login'&&mode!=='rotate'&&<label>再次输入密码<input type="password" autoComplete="new-password" required maxLength={72} disabled={busy} value={confirmation} onChange={event=>{if(!locked.current)setConfirmation(event.target.value);}}/></label>}
    {mode!=='rotate'&&<small className="accountNotice">密码需为 10–72 个 UTF-8 字节，建议至少 10 位英文字母、数字或符号。我们不会通过邮件找回；请妥善保存恢复码。</small>}
    {(mode==='login'||mode==='register')&&<label className="accountSignupChoice"><input type="checkbox" checked={mode==='register'} disabled={busy} onChange={event=>changeMode(event.target.checked?'register':'login')}/>第一次使用，创建新的用户名账号</label>}
    <button type="submit" className="primary" disabled={busy||!cloud||!usernameReady}>{mode==='register'?'创建账号':mode==='recover'?'验证恢复码并设置新密码':mode==='rotate'?'验证密码并生成新恢复码':mode==='link'?'保存用户名与密码':'用户名登录'}</button>
   </form>
   {session&&<div className="accountAlternatives"><button type="button" disabled={busy} onClick={()=>changeMode(mode==='rotate'?'link':'rotate')}>{mode==='rotate'?'设置用户名与密码':'已有用户名？管理恢复码'}</button></div>}
   {!session&&mode!=='link'&&mode!=='rotate'&&<div className="accountAlternatives"><button type="button" disabled={busy} onClick={()=>changeMode(mode==='recover'?'login':'recover')}>{mode==='recover'?'返回用户名登录':'使用恢复码找回账号'}</button></div>}
   <div className="accountEmail"><h3>其他登录方式</h3><div className="accountSocial">{(['github','google'] as LoginProvider[]).map(provider=><div key={provider}><button className="accountGithub" disabled={busy||!providers[provider]||!cloud} onClick={()=>void run(async ticket=>{const {error}=await cloud!.auth.signInWithOAuth(socialLoginOptions(provider,redirectTo));if(!isCurrent(ticket))return;if(error)throw error;})}>使用 {provider==='github'?'GitHub':'Google'} 登录</button>{settings!==null&&!providers[provider]&&<small className="accountNotice">{provider==='github'?'GitHub':'Google'} 登录正在配置，尚未开放。</small>}</div>)}</div>
    {settings===null&&<small className="accountNotice" role="status">{settingsError||'正在检查可用的登录方式…'}</small>}{settingsError&&<button disabled={busy} onClick={()=>setCheck(n=>n+1)}>重新检查</button>}
    <p className="accountFine">授权只用于识别账号，不读取 GitHub 仓库或 Gmail 邮件。不同登录方式使用的邮箱不一致时，可能进入不同账号空间，请优先使用原来的登录方式。</p>
    <details className="accountEmail"><summary>已有邮箱密码账号？</summary><p>此入口仅保留给已有账号，不提供邮箱注册或发信。</p><form onSubmit={passwordLogin}><label>邮箱<input type="email" autoComplete="email" required maxLength={254} disabled={busy} value={email} onChange={event=>{if(!locked.current)setEmail(event.target.value);}}/></label><label>邮箱账号的密码<input type="password" autoComplete="current-password" required disabled={busy} value={emailPassword} onChange={event=>{if(!locked.current)setEmailPassword(event.target.value);}}/></label><button type="submit" disabled={busy||!cloud||!emailPasswordAvailable(settings)}>已有邮箱账号登录</button></form></details>
   </div>
  </>}
  <p className="accountStatus" role="status">{busy?'处理中…':message}</p><small>账号内容只属于你。退出后会返回这台设备的游客空间。</small>
 </section></div>;
}
