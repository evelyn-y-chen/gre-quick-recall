import {useEffect,useRef,useState,type KeyboardEvent} from 'react';
import {INSTALL_TOUR_INDEX,TOUR_SLIDES,swipeTour,tourIndex,type TourLanguage} from './onboardingModel';
import './onboarding.css';
import TourDemo from './TourDemo';

export default function Onboarding({initial=0,onClose}:{initial?:number;onClose:()=>void}){
 const [index,setIndex]=useState(()=>tourIndex(initial)),[language,setLanguage]=useState<TourLanguage>('zh');
 const touch=useRef<{x:number;y:number}|null>(null),close=useRef<HTMLButtonElement>(null),panel=useRef<HTMLElement>(null);
 const slide=TOUR_SLIDES[index],copy=slide[language],english=language==='en';
 useEffect(()=>{const active=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;document.body.style.overflow='hidden';close.current?.focus();return()=>{document.body.style.overflow=overflow;active?.isConnected&&active.focus?.();};},[]);
 useEffect(()=>{panel.current?.scrollTo({top:0});},[index,language]);
 function move(n:number){setIndex(i=>tourIndex(i+n));}
 function keys(e:KeyboardEvent<HTMLDivElement>){e.stopPropagation();if(e.key==='Escape'){e.preventDefault();onClose();}else if(!(e.target as HTMLElement)?.closest?.('[data-tour-demo]')&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();move(e.key==='ArrowRight'?1:-1);}else if(e.key==='Tab'){
  const controls=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input,textarea,select')).filter(node=>node.getClientRects().length>0);const first=controls[0],last=controls.at(-1);
  if(first&&last&&(e.shiftKey&&document.activeElement===first||!e.shiftKey&&document.activeElement===last)){e.preventDefault();(e.shiftKey?last:first).focus();}
 }}
 return <div className="onboardingOverlay" role="dialog" aria-modal="true" aria-labelledby="tour-title" onKeyDown={keys} lang={english?'en':'zh-CN'}>
  <section className="onboardingPanel"><header className="tourHeader"><span>词笺 <small>Lemnota</small></span><div><button aria-label={english?'Switch to Chinese':'切换为英文'} onClick={()=>setLanguage(english?'zh':'en')}>{english?'中文':'English'}</button><button ref={close} className="tourClose" aria-label={english?'Close introduction':'关闭功能介绍'} onClick={onClose}>×</button></div></header>
   <section className="tourSlide" ref={panel} onTouchStart={e=>{if(e.touches.length===1&&!(e.target as HTMLElement)?.closest?.('[data-tour-demo]'))touch.current={x:e.touches[0].clientX,y:e.touches[0].clientY};}} onTouchCancel={()=>{touch.current=null;}} onTouchEnd={e=>{if(touch.current&&e.changedTouches[0]){const dx=e.changedTouches[0].clientX-touch.current.x,dy=e.changedTouches[0].clientY-touch.current.y;setIndex(i=>swipeTour(i,dx,dy));}touch.current=null;}}>
    <div className="tourCopy" key={slide.id+'-'+language} aria-live="polite"><p className="tourEyebrow">{String(index+1).padStart(2,'0')} / {copy.label}</p><h1 id="tour-title">{copy.title}</h1><p className="tourDescription">{copy.body}</p><TourDemo key={slide.id+language} id={slide.id} english={english}/><ol className="tourSteps">{copy.steps.map(step=><li key={step}>{step}</li>)}</ol><p className="tourTip">{copy.tip}</p>{index===INSTALL_TOUR_INDEX&&<div className="tourInstallLinks"><a href="https://support.apple.com/en-lamr/guide/iphone/iphea86e5236/ios" target="_blank" rel="noreferrer">{english?'Apple instructions ↗':'Apple 操作说明 ↗'}</a><a href="https://support.google.com/chrome/answer/9658361" target="_blank" rel="noreferrer">{english?'Chrome instructions ↗':'Chrome 操作说明 ↗'}</a></div>}</div>
   </section><footer className="tourFooter"><div className="tourPagination" role="group" aria-label={english?'Introduction pages':'介绍页码'}>{TOUR_SLIDES.map((s,i)=><button key={s.id} aria-label={english?`Page ${i+1}: ${s.en.label}`:`第 ${i+1} 页：${s.zh.label}`} aria-current={i===index?'step':undefined} onClick={()=>setIndex(i)}><i/></button>)}</div><div className="tourNav"><button disabled={!index} onClick={()=>move(-1)}>← {english?'Back':'上一张'}</button><span>{index+1} / {TOUR_SLIDES.length}</span><button className="primary" onClick={()=>index===TOUR_SLIDES.length-1?onClose():move(1)}>{index===TOUR_SLIDES.length-1?english?'Let’s begin':'开始使用':english?'Next →':'下一张 →'}</button></div><small>{english?'Swipe or use arrow keys. Reopen anytime from the User guide.':'左右滑动或点击翻页；可随时从「使用指南」重新查看。'}</small></footer>
  </section>
 </div>;
}
