/* BTX Docs Saúde — Service Worker (offline real) */
const CACHE_NAME = "btx-docs-cache-v5";

const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./db.js",
  "./pwa.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async ()=>{
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async ()=>{
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // só controla o próprio domínio
  if (url.origin !== self.location.origin) return;

  // Navegação: devolve index offline se cair
  if (req.mode === "navigate") {
    event.respondWith((async ()=>{
      try{
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put("./index.html", fresh.clone());
        return fresh;
      }catch(e){
        const cached = await caches.match("./index.html");
        return cached || new Response("Offline", { status: 503 });
      }
    })());
    return;
  }

  // assets: cache-first, atualiza em background
  event.respondWith((async ()=>{
    const cached = await caches.match(req);
    if(cached) return cached;

    try{
      const resp = await fetch(req);
      const cache = await caches.open(CACHE_NAME);
      cache.put(req, resp.clone());
      return resp;
    }catch(e){
      // fallback básico
      return caches.match("./index.html");
    }
  })());
});
