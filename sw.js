// service worker: 全アセットをプリキャッシュし、オフラインで動かす。外部オリジンへのリクエストは扱わない。
// アセットを更新したら VERSION を上げること（古いキャッシュは activate 時に削除される）。
const VERSION = '1';
const CACHE = `un-deta-${VERSION}`;

const PRECACHE = [
  './',
  './index.html',
  './terms.html',
  './privacy.html',
  './manifest.webmanifest',
  './src/app.js',
  './src/styles.css',
  './src/lib/backup-codec.js',
  './src/lib/backup-reminder.js',
  './src/lib/date.js',
  './src/lib/heatmap.js',
  './src/lib/import-merge.js',
  './src/lib/platform.js',
  './src/lib/qr.js',
  './src/lib/records.js',
  './src/lib/storage.js',
  './src/lib/streak.js',
  './src/ui/backup-view.js',
  './src/ui/heatmap-view.js',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable.svg',
  './icons/icon.svg',
  './icons/maskable-192.png',
  './icons/maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((p) => new Request(p, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('un-deta-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // ページ遷移: キャッシュ済みの HTML を返す（クエリは無視）。なければネットワーク。
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = (await cache.match(request, { ignoreSearch: true })) ?? (await cache.match('./index.html'));
        const network = fetch(request)
          .then((res) => {
            if (res.ok && res.type === 'basic') cache.put(request, res.clone());
            return res;
          })
          .catch(() => undefined);
        return cached ?? (await network) ?? new Response('オフラインです', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }),
    );
    return;
  }

  // その他: キャッシュを即返し、裏で更新する（stale-while-revalidate）
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request, { ignoreSearch: true });
      const network = fetch(request)
        .then((res) => {
          if (res.ok && res.type === 'basic') cache.put(request, res.clone());
          return res;
        })
        .catch(() => undefined);
      if (cached) {
        event.waitUntil(network);
        return cached;
      }
      return (await network) ?? Response.error();
    }),
  );
});
