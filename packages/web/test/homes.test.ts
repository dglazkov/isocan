import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { HomesResponse } from "@isocan/core";
import { HOMES_ROUTE, canvasesRoute } from "@isocan/core";
import { fetchHomes, listCanvases } from "../src/lib/api.ts";
import { homeOfCanvas } from "../src/lib/homes.ts";

/**
 * **One canvas, one door — the app's half of it** (phase 10.3).
 *
 * The daemon serves the app for the canvases it is the home of and signposts
 * the rest, but that guard sits on `GET /p/<id>` and the app's own links are
 * react-router `<Link>`s: a client-side navigation that never touches the
 * server. Bypassing the guard that way would give a canvas that lives at
 * dev.isocan.io a second door on a laptop — a second badge cookie, a second
 * service worker registration, a second IndexedDB replica, stale by
 * construction. `local-bridge.md`'s worst case, *"two surfaces agreeing with
 * each other and both wrong."*
 *
 * What a browser has to prove is what a browser proves: that the list's links
 * only lead to canvases this origin hosts, and that a hand-typed `/p/<id>` for
 * a canvas that lives elsewhere renders the notice instead of the canvas. The
 * conductor drives that in Chrome. What is worth pinning WITHOUT one is the
 * part that fails silently and looks perfect while it does:
 *
 * - the list asks for the narrowed reach at all, in core's spelling — a
 *   hand-rolled `?reach=Here` or a forgotten parameter is a page that works
 *   beautifully and quietly hands out doors it does not have;
 * - "no row" reads as HERE, the same way the daemon reads it, because that is
 *   the sentence the marker has always carried and the two must not diverge;
 * - the sentence the app shows and the sentence the daemon serves at the same
 *   address are the SAME sentence — a person who reloads a refusal (and
 *   reloading is the first thing anybody does) must not be told a different
 *   story by the reload.
 */

const realFetch = globalThis.fetch;

let seen: string[];
let answer: unknown;

beforeEach(() => {
  seen = [];
  answer = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.push(`${init?.method ?? "GET"} ${String(input)}`);
    return new Response(JSON.stringify(answer), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("what the canvas list asks for", () => {
  it("asks for the canvases this origin is the home of, in core's spelling", async () => {
    answer = [{ id: "prj_acme", title: "Acme Sprint Board" }];
    await listCanvases();

    // Built by `canvasesRoute`, never spelled here or in the page: the daemon
    // narrows on ONE word, and a near-miss silently hands back the wide list
    // under a name that reads like the narrow one.
    expect(seen).toEqual([`GET ${canvasesRoute("here")}`]);
  });

  it("reads where the canvases live from the one route that can say", async () => {
    answer = { birth: null, canvases: {}, links: [] } satisfies HomesResponse;
    await fetchHomes();

    // Not `/api/health` — its `home` key is the BIRTH DEFAULT now, a fact
    // about the daemon that says nothing about the canvas in front of you.
    expect(seen).toEqual([`GET ${HOMES_ROUTE}`]);
  });
});

describe("where a canvas lives, as the app reads it", () => {
  const homes: HomesResponse = {
    birth: "https://dev.isocan.io",
    canvases: {
      prj_acme: null,
      prj_widget: "https://dev.isocan.io",
    },
    links: [{ url: "https://dev.isocan.io", reachable: true, canvases: [] }],
  };

  it("a null row is here — this daemon is that canvas's home", () => {
    expect(homeOfCanvas(homes, "prj_acme")).toBeNull();
  });

  it("a row naming an address is elsewhere, and names it", () => {
    expect(homeOfCanvas(homes, "prj_widget")).toBe("https://dev.isocan.io");
  });

  /**
   * The load-bearing one. Absent and null mean the same thing — "wherever the
   * machine reading this lives" — which is what makes the upgrade from a
   * pre-10.3 machine a no-op, and it is exactly how `registerPages` reads a
   * missing row on the server side. Reading absent as "elsewhere" here would
   * refuse every canvas on a daemon that has never had a home, which is Dion's
   * whole rig; reading it as the birth default would be the cheerful wrong
   * address in its 10.3 form.
   */
  it("no row at all is here, not the birth default", () => {
    expect(homeOfCanvas(homes, "prj_never_heard_of_it")).toBeNull();
    expect(homeOfCanvas({ birth: "https://isocan.io", canvases: {}, links: [] }, "prj_x")).toBeNull();
  });
});

/**
 * **The app and the daemon tell one story about one address.**
 *
 * Two copies of these sentences exist and neither package may import the
 * other: one is JSX in `pages/ElsewherePage.tsx`, one is a Fastify reply in
 * `server/src/http.ts`. The duplication is survivable only because something
 * fails when they drift, and this is that something. Both texts are stripped
 * of the machinery around them — JSX's explicit `{" "}`, string-concatenation
 * seams, tags — so this compares what a person READS rather than how it was
 * written, and rewrapping a line does not fail the build.
 */
describe("the reload tells the same story as the app", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const words = (file: string): string =>
    readFileSync(file, "utf8")
      .replace(/\{"\s*"\}/g, " ") // JSX's deliberate space
      .replace(/[`"]\s*\+\s*[`"]/g, "") // a sentence split across string literals
      .replace(/<[^>]*>/g, "") // tags, JSX and HTML alike
      .replace(/\s+/g, " ");

  const app = words(path.resolve(here, "../src/pages/ElsewherePage.tsx"));
  const daemon = words(path.resolve(here, "../../server/src/http.ts"));

  for (const sentence of [
    "This canvas lives at",
    "Open it there. This is a local isocan daemon: it serves ops to the isocan CLI " +
      "and to agents on this machine, and serves pages only for the canvases it is " +
      "the home of — every canvas has one door.",
  ]) {
    it(`both say “${sentence.slice(0, 40)}…”`, () => {
      expect(app).toContain(sentence);
      expect(daemon).toContain(sentence);
    });
  }
});
