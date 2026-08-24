/**
 * **The cached shell** — phase 10's first clause, and the journey's rule 6:
 * *"offline in the browser is the service worker's job — cached shell, durable
 * browser replica, queued ops."* This file is the shell. The replica is
 * `src/lib/replica.ts` and the queue is `src/lib/writequeue.ts`; between them
 * a tab that loses the network keeps working.
 *
 * **Hand-written, and no plugin.** The argument for a plugin
 * (`vite-plugin-pwa` and friends) is a precomputed precache manifest — every
 * hashed asset listed at build time and fetched on install. The argument
 * against is the root `package.json`'s long comment: this repo duplicates the
 * CLI's runtime deps so that `npm i -g github:dglazkov/isocan#release`
 * resolves (#47), the install is a measured 81 packages and 18.6 MiB, and a
 * dependency here is never just a dependency — it is a build-time surface, a
 * generated file in `dist`, and a thing that goes stale between the day it is
 * added and the day somebody reads it.
 *
 * **So the manifest is computed at install time, from the shell itself**, and
 * this is not the runtime-caching-only design it started as. That one WAS
 * tried, and driving a real browser is what killed it: a service worker does
 * not control the page load that registers it, and this SPA does all its
 * routing client-side — so the second visit is the first navigation the worker
 * ever sees, and until then it has neither the shell nor the bundle. Stopping
 * the daemon after a first visit produced Chrome's dinosaur, which is the
 * failure this file exists to prevent. `precache()` below fixes it without
 * buying a build step: fetch `/index.html`, cache it, read the `/assets/…`
 * URLs it names out of the markup it already contains, and cache those. The
 * shell names its own assets, so the list is always exactly this build's, and
 * a browser is offline-ready from its first visit rather than its second.
 *
 * **A classic script, not a module.** `importScripts`-free and `import`-free
 * so it registers everywhere without `{ type: "module" }`, and so
 * `test/shell.test.ts` can evaluate this exact file and drive its handlers.
 * Testing the shipped artifact rather than a parallel copy of its policy is
 * the point: a policy module the service worker did not actually use would be
 * a test that proves nothing about what a browser does.
 *
 * ---
 *
 * **What must never be cached, in one place, because getting it wrong reopens
 * a door phase 9 closed.**
 *
 * `/api/*` is not a page. Nothing under it is cached, ever, and the check is
 * the first thing that happens on every request:
 *
 * - **The blob route is credentialed as of phase 9** — it answers with
 *   `Cache-Control: private` because who may read a canvas's files is a
 *   question the door answers per badge. A service worker cache is a
 *   per-ORIGIN store shared by every tab and every persona in the browser
 *   profile; a blob cached there would be served to a later request that the
 *   door would have refused, and the caching layer would never ask. That is
 *   the back gate phase 9 spent a stage closing, reopened by an optimization.
 * - **`/api/ops` is a mutation.** A cached POST is meaningless; a cached
 *   *response* to one is a lie about a write.
 * - **Everything else under `/api/`** is a live answer about a canvas, a
 *   roster, or a desk. Serving yesterday's is worse than serving none.
 *
 * The blob route also carries the only bytes here big enough to matter to a
 * quota, which is a second, weaker reason pointing the same way.
 */

/**
 * Bumped when the shape of what is cached changes — never for content, which
 * is hashed into its own filename by Vite. Old caches are deleted on activate,
 * so a bump is also how a bad cache is disowned.
 */
const CACHE = "isocan-shell-v1";

/** The app shell, under one key regardless of which route was navigated to.
 * Every path in this SPA is served the same `index.html`, so caching it per
 * URL would be N copies of one file and a miss for the one route a person
 * happens to reload on. */
const SHELL = "/index.html";

/**
 * What to do with a request. The whole policy, as one pure function, so the
 * test can ask it directly and a reader can check it against the paragraphs
 * above without following a promise chain.
 *
 * - `"pass"` — not ours. Go to the network and never touch the cache.
 * - `"shell"` — a navigation. Network first, and the cached shell when the
 *   network is gone. Network FIRST rather than cache-first because a deploy
 *   must be picked up on the next load rather than on the load after that,
 *   and because `lib/appversion.ts` compares the running bundle against the
 *   served one and would compare a cached page against itself forever.
 * - `"asset"` — a content-hashed build artifact. Cache first: the filename
 *   changes when the bytes do, so a hit is always correct and always current,
 *   and this is what makes an offline load fast rather than merely possible.
 * - `"try"` — anything else same-origin and GET (a favicon, a font). Network
 *   first, fall back to whatever was cached.
 */
function routeFor(request, url) {
  if (request.method !== "GET") return "pass";
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return "pass";
  }
  if (parsed.origin !== self.location.origin) return "pass";
  // First, and deliberately before every other test. See the comment above.
  if (parsed.pathname === "/api" || parsed.pathname.startsWith("/api/")) return "pass";
  if (request.mode === "navigate") return "shell";
  if (parsed.pathname.startsWith("/assets/")) return "asset";
  return "try";
}

self.addEventListener("install", (event) => {
  // Take over as soon as this build is installed rather than waiting for every
  // tab holding the previous one to close. Safe because the caches are keyed by
  // build (`CACHE`) and the assets by content hash, and because the app already
  // knows how to notice it is running an old bundle.
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

/**
 * Everything needed to draw this app with no network, fetched once, at install.
 *
 * The manifest is READ OUT OF THE SHELL rather than generated by a build step:
 * `index.html` names the bundle and the stylesheet it needs, with the content
 * hashes Vite gave them, so parsing the markup for `/assets/…` yields exactly
 * this build's assets and nothing else. Two regexes and no dependency.
 *
 * Best-effort throughout. A failure here must not fail the install — an app
 * that would not start because it could not get ahead on caching would be a
 * worse app than one that is simply not offline-ready yet, and the runtime
 * handlers below fill the cache anyway on the next successful load.
 */
async function precache() {
  try {
    const response = await fetch(SHELL, { cache: "no-store" });
    if (!response || !response.ok) return;
    const html = await response.clone().text();
    const cache = await caches.open(CACHE);
    await cache.put(SHELL, response);
    const assets = new Set();
    for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) assets.add(match[1]);
    await Promise.all([...assets].map((url) => cache.add(url).catch(() => {})));
  } catch {
    // No network at install time. Nothing is cached, and nothing is broken.
  }
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const route = routeFor(event.request, event.request.url);
  if (route === "pass") return; // untouched: the browser does what it always did
  if (route === "shell") return event.respondWith(shellFirst(event.request));
  if (route === "asset") return event.respondWith(assetFirst(event.request));
  event.respondWith(networkFirst(event.request));
});

/**
 * A navigation: the live page when there is a network, the last one we saw
 * when there is not.
 *
 * **What a cached shell costs, said out loud:** the daemon badges a browser on
 * the PAGE LOAD (`http.ts`'s SPA fallback mints a cookie badge when a request
 * arrives without one), and a page served from this cache reaches the tab with
 * no `Set-Cookie` on it. That is not a new hole — the badge cookie is durable
 * and survives reloads — and the recovery already exists and is exercised: a
 * request that comes back 401 goes to the door and replays (`lib/api.ts`'s
 * `knockOnDoor`). So the visible consequence of a cold cached load with no
 * badge is one 401 in the network log and a door call, which is precisely what
 * that path was built for.
 */
async function shellFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE);
      await cache.put(SHELL, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(SHELL);
    if (cached) return cached;
    throw err;
  }
}

/** A hashed asset: if we have it, it is the right bytes by construction. */
async function assetFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

/** Everything else same-origin: fresh when we can, remembered when we cannot. */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw err;
  }
}
