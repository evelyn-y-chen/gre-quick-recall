"use client";
import {createContext,useContext,useState,type ReactNode} from "react";
import SharedWordMemory,{useWordMemory} from "./SharedWordMemory";
import {wordMemoryKey} from "./wordMemoryModel";
const Context=createContext(false);
export function useAPlusNotesOpen(){return useContext(Context);}
export function APlusNotesProvider({children}:{children:ReactNode;onOpenGlee?:(word:string)=>void}){
 const [open,setOpen]=useState(false),memory=useWordMemory();
 return <Context.Provider value={open}><div className="aPlusNotesToolbar" onKeyDown={e=>e.stopPropagation()}><button type="button" onClick={()=>setOpen(!open)}>{open?"收起全部笔记":"展开全部笔记"}</button><button type="button" className="solid" disabled={!memory||!memory.ready||memory.busy||!Object.keys(memory.drafts).length} onClick={()=>memory?.save()}>保存全部记忆方法</button><span>{memory?.status}</span></div>{children}</Context.Provider>;
}
export default function APlusNotes({words}:{words:string[]}){const open=useContext(Context);return !open?null:<div className="aPlusNotes"><div className="aPlusNotesBody">{[...new Map(words.map(word=>[wordMemoryKey(word),word])).values()].map(word=><div className="aPlusMemoryEntry" key={wordMemoryKey(word)}><SharedWordMemory word={word} hideWord={false}/></div>)}</div></div>;}
