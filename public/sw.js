// Only current-build program assets are cached. Learning data stays in IndexedDB.
const CACHE='gre-community-shell-development';
const ASSETS=null; // Replaced with the current build's asset URLs after build.
const allowed=new Set((ASSETS||[]).map(path=>new URL(path,self.registration.scope).pathname));
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>{e.waitUntil((async()=>{try{for(const key of await caches.keys())if(key.startsWith('gre-community-shell-')&&key!==CACHE)await caches.delete(key);}catch{/* Storage may be unavailable; do not touch learning records. */}await self.clients.claim();})());});
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);
 if(e.request.method!=='GET'||u.origin!==self.location.origin||!allowed.has(u.pathname))return;
 const key=u.origin+u.pathname;
 e.respondWith((async()=>{
  let cache;try{cache=await caches.open(CACHE);const old=await cache.match(key);if(old)return old;}catch{}
  const response=await fetch(e.request);
  if(response.ok&&cache)try{await cache.put(key,response.clone());}catch{/* A full disk must not turn a successful download into an error. */}
  return response;
 })());
});
