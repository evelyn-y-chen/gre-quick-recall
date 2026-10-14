import {useEffect,useRef,useState} from 'react';
import Page from '../app/page';
import Guide from './Guide';
import About from './About';
import {makeSlip,readSlip} from './slip';
import {SharedWordMemoryProvider} from '../app/SharedWordMemory';
import PwaBridge from '../app/pwa-bridge';
import {exportWorkspace,openWorkspace,onWorkspaceChange,validSnapshot} from './database';
import {switchWorkspace} from './api';
import {studyStorage} from './storage';
import {readLocalWorkspace,saveLocalWorkspace} from './localWorkspace';
const themes=[['cream','奶油蓝','#496783'],['pink','雪林晚霞','#525871'],['sage','湖畔鸢尾','#5d4c68'],['night','暮色雪林','#f2c1a3'],['antique','苹果古纸','#a94f55']];
const paletteColors:Record<string,string[]>={cream:['#f6f1e8','#fffdfa','#496783','#e7c7c6'],pink:['#faf1ed','#fffaf7','#525871','#e4c7c7'],sage:['#edf3f7','#fcfdfb','#5d4c68','#cbd9c2'],night:['#303447','#40465d','#f2c1a3','#857c91'],antique:['#faf3e8','#fffaf2','#a94f55','#d4e7f2']};
function PaletteSwatch({id}:{id:string}){return <span className="paletteSwatch" aria-hidden="true">{paletteColors[id].map((c,i)=><i key={c} title={['背景','卡片','主按钮','选中与高亮'][i]} style={{background:c}}/>)}</span>;}

function localFileDate(){const d=new Date(),pad=(n:number)=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;}
const savedMessage='已存到这台设备';
export default function App(){
 const [username,setUsername]=useState(''),[celebrate,setCelebrate]=useState(false),[ready,setReady]=useState(false),[started,setStarted]=useState(false),[help,setHelp]=useState(false),[about,setAbout]=useState(false),[theme,setTheme]=useState('cream'),[status,setStatus]=useState('正在读取浏览器记录…'),[generation,setGeneration]=useState(0);
 const revision=useRef(0),dirty=useRef(false),saving=useRef(false),version=useRef(0),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),file=useRef<HTMLInputElement>(null),alive=useRef(true),loading=useRef(false);
 async function flush(){
  clearTimeout(timer.current);if(!dirty.current||saving.current)return;
  saving.current=true;const change=version.current;
  try{revision.current=await saveLocalWorkspace(exportWorkspace(),revision.current);dirty.current=version.current!==change;if(alive.current)setStatus(dirty.current?'正在保存新修改…':savedMessage);if(dirty.current)timer.current=setTimeout(()=>void flush(),100);}
  catch(error){if(alive.current)setStatus(error instanceof Error?error.message:'保存失败，请导出备份。');}
  finally{saving.current=false;}
 }
 function changed(){dirty.current=true;version.current++;setStatus('正在保存到当前浏览器…');clearTimeout(timer.current);timer.current=setTimeout(()=>void flush(),200);}
 function restoreTheme(){setUsername(studyStorage.getItem("lemnota-username")??"");const old=studyStorage.getItem('community-theme')??'cream';const value=({blue:'cream',yellow:'antique',ivory:'cream',apricot:'antique',lavender:'cream'} as Record<string,string>)[old]??old;setTheme(themes.some(t=>t[0]===value)?value:'cream');}
 async function initialize(){if(loading.current)return;loading.current=true;try{const saved=await readLocalWorkspace();if(!alive.current)return;await switchWorkspace(()=>openWorkspace(saved?.payload));revision.current=saved?.revision??0;restoreTheme();onWorkspaceChange(changed);setReady(true);setStatus(saved?savedMessage:'无需登录，学习记录自动保存在当前浏览器。');}catch{setStatus('无法读取浏览器存储，请检查浏览器权限后重试。现有记录未覆盖。');}finally{loading.current=false;}}
 useEffect(()=>{alive.current=true;void initialize();const leaving=(event:BeforeUnloadEvent)=>{if(dirty.current){void flush();event.preventDefault();event.returnValue='';}};const hidden=()=>{if(document.visibilityState==='hidden')void flush();};window.addEventListener('beforeunload',leaving);document.addEventListener('visibilitychange',hidden);return()=>{alive.current=false;clearTimeout(timer.current);onWorkspaceChange(()=>{});window.removeEventListener('beforeunload',leaving);document.removeEventListener('visibilitychange',hidden);};},[]);
 useEffect(()=>{document.documentElement.dataset.theme=theme;document.querySelector('meta[name="theme-color"]')?.setAttribute('content',themes.find(t=>t[0]===theme)?.[2]??'#283f61');},[theme]);
 useEffect(()=>{if(!celebrate)return;const timer=setTimeout(()=>setCelebrate(false),3500);return()=>clearTimeout(timer);},[celebrate]);
 function changeTheme(value:string){setTheme(value);studyStorage.setItem('community-theme',value);}
 function download(){const blob=new Blob([JSON.stringify(makeSlip(exportWorkspace()))],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`词笺_${username.trim().replace(/[^\p{L}\p{N}_-]/gu,"_").slice(0,30)||"我的"}_便笺_${localFileDate()}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 async function importBackup(selected:File){
  try{if(selected.size>20*1024*1024)throw Error('文件过大，请选择词笺学习便笺。');const payload=readSlip(JSON.parse(await selected.text()));if(!window.confirm('读取便笺会替换这台设备的学习记录（不会合并）。请先导出当前记录留底。确认读取？'))return;
   if(saving.current)throw Error('正在保存，请稍后再导入。');clearTimeout(timer.current);onWorkspaceChange(()=>{});setReady(false);
   // Persist first; a failed import must not replace the active workspace.
   revision.current=await saveLocalWorkspace(payload,revision.current);await switchWorkspace(()=>openWorkspace(payload));dirty.current=false;restoreTheme();setGeneration(n=>n+1);setStatus('便笺已读取，进度已保存在这台设备。');setCelebrate(true);
  }catch(error){setStatus(error instanceof Error?error.message:'导入失败，现有记录未改动。');}
  finally{onWorkspaceChange(changed);setReady(true);if(file.current)file.current.value='';}
 }
 return <>{celebrate&&<div className="slipCelebration" role="status"><div aria-hidden="true" className="confetti">{Array.from({length:18},(_,i)=><i key={i} style={{left:`${i*5.5}%`,animationDelay:`${i%5*.08}s`,background:["#8ba9c1","#d4a0ac","#d9c77a"][i%3]}}/>)}</div><p>进度接上了，离目标又近一步。</p></div>}<div className="communityBar"><a className="communityBrand" href="#" onClick={e=>{e.preventDefault();setStarted(false);}}><span className="brandChinese">词笺</span><span className="brandEnglish">Lemnota</span></a><span className="communityIdentity">个人学习空间 · 测试版</span><button onClick={()=>setHelp(true)}>使用指南</button><button onClick={()=>setAbout(true)}>关于词笺</button><details className="themeMenu"><summary>配色</summary><div>{themes.map(([id,name,color])=><button disabled={!ready} key={id} aria-pressed={theme===id} onClick={()=>changeTheme(id)}><PaletteSwatch id={id}/>{name}</button>)}</div></details></div>
 <div className="communityStatus" role="status">{status}{ready&&<><button onClick={()=>void flush()}>重试保存</button><button onClick={download}>带走便笺</button><button onClick={()=>file.current?.click()}>读取便笺</button><input ref={file} type="file" accept=".json,application/json" hidden onChange={e=>{const selected=e.target.files?.[0];if(selected)void importBackup(selected);}}/></>}</div>
 {!ready?<section className="communityWelcome"><h1>正在准备你的学习空间</h1><p>{status}</p><button onClick={()=>void initialize()}>重试</button></section>:<>
 {!started?<section className="communityWelcome"><p className="eyebrow">GRE 学习小白板</p><h1 className="lemnotaTitle"><span>词笺</span><span lang="en">Lemnota</span></h1><p className="brandTagline" lang="en">Worth noting.</p><p>选词表、看释义、记笔记，用红黄绿标记掌握程度。使用方法随时可以在「使用指南」里查看。</p><label className="welcomeUsername">怎么称呼你？<input aria-label="用户名" maxLength={30} placeholder="可选，写一个昵称" value={username} onChange={e=>{setUsername(e.target.value);studyStorage.setItem("lemnota-username",e.target.value);}}/><small>名字也会写进便笺的文件名，方便你找回。</small></label><div className="welcomeActions"><button className="primary" onClick={()=>setStarted(true)}>开始刷词</button></div><p className="welcomeFine">不用注册，记录自动留在这个浏览器。换设备时，带上一份学习便笺。</p><div className="welcomeSections"><section className="slipCard"><span className="slipIcon" aria-hidden="true">↗</span><div><h2>把进度装进一张便笺</h2><p>平时不用管保存。想留个备份，或换一台设备，就把记录带走。</p><button onClick={download}>导出我的便笺</button><button onClick={()=>file.current?.click()}>我有一张便笺</button><small>包含已保存的笔记和学习记录，请自己妥善保管。</small></div></section><details className="welcomeGuide"><summary>第一次来？看看怎么用</summary><Guide/></details></div><div className="welcomeThemes"><h2>选一套你喜欢的四色搭配</h2><p className="paletteLegend">从左到右：背景 · 卡片 · 主按钮 · 选中与高亮</p>{themes.map(([id,name,color])=><button key={id} aria-pressed={theme===id} onClick={()=>changeTheme(id)}><PaletteSwatch id={id}/>{name}</button>)}</div></section>:<SharedWordMemoryProvider key={generation}><Page/></SharedWordMemoryProvider>}
 <PwaBridge/></>}
 {about&&<div className="communityModal" role="dialog" aria-modal="true" aria-label="关于词笺"><section><button className="modalClose" onClick={()=>setAbout(false)} aria-label="关闭关于词笺">×</button><h2>词笺 · Lemnota</h2><About/></section></div>}{help&&<div className="communityModal" role="dialog" aria-modal="true" aria-labelledby="help-title"><section><button className="modalClose" aria-label="关闭帮助" onClick={()=>setHelp(false)}>×</button><h2 id="help-title">词笺使用指南</h2><Guide/><button className="primary" onClick={()=>{setHelp(false);setStarted(true);}}>开始学习</button></section></div>}
 </>;
}
