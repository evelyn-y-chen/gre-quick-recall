import {useEffect,useMemo,useRef,useState} from 'react';
import {createClient,type Session} from '@supabase/supabase-js';
import publicConfig from './publicCloud.json';

type Item={id:string;body:string;reply:string;created_at:string;replied_at:string|null;is_public:boolean};
type Scope='public'|'mine'|'admin';
type Props={admin?:boolean;session:Session|null;onClose:()=>void;onLogin?:()=>void};
const guestStorageKey='lemnota-feedback-guest-v1';
let ephemeralGuestKey:string|null=null;
function getGuestKey(){
 if(ephemeralGuestKey)return ephemeralGuestKey;
 try{const saved=localStorage.getItem(guestStorageKey);if(saved&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(saved))return ephemeralGuestKey=saved;}catch{}
 ephemeralGuestKey=crypto.randomUUID();
 try{localStorage.setItem(guestStorageKey,ephemeralGuestKey);}catch{}
 return ephemeralGuestKey;
}
export default function Feedback({admin=false,session,onClose,onLogin}:Props){
 const [scope,setScope]=useState<Scope>(admin?'admin':'public');
 const [isPublic,setIsPublic]=useState(!session),[items,setItems]=useState<Item[]>([]),[body,setBody]=useState(''),[drafts,setDrafts]=useState<Record<string,string>>({}),[status,setStatus]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[offset,setOffset]=useState(0),[refresh,setRefresh]=useState(0);
 const request=useRef<{id:string;body:string;isPublic:boolean}|null>(null),alive=useRef(true);
 // Pin requests to the account that opened this panel, even if another tab changes the shared auth session.
 const client=useMemo(()=>{
  const url=import.meta.env.VITE_SUPABASE_URL||publicConfig.url,key=import.meta.env.VITE_SUPABASE_ANON_KEY||publicConfig.publishableKey;
  const token=session?.access_token??null;
  return url&&key?createClient(url,key,{accessToken:async()=>token}):null;
 },[session?.access_token]);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{
  let active=true;setLoading(true);setItems([]);setDrafts({});
  void (async()=>{try{if(!client)throw Error();const {data,error}=await client.rpc('list_feedback_v2',{p_scope:scope,p_offset:offset});if(error)throw error;if(active)setItems(data as Item[]);}catch{if(active)setStatus('读取失败，请稍后刷新。 / Could not load feedback. Please try again.');}finally{if(active)setLoading(false);}})();
  return()=>{active=false;};
 },[client,scope,offset,refresh]);
 function changeScope(value:Scope){setScope(value);setOffset(0);setStatus('');}
 async function submit(){
  if(busy||!body.trim())return;
  const visibility=session?isPublic:true;
  setBusy(true);setStatus('');
  if(!request.current||request.current.body!==body.trim()||request.current.isPublic!==visibility)request.current={id:crypto.randomUUID(),body:body.trim(),isPublic:visibility};
  try{
   if(!client)throw Error();
   const {error}=await client.rpc('submit_feedback_v2',{p_id:request.current.id,p_body:request.current.body,p_public:request.current.isPublic,p_guest_key:session?null:getGuestKey()});
   if(error)throw error;
   if(!alive.current)return;
   request.current=null;setBody('');setScope(visibility?'public':'mine');setOffset(0);setRefresh(n=>n+1);
   setStatus(visibility?'公开建议已送达，谢谢你。作者的回复也会公开显示。 / Thank you. Your suggestion and the author’s reply are public.':'私人反馈已送达，谢谢你。可在「我的反馈」查看作者回复。 / Thank you. Check My feedback for the author’s private reply.');
  }catch(e){if(alive.current)setStatus((e as {code?:string}).code==='54000'?'今天提交较多，请明天再试。 / Daily limit reached. Please try tomorrow.':'提交失败，内容仍保留，可重试。 / Could not send. Your text is still here; please retry.');}finally{if(alive.current)setBusy(false);}
 }
 async function reply(item:Item){
  const value=(drafts[item.id]??item.reply).trim();if(busy||!value)return;setBusy(true);setStatus('');
  try{if(!client)throw Error();const {error}=await client.rpc('reply_app_feedback',{p_id:item.id,p_reply:value});if(error)throw error;if(!alive.current)return;setItems(rows=>rows.map(row=>row.id===item.id?{...row,reply:value,replied_at:new Date().toISOString()}:row));setStatus(item.is_public?'回复已公开保存，所有人均可查看。 / Public reply saved.':'私人回复已保存，仅提交账号和作者可见。 / Private reply saved.');}catch{if(alive.current)setStatus('回复保存失败，文字仍保留，请重试。 / Could not save the reply. Your text is still here.');}finally{if(alive.current)setBusy(false);}
 }
 return <div className="analyticsOverlay feedbackOverlay" role="dialog" aria-modal="true" aria-labelledby="feedbackTitle"><section className="analyticsDashboard feedbackPanel">
  <header><div><p className="eyebrow">LEMNOTA · FEEDBACK</p><h2 id="feedbackTitle">{admin?'用户反馈 · Feedback':'建议与回复 · Feedback'}</h2></div><button onClick={onClose}>关闭 / Close</button></header>
  {!admin&&<>
   <p>遇到问题，或有想改进的地方，都可以告诉我。公开建议和回复所有人都能看到；登录后，也可以只向作者发送私人反馈。</p>
   <p className="feedbackEnglish" lang="en">Share a problem or an idea. Public suggestions and replies are visible to everyone. Sign in to send private feedback to the author.</p>
   <div className="feedbackComposer">
    {session?<fieldset className="feedbackVisibility"><legend>这条反馈谁可以看？ / Visibility</legend><label><input type="radio" name="feedbackVisibility" checked={!isPublic} disabled={busy} onChange={()=>setIsPublic(false)}/><span>私人 / Private<small>只有你和作者 / Only you and the author</small></span></label><label><input type="radio" name="feedbackVisibility" checked={isPublic} disabled={busy} onChange={()=>setIsPublic(true)}/><span>公开 / Public<small>所有人都可以看 / Visible to everyone</small></span></label></fieldset>:<div className="feedbackPublicNotice"><strong>你将提交公开建议 / This suggestion will be public</strong><p>无需登录，建议和作者的回复会公开显示。请不要填写姓名、联系方式、密码等私人信息。</p><p lang="en">No account needed. Your suggestion and the author’s reply will be public. Please leave out names, contact details, passwords, and other private information.</p>{onLogin&&<button onClick={onLogin}>想私下留言？登录后选择私人 / Sign in for private feedback</button>}</div>}
    {session&&<p className="feedbackVisibilityHint">{isPublic?'这条建议和作者的回复会公开显示。请勿填写私人信息。 / Your suggestion and reply will be public. Please leave out private information.':'这条反馈和回复只对你及作者可见，不会进入公开建议。 / Only you and the author can read this feedback and reply.'}</p>}
    <label htmlFor="feedbackBody">反馈内容 / Your feedback</label><textarea id="feedbackBody" value={body} maxLength={3000} rows={5} disabled={busy} onChange={e=>setBody(e.target.value)} placeholder="可以描述所在模块、操作过程和你期待的效果。 / Which module, what happened, and what would help?"/>
    <div className="feedbackSend"><small>{body.length} / 3000</small><button className="primary" disabled={busy||!body.trim()} onClick={()=>void submit()}>{busy?'正在发送… / Sending…':session&&!isPublic?'发送私人反馈 / Send privately':'提交公开建议 / Post publicly'}</button></div>
   </div>
  </>}
  <p className="feedbackStatus" role="status">{status}</p>
  {admin?<p>这里包含全部公开建议和私人反馈。回复会沿用原反馈的可见范围。 / Replies follow the original feedback’s visibility.</p>:<nav className="feedbackScopes" aria-label="反馈列表 / Feedback lists"><button aria-pressed={scope==='public'} disabled={busy} onClick={()=>changeScope('public')}>公开建议 / Public</button>{session&&<button aria-pressed={scope==='mine'} disabled={busy} onClick={()=>changeScope('mine')}>我的反馈 / Mine</button>}</nav>}
  <div className="feedbackNavigation"><button disabled={loading||busy} onClick={()=>{setStatus('');setRefresh(n=>n+1);}}>刷新 / Refresh</button><button disabled={offset===0||loading||busy} onClick={()=>setOffset(n=>Math.max(0,n-30))}>上一页 / Previous</button><span>第 {offset/30+1} 页 / Page {offset/30+1}</span><button disabled={items.length<30||loading||busy} onClick={()=>setOffset(n=>n+30)}>下一页 / Next</button></div>
  {loading?<p role="status">正在读取… / Loading…</p>:items.length===0?<p>{scope==='mine'?'你还没有提交反馈。 / You have not sent any feedback yet.':'这里还没有反馈。 / No feedback yet.'}</p>:items.map(item=><article className="feedbackItem" key={item.id}><div className="feedbackItemMeta"><span className={'feedbackBadge'+(item.is_public?' isPublic':'')}>{item.is_public?'公开 / Public':'私人 / Private'}</span><small>{new Date(item.created_at).toLocaleString()} · {item.reply?'已回复 / Replied':'等待回复 / Awaiting reply'}</small></div><p>{item.body}</p>{admin?<><label htmlFor={'reply-'+item.id}>{item.is_public?'作者回复（公开） / Public author reply':'作者回复（私人） / Private author reply'}</label><textarea id={'reply-'+item.id} rows={4} maxLength={5000} disabled={busy} value={drafts[item.id]??item.reply} onChange={e=>setDrafts(d=>({...d,[item.id]:e.target.value}))}/><button disabled={busy||!(drafts[item.id]??item.reply).trim()} onClick={()=>void reply(item)}>保存回复 / Save reply</button></>:item.reply&&<div className="feedbackReply"><strong>作者回复 / Author’s reply</strong><p>{item.reply}</p></div>}</article>)}
 </section></div>;
}
