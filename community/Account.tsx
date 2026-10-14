import {useEffect,useState} from 'react';
import {cloud,readLoginSettings} from './cloud';
import publicConfig from './publicCloud.json';
import {enabledLoginProviders,socialLoginOptions,type LoginProvider} from './loginProviders';

export default function Account({onClose,beforeLogin}:{onClose:()=>void;beforeLogin:()=>Promise<boolean>}){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[register,setRegister]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[providers,setProviders]=useState<Record<LoginProvider,boolean>|null>(null),[providerError,setProviderError]=useState(false),[check,setCheck]=useState(0);
 const emailReady=publicConfig.emailRegistrationEnabled;
 const redirectTo=new URL(import.meta.env.BASE_URL,location.origin).href;
 useEffect(()=>{const controller=new AbortController();setProviders(null);setProviderError(false);void readLoginSettings(controller.signal).then(settings=>setProviders(enabledLoginProviders(settings))).catch(()=>{if(!controller.signal.aborted)setProviderError(true);});return()=>controller.abort();},[check]);
 async function run(task:()=>Promise<{error:any}>){if(!cloud||busy)return;setBusy(true);setMessage('');try{if(!await beforeLogin())throw Error('本机记录还没有保存，请先导出便笺再登录。');const {error}=await task();if(error)throw error;}catch(e){setMessage(e instanceof Error?e.message:'登录失败，请重试。');}finally{setBusy(false);}}
 async function submit(e:React.FormEvent){e.preventDefault();if(register&&!emailReady)return;await run(async()=>{const result=register?await cloud!.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:redirectTo}}):await cloud!.auth.signInWithPassword({email:email.trim(),password});if(!result.error){setPassword('');if(result.data.session)onClose();else setMessage('请查收验证邮件，完成验证后再登录。未收到时查看垃圾邮件。');}return result;});}
 return <div className="communityModal" role="dialog" aria-modal="true" aria-label="账号登录"><section>
  <button className="modalClose" disabled={busy} aria-label="关闭登录" onClick={onClose}>×</button><h2>登录词笺</h2><p>在其他设备登录同一个账号，继续笔记、红黄绿、生词本和测试进度。不登录也能使用，便笺随时可以带走。</p>
  <div className="accountSocial">{(['github','google'] as LoginProvider[]).map(provider=><div key={provider}><button className="accountGithub" disabled={busy||providers?.[provider]!==true||!cloud} onClick={()=>void run(()=>cloud!.auth.signInWithOAuth(socialLoginOptions(provider,redirectTo)))}>使用 {provider==='github'?'GitHub':'Google'} 登录</button>{providers&&!providers[provider]&&<small className="accountNotice">{provider==='github'?'GitHub':'Google'} 登录正在配置，尚未开放。</small>}</div>)}</div>
  {providers===null&&<small className="accountNotice">{providerError?'暂时无法读取登录配置，请检查网络。':'正在检查可用的登录方式…'}</small>}{providerError&&<button disabled={busy} onClick={()=>setCheck(n=>n+1)}>重新检查</button>}
  <p className="accountFine">登录授权只用于识别你的账号，不读取 GitHub 仓库或 Gmail 邮件。</p>
  <details className="accountEmail"><summary>其他登录方式 · 邮箱与密码</summary>
   {!emailReady&&<small className="accountNotice">邮箱注册与邮件链接登录暂未开放；已有词笺账号可使用邮箱密码登录。</small>}
   <form onSubmit={submit}><label>邮箱<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label><label>密码<input type="password" autoComplete={register?'new-password':'current-password'} required minLength={register?8:1} value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="primary" disabled={busy||!cloud||(register&&!emailReady)}>{busy?'处理中…':register?'注册并发送验证邮件':'邮箱登录'}</button></form>
   <div className="accountAlternatives"><button disabled={busy} onClick={()=>{setRegister(!register);setPassword('');setMessage('');}}>{register?'已有账号，去登录':'第一次来？创建账号'}</button><button disabled={busy||!email.trim()||!cloud||!emailReady} onClick={()=>void run(async()=>{const result=await cloud!.auth.signInWithOtp({email:email.trim(),options:{shouldCreateUser:false,emailRedirectTo:redirectTo}});if(!result.error)setMessage('登录链接已发送到邮箱，请在此浏览器打开。');return result;})}>忘记密码？用邮件链接登录</button></div>
  </details><p className="accountStatus" role="status">{message}</p><small>账号内容只属于你。退出后会返回这台设备的游客空间。</small>
 </section></div>;
}
