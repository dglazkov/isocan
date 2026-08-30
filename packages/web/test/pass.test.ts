import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  DOOR_ROUTE,
  formatBadgeToken,
  INSTALL_SPEC,
  PASS_EXPIRED,
  PASS_REDEEM_ROUTE,
  PASS_SPENT,
  PASS_UNKNOWN,
  passesRoute,
  localAgentInstructions,
  type MintPassResponse,
} from "@isocan/core";
import { startDaemon, type Daemon } from "@isocan/server";
import { mintTestBadge, type TestBadge } from "./badge.ts";
import { beginArrival, reloadOnLatePass } from "../src/lib/arrival.ts";
import { ApiError, mintPass } from "../src/lib/api.ts";
import { enterAs, knownIdentities, readIdentity } from "../src/lib/identity.ts";

/**
 * **Scene 5, from the browser's two ends** (phase 8).
 *
 * The minting end is the "Bring your own agent…" dialog: an admitted tab
 * asks for a pass that names this canvas and this person's actor. The
 * redeeming end is a tab that arrives on `…/p/<id>#<pass>` — `isocan open`'s
 * doing — and has to come up ALREADY BEING that person.
 *
 * What is worth a test without a browser is everything that would otherwise
 * fail silently: that the pass really carries the identity onto the arriving
 * badge (not merely into localStorage, which would be a tab that believes it
 * is somebody the home has never heard of), that the fragment leaves the
 * address bar so a reload cannot re-spend a spent pass, and that each of the
 * three refusals produces copy a person can act on. The dialog itself — the
 * menu entry, the copy button, the command on screen — is driven in Chrome,
 * and the report says what was seen.
 *
 * The daemon is real, as in `identity.test.ts`: passes are desk state, and a
 * stubbed desk would be a test of the stub.
 */

const jordan = { id: "usr_jordan", name: "Jordan" };

/** localStorage, in memory — the identity module reads it lazily. */
function stubStorage(): void {
  const map = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
}

/**
 * An address bar, and the one history call `beginArrival` makes on it. The
 * fragment really does move: `strip()` rewrites the URL, and a test that let
 * `location` be a constant could not see the difference between stripping and
 * pretending to.
 */
function stubAddressBar(href: string): {
  href: () => string;
  reloads: () => number;
  setHash: (hash: string) => void;
} {
  const url = new URL(href);
  let reloads = 0;
  const location = {
    reload: () => {
      reloads += 1;
    },
    get href() {
      return url.href;
    },
    get origin() {
      return url.origin;
    },
    get pathname() {
      return url.pathname;
    },
    get search() {
      return url.search;
    },
    get hash() {
      return url.hash;
    },
  };
  (globalThis as Record<string, unknown>).location = location;
  (globalThis as Record<string, unknown>).history = {
    replaceState: (_state: unknown, _title: string, next: string) => {
      const replaced = new URL(next, url.origin);
      url.pathname = replaced.pathname;
      url.search = replaced.search;
      url.hash = replaced.hash;
    },
  };
  return {
    href: () => url.href,
    reloads: () => reloads,
    setHash: (hash: string) => {
      url.hash = hash;
    },
  };
}

let home: string;
let daemon: Daemon;
let base: string;
/** The tab that already stands on the canvas — Jordan's, in the journey. It
 * mints; it is never the one that redeems. */
let tab: TestBadge;
/** The badge of the browser under test: a different holder, which is the
 * entire point of a handoff. */
let auth: Record<string, string>;
const realFetch = globalThis.fetch;

/** The app fetches same-origin ("/api/…"); in node the daemon is the origin,
 * and node's fetch has no cookie jar, so the browser's badge rides as a
 * bearer. Both carriers are accepted from anyone. */
function speakAsBrowser(): void {
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    realFetch(typeof input === "string" && input.startsWith("/") ? `${base}${input}` : input, {
      ...init,
      headers: { ...(init?.headers as Record<string, string>), ...auth },
    })) as typeof fetch;
}

beforeEach(async () => {
  stubStorage();
  stubAddressBar("http://localhost:5173/");
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-web-pass-"));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;

  const door = await realFetch(`${base}${DOOR_ROUTE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ carrier: "bearer" }),
  });
  const { badgeId, secret } = (await door.json()) as { badgeId: string; secret: string };
  auth = { Authorization: `Bearer ${formatBadgeToken(badgeId, secret)}` };

  // Jordan's tab: it claims her, and it creates the canvas — which is what
  // admits it (bootstrap provenance), so it may mint.
  tab = await mintTestBadge(base);
  await tab.speakAs(jordan);
  await asTab({ type: "project.create", canvasId: "prj_acme", title: "Acme Sprint Board" }, null);
  speakAsBrowser();
});

afterEach(async () => {
  globalThis.fetch = realFetch;
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true });
});

/** An op written by the minting tab, as Jordan. */
async function asTab(op: unknown, canvasId: string | null = "prj_acme"): Promise<Response> {
  return realFetch(`${base}/api/ops`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...tab.headers },
    body: JSON.stringify({ canvasId, actor: jordan, op }),
  });
}

/** What the dialog's mint call produces, minted by the OTHER tab — the shape
 * a person actually copies. */
async function passFromTheTab(actorId: string | null = jordan.id): Promise<MintPassResponse> {
  const res = await realFetch(`${base}${passesRoute("prj_acme")}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...tab.headers },
    body: JSON.stringify(actorId ? { actorId } : {}),
  });
  if (!res.ok) throw new Error(`mint refused: ${await res.text()}`);
  return (await res.json()) as MintPassResponse;
}

describe("minting one from the dialog", () => {
  it("asks core's route, endows this person's actor, and builds the command core builds", async () => {
    // This time the browser under test is the one doing the MINTING: an
    // admitted tab, standing on the canvas it is about to escalate from. It
    // names itself and opens the canvas, which is what admits it — the
    // standing link grant every canvas is born with.
    await enterAs("Priya");
    const me = readIdentity()!;
    await realFetch(`${base}/api/projects/prj_acme/canvas`, { headers: auth });

    const { pass, token } = await mintPass("prj_acme", me.id);
    expect(pass.canvasId).toBe("prj_acme");
    // The whole point of Scene 5's dialog: the pass names THIS person, so the
    // machine that redeems it arrives being her rather than a stranger.
    expect(pass.actorId).toBe(me.id);
    // Short-lived, and the row says when — the dialog counts down against this
    // rather than against a number it remembers.
    expect(Date.parse(pass.expiresAt)).toBeGreaterThan(Date.now());
    expect(Date.parse(pass.expiresAt)).toBeLessThanOrEqual(Date.now() + 15 * 60 * 1000);

    // What is on screen is built, never spelled — and it is a PROMPT for the
    // agent the person already has running, not a shell command for the person
    // (`isocan pass` prints that one; its reader is standing at a shell). A
    // hand-rolled line would look perfect and install an empty directory (#47).
    const line = localAgentInstructions("https://isocan.io", "prj_acme", token);
    expect(line).toContain(`npx ${INSTALL_SPEC} setup https://isocan.io/p/prj_acme#${token}`);
    expect(line).toContain("#release");
  });

  it("refuses to endow somebody else's actor — no second door, no social claim", async () => {
    await enterAs("Priya");
    // Jordan is somebody this browser is not, however well it knows her name.
    const refused = (await mintPass("prj_acme", jordan.id).catch((err: unknown) => err)) as ApiError;
    // Mechanism 5's own check, not a second spelling of it in the dialog: the
    // home refuses, and the refusal is the one `isocan pass` meets too.
    expect(refused).toBeInstanceOf(ApiError);
    expect(refused.code).toBe("not-your-actor");
  });
});

describe("a tab that arrives carrying one", () => {
  it("comes up already being that person, and can speak as her", async () => {
    const { token } = await passFromTheTab();
    const bar = stubAddressBar(`http://localhost:5173/p/prj_acme#${token}`);

    const refusal = await beginArrival();
    expect(refusal).toBeNull();

    // The identity was announced exactly once, in the redemption response —
    // `GET /api/actors` answers `[]` for a handed claim, so a tab that only
    // logged it would have stranded her. It is this browser's identity now.
    expect(readIdentity()).toEqual(jordan);
    expect(knownIdentities()).toEqual([jordan]); // and switchable, like any persona

    // And it is not just localStorage: the HOME wrote the claim onto this
    // browser's badge, so an op naming Jordan is accepted from it — which is
    // what "already being that person" has to mean.
    const wrote = await fetch("/api/ops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        canvasId: "prj_acme",
        actor: jordan,
        op: { type: "project.update", patch: { description: "hers now" } },
      }),
    });
    expect(wrote.status).toBe(200);

    // The credential is out of the address bar before the answer even lands:
    // a reload must not try to spend a spent pass, and a bookmark or a screen
    // share must not carry one.
    expect(bar.href()).toBe("http://localhost:5173/p/prj_acme");
  });

  it("admits without endowing when the pass carries no actor — the door is still the next thing", async () => {
    const { token } = await passFromTheTab(null);
    stubAddressBar(`http://localhost:5173/p/prj_acme#${token}`);

    expect(await beginArrival()).toBeNull();
    // Scene 6's shape (an agent names itself) and day-one `isocan open`. The
    // tab is admitted and nobody in particular, which is what the door is for.
    expect(readIdentity()).toBeNull();
    const canvas = await fetch("/api/projects/prj_acme/canvas");
    expect(canvas.status).toBe(200);
  });

  it("says so, in words with a remedy, when the pass has already been spent", async () => {
    const { token } = await passFromTheTab();
    stubAddressBar(`http://localhost:5173/p/prj_acme#${token}`);
    expect(await beginArrival()).toBeNull();

    // The reload — or the second machine — that meets its own spent pass.
    stubAddressBar(`http://localhost:5173/p/prj_acme#${token}`);
    const refusal = await beginArrival();
    expect(refusal?.code).toBe(PASS_SPENT);
    expect(refusal?.note).toMatch(/already been used/);
    // Not a blank page and not a silent fall back to being a stranger: the
    // three refusals exist so that each one names what to do next.
    expect(refusal?.hint).toMatch(/Bring your own agent|isocan open/);
  });

  it("says so when the home has never heard of the pass", async () => {
    stubAddressBar("http://localhost:5173/p/prj_acme#pss_nope.notasecret");
    const refusal = await beginArrival();
    expect(refusal?.code).toBe(PASS_UNKNOWN);
    expect(refusal?.note).toMatch(/did not recognise/);
  });

  /**
   * Measured in Chrome before it was written: pointing an open canvas tab at
   * its own address with `#<pass>` appended is a SAME-DOCUMENT navigation, so
   * nothing reloads, `main.tsx` never runs again, and the credential sits in
   * the address bar doing nothing. A reload is the whole fix — the page comes
   * back through `beginArrival` with the fragment still attached.
   */
  it("reloads when a pass lands in the bar of a page that is already open", async () => {
    const bar = stubAddressBar("http://localhost:5173/p/prj_acme");
    const late: Array<() => void> = [];
    (globalThis as Record<string, unknown>).addEventListener = (type: string, fn: () => void) => {
      if (type === "hashchange") late.push(fn);
    };
    reloadOnLatePass();

    // A hash that is not a pass is not this feature's business.
    for (const fire of late) fire();
    expect(bar.reloads()).toBe(0);

    bar.setHash("#pss_late.secret");
    for (const fire of late) fire();
    expect(bar.reloads()).toBe(1);
  });

  it("does nothing at all to a tab that arrived without one", async () => {
    const bar = stubAddressBar("http://localhost:5173/p/prj_acme");
    expect(await beginArrival()).toBeNull();
    expect(bar.href()).toBe("http://localhost:5173/p/prj_acme");
    // A trailing `#` is what a copy-paste leaves behind, not an empty pass.
    const stray = stubAddressBar("http://localhost:5173/p/prj_acme#");
    expect(await beginArrival()).toBeNull();
    expect(stray.href()).toBe("http://localhost:5173/p/prj_acme#");
  });
});

describe("refusals this browser cannot make a real daemon produce", () => {
  /** A home that answers exactly this, once. Fifteen minutes of waiting is not
   * a test, and a pass row cannot be aged from out here. */
  function homeAnswers(status: number, json: unknown): void {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify(json), {
        status,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;
  }

  it("an expired pass names the clock, and where to get another", async () => {
    stubAddressBar("http://localhost:5173/p/prj_acme#pss_1.secret");
    homeAnswers(410, { error: "this pass expired at …", code: PASS_EXPIRED });

    const refusal = await beginArrival();
    expect(refusal?.code).toBe(PASS_EXPIRED);
    expect(refusal?.note).toMatch(/expired/);
    expect(refusal?.note).toMatch(/15 minutes/); // from PASS_TTL_MS, not a literal
    expect(refusal?.hint).toMatch(/Bring your own agent/);
    expect(readIdentity()).toBeNull(); // and nobody was quietly minted
  });

  it("a home too old to have the route says that instead of being paraphrased", async () => {
    stubAddressBar("http://localhost:5173/p/prj_acme#pss_1.secret");
    // Phase 7.5's finding, closed: an unmatched `/api/` path is JSON with a
    // code now, not the app shell with a 200. Its own sentence is better than
    // anything this layer could invent, so it goes through verbatim.
    homeAnswers(404, {
      error: `no route POST ${PASS_REDEEM_ROUTE} on this daemon — if you are a newer client, this home is older than the route you asked for`,
      code: "unknown-route",
    });

    const refusal = await beginArrival();
    expect(refusal?.code).toBe("unknown-route");
    expect(refusal?.note).toMatch(/older than the route/);
  });
});
