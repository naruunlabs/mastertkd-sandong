const CACHE='personal-board-shell-20261120-2';
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('personal-board-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('fetch',event=>{
  const u=new URL(event.request.url);if(event.request.method!=='GET'||u.origin!==self.location.origin||!u.pathname.startsWith('/board/'))return;
  // Cache only the public static app shell. No private API responses or credentials.
  const isShell=event.request.mode==='navigate'||/\.(?:css|js|png|webmanifest)$/.test(u.pathname);if(!isShell)return;
  event.respondWith(fetch(event.request).then(response=>{if(response.ok&&response.type==='basic'){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}return response;}).catch(async()=>{const cached=await caches.match(event.request);if(cached)return cached;return new Response('인터넷 연결 후 다시 열어 주세요.',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});}));
});
