import type {CaptureInput} from './quickCaptureModel';

type Message = {type:'find'|'available'|'accepted'|'declined'; request:string; account:string; peer:string}
 | {type:'deliver'; request:string; account:string; peer:string; input:CaptureInput};

/** A shortcut tab can hand its word to a ready Inkling page in the same browser profile. */
export function listenForCapture(account:string, canAccept:()=>boolean, accept:(input:CaptureInput)=>boolean){
 if(typeof BroadcastChannel==='undefined')return null;
 const channel=new BroadcastChannel(`inkling-capture:${location.pathname}`), peer=crypto.randomUUID();
 channel.addEventListener('message',({data}:MessageEvent<Message>)=>{
  if(data?.account!==account)return;
  if(data.type==='find'&&canAccept())channel.postMessage({...data,type:'available',peer});
  if(data.type==='deliver'&&data.peer===peer){
   const accepted=accept(data.input);
   channel.postMessage({type:accepted?'accepted':'declined',account,peer,request:data.request});
  }
 });
 function send(input:CaptureInput,onResult:(accepted:boolean)=>void){
  const request=crypto.randomUUID();
  let recipient='';
  let timer:number;
  function finish(accepted:boolean){cancel();onResult(accepted);}
  function reply({data}:MessageEvent<Message>){
   if(data?.account!==account||data.request!==request)return;
   if(data.type==='available'&&!recipient){
    recipient=data.peer;
    window.clearTimeout(timer);
    timer=window.setTimeout(()=>finish(false),1000);
    channel.postMessage({type:'deliver',account,request,peer:recipient,input});
   }else if(data.peer===recipient&&(data.type==='accepted'||data.type==='declined'))finish(data.type==='accepted');
  }
  function cancel(){window.clearTimeout(timer);channel.removeEventListener('message',reply);}
  channel.addEventListener('message',reply);
  timer=window.setTimeout(()=>finish(false),300);
  channel.postMessage({type:'find',account,request,peer});
  return cancel;
 }
 return {send,close:()=>channel.close()};
}
