/* Service Worker — Notre Nid */
const CACHE = 'notre-nid-v3';
const SHELL = ['/', '/index.html', '/manifest.json', '/icon.svg',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;600;700&display=swap'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(()=>{})));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if(e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Ne pas cacher les appels Firebase
  if(url.hostname.includes('firebase') || url.hostname.includes('googleapis.com')) return;

  e.respondWith(
    fetch(e.request)
      .then(r => {
        if(r && r.ok) {
          const clone = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return r;
      })
      .catch(() => caches.match(e.request).then(r => r || new Response('Hors ligne', {status: 503})))
  );
});

/* Push notifications (nécessite Firebase Cloud Messaging côté serveur) */
self.addEventListener('push', e => {
  const d = e.data ? e.data.json() : {};
  e.waitUntil(self.registration.showNotification(d.title || 'Notre Nid', {
    body: d.body || '',
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: d.tag || 'notre-nid',
    data: { url: '/' }
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({type:'window'}).then(cs => {
    const c = cs.find(w => w.url === '/');
    return c ? c.focus() : clients.openWindow('/');
  }));
});
