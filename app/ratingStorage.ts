import {validRatings,type Ratings} from './ratingSyncModel';
type Storage={getItem:(key:string)=>string|null;setItem:(key:string,value:string)=>void};
export function readSavedRatings(storage:Storage,key:string):Ratings|undefined{
 const raw=storage.getItem(key);if(raw===null)return undefined;
 try{const value=JSON.parse(raw);return validRatings(value)?value:undefined;}catch{return undefined;}
}
export function writeSavedRatings(storage:Storage,key:string,ratings:Ratings){
 const raw=storage.getItem(key);
 // An unreadable map must not be erased by the initial empty React state.
 if(raw!==null&&readSavedRatings(storage,key)===undefined){
  storage.setItem(`gre-rating-recovery:${key}`,raw);
  if(!Object.keys(ratings).length)return;
 }
 storage.setItem(key,JSON.stringify(ratings));
}
