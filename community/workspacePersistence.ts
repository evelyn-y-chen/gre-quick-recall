export type WorkspacePersistenceResult={destination:'account'|'device';synced:boolean;message?:string};
type Registration={key:string;generation:number;persist:()=>Promise<WorkspacePersistenceResult>};
let registration:Registration|null=null;

/** Available only after the corresponding in-memory workspace has actually opened. */
export function registerWorkspacePersistence(next:Registration){
 registration=next;
 return()=>{if(registration===next)registration=null;};
}

/** Call after appFetch has resolved, never from inside the local API write queue. */
export async function persistLearningWorkspace(expectedGeneration:number):Promise<WorkspacePersistenceResult>{
 const current=registration;
 if(!current)throw Error('学习空间尚未准备好，请稍后重试保存。');
 if(current.generation!==expectedGeneration)throw Error('学习空间已切换，请在当前账号重新保存。');
 const result=await current.persist();
 if(registration!==current)throw Error('学习空间已切换，请在当前账号查看保存状态。');
 return result;
}
