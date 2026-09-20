// 更新のたびにバージョンを上げる（古いキャッシュを捨てるため）
const CACHE = "control-sumaho-v3";

const PRECACHE_URLS = [
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./assets/icon.png",
  "./assets/favicon.png",
  "./assets/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        Promise.all(PRECACHE_URLS.map((url) => cache.add(url).catch(() => {})))
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.map((k) => (k === CACHE ? Promise.resolve() : caches.delete(k))))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("./index.html")));
    return;
  }

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 同一オリジンの JS/CSS などはネットワーク優先（取れたらキャッシュも更新）、オフライン時だけキャッシュ。
  // 以前はキャッシュ優先だったため、修正版を配信しても古い app.js / styles.css が使われ続けていた。
  event.respondWith(
    // cache: "no-cache" でブラウザの HTTP キャッシュを使わずサーバーに確認させる（更新漏れ防止）
    fetch(req, { cache: "no-cache" })
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
