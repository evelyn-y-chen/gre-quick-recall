import type {Snapshot} from './database';
import type {SavedWorkspace} from './localWorkspace';
import {mergeWorkspaceSnapshots} from './ratingMerge';
export function workspacePlan(cache:SavedWorkspace|undefined,remote:{payload:Snapshot;revision:number}|null){
 const revision=remote?.revision??0;
 const compatible=cache?.pending&&cache.cloudRevision===revision;
 const conflict=!!cache?.pending&&!compatible;
 if(conflict&&remote&&cache?.basePayload){
  try{return {payload:mergeWorkspaceSnapshots(cache.basePayload,cache.payload,remote.payload),cloudRevision:revision,pending:true,conflict:undefined};}catch{}
 }
 return {payload:compatible?cache!.payload:remote?.payload,cloudRevision:revision,pending:!!compatible,conflict:conflict?cache!.payload:undefined};
}
