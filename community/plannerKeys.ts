import type {KeyboardEvent} from 'react';
export function planModalKeys(e:KeyboardEvent<HTMLElement>,close:()=>void,busy=false){
 e.stopPropagation();
 if(e.key==='Escape'){e.preventDefault();if(!busy)close();}
 if(e.key==='Tab'){
  const nodes=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href],summary')).filter(n=>n.getClientRects().length);
  const first=nodes[0],last=nodes.at(-1);
  if(first&&last&&(e.shiftKey&&document.activeElement===first||!e.shiftKey&&document.activeElement===last)){e.preventDefault();(e.shiftKey?last:first).focus();}
 }
}
