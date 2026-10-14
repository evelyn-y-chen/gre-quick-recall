import type {Snapshot} from './database';
import type {SavedWorkspace} from './localWorkspace';
export function workspacePlan(cache:SavedWorkspace|undefined,remote:{payload:Snapshot;revision:number}|null){
 const revision=remote?.revision??0;
 const compatible=cache?.pending&&cache.cloudRevision===revision;
 const conflict=!!cache?.pending&&!compatible;
 return {payload:compatible?cache!.payload:remote?.payload,cloudRevision:revision,pending:!!compatible,conflict:conflict?cache!.payload:undefined};
}
