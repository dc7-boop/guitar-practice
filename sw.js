// Offline support. The app shell is fetched fresh when there is a connection and
// served from the cache when there isn't; the large player libraries are cached once.
const VERSION = 'v1.0.0';
const SHELL = `shell-${VERSION}`;
const VENDOR = 'vendor-v1';

const SHELL_FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/main.js',
  'js/version.js',
  'js/store.js',
  'js/dom.js',
  'js/metronome.js',
  'js/log.js',
  'js/demo.js',
  'js/views/list.js',
  'js/views/item.js',
  'js/views/metronome.js',
  'js/views/player.js',
  'js/views/viewer.js',
  'js/views/settings.js',
  'icons/icon.svg',
  'icons/icon-192.png',
];

const VENDOR_FILES = [
  'vendor/alphatab/alphaTab.min.js',
  'vendor/alphatab/font/Bravura.woff2',
  'vendor/alphatab/soundfont/sonivox.sf2',
  'vendor/pdfjs/pdf.min.mjs',
  'vendor/pdfjs/pdf.worker.min.mjs',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)),
      caches.open(VENDOR).then((c) => c.addAll(VENDOR_FILES)),
    ]).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== VENDOR).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;

  if (url.pathname.includes('/vendor/')) {
    event.respondWith(
      caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) caches.open(VENDOR).then((c) => c.put(req, res.clone()));
        return res.clone();
      }))
    );
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html')))
  );
});
