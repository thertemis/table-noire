/* sw.js — makes Table Noire installable and keeps the app shell available.
   Same-origin GET requests only: network first (updates show up at once), cache as fallback.
   Appwrite and CDN requests are never intercepted. */
const CACHE = 'tn-shell-v37';
const SHELL = ['./', 'index.html', 'config.js', 'i18n-en.js', 'i18n.js', 'app.js', 'sw-register.js', 'fidgets.js', 'portrait.js', 'settings.js', 'online.js', 'security.js', 'sheet.js', 'inventory.js', 'world.js', 'equipment.js', 'templates.js', 'campaign.js', 'rolls.js', 'initiative.js', 'reveal.js', 'fog.js', 'gmtools.js', 'backup.js', 'comfort.js', 'search.js', 'lore.js', 'polls.js', 'identity.js', 'library.js', 'notebook.js', 'npc.js', 'images.js', 'stable.js',
  'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'assets/body-front.png', 'assets/body-back.png', 'assets/organs.png', 'assets/skull.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // cache: 'no-cache' revalidates with the server: some hosts (CDN zones) tell browsers to keep files for hours
  e.respondWith(fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
