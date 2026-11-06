/* Burmese Voice TTS — conservative NETWORK-FIRST service worker.
 *
 * Policy:
 * - Only a small allowlist of same-origin static assets (the Padauk
 *   webfont files, the app icons, og.png and the landing sample MP3s)
 *   is ever cached, and even those are network-first: the network copy
 *   is returned whenever it succeeds, and the cache is only a fallback
 *   for when the network fails.
 * - index.html / the app document is NEVER cached (always live).
 * - All API and Supabase traffic (cross-origin) passes straight through.
 */
const CACHE = "bvtts-static-v2";
const CACHEABLE = /(?:padauk-(?:regular|bold)\.woff2|logo-(?:192|512|180)\.png|og\.png|sample-[a-z]+\.mp3)$/;

self.addEventListener("install", () => { self.skipWaiting(); });

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;  /* API / Supabase / CDNs: pass through */
  if (!CACHEABLE.test(url.pathname)) return;        /* index.html & everything else: pass through */
  event.respondWith((async () => {
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.ok) {
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (err) {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      throw err;
    }
  })());
});
