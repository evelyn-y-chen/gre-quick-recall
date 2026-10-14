import {useEffect,useState} from 'react';
import {useAPlusNotesOpen} from '../app/APlusNotes';
import {APlusWordMark} from '../app/APlusWordMarks';
import SharedWordMemory from '../app/SharedWordMemory';
export default function WordNoteCard({word,pronounce}:{word:string;pronounce:(word:string)=>void}){const allOpen=useAPlusNotesOpen();const [open,setOpen]=useState(allOpen);useEffect(()=>setOpen(allOpen),[allOpen]);return <div className="wordNoteCard"><APlusWordMark word={word} pronounce={pronounce}/><button className="wordNoteToggle memoryLabel" aria-expanded={open} aria-label={`${word} 的笔记`} onClick={()=>setOpen(!open)}><span className="noteChevron" aria-hidden="true">{open?"▾":"▸"}</span>笔记</button>{open&&<SharedWordMemory word={word}/>}</div>;}
