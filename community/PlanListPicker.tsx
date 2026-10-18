import SelectionChips from './SelectionChips';
import type {PlannedList} from './listLearningPlanModel';
export default function PlanListPicker({units,selected,onChange,disabled=false}:{units:PlannedList[];selected:string[];onChange:(ids:string[])=>void;disabled?:boolean}){
 const decks=[...new Set(units.map(u=>u.deckId))];
 return <div className="planListPicker">{decks.map((deck,index)=>{const group=units.filter(u=>u.deckId===deck),ids=new Set(group.map(u=>u.id));return <details key={deck} open={index===0||undefined}><summary>{group[0].deckName}<small>已选 {group.filter(u=>selected.includes(u.id)).length} / {group.length} 组</small></summary><SelectionChips label={group[0].deckName+' 的 List'} options={group.map(u=>({id:u.id,label:u.label,detail:`${u.words.length} 词`}))} selected={selected.filter(id=>ids.has(id))} disabled={disabled} onChange={next=>onChange([...selected.filter(id=>!ids.has(id)),...next])}/></details>;})}</div>;
}
