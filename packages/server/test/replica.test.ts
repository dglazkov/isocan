import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BADGE_COOKIE, DOOR_ROUTE, ISOCAN_NAMES } from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { resolveHomeUrl } from "../src/config.ts";
import * as p from "../src/paths.ts";
import { writeBadge } from "../src/badge-store.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * The one-origin rule, in the code that enforces it — **and it is a per-canvas
 * rule, not a per-daemon one** (phase 10.3).
 *
 * A daemon serves the app for the canvases whose home it is, and for no
 * others: a canvas with two doors would have two badge cookies, two service
 * worker registrations and two browser replicas, the local one stale by
 * construction. A canvas whose home IS this daemon has exactly one door
 * already, so serving it is not a violation of the rule — it is the rule.
 *
 * The two degenerate shapes are what most of this file exercises and they are
 * byte-for-byte what they always were: a **pure replica** (a birth default,
 * not one canvas of its own) serves no pages at all, and a **pure home** (no
 * birth default) serves everything. The mixed rig — Dion's, phase 10.5's — is
 * the new shape, and it is the last block below.
 */

/**
 * A home address that is a STRING and nothing more.
 *
 * It used to be `https://dev.isocan.io`, which was harmless while a configured
 * home was only a thing the page server branched on. Stage 2 made a replica
 * DIAL its home, and these fixtures immediately started knocking on the real
 * dev home's door from the test suite — slow, impolite, and a test that would
 * fail on a laptop with no network for a reason it never mentions. `.invalid`
 * is reserved by RFC 2606 and can never resolve, which is exactly what a
 * fixture that is only ever echoed back should be.
 */
const HOME = "https://home.invalid";

/** Whether the web app has actually been built into `packages/web/dist`. A
 * home only serves pages when it has pages to serve, so the home half of the
 * page assertions is conditional and the replica half never is — a replica
 * refuses whether or not a build is sitting there. */
const distBuilt = existsSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../web/dist/index.html"),
);

let home: string;
let daemon: Daemon | null;
/** A second daemon, for the one test whose replica has to reach a home that
 * is actually there. Its own directory, torn down with everything else. */
let upstream: Daemon | null;
let upstreamHome: string | null;

async function boot(birthHome: string | null): Promise<string> {
  daemon = await startDaemon({ port: 0, home, birthHome });
  const address = daemon.app.server.address();
  return `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
}

async function realHome(): Promise<string> {
  upstreamHome = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-upstream-"));
  upstream = await startDaemon({ port: 0, home: upstreamHome, birthHome: null });
  const address = upstream.app.server.address();
  return `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
}

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-replica-"));
  daemon = null;
  upstream = null;
  upstreamHome = null;
});

afterEach(async () => {
  await daemon?.close();
  await upstream?.close();
  await fs.rm(home, { recursive: true, force: true });
  if (upstreamHome) await fs.rm(upstreamHome, { recursive: true, force: true });
  delete process.env.ISOCAN_HOME_URL;
});

describe("where a daemon learns where a canvas born here goes", () => {
  it("births locally when nothing says otherwise — there is no baked-in address", async () => {
    // The load-bearing assertion of the whole mechanism: every daemon in this
    // repo today has no home configured, and a canvas born on one must go on
    // being born right there. Baking `isocan.io` in as a fallback would change
    // that for all of them; that default belongs to phase 14, where setup
    // writes the address on purpose — and phase 10.3 is what makes flipping it
    // safe, because a birth default cannot re-point work that already exists.
    expect(await resolveHomeUrl(home)).toBeNull();
    daemon = await startDaemon({ port: 0, home });
    expect(daemon.birthHome).toBeNull();
  });

  it("reads ISOCAN_HOME_URL from the environment", async () => {
    process.env.ISOCAN_HOME_URL = HOME;
    expect(await resolveHomeUrl(home)).toBe(HOME);
  });

  it("falls back to config.json's `home`", async () => {
    await fs.writeFile(p.configFile(home), JSON.stringify({ home: HOME }));
    expect(await resolveHomeUrl(home)).toBe(HOME);
  });

  it("lets the environment win, because that is how a container is configured", async () => {
    await fs.writeFile(p.configFile(home), JSON.stringify({ home: "https://elsewhere.example" }));
    process.env.ISOCAN_HOME_URL = HOME;
    expect(await resolveHomeUrl(home)).toBe(HOME);
  });

  it("treats a malformed config.json as no configuration, not as a crash", async () => {
    // config.json is hand-edited and already carries `harnessVars` and
    // `defaultProjectId`. One tolerant reader serves all three, so a stray
    // comma costs the file's settings and never a daemon that will not boot.
    await fs.writeFile(p.configFile(home), "{ not json ,");
    expect(await resolveHomeUrl(home)).toBeNull();
    await fs.writeFile(p.configFile(home), '"a string is not a config"');
    expect(await resolveHomeUrl(home)).toBeNull();
    await fs.writeFile(p.configFile(home), JSON.stringify({ home: "   " }));
    expect(await resolveHomeUrl(home)).toBeNull();
  });
});

/**
 * **Upgrade day** — what phase 10.3's one migration writes, and (mostly) does
 * not.
 *
 * From 10.3 on, a canvas with no row in `homes.json` is one this daemon is the
 * home of. That reading is right for Dion, whose canvases were born local. It
 * is catastrophically wrong for the other upgraded machine: one whose
 * `config.json` already carried a `home`, holding canvases born on it as a
 * replica in the phase 6→7.5 window, whose markers say nothing and which
 * genuinely live at that home. Re-reading "absent" as "local" would silently
 * FORK every one of them.
 */
describe("what the upgrade writes down about canvases that already exist", () => {
  /** A pre-10.3 machine: canvases in the store, and no `homes.json` at all —
   * which is exactly what a machine that has never run this code has. */
  async function preUpgradeMachine(): Promise<void> {
    const base = await boot(null);
    const badge = await mintTestBadge(base);
    await badge.speakAs({ id: "usr_dion", name: "Dion" });
    for (const [id, title] of [
      ["prj_acme", "Acme Sprint Board"],
      ["prj_widget", "Widget Redesign"],
    ]) {
      const made = await fetch(`${base}/api/ops`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...badge.headers },
        body: JSON.stringify({
          canvasId: null,
          actor: { id: "usr_dion", name: "Dion" },
          op: { type: "project.create", canvasId: id, title },
        }),
      });
      expect(made.status).toBe(200);
    }
    await daemon!.close();
    daemon = null;
    await fs.rm(p.homesFile(home), { force: true });
  }

  it("freezes the canvases of a machine that really was a replica — it holds that home's badge", async () => {
    // The wrinkle the upgrade must not fall into, asserted. This machine was a
    // phase 6→7.5 replica, so what it holds today genuinely lives at that home
    // — and it is written down explicitly rather than left to a rule that now
    // says the opposite.
    //
    // **What makes it a replica is the BADGE, not the config key** (phase
    // 10.5). `isocan home <address>` writes `config.json` and then restarts,
    // so a configured home also describes a machine that has merely been TOLD
    // an address a moment ago — and freezing that one hands its owner's local
    // canvases to a home they have never been to. A replica knocked on the
    // door and was recognised; this is that recognition, on disk.
    await preUpgradeMachine();
    await writeBadge(home, HOME, { badgeId: "bdg_replica", secret: "s3cret", at: HOME });
    await boot(HOME);
    expect(daemon!.homes.assignments()).toEqual({ prj_acme: HOME, prj_widget: HOME });
    expect(JSON.parse(await fs.readFile(p.homesFile(home), "utf8"))).toEqual({
      prj_acme: HOME,
      prj_widget: HOME,
    });
  });

  it("writes no rows on a machine with no home configured — Dion's, and every hosted home's", async () => {
    // Two machines behind one assertion. Dion's: absent-means-local is already
    // the truth about it, so there is nothing to record and his canvases keep
    // working with his daemon as their home, unchanged.
    //
    // And the hosted home's, which is the half that would actually hurt: a
    // container starts from a fresh filesystem and re-runs its migrations at
    // EVERY cold start, so a per-canvas write here would be paid over and over
    // for canvases that are all local by definition. This writes zero bytes.
    await preUpgradeMachine();
    await boot(null);
    expect(daemon!.homes.assignments()).toEqual({});
    // An EMPTY record is still written, and that is the guard rather than an
    // exception to it (phase 10.5). Returning before the write left this
    // migration armed on exactly the machine it was least meant for: the next
    // `isocan home <address>` gave it a configured home and no record, and it
    // froze Dion's locally-born canvases at a home they had never been to.
    // The cost is one tiny write per cold start, not one per canvas — the
    // thing the hosted home actually could not afford.
    expect(JSON.parse(await fs.readFile(p.homesFile(home), "utf8"))).toEqual({});
  });

  it("runs once — a row written afterwards is not re-frozen by the next boot", async () => {
    await preUpgradeMachine();
    await boot(HOME);
    await daemon!.close();
    daemon = null;
    // Somebody re-homes a canvas by hand, or a later join writes a different
    // row. The migration is marked done by the file's existence, so the next
    // boot leaves it alone rather than stamping the configured home over
    // everything again.
    await fs.writeFile(
      p.homesFile(home),
      JSON.stringify({ prj_acme: null, prj_widget: HOME }),
    );
    await boot(HOME);
    expect(daemon!.homes.assignments()).toEqual({ prj_acme: null, prj_widget: HOME });
  });
});

describe("a pure replica does not serve pages", () => {
  it("answers an unmatched GET with a 404 that names the home", async () => {
    // A birth default and not one canvas of its own: a PURE replica, which is
    // the shape this whole block is about and the one that is unchanged.
    const base = await boot(HOME);
    for (const url of ["/", "/c/prj_1", "/index.html"]) {
      const res = await fetch(`${base}${url}`, { headers: { Accept: "text/html" } });
      expect(res.status, url).toBe(404);
      // Not silent: the failure-may-not-be-silent instinct runs through this
      // codebase, and an unexplained 404 from your own machine reads as a
      // broken daemon rather than as a design decision.
      expect(await res.text()).toContain(HOME);
    }
  });

  it("names the home in a header too, and does NOT redirect there", async () => {
    const base = await boot(HOME);
    const res = await fetch(`${base}/c/prj_1`, { redirect: "manual" });
    expect(res.headers.get("x-isocan-home")).toBe(HOME);
    // A Location would send a browser to the home carrying a path this daemon
    // invented — which is how a person lands on the home's own 404 wondering
    // what they did. The address is stated; the move is left to the person.
    expect(res.headers.get("location")).toBeNull();
    expect(res.status).toBe(404);
  });

  it("answers a script in plain text rather than a wall of markup", async () => {
    const base = await boot(HOME);
    const res = await fetch(`${base}/`, { headers: { Accept: "*/*" } });
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(await res.text()).toBe(`this canvas lives at ${HOME} — open it there\n`);
  });

  it("mints no cookie badge, because the page that minted it is gone", async () => {
    // The SPA fallback is where a browser gets badged (`if (!req.badge)
    // mintBadge("cookie")`). A daemon mints them only where it is somebody's
    // home — leaving that half reachable on a pure replica would mint a badge
    // per stray asset request to a page that does not exist.
    const base = await boot(HOME);
    const res = await fetch(`${base}/`);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(await res.text()).not.toContain(BADGE_COOKIE);
  });

  it("still serves ops to CLIs — that is the half it keeps", async () => {
    // A REAL home for this one, because stage 2 made the forward real: a write
    // on a replica now travels to its home, so a made-up address would have
    // this test asserting that an op reaches an address that does not exist.
    // The fixture changed; the assertions below did not.
    const upstream = await realHome();
    const base = await boot(upstream);
    // The door still opens (a CLI's bearer badge comes from here), health is
    // still answered, and the op vocabulary is untouched. "Ops to CLIs, never
    // pages to persons" is a statement about pages only.
    expect((await fetch(`${base}${DOOR_ROUTE}`, { method: "POST" })).status).toBe(200);
    expect((await fetch(`${base}/healthz`)).status).toBe(200);
    const badge = await mintTestBadge(base);
    await badge.speakAs({ id: "usr_isaac", name: "Isaac" });
    const created = await fetch(`${base}/api/ops`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...badge.headers },
      body: JSON.stringify({
        canvasId: null,
        actor: { id: "usr_isaac", name: "Isaac" },
        op: { type: "project.create", canvasId: "prj_1", title: "Acme Sprint Board" },
      }),
    });
    expect(created.status).toBe(200);
    const canvases = await fetch(`${base}/api/projects`, { headers: badge.headers });
    expect(((await canvases.json()) as { id: string }[]).map((p) => p.id)).toEqual(["prj_1"]);
  });

  it("records the birth default, and it is the whole-daemon answer that survives", async () => {
    // A daemon that could not say where its next canvas would go would be a
    // daemon nothing could ask. What it can no longer say — and deliberately
    // does not pretend to — is "the home I answer to": that is a per-canvas
    // question now, and `GET /api/homes` is where it is asked.
    await boot(HOME);
    expect(daemon!.birthHome).toBe(HOME);
    expect(daemon!.homes.assignments()).toEqual({});
  });
});

describe("a pure home is unchanged", () => {
  it("serves the web app and badges the page load", async () => {
    if (!distBuilt) return; // no build here; the daemon correctly serves nothing
    const base = await boot(null);
    const res = await fetch(`${base}/c/prj_1`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("set-cookie")).toContain(BADGE_COOKIE);
    expect(res.headers.get("x-isocan-home")).toBeNull();
  });
});

/**
 * **The mixed rig** — a daemon that is the home of one canvas and a replica
 * for another, which is Dion's machine (phase 10.5) and every developer's the
 * moment prod and dev both exist.
 *
 * Before phase 10.3 this shape could not be expressed: a configured home
 * demoted the whole daemon, so a locally-born canvas on a machine with a home
 * had nowhere to be opened. These two tests are the pair that says the branch
 * has an input now — one for what it serves, one for what it refuses — and the
 * refusal is the sharper of them, because it names THAT CANVAS's home rather
 * than the daemon's.
 */
describe("a daemon that is the home of some canvases and a replica for others", () => {
  /**
   * A canvas this daemon really is the home of, on a daemon that also has a
   * birth default.
   *
   * **Born for real rather than written straight into the record**, which this
   * fixture used to do. "Is this daemon somebody's home" is a question about
   * what it HOLDS, and a row naming a canvas the store has never heard of is a
   * record about nothing — so the shortcut described a machine that cannot
   * exist. Birth with no birth default needs no second daemon: the canvas
   * lands locally and writes its own `null` row, which is precisely the state
   * under test.
   */
  async function withLocalCanvas(birthHome: string, local: string): Promise<string> {
    const first = await boot(null);
    const badge = await mintTestBadge(first);
    await badge.speakAs({ id: "usr_dion", name: "Dion" });
    const made = await fetch(`${first}/api/ops`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...badge.headers },
      body: JSON.stringify({
        canvasId: null,
        actor: { id: "usr_dion", name: "Dion" },
        op: { type: "project.create", canvasId: local, title: "Acme Sprint Board" },
      }),
    });
    expect(made.status).toBe(200);
    await daemon!.close();
    daemon = null;
    return boot(birthHome);
  }

  it("serves the app again, because it is somebody's home now", async () => {
    if (!distBuilt) return; // no build here; the daemon correctly serves nothing
    const base = await withLocalCanvas(HOME, "prj_acme");
    // The canvas it hosts opens in a browser, badge and all — which is exactly
    // what phase 10.5 promises Dion does not lose.
    const canvas = await fetch(`${base}/p/prj_acme`, { headers: { Accept: "text/html" } });
    expect(canvas.status).toBe(200);
    expect(canvas.headers.get("content-type")).toContain("text/html");
    expect(canvas.headers.get("set-cookie")).toContain(BADGE_COOKIE);
    // And so does the front page: this daemon is not a pure replica any more,
    // so `/` and the assets are its to serve.
    const front = await fetch(`${base}/`, { headers: { Accept: "text/html" } });
    expect(front.status).toBe(200);
  });

  it("refuses a canvas that lives elsewhere, naming THAT canvas's home", async () => {
    // Two canvases: one this daemon is the home of, one recorded as living at
    // a THIRD address — neither local nor the birth default. That third
    // address is the whole assertion: a signpost that still named the daemon's
    // one configured home would pass every other check in this test and print
    // the wrong address to the person reading it.
    const elsewhere = "https://widgets.invalid";
    await fs.writeFile(
      p.homesFile(home),
      JSON.stringify({ prj_acme: null, prj_widget: elsewhere }),
    );
    const base = await boot(HOME);

    const res = await fetch(`${base}/p/prj_widget`, { headers: { Accept: "text/html" } });
    expect(res.status).toBe(404);
    expect(res.headers.get("x-isocan-home")).toBe(elsewhere);
    expect(await res.text()).toContain(elsewhere);
    expect(res.headers.get("x-isocan-home")).not.toBe(HOME);
  });
});

/**
 * Phase 7.5's defect, in the shape it was met in: the very first
 * `isocan identity --session` against a real home allocated "Isaac" locally
 * and was then refused by the home, because Isaac was already somebody there.
 *
 * Not a race — that was tested and ruled out. A SCOPE MISMATCH. A name is
 * judged in the presenting badge's admissions (mechanism 10), a fresh
 * replica's local badge has none, so the whole roster looks free to it, while
 * the home judges the same name against the rosters that badge can see there.
 * Both answers are correct in their own scope; only one of them is the one
 * that matters, and it is the home's, because the home owns the namespace the
 * name has to be unique in.
 *
 * Nothing here points at dev.isocan.io. Two daemons in one process reproduce
 * it exactly, and a test that reached the real dev home would be asserting
 * against somebody else's roster.
 */
describe("a name allocated on a replica is a name the home will accept", () => {
  /** The canvas at the home, with the first roster name already on it. */
  async function homeWithIsaac(): Promise<{ base: string; badge: TestBadge }> {
    const base = await realHome();
    const badge = await mintTestBadge(base);
    const isaac = { id: "usr_isaac", name: "Isaac" };
    await badge.speakAs(isaac);
    // On a CANVAS, not merely claimed: `heldNames` is what a name is judged
    // against, and it reads the rosters of the canvases in scope.
    const created = await fetch(`${base}/api/ops`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...badge.headers },
      body: JSON.stringify({
        canvasId: null,
        actor: isaac,
        op: { type: "project.create", canvasId: "prj_acme", title: "Acme Sprint Board" },
      }),
    });
    expect(created.status).toBe(200);
    return { base, badge };
  }

  /** A nameless claim — "hand me a name" — from a badge that has never
   * claimed anything. The path the defect lived on. */
  async function claimNameless(
    base: string,
    badge: TestBadge,
    sessionKey: string,
  ): Promise<{ status: number; actor?: { id: string; name: string }; error?: string }> {
    const res = await fetch(`${base}/api/ops`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...badge.headers },
      body: JSON.stringify({
        canvasId: null,
        op: { type: "actor.claim", sessionKey },
      }),
    });
    const json = (await res.json().catch(() => null)) as any;
    return res.ok
      ? { status: res.status, actor: json.envelope.actor }
      : { status: res.status, error: json?.error };
  }

  async function until<T>(fn: () => Promise<T>, ok: (v: T) => boolean, what: string): Promise<T> {
    const deadline = Date.now() + 10_000;
    for (;;) {
      const value = await fn().catch(() => null as T | null);
      if (value !== null && ok(value)) return value;
      if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
      await new Promise((r) => setTimeout(r, 20));
    }
  }

  const namesAt = async (base: string, badge: TestBadge): Promise<Record<string, string>> =>
    (await (await fetch(`${base}/api/names`, { headers: badge.headers })).json()) as Record<
      string,
      string
    >;

  it("skips a roster name that is taken at the home, and the home vouches for the one it hands out", async () => {
    const upstream = await homeWithIsaac();
    const base = await boot(upstream.base);
    const mine = await mintTestBadge(base);

    const claimed = await claimNameless(base, mine, "claude-code:s-1");
    expect(claimed.status).toBe(200);
    // The defect, stated as an assertion: "Isaac" is free by this replica's
    // own lights and it must not hand it out anyway.
    expect(claimed.actor!.name).not.toBe("Isaac");
    expect(claimed.actor!.name).toBe(ISOCAN_NAMES[1]);

    // And the proof that it is the RIGHT name and not merely a different one:
    // the announcement lands at the home instead of being refused there, so
    // the actor born on this replica exists at the home under that name.
    const names = await until(
      () => namesAt(upstream.base, upstream.badge),
      (all) => all[claimed.actor!.id] !== undefined,
      "the home to vouch for the actor born on the replica",
    );
    expect(names[claimed.actor!.id]).toBe(claimed.actor!.name);
  });

  it("never swaps a name somebody asked for, even one the home would refuse", async () => {
    // The narrowness of the fix, asserted. Only ALLOCATION consults the home;
    // a supplied name is judged where it is supplied, and is never quietly
    // replaced by the home's suggestion. `--name Isaac` here is free locally,
    // so it binds locally and the home refuses the announcement with the
    // message it has always had — which is the behaviour the phase keeps.
    const upstream = await homeWithIsaac();
    const base = await boot(upstream.base);
    const mine = await mintTestBadge(base);
    const res = await fetch(`${base}/api/ops`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...mine.headers },
      body: JSON.stringify({
        canvasId: null,
        op: { type: "actor.claim", sessionKey: "claude-code:s-1", name: "Isaac" },
      }),
    });
    const json = (await res.json()) as any;
    expect(res.status).toBe(200);
    expect(json.envelope.actor.name).toBe("Isaac");
  });

  it("allocates from its own scope when the home cannot be reached", async () => {
    // A replica must stay usable with no home in sight: the home's answer is a
    // preference, never a precondition. `.invalid` can never resolve, so this
    // is the offline case with no waiting for a timeout to be arranged.
    const base = await boot(HOME);
    const mine = await mintTestBadge(base);
    const claimed = await claimNameless(base, mine, "claude-code:s-1");
    expect(claimed.status).toBe(200);
    expect(claimed.actor!.name).toBe(ISOCAN_NAMES[0]);
  });
});
