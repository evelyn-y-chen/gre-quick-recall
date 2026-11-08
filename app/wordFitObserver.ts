const selector=".quickWord strong,.quickPairWord strong,.aPlusWordChip,.bbPronounce,.mindMapWordMain strong,.sharedMemoryWord,.aPlusChoiceLabel strong,.aPlusQuestionHeading h2,.wordCard h2,.practiceQuestion h2,.practicePrompt.enWord,.practiceOptions .practiceEnglish,.practiceDueWords strong,.learningStudyWord>.enWord";

/** Observe word labels, not unrelated status messages, notes or typed answers. */
export function observeWordFit(){
 let frame=0,closed=false;
 const labels=new Map<HTMLElement,HTMLElement>();
 const parents=new Map<HTMLElement,Set<HTMLElement>>();
 const widths=new WeakMap<Element,number>();
 const dirty=new Set<HTMLElement>();
 const fit=()=>{
  frame=0;if(closed)return;
  const pending=[...dirty];dirty.clear();
  const visible:HTMLElement[]=[];
  for(const node of pending){
   if(!node.isConnected){
    const parent=labels.get(node);labels.delete(node);
    if(parent){const children=parents.get(parent);children?.delete(node);if(!children?.size){observer.unobserve(parent);parents.delete(parent);widths.delete(parent);}}
    continue;
   }
   if(node.getClientRects().length)visible.push(node);
  }
  // Separate writes and reads so opening a List does not force layout between
  // every pair of labels. Later edits touch only dirty labels.
  for(const node of visible)node.style.removeProperty('font-size');
  const sizes=visible.map(node=>{
   const base=parseFloat(getComputedStyle(node).fontSize),width=node.clientWidth,overflow=node.scrollWidth;
   return {node,size:width>0&&overflow>width+1?Math.max(8,base*width/overflow-.3):null};
  });
  for(const {node,size} of sizes)if(size!==null)node.style.setProperty('font-size',size+'px','important');
 };
 const schedule=()=>{if(!closed&&dirty.size&&!frame)frame=requestAnimationFrame(fit);};
 const mark=(node:HTMLElement)=>{dirty.add(node);schedule();};
 const watch=(node:HTMLElement)=>{
  const parent=node.parentElement;if(!parent)return;
  const oldParent=labels.get(node);
  if(oldParent!==parent){
   if(oldParent){const siblings=parents.get(oldParent);siblings?.delete(node);if(!siblings?.size){observer.unobserve(oldParent);parents.delete(oldParent);widths.delete(oldParent);}}
   labels.set(node,parent);
   let siblings=parents.get(parent);
   if(!siblings){siblings=new Set();parents.set(parent,siblings);observer.observe(parent);}
   siblings.add(node);
  }
  mark(node);
 };
 const scan=(element:Element)=>{
  if(element.matches(selector))watch(element as HTMLElement);
  element.querySelectorAll<HTMLElement>(selector).forEach(watch);
 };
 const observer=new ResizeObserver(entries=>{
  for(const entry of entries){
   const width=entry.contentRect.width;
   // Textarea growth can alter height without changing word width.
   if(widths.get(entry.target)===width)continue;
   widths.set(entry.target,width);
   parents.get(entry.target as HTMLElement)?.forEach(mark);
  }
 });
 const mutation=new MutationObserver(records=>{
  for(const record of records){
   const element=record.target.nodeType===1?record.target as Element:record.target.parentElement;
   const label=element?.closest<HTMLElement>(selector);
   if(label)watch(label);
   if(record.type==='childList'){
    for(const added of record.addedNodes)if(added.nodeType===1)scan(added as Element);
    // Clean up only detached branches; no full document scan on typing.
    for(const removed of record.removedNodes)if(removed.nodeType===1){
     const element=removed as Element;
     if(element.matches(selector))mark(element as HTMLElement);
     element.querySelectorAll<HTMLElement>(selector).forEach(mark);
    }
   }
  }
 });
 const refresh=()=>{labels.forEach((_,node)=>mark(node));};
 mutation.observe(document.body,{childList:true,subtree:true,characterData:true});
 window.addEventListener('resize',refresh);scan(document.body);
 void document.fonts.ready.then(()=>{if(!closed)refresh();});
 return()=>{closed=true;cancelAnimationFrame(frame);observer.disconnect();mutation.disconnect();window.removeEventListener('resize',refresh);labels.clear();parents.clear();dirty.clear();};
}
