// MCQ Vault offline copy: keeps the app on this device so it opens with no internet.
// The page itself is fetched fresh when online (so updates arrive), and taken from this cache when offline.
// Calls to the Apps Script server are never cached: they go straight to the network.
const CACHE = 'mcqvault-app-v47u';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];
const LIBS = ['https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js'];
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(SHELL);
    await Promise.all(LIBS.map(u => c.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE && k.startsWith('mcqvault-app-')) await caches.delete(k);
    await self.clients.claim();
  })());
});
function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)); }
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (/(^|\.)script\.google\.com$|script\.googleusercontent\.com$/.test(url.hostname)) return;
  const page = req.mode === 'navigate' || (url.origin === location.origin && /\/(index\.html)?$/.test(url.pathname));
  if (page) {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      try {
        const r = await Promise.race([fetch(req, { cache: 'no-store' }), timeout(5000)]);
        if (r && r.ok) { c.put('./index.html', r.clone()); return r; }
        throw new Error('bad status');
      } catch (err) {
        return (await c.match('./index.html')) || (await c.match('./')) || new Response('MCQ Vault is not on this device yet. Open it once while online.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      }
    })());
    return;
  }
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(req, { ignoreSearch: url.origin === location.origin });
    if (hit) return hit;
    try {
      const r = await fetch(req);
      if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone());
      return r;
    } catch (err) { return new Response('', { status: 504 }); }
  })());
});
