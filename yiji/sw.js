// 一记 PWA 离线缓存：缓存应用外壳，保证无网也能打开
const CACHE = 'yiji-v1';
const SHELL = [
  '.',
  'index.html',
  'app.js',
  'styles.css',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // 导航请求（打开页面）：缓存优先，失败回退到首页
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(() => caches.match('index.html').then((r) => r || caches.match('.')))
    );
    return;
  }
  // 静态资源：缓存优先，回退网络
  e.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      if (res && res.ok && new URL(req.url).origin === self.location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => cached))
  );
});
