// Cache static assets only. Personal learning data is never cached by the worker.
const CACHE='gre-community-shell-v1';
self.addEventListener('install',e=>{self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('gre-community-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||!u.pathname.includes('/assets/'))return;e.respondWith(caches.open(CACHE).then(async c=>{const old=await c.match(e.request);if(old)return old;const r=await fetch(e.request);if(r.ok)c.put(e.request,r.clone());return r;}));});
