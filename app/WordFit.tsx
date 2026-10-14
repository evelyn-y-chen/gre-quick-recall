"use client";
import {useEffect} from "react";
const selector=".quickWord strong,.quickPairWord strong,.aPlusWordChip,.bbPronounce,.mindMapWordMain strong,.sharedMemoryWord,.aPlusChoiceLabel strong,.aPlusQuestionHeading h2,.wordCard h2,.practiceQuestion h2";
/** Keep English word labels intact; fit only labels, never meanings or notes. */
export default function WordFit(){
 useEffect(()=>{
  let frame=0,closed=false;
  const watched=new Set<Element>();
  const fit=()=>{
   frame=0;if(closed)return;
   for(const node of watched)if(!node.isConnected){observer.unobserve(node);watched.delete(node);}
   document.querySelectorAll<HTMLElement>(selector).forEach(node=>{
    const parent=node.parentElement;if(!parent||!node.getClientRects().length)return;
    if(!watched.has(parent)){watched.add(parent);observer.observe(parent);}
    node.style.removeProperty('font-size');
    const base=parseFloat(getComputedStyle(node).fontSize);
    const width=node.clientWidth;
    if(width>0&&node.scrollWidth>width+1){
     node.style.setProperty('font-size',Math.max(8,base*width/node.scrollWidth-.3)+'px','important');
     // Fonts and letter-spacing can round differently; ensure the whole label fits.
     let size=parseFloat(node.style.fontSize);
     while(node.scrollWidth>node.clientWidth+1&&size>8){size-=.5;node.style.setProperty('font-size',Math.max(8,size)+'px','important');}
    }
   });
  };
  const schedule=()=>{if(!closed&&!frame)frame=requestAnimationFrame(fit);};
  const observer=new ResizeObserver(schedule),mutation=new MutationObserver(schedule);
  mutation.observe(document.body,{childList:true,subtree:true,characterData:true});
  window.addEventListener('resize',schedule);schedule();void document.fonts.ready.then(schedule);
  return()=>{closed=true;cancelAnimationFrame(frame);observer.disconnect();mutation.disconnect();window.removeEventListener('resize',schedule);};
 },[]);
 return null;
}
