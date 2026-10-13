import {useEffect,useRef,useState} from 'react';
import type {Session} from '@supabase/supabase-js';
import Page from '../app/page';
import {SharedWordMemoryProvider} from '../app/SharedWordMemory';
import PwaBridge from '../app/pwa-bridge';
import {cloud} from './cloud';
import {exportWorkspace,openWorkspace,onWorkspaceChange,type Snapshot} from './database';
import {switchWorkspace} from './api';
import {studyStorage} from './storage';
const themes=[['cream','奶油蓝','#283f61'],['sage','鼠尾草绿','#46624f'],['lavender','雾紫','#735681'],['apricot','暖杏','#92543e'],['night','深夜蓝','#a7c8f2']];
export default function App(){
 const [session,setSession]=useState<Session|null>(null),[ready,setReady]=useState(false),[started,setStarted]=useState(false),[help,setHelp]=useState(false),[login,setLogin]=useState(false),[theme,setTheme]=useState('cream'),[status,setStatus]=useState('正在准备学习空间…'),[email,setEmail]=useState(''),[code,setCode]=useState(''),[sent,setSent]=useState(false),[busy,setBusy]=useState(false),[authMessage,setAuthMessage]=useState(''),[guestOffer,setGuestOffer]=useState(false);
 const currentUser=useRef<string|null|undefined>(undefined),revision=useRef(0),dirty=useRef(false),epoch=useRef(0),version=useRef(0),saving=useRef(false),blocked=useRef(false),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),guest=useRef<Snapshot|null>(null),requestedSession=useRef<Session|null>(null),alive=useRef(true);
 function notice(){setStatus(currentUser.current?'有修改，正在等待保存…':'游客模式：修改仅在本次页面中保留，刷新或关闭后丢失。');}
 async function flush(){
  if(!currentUser.current||!cloud||blocked.current)return !dirty.current;
  if(saving.current)return false;if(!dirty.current)return true;
  saving.current=true;const id=currentUser.current,stamp=epoch.current,change=version.current,snapshot=exportWorkspace();setStatus('正在保存你的学习记录…');
  try{const {data,error}=await cloud.rpc('save_learning_workspace',{p_payload:snapshot,p_expected_revision:revision.current});
   if(stamp!==epoch.current)return false;if(error)throw error;
   if(!data?.ok){blocked.current=true;setStatus('另一台设备已更新。为避免覆盖，已暂停保存；请先下载本次备份，再重新载入。');return false;}
   revision.current=data.revision;dirty.current=change!==version.current;setStatus(dirty.current?'有新修改，继续保存…':'已保存到你的账号 · 其他人看不到你的记录');return !dirty.current;
  }catch{if(stamp===epoch.current)setStatus('保存失败，修改仍在本次页面中。请重试或下载备份后再离开。');return false;}
  finally{saving.current=false;if(stamp===epoch.current&&currentUser.current===id&&dirty.current&&!blocked.current)timer.current=setTimeout(()=>void flush(),5000);}
 }
 function changed(){dirty.current=true;version.current++;clearTimeout(timer.current);notice();if(currentUser.current)timer.current=setTimeout(()=>void flush(),1500);}
 async function transition(next:Session|null,force=false){
  requestedSession.current=next;const id=next?.user.id??null;if(!force&&currentUser.current===id){setSession(next);return;}
  const stamp=++epoch.current;clearTimeout(timer.current);onWorkspaceChange(()=>{});setReady(false);setStatus('正在载入你的学习空间…');
  if(currentUser.current===null&&dirty.current)guest.current=exportWorkspace();
  try{
   let payload:Snapshot|undefined;let remoteRevision=0;
   if(id&&cloud){const {data,error}=await cloud.from('learning_workspaces').select('payload,revision').eq('user_id',id).maybeSingle();if(error)throw error;payload=data?.payload;remoteRevision=data?.revision??0;}
   if(stamp!==epoch.current||!alive.current)return;
   await switchWorkspace(()=>openWorkspace(payload));if(stamp!==epoch.current)return;
   currentUser.current=id;revision.current=remoteRevision;dirty.current=false;blocked.current=false;version.current=0;setSession(next);
   const selected=studyStorage.getItem('community-theme')??'cream';setTheme(themes.some(t=>t[0]===selected)?selected:'cream');
   setGuestOffer(!!id&&!!guest.current&&remoteRevision===0);onWorkspaceChange(changed);setReady(true);
   setStatus(id?'已载入你的个人空间':'游客模式：修改仅在本次页面中保留，刷新或关闭后丢失。');
  }catch{if(stamp===epoch.current){setStatus('个人空间读取失败。为保护现有数据，未开启编辑，请重试。');}}
 }
 useEffect(()=>{alive.current=true;cloud?cloud.auth.getSession().then(({data,error})=>{if(error)setStatus('登录状态读取失败，请刷新重试。');else void transition(data.session);}):void transition(null);
  const subscription=cloud?.auth.onAuthStateChange((_event,next)=>{setTimeout(()=>{if(alive.current)void transition(next);},0);});
  const leaving=(event:BeforeUnloadEvent)=>{if(dirty.current){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',leaving);
  return()=>{alive.current=false;clearTimeout(timer.current);subscription?.data.subscription.unsubscribe();onWorkspaceChange(()=>{});window.removeEventListener('beforeunload',leaving);};
 },[]);
 useEffect(()=>{document.documentElement.dataset.theme=theme;document.querySelector('meta[name="theme-color"]')?.setAttribute('content',themes.find(t=>t[0]===theme)?.[2]??'#283f61');},[theme]);
 function changeTheme(value:string){setTheme(value);studyStorage.setItem('community-theme',value);}
 async function sendCode(event:React.FormEvent){event.preventDefault();if(!cloud)return;setBusy(true);setAuthMessage('');try{const {error}=await cloud.auth.signInWithOtp({email:email.trim()});if(error)throw error;setSent(true);setAuthMessage('验证码已发送，请查看邮箱。');}catch{setAuthMessage('邮件暂时发送失败，请稍后重试，或先直接体验。');}finally{setBusy(false);}}
 async function verify(event:React.FormEvent){event.preventDefault();if(!cloud)return;setBusy(true);try{const {error}=await cloud.auth.verifyOtp({email:email.trim(),token:code.trim(),type:'email'});if(error)throw error;setLogin(false);setCode('');setStarted(true);}catch{setAuthMessage('验证码无效或已过期，请检查后重试。');}finally{setBusy(false);}}
 async function logout(){if(dirty.current&&!await flush())return;await cloud?.auth.signOut();}
 function download(data=exportWorkspace()){const blob=new Blob([JSON.stringify(data)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='GRE个人学习备份.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 async function keepGuest(){const data=guest.current;if(!data||revision.current!==0)return;setReady(false);onWorkspaceChange(()=>{});await switchWorkspace(()=>openWorkspace(data));onWorkspaceChange(changed);guest.current=null;setGuestOffer(false);setReady(true);changed();}
 return <><div className="communityBar"><a className="communityBrand" href="#" onClick={e=>{e.preventDefault();setStarted(false);}}>Q · GRE 速刷</a><span className="communityIdentity">{session?'我的学习空间':'游客体验'}</span><button onClick={()=>setHelp(true)}>使用帮助</button><details className="themeMenu"><summary>配色</summary><div>{themes.map(([id,name,color])=><button key={id} aria-pressed={theme===id} onClick={()=>changeTheme(id)}><i style={{background:color}}/>{name}</button>)}</div></details>{session?<button onClick={logout}>退出登录</button>:<button className="primary" onClick={()=>setLogin(true)}>登录并保存</button>}</div>
 <div className="communityStatus" role="status">{status}{session&&<><button onClick={()=>void flush()}>立即保存 / 重试</button><button onClick={()=>download()}>下载备份</button>{blocked.current&&<button onClick={()=>{if(window.confirm('请先下载本次备份。重新载入将使用云端记录，放弃本页未保存的修改。'))void transition(session,true);}}>重新载入</button>}</>}</div>
 {!ready?<section className="communityWelcome"><h1>正在准备你的学习空间</h1><p>{status}</p><button onClick={()=>void transition(requestedSession.current,true)}>重试</button></section>:<>
 {!started?<section className="communityWelcome"><p className="eyebrow">YOUR WORDS. YOUR WAY.</p><h1>记住单词，<br/>用你自己的方法。</h1><p>从速刷到测试，从记忆笔记到滚动复习。选择一份词表，今天就开始。</p><div className="welcomeActions"><button className="primary" onClick={()=>setStarted(true)}>直接开始{session?'学习':'体验'} →</button>{!session&&<button onClick={()=>setLogin(true)}>登录，保存我的进度</button>}</div><p className="welcomeFine">无需注册即可体验。登录后，笔记、红黄绿、复习记录和配色只属于你。</p><div className="featureTiles"><article><b>01 · 主动回忆</b><p>先看单词，再揭晓释义和记忆方法。</p></article><article><b>02 · 学习有迹可循</b><p>红黄绿标记、等价词测试和错词滚动复习。</p></article><article><b>03 · 一词一份笔记</b><p>在不同词库遇见同一个词，继续使用自己的记忆方法。</p></article></div><div className="welcomeThemes"><h2>选一个你喜欢的配色</h2>{themes.map(([id,name,color])=><button key={id} aria-pressed={theme===id} onClick={()=>changeTheme(id)}><i style={{background:color}}/>{name}</button>)}</div></section>:<SharedWordMemoryProvider key={session?.user.id??'guest'}><Page/></SharedWordMemoryProvider>}
 <PwaBridge/>
 </>}
 {guestOffer&&<div className="communityModal" role="dialog" aria-modal="true" aria-labelledby="guest-title"><section><h2 id="guest-title">保留刚才的体验记录？</h2><p>这是你的新学习空间，可以把刚才的笔记和标记存入账号。</p><button className="primary" onClick={keepGuest}>保存本次体验</button><button onClick={()=>{guest.current=null;setGuestOffer(false);}}>从基础词库开始</button></section></div>}
 {session&&guest.current&&!guestOffer&&<aside className="guestBackup">登录前的体验记录没有覆盖你的账号。<button onClick={()=>{download(guest.current!);guest.current=null;setStatus('已下载游客体验备份。');}}>下载体验备份</button></aside>}
 {login&&<div className="communityModal" role="dialog" aria-modal="true" aria-labelledby="login-title"><section><button className="modalClose" aria-label="关闭登录" onClick={()=>setLogin(false)}>×</button><h2 id="login-title">留住你的每一次进步</h2><p>邮箱验证码登录，无需设置密码。首次验证成功后会建立个人账号。</p>{cloud?<><form onSubmit={sendCode}><label>邮箱<input type="email" autoComplete="email" required value={email} onChange={e=>{setEmail(e.target.value);setSent(false);}}/></label><button disabled={busy}>{sent?'重新发送验证码':'获取验证码'}</button></form>{sent&&<form onSubmit={verify}><label>邮箱验证码<input inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={e=>setCode(e.target.value)}/></label><button className="primary" disabled={busy}>验证并登录</button></form>}<p role="status">{authMessage}</p></>:<p className="setupNotice">此预览尚未连接账号服务。你现在可以完整体验游客模式；账号保存将在配置完成后开放。</p>}<button onClick={()=>{setLogin(false);setStarted(true);}}>先直接体验</button></section></div>}
 {help&&<div className="communityModal" role="dialog" aria-modal="true" aria-labelledby="help-title"><section><button className="modalClose" aria-label="关闭帮助" onClick={()=>setHelp(false)}>×</button><h2 id="help-title">从这五步开始</h2><ol><li><b>选词库</b>：全能词、A+、BB六选二、GLEE、数学等。</li><li><b>先回忆再揭晓</b>：单词、等价词和释义按需显示。</li><li><b>标记掌握程度</b>：红色不认识、黄色模糊、绿色熟悉。</li><li><b>测试和复习</b>：练习释义与同义词，错词按安排回来复习。</li><li><b>写自己的方法</b>：同词跨模块共用一份个人笔记。</li></ol><p>方向键切换，Enter 揭晓，1 / 2 / 3 标记；各模块的快捷键栏会提示具体操作。</p><p>游客修改仅在本页中保留。登录后由顶部状态提示是否已保存；保存失败时请先备份再离开。</p><p>手机可通过浏览器菜单“添加到主屏幕”安装。它是网页 App，目前不代表已上架应用商店。</p><button className="primary" onClick={()=>{setHelp(false);setStarted(true);}}>开始学习</button></section></div>}
 </>;
}
