import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { blobUrl } from "../src/lib/api.ts";
import {
  adoptContentBase,
  contentBase,
  contentOrigin,
  ensureTickets,
} from "../src/lib/contentBase.ts";
import { itemFrame } from "../src/lib/frame.ts";

/**
 * The content-origin plan's invariants 1 and 2 as tests
 * (`docs/projects/atlas/content-origin-plan.md`), written before any base
 * existed so that every stage since has changed code and not contracts —
 * including stage 4b's signed reads, which added a third answer (`null`,
 * "not minted yet") without moving where the sandbox grant comes from.
 */

const unsigned = (base: string) => ({ base, ticket: null });

describe("invariant 2: the sandbox upgrade is keyed to the split, never to a flag", () => {
  it("no content origin → exactly today's frame, byte for byte", () => {
    const frame = itemFrame(null, "prj_1", "blob_abc");
    expect(frame?.src).toBe(blobUrl("prj_1", "blob_abc"));
    expect(frame?.sandbox).toBe("allow-scripts");
  });

  it("a content origin → src moves origin AND the grant arrives, together", () => {
    for (const base of ["http://127.0.0.1:4442", "https://isocan.store"]) {
      const frame = itemFrame(unsigned(base), "prj_1", "blob_abc");
      expect(frame?.src).toBe(`${base}${blobUrl("prj_1", "blob_abc")}`);
      expect(frame?.sandbox).toBe("allow-scripts allow-same-origin");
    }
  });

  it("a signed origin → the ticket's path, on the content base", () => {
    const signed = {
      base: "https://isocan.store",
      ticket: () => "/api/projects/prj_1/blobs/blob_abc?exp=99&sig=zzz",
    };
    const frame = itemFrame(signed, "prj_1", "blob_abc");
    expect(frame?.src).toBe("https://isocan.store/api/projects/prj_1/blobs/blob_abc?exp=99&sig=zzz");
    expect(frame?.sandbox).toBe("allow-scripts allow-same-origin");
  });

  it("a ticket that has not landed is NOTHING, never an app-origin frame", () => {
    // The one way stage 4b could have broken invariant 2: falling back to the
    // app origin while a signature is in flight would pair an app-origin src
    // with the grant the split exists to make safe. It answers null instead.
    const pending = { base: "https://isocan.store", ticket: () => null };
    expect(itemFrame(pending, "prj_1", "blob_abc")).toBe(null);
  });

  it("the pair app-origin src + allow-same-origin is unbuildable", () => {
    // The property itself, across every input shape: allow-same-origin
    // appears exactly when the src is an absolute URL on another origin.
    // A same-origin path NEVER carries the grant — that pair is the
    // whole-home compromise the content-origin proposal opens with.
    const origins = [
      null,
      unsigned("http://127.0.0.1:4442"),
      unsigned("https://isocan.store"),
      { base: "https://isocan.store", ticket: () => "/api/projects/p/blobs/b?exp=1&sig=s" },
      { base: "https://isocan.store", ticket: () => null },
    ];
    for (const origin of origins) {
      const frame = itemFrame(origin, "prj_1", "blob_abc");
      if (frame === null) continue; // nothing rendered is nothing granted
      const crossOrigin = frame.src.startsWith("http");
      expect(frame.sandbox.includes("allow-same-origin")).toBe(crossOrigin);
    }
  });

  it("ItemView builds its html frame through itemFrame — the one builder", () => {
    const source = readFileSync(
      new URL("../src/components/ItemView.tsx", import.meta.url),
      "utf8",
    );
    // Through `useFrameSrc`, which is `itemFrame` plus "a loaded frame keeps
    // the src it loaded with" — still one builder deciding the pair.
    expect(source).toContain("useFrameSrc(origin, canvasId, blobHash)");
    // The old hand-paired frame must not come back: an html-view src with a
    // literal sandbox is a second place deciding the pair.
    expect(source).not.toMatch(/className="html-view"\s+src=\{url\}\s+sandbox="/);
    // And nothing outside frame.ts may write the grant by hand.
    expect(source).not.toContain('sandbox="allow-scripts allow-same-origin"');
  });
});

describe("stage 2: the tab learns the base at boot", () => {
  it("main.tsx asks beside the color and name loads, fire-and-forget", () => {
    const source = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");
    expect(source).toContain("void loadContentBase()");
  });
});

describe("invariant 1: unconfigured means today", () => {
  it("the tab starts with no content base, and adopt is reversible", () => {
    // Module state starts null — nothing sets it until stage 2's boot fetch —
    // and null is the fallback for a failed or absent advertisement too, so
    // clearing must restore today's behavior exactly.
    expect(contentBase()).toBe(null);
    adoptContentBase("http://127.0.0.1:4442");
    expect(contentBase()).toBe("http://127.0.0.1:4442");
    adoptContentBase(null);
    expect(contentBase()).toBe(null);
    expect(itemFrame(contentOrigin(), "prj_1", "b")?.sandbox).toBe("allow-scripts");
  });
});

describe("stage 4b: the tab asks for a signature only where one is wanted", () => {
  it("a local base asks for no ticket at all", () => {
    adoptContentBase("http://127.0.0.1:4442");
    expect(contentOrigin()).toEqual({ base: "http://127.0.0.1:4442", ticket: null });
    adoptContentBase(null);
  });

  it("a signing base has a ticket function, and it answers null until one lands", () => {
    adoptContentBase("https://isocan.store", true);
    const origin = contentOrigin();
    expect(origin?.base).toBe("https://isocan.store");
    expect(typeof origin?.ticket).toBe("function");
    // Nothing minted: the frame is not built rather than being built wrong.
    expect(origin?.ticket?.("prj_1", "blob_abc")).toBe(null);
    expect(itemFrame(origin, "prj_1", "blob_abc")).toBe(null);
    adoptContentBase(null);
  });

  it("signing is only ever true alongside a base", () => {
    // A tab that read `contentSigned` off an answer with no base must not end
    // up in a state where it would sign nothing and frame everything.
    adoptContentBase(null, true);
    expect(contentOrigin()).toBe(null);
  });
});

describe("stage 4b: the tickets", () => {
  afterEach(() => {
    adoptContentBase(null); // also clears the cache
    vi.unstubAllGlobals();
  });

  /** The home's answer, with a deliberately WRONG `expiresAt` — see below. */
  const home = (urls: Record<string, string>, expiresAt: number, ttlSeconds = 300) => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url);
        return { ok: true, status: 200, json: async () => ({ urls, expiresAt, ttlSeconds }) };
      }),
    );
    return calls;
  };

  it("mints every hash in ONE call, and the paths reach itemFrame", async () => {
    // The batching is what made five minutes affordable: the mint cost is one
    // round trip per canvas visit, not one per frame. If this ever becomes a
    // call per hash, the TTL decision should be re-argued.
    adoptContentBase("https://isocan.store", true);
    const calls = home(
      { a: "/api/projects/prj_1/blobs/a?exp=1&sig=sa", b: "/api/projects/prj_1/blobs/b?exp=1&sig=sb" },
      Math.floor(Date.now() / 1000) + 300,
    );
    await ensureTickets("prj_1", ["a", "b", "a"]);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("hashes=a,b");
    expect(itemFrame(contentOrigin(), "prj_1", "a")?.src).toBe(
      "https://isocan.store/api/projects/prj_1/blobs/a?exp=1&sig=sa",
    );
    // Asking again is free: a live ticket is not re-minted.
    await ensureTickets("prj_1", ["a", "b"]);
    expect(calls).toHaveLength(1);
  });

  it("measures a ticket's life from RECEIPT, so a skewed tab still renders", async () => {
    // The failure this prevents: a tab whose clock runs an hour slow reads
    // `expiresAt` as an hour away, hands the frame a URL the home has already
    // buried, and shows a blank card with nothing left to re-render it. The
    // duration is the fact to trust; the timestamp is the home's clock.
    adoptContentBase("https://isocan.store", true);
    home({ a: "/api/projects/prj_1/blobs/a?exp=1&sig=sa" }, /* long past */ 1_000, 300);
    await ensureTickets("prj_1", ["a"]);
    expect(itemFrame(contentOrigin(), "prj_1", "a")).not.toBe(null);
  });

  it("a ticket inside the renewal margin is still SERVED — it is only re-minted", async () => {
    // **The white-screen bug, as a test** (6 Sep 2026). `ticket()` used to
    // answer null for anything inside the renewal margin, so four and a half
    // minutes after a canvas loaded every mounted frame went blank and STAYED
    // blank: the effect that would re-mint has stable deps, so nothing asked
    // again until the person clicked an item and remounted it.
    //
    // A ticket the home would still accept must still be handed over. Being
    // inside the margin means "worth replacing", never "unusable".
    adoptContentBase("https://isocan.store", true);
    home({ a: "/api/projects/prj_1/blobs/a?exp=1&sig=sa" }, Math.floor(Date.now() / 1000) + 5, 5);
    await ensureTickets("prj_1", ["a"]);
    expect(itemFrame(contentOrigin(), "prj_1", "a")?.src).toBe(
      "https://isocan.store/api/projects/prj_1/blobs/a?exp=1&sig=sa",
    );
  });

  it("a ticket that has actually expired is gone, and nothing is rendered", async () => {
    // The other side of the same line: past `exp` the home refuses, so a
    // frame pointed at it would show its own error page. Null is honest.
    adoptContentBase("https://isocan.store", true);
    home({ a: "/api/projects/prj_1/blobs/a?exp=1&sig=sa" }, 1, -5);
    await ensureTickets("prj_1", ["a"]);
    expect(itemFrame(contentOrigin(), "prj_1", "a")).toBe(null);
  });

  it("collapses one call per screen into one call per tick", async () => {
    // **Every item on the canvas is its own component asking for its own
    // hash** — `ItemView` renders an `HtmlItemView` per screen. So forty
    // screens made forty round trips, which quietly falsified the decision
    // doc's argument for a five-minute TTL ("one batched call per canvas
    // visit"). Sibling effects run in one commit, so collecting on a
    // microtask turns them back into one.
    adoptContentBase("https://isocan.store", true);
    const urls = Object.fromEntries(
      ["a", "b", "c", "d"].map((h) => [h, `/api/projects/prj_1/blobs/${h}?exp=9999999999&sig=s${h}`]),
    );
    const calls = home(urls, 9999999999);
    // Four components mounting in the same commit, each asking for its own.
    await Promise.all([
      ensureTickets("prj_1", ["a"]),
      ensureTickets("prj_1", ["b"]),
      ensureTickets("prj_1", ["c"]),
      ensureTickets("prj_1", ["d"]),
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("hashes=a,b,c,d");
    for (const h of ["a", "b", "c", "d"]) {
      expect(itemFrame(contentOrigin(), "prj_1", h)?.src).toContain(`sig=s${h}`);
    }
  });

  it("mints nothing on a home that serves item content unsigned", async () => {
    adoptContentBase("http://127.0.0.1:4442");
    const calls = home({}, 0);
    await ensureTickets("prj_1", ["a"]);
    expect(calls).toHaveLength(0);
    // And the frame is built without one, as it has been since stage 2.
    expect(itemFrame(contentOrigin(), "prj_1", "a")?.src).toBe(
      `http://127.0.0.1:4442${blobUrl("prj_1", "a")}`,
    );
  });
});
