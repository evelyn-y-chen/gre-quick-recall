import {useEffect,useRef,useState} from 'react';
import {getWorkspaceGeneration} from './api';
import {studyStorage} from './storage';
import {persistLearningWorkspace} from './workspacePersistence';

// The workspace writes to IndexedDB immediately. This coalesced check also
// verifies account delivery and reports the result inside the testing dialog.
export function useTestAutosave(revision:unknown,enabled:boolean,generation:number){
 const [status,setStatus]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{if(!enabled)return;const online=()=>setRetry(n=>n+1);window.addEventListener('online',online);return()=>window.removeEventListener('online',online);},[enabled]);
 useEffect(()=>{
  if(!enabled||getWorkspaceGeneration()!==generation)return;
  let stale=false;
  setStatus('正在自动保存测试进度…');
  const timer=setTimeout(()=>{void persistLearningWorkspace(generation).then(result=>{
   if(stale||getWorkspaceGeneration()!==generation)return;
   setStatus(result.synced?(result.destination==='account'?'测试进度已自动保存到账号':'测试进度已自动保存到本机'):(result.message||'已保存到本机，账号同步待完成，请重试。'));
  }).catch(error=>{if(!stale)setStatus('自动保存尚未完成：'+(error instanceof Error?error.message:'请重试，并保留本页。'));});},400);
  return()=>{stale=true;clearTimeout(timer);};
 },[revision,enabled,generation,retry]);
 return {status,retry:()=>setRetry(n=>n+1)};
}
export function TestAudio({word,questionKey}:{word:string;questionKey:string}){
 const [enabled,setEnabled]=useState(()=>studyStorage.getItem('gre-test-auto-speak')!=='false');
 const [hint,setHint]=useState('');
 const serial=useRef(0);
 function stop(){serial.current++;if(typeof window!=='undefined'&&'speechSynthesis' in window)window.speechSynthesis.cancel();}
 function speak(){
  if(!word)return;
  if(typeof window==='undefined'||!('speechSynthesis' in window)||typeof SpeechSynthesisUtterance==='undefined'){setHint('此浏览器暂不支持朗读');return;}
  stop();const id=serial.current,utterance=new SpeechSynthesisUtterance(word);utterance.lang='en-US';utterance.rate=.9;
  const voice=window.speechSynthesis.getVoices().find(v=>v.lang==='en-US')??window.speechSynthesis.getVoices().find(v=>v.lang.startsWith('en'));
  if(voice)utterance.voice=voice;
  utterance.onerror=event=>{if(id===serial.current&&event.error!=='interrupted'&&event.error!=='canceled')setHint('未能自动朗读，可点「朗读单词」重试');};
  utterance.onstart=()=>{if(id===serial.current)setHint('');};
  window.speechSynthesis.speak(utterance);
 }
 useEffect(()=>{if(enabled&&word)speak();return stop;},[word,questionKey,enabled]);
 return <div className="testAudio"><label><input type="checkbox" checked={enabled} onChange={e=>{setEnabled(e.target.checked);studyStorage.setItem('gre-test-auto-speak',String(e.target.checked));}}/>自动朗读</label>{word&&<button type="button" onClick={speak}>朗读单词</button>}{hint&&<small role="status">{hint}</small>}</div>;
}
