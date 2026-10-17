/** Bound both network IO and any SDK retry/backoff to one visible attempt. */
export function withCloudTimeout<T>(run:(signal:AbortSignal)=>PromiseLike<T>,milliseconds=15000):Promise<T>{
 const controller=new AbortController();
 return new Promise<T>((resolve,reject)=>{
  const timer=setTimeout(()=>{controller.abort();reject(Error('账号连接超时，请检查网络后重试。'));},milliseconds);
  Promise.resolve().then(()=>run(controller.signal)).then(resolve,reject).finally(()=>clearTimeout(timer));
 });
}
