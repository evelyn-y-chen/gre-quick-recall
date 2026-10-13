"use client";
import type {ReactNode} from "react";
import SharedWordMemory from "./SharedWordMemory";
export function QuickGleeMemoryProvider({children}:{children:ReactNode}){return <>{children}</>;}
export default function QuickGleeMemory({word,revealed=false}:{word:string;revealed?:boolean;onEdit?:(word:string)=>void}){return <div className="quickGleeMemoryCell" role="cell">{revealed?<SharedWordMemory word={word}/>:<span className="quickGleeMemoryEmpty">随释义一起显示</span>}</div>;}
