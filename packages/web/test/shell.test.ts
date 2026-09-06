import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";

/**
 * **The cached shell, driven** — phase 10's first clause.
 *
 * This evaluates `public/sw.js` itself rather than a parallel copy of its
 * policy, which is the whole point: a policy module the service worker did not
 * actually use would be a test that proves nothing about what a browser does.
 * The worker is a classic script with no imports and no exports precisely so
 * this is possible — `new Function` gives it a `self`, a `caches` and a
 * `fetch`, and its own `addEventListener` hands back the handlers to call.
 *
 * The assertion this file exists for is the negative one: **`/api/*` is never
 * cached.** The blob route is credentialed as of phase 9 (`Cache-Control:
 * private`), and a service worker cache is a per-ORIGIN store shared by every
 * tab and persona in the browser profile — so a blob cached there would be
 * handed to a later request the door would have refused, with the caching
 * layer never asking. That is the back gate phase 9 spent a stage closing, and
 * an optimization is exactly how it would be reopened.
 */

const SW = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../public/sw.js",
);

interface Harness {
  install: () => Promise<unknown>;
  activate: () => Promise<unknown>;
  /** Ask the worker for a request. Returns the response it produced, or the
   * string "passed" when it declined to handle it at all — which is what
   * "never cached" looks like from the outside. */
  fetch: (
    url: string,
    init?: { method?: string; mode?: string },
  ) => Promise<{ body: string; from: string } | "passed">;
  /** Every key in the cache, so a test can assert what is NOT in there. */
  cached: () => string[];
  /** Flip the network off. */
  offline: () => void;
  online: () => void;
  /** What the (fake) network was asked for. */
  requests: string[];
}

/** The bytes on the wire for a URL, and where they came from. */
const origin = "https://isocan.io";

/** What the daemon actually serves at `/`, trimmed: a hashed module and a
 * hashed stylesheet. The install-time precache derives its manifest from this
 * and nothing else, which is why the test's copy has to look like the real
 * one. */
const SHELL_HTML = `<!doctype html><html><head>
  <script type="module" crossorigin src="/assets/index-_NQH5FWZ.js"></script>
  <link rel="stylesheet" crossorigin href="/assets/index-D2wqCYKm.css">
</head><body><div id="root"></div></body></html>`;

function load(startOffline = false, shellHtml: string = SHELL_HTML): Harness {
  const source = readFileSync(SW, "utf8");
  const handlers = new Map<string, (event: any) => void>();
  const cache = new Map<string, { body: string; from: string }>();
  const requests: string[] = [];
  let up = !startOffline;

  // A real Cache keys on the absolute request URL, so a relative `put` and an
  // absolute `match` for the same file are a hit. Getting this wrong in the
  // fake would have made the precache look broken when it is not.
  const key = (request: any) =>
    new URL(typeof request === "string" ? request : request.url, origin).href;

  const keys = new Set<string>();
  const cacheApi = {
    open: async (name: string) => {
      keys.add(name);
      return {
        put: async (request: any, response: any) => {
          cache.set(key(request), { body: response.body, from: "cache" });
        },
        add: async (url: string) => {
          const response = await self.fetch(url);
          cache.set(key(url), { body: response.body, from: "cache" });
        },
        // `sweep` walks the entries and removes what this build does not name,
        // so the fake has to hold entries the way a real Cache does: as
        // Requests with absolute URLs.
        keys: async () => [...cache.keys()].map((url) => ({ url })),
        delete: async (request: any) => cache.delete(key(request)),
        match: async (request: any) => {
          const found = cache.get(key(request));
          return found ? { ...found, ok: true, clone: () => found, text: async () => found.body } : undefined;
        },
      };
    },
    match: async (request: any) => {
      const found = cache.get(key(request));
      return found ? { ...found, ok: true, clone: () => found } : undefined;
    },
    keys: async () => [...keys],
    // Deleting a cache BY NAME takes its contents with it — which is the whole
    // mechanism a version bump relies on, so a fake that only forgot the name
    // would make the bump look like it worked when it had not.
    delete: async (name: string) => {
      if (!keys.delete(name)) return false;
      cache.clear();
      return true;
    },
  };

  const self: any = {
    location: { origin },
    addEventListener: (name: string, fn: (event: any) => void) => handlers.set(name, fn),
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
    caches: cacheApi,
    fetch: async (request: any) => {
      const url = typeof request === "string" ? request : request.url;
      requests.push(url);
      if (!up) throw new TypeError("Failed to fetch");
      // The real index.html names its own hashed assets; the install-time
      // precache reads them out of exactly this markup.
      const body =
        url === "/index.html" || url.endsWith("/index.html")
          ? shellHtml
          : `network:${url}`;
      return {
        ok: true,
        body,
        from: "network",
        text: async () => body,
        clone() {
          const copy = { body: this.body, from: "network", text: async () => body, clone: () => copy };
          return copy;
        },
      };
    },
  };

  // The worker's globals are its `self`, so give it both spellings — a real
  // ServiceWorkerGlobalScope is `self` AND the global object.
  new Function("self", "caches", "fetch", source)(self, cacheApi, self.fetch);

  const run = async (name: string) => {
    let waited: unknown;
    handlers.get(name)?.({ waitUntil: (promise: unknown) => (waited = promise) });
    return waited;
  };

  return {
    install: () => run("install"),
    activate: () => run("activate"),
    cached: () => [...cache.keys()],
    offline: () => void (up = false),
    online: () => void (up = true),
    requests,
    fetch: async (url, init) => {
      const request = { url, method: init?.method ?? "GET", mode: init?.mode ?? "no-cors" };
      let answer: Promise<any> | null = null;
      handlers.get("fetch")?.({
        request,
        respondWith: (promise: Promise<any>) => {
          answer = promise;
        },
      });
      // No `respondWith` is the "pass" verdict: the worker declined and the
      // browser does what it always did — which for /api/ is the whole point.
      if (answer === null) return "passed";
      const response = await (answer as Promise<any>);
      return { body: response.body, from: response.from };
    },
  };
}

let sw: Harness;

beforeEach(async () => {
  sw = load();
  await sw.install();
  await sw.activate();
});

describe("what the shell must never touch", () => {
  it("passes every /api/ request straight through, uncached", async () => {
    const routes = [
      "/api/ops",
      "/api/projects",
      "/api/projects/prj_1/canvas",
      "/api/colors",
      "/api/attest",
    ];
    const before = sw.cached().sort();
    for (const route of routes) {
      expect(await sw.fetch(`${origin}${route}`)).toBe("passed");
    }
    // Not one key more than the install-time shell: nothing under /api/ has
    // been written, however many times it was asked for.
    expect(sw.cached().sort()).toEqual(before);
  });

  it("passes the BLOB route, which phase 9 made credentialed", async () => {
    // `Cache-Control: private` on a per-badge answer, into a per-origin store
    // shared by every persona in the profile. The cache would never ask the
    // door, and the door is the only thing that knows.
    const blob = `${origin}/api/projects/prj_1/blobs/9f2c`;
    const before = sw.cached().sort();
    expect(await sw.fetch(blob)).toBe("passed");
    expect(await sw.fetch(blob)).toBe("passed"); // and not on the second ask either
    expect(sw.cached().sort()).toEqual(before);
  });

  it("leaves writes alone", async () => {
    expect(await sw.fetch(`${origin}/p/prj_1`, { method: "POST" })).toBe("passed");
    expect(await sw.fetch(`${origin}/assets/index-abc.js`, { method: "POST" })).toBe("passed");
  });

  it("leaves other origins alone", async () => {
    const before = sw.cached().sort();
    expect(await sw.fetch("https://example.test/thing.js")).toBe("passed");
    expect(sw.cached().sort()).toEqual(before);
  });
});

describe("the cache is bounded by one build", () => {
  /**
   * **The bug this is here for, found on a real machine on 6 September 2026.**
   *
   * A tab sat on "connecting" and froze, and `navigator.storage.estimate()`
   * said 59MB under `caches` against 7.5MB of actual canvas data. Clearing the
   * cache by hand fixed it immediately.
   *
   * The cause was two true sentences that never met: `activate` deletes every
   * cache whose NAME is not the current one, and the name is a constant. So
   * nothing was ever deleted, while `assetFirst` added every content-hashed
   * chunk of every deploy. The cache grew by roughly one build per deploy for
   * as long as the browser profile lived.
   */
  it("drops the previous build's assets when a new one activates", async () => {
    const first = load();
    await first.install();
    await first.activate();
    expect(first.cached().sort()).toEqual([
      `${origin}/assets/index-D2wqCYKm.css`,
      `${origin}/assets/index-_NQH5FWZ.js`,
      `${origin}/index.html`,
    ]);

    // A lazily-imported chunk, cached at runtime the way `assetFirst` does —
    // named by no markup, which is exactly why it used to survive forever.
    await first.fetch(`${origin}/assets/StageEditor-OLD1111.js`);
    expect(first.cached()).toContain(`${origin}/assets/StageEditor-OLD1111.js`);

    // Now deploy: the shell names different hashes.
    const NEXT_HTML = SHELL_HTML.replace("index-_NQH5FWZ.js", "index-NEW2222.js").replace(
      "index-D2wqCYKm.css",
      "index-NEW3333.css",
    );
    const next = load(false, NEXT_HTML);
    await next.install();
    await next.activate();

    const after = next.cached().sort();
    expect(after).toContain(`${origin}/assets/index-NEW2222.js`);
    expect(after).toContain(`${origin}/assets/index-NEW3333.css`);
    // The point: last build's eager assets AND its lazy chunk are gone, rather
    // than sitting there until the profile is deleted.
    expect(after).not.toContain(`${origin}/assets/index-_NQH5FWZ.js`);
    expect(after).not.toContain(`${origin}/assets/index-D2wqCYKm.css`);
    expect(after).not.toContain(`${origin}/assets/StageEditor-OLD1111.js`);
  });

  it("keeps the shell itself, which is not an asset and is how offline works", async () => {
    await sw.fetch(`${origin}/assets/lazy-AAA111.js`);
    await sw.activate();
    // The sweep is about /assets/ only: sweeping the shell would take the
    // offline story with it.
    expect(sw.cached()).toContain(`${origin}/index.html`);
    expect(sw.cached()).not.toContain(`${origin}/assets/lazy-AAA111.js`);
  });

  it("names a cache the previous version does not, so an old one is disowned", () => {
    const source = readFileSync(SW, "utf8");
    // The bump IS the migration for everybody already carrying the leaked
    // cache: they delete it on their next visit, with nothing to do by hand.
    expect(source).toContain('const CACHE = "isocan-shell-v2"');
    expect(source).not.toContain('"isocan-shell-v1"');
  });
});

describe("the app loads with no network", () => {
  /**
   * **The regression a real browser caught, and no unit test would have.**
   *
   * This started as runtime-caching only: cache what the page asks for, and
   * offline works from the second visit. Driving Chrome killed it — a service
   * worker does not control the page load that registers it, and this SPA
   * routes client-side, so the worker saw no navigation at all on the first
   * visit. Stopping the daemon after one visit produced Chrome's dinosaur.
   * The manifest is now read out of the shell at install time, which is why
   * this test asserts the cache is warm before ANY page has been fetched
   * through the worker.
   */
  it("is offline-ready from the first visit, having read the shell's own manifest", async () => {
    expect(sw.cached().sort()).toEqual([
      `${origin}/assets/index-D2wqCYKm.css`,
      `${origin}/assets/index-_NQH5FWZ.js`,
      `${origin}/index.html`,
    ]);
    sw.offline();
    const cold = await sw.fetch(`${origin}/p/prj_1`, { mode: "navigate" });
    expect((cold as { from: string }).from).toBe("cache");
    expect((await sw.fetch(`${origin}/assets/index-_NQH5FWZ.js`)) as { from: string }).toMatchObject(
      { from: "cache" },
    );
  });

  it("serves the shell from cache once it has seen it online", async () => {
    const navigate = { mode: "navigate" as const };
    const live = await sw.fetch(`${origin}/p/prj_1`, navigate);
    expect(live).not.toBe("passed");
    expect((live as { from: string }).from).toBe("network");

    sw.offline();
    // A DIFFERENT canvas's address, which this browser has never navigated to
    // — every route in this SPA is served the same index.html, so the shell is
    // cached under one key and answers all of them.
    const offline = await sw.fetch(`${origin}/p/prj_other`, navigate);
    expect(offline).not.toBe("passed");
    expect((offline as { from: string }).from).toBe("cache");
  });

  it("serves hashed assets from cache without asking the network twice", async () => {
    const asset = `${origin}/assets/index-7PNG8ZF_.js`;
    await sw.fetch(asset);
    const asked = sw.requests.length;
    const again = await sw.fetch(asset);
    // Content-hashed: a hit is correct by construction, so a second round trip
    // would be a round trip for bytes that cannot have changed.
    expect(sw.requests.length).toBe(asked);
    expect((again as { from: string }).from).toBe("cache");
  });

  it("prefers the network for a navigation, so a deploy is picked up next load", async () => {
    const navigate = { mode: "navigate" as const };
    await sw.fetch(`${origin}/`, navigate);
    const asked = sw.requests.length;
    const second = await sw.fetch(`${origin}/`, navigate);
    // Cache-first here would pin a tab to the build it first saw, and would
    // also make `lib/appversion.ts` compare a cached page against itself
    // forever — an update banner that could never appear.
    expect(sw.requests.length).toBe(asked + 1);
    expect((second as { from: string }).from).toBe("network");
  });

  it("still fails honestly when it has nothing cached", async () => {
    // Installed with no network at all: the precache got nothing, and the
    // install did not fail for it. An app that refused to start because it
    // could not get ahead on caching would be worse than one that is simply
    // not offline-ready yet.
    const cold = load(true);
    await cold.install();
    await cold.activate();
    expect(cold.cached()).toEqual([]);
    await expect(cold.fetch(`${origin}/p/prj_1`, { mode: "navigate" })).rejects.toBeInstanceOf(
      TypeError,
    );
  });
});
