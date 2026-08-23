import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { WebSocket } from "ws";
import {
  BADGE_COOKIE,
  DOOR_ROUTE,
  formatBadgeToken,
  WS_BAD_ORIGIN,
  WS_NO_BADGE,
  type DoorResponse,
} from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import * as p from "../src/paths.ts";
import { mintTestBadge } from "./badge.ts";

/**
 * The door (identity desk, mechanism 1): mint, carry, refuse, migrate.
 *
 * The phase's outcome is RECOGNITION, not policy — the address still admits,
 * and getting a badge is free — so what these assert is that the home can
 * tell holders apart, that both carriers work, that the badge-less are
 * refused with something they can act on, and that nobody who had an actor
 * before the desk opened loses it.
 */

/** Somebody for a fixture canvas to belong to. */
const usrA = { id: "usr_a", name: "A" };

let home: string;
let daemon: Daemon;
let base: string;
let port: number;

async function boot(): Promise<void> {
  daemon = await startDaemon({ port: port ?? 0, home });
  const address = daemon.app.server.address();
  port = typeof address === "object" && address ? address.port : 0;
  base = `http://127.0.0.1:${port}`;
}

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-door-"));
  port = 0;
  await boot();
});

afterEach(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true });
});

const door = async (body: unknown, headers: Record<string, string> = {}) => {
  const res = await fetch(`${base}${DOOR_ROUTE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return {
    status: res.status,
    setCookie: res.headers.get("set-cookie"),
    json: (await res.json().catch(() => null)) as DoorResponse | null,
  };
};

const deskFile = async () =>
  JSON.parse(await fs.readFile(p.badgesFile(home), "utf8")) as {
    lastSeq: number;
    badges: Record<
      string,
      {
        secretHash: string;
        kind: string;
        admissions: { canvasId: string; provenance: { root: string } }[];
        claims: { actorId: string; sessionKey?: string }[];
      }
    >;
    shelf: Record<string, { actorId: string; sessionKey?: string }>;
  };

// ---- mint ----

describe("the door mints", () => {
  it("hands a bearer its secret once, in the body", async () => {
    const { status, json, setCookie } = await door({ carrier: "bearer" });
    expect(status).toBe(200);
    expect(json!.badgeId).toMatch(/^bdg_/);
    // 32 bytes of CSPRNG, base64url — the architecture's 256 bits.
    expect(json!.secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(setCookie).toBeNull();
  });

  it("hands a cookie carrier a cookie and NOT the secret", async () => {
    const { json, setCookie } = await door({ carrier: "cookie" });
    expect(json!.badgeId).toMatch(/^bdg_/);
    // The whole value of HttpOnly is that page JavaScript cannot read the
    // credential; returning it in JSON would hand it straight back.
    expect(json!.secret).toBeUndefined();
    expect(setCookie).toContain(`${BADGE_COOKIE}=${json!.badgeId}.`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Max-Age=31536000");
    // Not over TLS here, and the local daemon never is — which is why the
    // `__Host-` prefix waits for the hosted home.
    expect(setCookie).not.toContain("Secure");
    expect(setCookie).not.toContain("Domain");
  });

  it("stores the secret hashed, and never the secret", async () => {
    const { json } = await door({ carrier: "bearer" });
    const desk = await deskFile();
    const record = desk.badges[json!.badgeId]!;
    expect(record.secretHash).toMatch(/^[0-9a-f]{64}$/);
    expect(record.secretHash).toBe(createHash("sha256").update(json!.secret!).digest("hex"));
    // A leaked ledger leaks no bearer tokens.
    expect(JSON.stringify(desk)).not.toContain(json!.secret!);
  });

  it("mints only for the badge-less — a holder is told its own id", async () => {
    const badge = await mintTestBadge(base);
    const again = await door({ carrier: "bearer" }, badge.headers);
    expect(again.json!.badgeId).toBe(badge.badgeId);
    // No new secret: a refresh storm cannot mint a badge per request.
    expect(again.json!.secret).toBeUndefined();
    expect(Object.keys((await deskFile()).badges)).toHaveLength(1);
  });

  it("defaults to bearer when the carrier is not stated", async () => {
    const { json, setCookie } = await door({});
    expect(json!.secret).toBeDefined();
    expect(setCookie).toBeNull();
  });
});

// ---- carry ----

describe("both carriers are one badge", () => {
  it("carries as a bearer", async () => {
    const badge = await mintTestBadge(base);
    const res = await fetch(`${base}/api/projects`, { headers: badge.headers });
    expect(res.status).toBe(200);
  });

  it("carries as a cookie", async () => {
    const { json, setCookie } = await door({ carrier: "cookie" });
    const value = setCookie!.split(";")[0]!;
    const res = await fetch(`${base}/api/projects`, { headers: { cookie: value } });
    expect(res.status).toBe(200);
    expect(value).toContain(json!.badgeId);
  });

  it("prefers the bearer when both arrive — explicit beats ambient", async () => {
    const bearer = await mintTestBadge(base);
    const cookieBadge = await door({ carrier: "cookie" });
    const res = await fetch(`${base}/api/ops`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookieBadge.setCookie!.split(";")[0]!,
        ...bearer.headers,
      },
      body: JSON.stringify({
        projectId: null,
        op: { type: "actor.claim", sessionKey: "cli:s-1", name: "Kenny" },
      }),
    });
    expect(res.status).toBe(200);
    // The claim landed on the BEARER's badge, not the cookie's.
    const desk = await deskFile();
    expect(desk.badges[bearer.badgeId]!.claims.map((c) => c.sessionKey)).toEqual(["cli:s-1"]);
    expect(desk.badges[cookieBadge.json!.badgeId]!.claims).toEqual([]);
  });

  it("carries on the WebSocket upgrade, and the badge-less handshake is closed", async () => {
    const badge = await mintTestBadge(base);
    await badge.speakAs(usrA); // a badge speaks only for actors it claims
    await fetch(`${base}/api/ops`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...badge.headers },
      body: JSON.stringify({
        projectId: null,
        actor: usrA,
        op: { type: "project.create", projectId: "prj_1", title: "P" },
      }),
    });
    const wsBase = base.replace("http", "ws");

    const badged = new WebSocket(`${wsBase}/ws?projectId=prj_1`, { headers: badge.headers });
    const hello = await new Promise<string>((resolve, reject) => {
      badged.on("message", (data) => resolve(String(data)));
      badged.on("error", reject);
    });
    expect(JSON.parse(hello).type).toBe("snapshot");
    badged.close();

    // A browser cannot set headers on a handshake, so the cookie is the other
    // carrier; with neither, the socket is closed with a code the client can
    // act on rather than a silent hang.
    const bare = new WebSocket(`${wsBase}/ws?projectId=prj_1`);
    bare.on("error", () => {});
    const code = await new Promise<number>((resolve) => bare.on("close", resolve));
    expect(code).toBe(WS_NO_BADGE);

    const cookieBadge = await door({ carrier: "cookie" });
    const viaCookie = new WebSocket(`${wsBase}/ws?projectId=prj_1`, {
      headers: { cookie: cookieBadge.setCookie!.split(";")[0]! },
    });
    const cookieHello = await new Promise<string>((resolve, reject) => {
      viaCookie.on("message", (data) => resolve(String(data)));
      viaCookie.on("error", reject);
    });
    expect(JSON.parse(cookieHello).type).toBe("snapshot");
    viaCookie.close();
  });
});

// ---- refuse ----

describe("the badge-less are refused, actionably", () => {
  it("401s an API request with no badge, naming the way back", async () => {
    const res = await fetch(`${base}/api/projects`);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string; code: string };
    expect(body.code).toBe("no-badge");
    expect(body.error).toContain(DOOR_ROUTE);
    // An old CLI against a new daemon is an accepted break — but a break that
    // explains itself is a different thing from a break.
    expect(body.error).toContain("isocan restart");
  });

  it("distinguishes a badge it does not know: throw yours away, get a new one", async () => {
    const res = await fetch(`${base}/api/projects`, {
      headers: { Authorization: `Bearer ${formatBadgeToken("bdg_nosuchbdg", "x".repeat(43))}` },
    });
    expect(res.status).toBe(401);
    expect(((await res.json()) as { code: string }).code).toBe("bad-badge");
  });

  it("refuses a real badge id with the wrong secret", async () => {
    const badge = await mintTestBadge(base);
    const res = await fetch(`${base}/api/projects`, {
      headers: { Authorization: `Bearer ${formatBadgeToken(badge.badgeId, "n".repeat(43))}` },
    });
    expect(res.status).toBe(401);
    expect(((await res.json()) as { code: string }).code).toBe("bad-badge");
  });

  it("refuses a route added later by default — the allowlist is the whole rule", async () => {
    for (const url of [
      "/api/actors",
      "/api/names",
      "/api/colors",
      "/api/commands",
      "/api/projects/prj_1/canvas",
    ]) {
      expect((await fetch(`${base}${url}`)).status).toBe(401);
    }
  });

  it("leaves healthz and the door open, because nothing else could bootstrap", async () => {
    // /healthz is the load balancer's probe AND what ensureDaemon, warnIfStale
    // and stopDaemons poll before any badge could exist.
    expect((await fetch(`${base}/healthz`)).status).toBe(200);
    // Its hosted sibling, badge-less for the same reason. It sits under
    // /api/, so it is open only because the allowlist says so — which is the
    // point: if the handler ever went away, an unbadged probe would get a 401
    // here rather than a cheerful 200 from the SPA fallback.
    expect((await fetch(`${base}/api/healthz`)).status).toBe(200);
    expect((await door({ carrier: "bearer" })).status).toBe(200);
  });

  it("leaves the blob GET open — DELIBERATELY, and phase 3 inherits it", async () => {
    // A sandboxed HTML blob has an OPAQUE origin, so it has a null
    // site-for-cookies: nothing it then requests (a relative <img>, a
    // stylesheet, a fetch) can carry a SameSite cookie at all. The route is
    // open today; requiring a badge here would break every HTML blob with a
    // relative asset reference.
    //
    // The honest long-term answer is that a blob hash IS a capability — 256
    // bits of content address — and PHASE 3, which re-asks
    // `projectId ∈ admissions` per route, is the phase that decides whether
    // that is capability enough or whether HTML blobs get a per-blob token.
    // This assertion exists so that closing the hole is a deliberate act:
    // whoever closes it has to come here and say so.
    const badge = await mintTestBadge(base);
    await badge.speakAs(usrA); // a badge speaks only for actors it claims
    await fetch(`${base}/api/ops`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...badge.headers },
      body: JSON.stringify({
        projectId: null,
        actor: usrA,
        op: { type: "project.create", projectId: "prj_1", title: "P" },
      }),
    });
    const upload = await fetch(`${base}/api/projects/prj_1/blobs`, {
      method: "POST",
      headers: { "Content-Type": "text/html", "X-Isocan-Filename": "page.html", ...badge.headers },
      body: "<h1>hi</h1>",
    });
    const { blobHash } = (await upload.json()) as { blobHash: string };

    const bare = await fetch(`${base}/api/projects/prj_1/blobs/${blobHash}`);
    expect(bare.status).toBe(200);
    expect(await bare.text()).toBe("<h1>hi</h1>");
    // Uploading one, though, is an ordinary write and does want a badge.
    expect(
      (
        await fetch(`${base}/api/projects/prj_1/blobs`, {
          method: "POST",
          headers: { "Content-Type": "text/html" },
          body: "<h1>nope</h1>",
        })
      ).status,
    ).toBe(401);
  });
});

// ---- SameSite's belt: the Origin check ----

describe("the Origin check", () => {
  it("allows an absent Origin — that is not a browser", async () => {
    const badge = await mintTestBadge(base);
    expect((await fetch(`${base}/api/projects`, { headers: badge.headers })).status).toBe(200);
  });

  it("allows any loopback origin on a loopback daemon", async () => {
    // Mechanism 5's own line applied to origins: within a machine, localhost
    // trust stands. This is what makes Vite's `localhost:5173` dev proxy work
    // without a special case.
    const badge = await mintTestBadge(base);
    for (const origin of ["http://localhost:5173", `http://127.0.0.1:${port}`, "http://[::1]:1234"]) {
      const res = await fetch(`${base}/api/projects`, {
        headers: { ...badge.headers, Origin: origin },
      });
      expect(res.status).toBe(200);
    }
  });

  it("refuses a foreign origin riding a cookie, and lets the bearer through", async () => {
    // Naming an allowlist puts the daemon in home posture: strict, its own
    // origin only. A bearer is exempt — an attacker's page cannot read one,
    // so there is nothing to ride.
    const previous = process.env.ISOCAN_ALLOWED_ORIGINS;
    process.env.ISOCAN_ALLOWED_ORIGINS = `http://127.0.0.1:${port}`;
    try {
      const cookieBadge = await door({ carrier: "cookie" });
      const cookie = cookieBadge.setCookie!.split(";")[0]!;
      const foreign = await fetch(`${base}/api/projects`, {
        headers: { cookie, Origin: "http://evil.example" },
      });
      expect(foreign.status).toBe(403);
      expect(((await foreign.json()) as { code: string }).code).toBe("bad-origin");

      const own = await fetch(`${base}/api/projects`, {
        headers: { cookie, Origin: `http://127.0.0.1:${port}` },
      });
      expect(own.status).toBe(200);

      const badge = await mintTestBadge(base);
      const viaBearer = await fetch(`${base}/api/projects`, {
        headers: { ...badge.headers, Origin: "http://evil.example" },
      });
      expect(viaBearer.status).toBe(200);
    } finally {
      if (previous === undefined) delete process.env.ISOCAN_ALLOWED_ORIGINS;
      else process.env.ISOCAN_ALLOWED_ORIGINS = previous;
    }
  });

  it("closes a foreign WebSocket handshake — the case CORS does not cover", async () => {
    // Browsers do not enforce CORS on WebSockets, which is the whole reason
    // this check exists on the upgrade as well as on the API.
    const previous = process.env.ISOCAN_ALLOWED_ORIGINS;
    process.env.ISOCAN_ALLOWED_ORIGINS = `http://127.0.0.1:${port}`;
    try {
      const cookieBadge = await door({ carrier: "cookie" });
      const ws = new WebSocket(`${base.replace("http", "ws")}/ws?projectId=prj_1`, {
        headers: {
          cookie: cookieBadge.setCookie!.split(";")[0]!,
          Origin: "http://evil.example",
        },
      });
      ws.on("error", () => {});
      expect(await new Promise<number>((resolve) => ws.on("close", resolve))).toBe(WS_BAD_ORIGIN);
    } finally {
      if (previous === undefined) delete process.env.ISOCAN_ALLOWED_ORIGINS;
      else process.env.ISOCAN_ALLOWED_ORIGINS = previous;
    }
  });
});

// ---- what a badge holds ----

describe("what a badge holds", () => {
  it("holds several claims — a machine vouches for its human and its agents", async () => {
    const badge = await mintTestBadge(base);
    const claim = (sessionKey: string, name: string) =>
      fetch(`${base}/api/ops`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...badge.headers },
        body: JSON.stringify({
          projectId: null,
          op: { type: "actor.claim", sessionKey, name },
        }),
      }).then((r) => r.json() as Promise<{ envelope: { actor: { id: string } } }>);
    const kenny = await claim("claude-code:s-1", "Kenny");
    const isaac = await claim("codex:t-1", "Isaac");

    const desk = await deskFile();
    expect(desk.badges[badge.badgeId]!.claims.map((c) => c.sessionKey).sort()).toEqual([
      "claude-code:s-1",
      "codex:t-1",
    ]);
    expect(desk.badges[badge.badgeId]!.claims.map((c) => c.actorId).sort()).toEqual(
      [kenny.envelope.actor.id, isaac.envelope.actor.id].sort(),
    );
  });

  it("sees its own claims and nobody else's", async () => {
    const mine = await mintTestBadge(base);
    const yours = await mintTestBadge(base);
    await fetch(`${base}/api/ops`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...mine.headers },
      body: JSON.stringify({
        projectId: null,
        op: { type: "actor.claim", sessionKey: "cli:s-1", name: "Kenny" },
      }),
    });
    const asMe = (await (
      await fetch(`${base}/api/actors`, { headers: mine.headers })
    ).json()) as { key: string }[];
    const asYou = (await (
      await fetch(`${base}/api/actors`, { headers: yours.headers })
    ).json()) as { key: string }[];
    expect(asMe.map((b) => b.key)).toEqual(["cli:s-1"]);
    expect(asYou).toEqual([]);
  });

  it("writes down where it has been, without enforcing it", async () => {
    // Unenforced in phase 2 — "the address still admits" recorded as data
    // instead of assumed, so phase 3's `projectId ∈ admissions` is a check
    // rather than a backfill.
    const creator = await mintTestBadge(base);
    await creator.speakAs(usrA);
    await fetch(`${base}/api/ops`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...creator.headers },
      body: JSON.stringify({
        projectId: null,
        actor: usrA,
        op: { type: "project.create", projectId: "prj_1", title: "P" },
      }),
    });
    const visitor = await mintTestBadge(base);
    const seen = await fetch(`${base}/api/projects/prj_1/canvas`, { headers: visitor.headers });
    expect(seen.status).toBe(200); // policy unchanged: the address admits

    const desk = await deskFile();
    expect(desk.badges[creator.badgeId]!.admissions).toEqual([
      expect.objectContaining({ canvasId: "prj_1", provenance: { root: "created" } }),
    ]);
    expect(desk.badges[visitor.badgeId]!.admissions).toEqual([
      expect.objectContaining({ canvasId: "prj_1", provenance: { root: "link" } }),
    ]);
  });
});

describe("a badge that was lost", () => {
  /**
   * The claims are still on the desk; the badge holding them is not. The home
   * has to be able to say so, or a client is told "no identity configured" —
   * true of the badge, false of the home, and pointing at the one recovery
   * (`--name`) that mints a stranger.
   */
  const claimOn = (badge: { headers: Record<string, string> }, sessionKey: string, name: string) =>
    fetch(`${base}/api/ops`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...badge.headers },
      body: JSON.stringify({ projectId: null, op: { type: "actor.claim", sessionKey, name } }),
    }).then((r) => r.json() as Promise<{ envelope: { actor: { id: string } } }>);

  const orphaned = (badge: { headers: Record<string, string> }, keys: string) =>
    fetch(`${base}/api/actors/orphaned?keys=${keys}`, { headers: badge.headers }).then(
      (r) => r.json() as Promise<{ key: string; actor: { id: string; name: string } }[]>,
    );

  it("names the actor a re-badged client should come back as", async () => {
    const lost = await mintTestBadge(base);
    const claimed = await claimOn(lost, "claude-code:s-1", "Isaac");

    // The same conversation, a new badge — a cleared `auth` block, a wiped
    // home, a client that re-badged. Its own listing is empty and correct.
    const replacement = await mintTestBadge(base);
    expect(
      await (
        await fetch(`${base}/api/actors?keys=claude-code:s-1`, { headers: replacement.headers })
      ).json(),
    ).toEqual([]);

    expect(await orphaned(replacement, "claude-code:s-1")).toEqual([
      expect.objectContaining({
        key: "claude-code:s-1",
        actor: { id: claimed.envelope.actor.id, name: "Isaac" },
      }),
    ]);
  });

  it("answers only about keys the caller named — it is not a roster", async () => {
    // A client that could ask "who is on this home?" would be handed a list of
    // actors to impersonate. Asking about a key you already hold can only ever
    // tell you about the conversation you are already inside.
    const mine = await mintTestBadge(base);
    await claimOn(mine, "claude-code:s-1", "Isaac");
    const stranger = await mintTestBadge(base);
    await claimOn(stranger, "codex:t-1", "Kenny");

    const asked = await mintTestBadge(base);
    expect(await orphaned(asked, "claude-code:s-1")).toHaveLength(1);
    expect(await orphaned(asked, "cli:never-used")).toEqual([]);
    // Naming no key at all answers nothing, rather than everything.
    expect(
      await (await fetch(`${base}/api/actors/orphaned`, { headers: asked.headers })).json(),
    ).toEqual([]);
  });

  it("never reports the caller's own claims as orphaned", async () => {
    const badge = await mintTestBadge(base);
    await claimOn(badge, "claude-code:s-1", "Isaac");
    expect(await orphaned(badge, "claude-code:s-1")).toEqual([]);
  });

  it("reports, and does not adopt — coming back stays deliberate", async () => {
    const lost = await mintTestBadge(base);
    const claimed = await claimOn(lost, "claude-code:s-1", "Isaac");
    const replacement = await mintTestBadge(base);
    await orphaned(replacement, "claude-code:s-1");

    // A standing "whoever presents the key gets the actor" rule would become
    // "anyone who learns a session key can take that actor" the moment claims
    // carry authorization. The claim has not moved.
    const desk = await deskFile();
    expect(desk.badges[lost.badgeId]!.claims).toHaveLength(1);
    expect(desk.badges[replacement.badgeId]!.claims).toEqual([]);

    // The named way back does work, and it is `as`: a same-key claim on a dead
    // badge never trips the thirty-minute window, because `reincarnate`
    // excludes the caller's own session key.
    const back = await fetch(`${base}/api/ops`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...replacement.headers },
      body: JSON.stringify({
        projectId: null,
        op: { type: "actor.claim", sessionKey: "claude-code:s-1", as: claimed.envelope.actor.id },
      }),
    });
    expect(back.status).toBe(200);
    expect(((await back.json()) as any).envelope.actor).toEqual({
      id: claimed.envelope.actor.id,
      name: "Isaac",
    });
  });
});

// ---- the durable half ----

describe("the claims half is durable", () => {
  it("recovers badges and claims from the log when the snapshot is lost", async () => {
    // A claim row carries authorization now, so a table that were truth with
    // nothing behind it would turn "I lost a file" into "I cannot have my own
    // name back until phase 9 ships kill-a-badge".
    const badge = await mintTestBadge(base);
    await fetch(`${base}/api/ops`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...badge.headers },
      body: JSON.stringify({
        projectId: null,
        op: { type: "actor.claim", sessionKey: "cli:s-1", name: "Kenny" },
      }),
    });
    await daemon.close();
    await fs.rm(p.badgesFile(home)); // lose the snapshot, keep the log
    await boot();

    // Still recognized, still Kenny.
    const bindings = (await (
      await fetch(`${base}/api/actors`, { headers: badge.headers })
    ).json()) as { key: string; actor: { name: string } }[];
    expect(bindings).toHaveLength(1);
    expect(bindings[0]!.key).toBe("cli:s-1");
    expect(bindings[0]!.actor.name).toBe("Kenny");
  });

  it("keeps a RENAMED actor's name after their claim is deleted", async () => {
    // The bug the name/claim split fixes, end to end, and the only place it
    // can be shown: a claim has to actually disappear, and a core-level
    // registry has no claims table for one to disappear FROM.
    //
    // A name used to live only on a claim row, and `actorNames` derived from
    // those rows. So an actor whose claim went away — pruned at thirty days —
    // silently reverted to whatever name was stamped on each op at the time it
    // was written: "Dion 2" still talking in a thread after Dion 2 became Di,
    // which is the exact failure the registry exists to prevent. The rename in
    // step 1 is what makes this a real test: without it the registry's name and
    // the stamped name are the same string, and losing the registry's copy
    // costs nothing visible.
    const badge = await mintTestBadge(base);
    const post = (body: unknown) =>
      fetch(`${base}/api/ops`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...badge.headers },
        body: JSON.stringify(body),
      }).then((r) => r.json() as Promise<{ envelope: { actor: { id: string } } }>);

    // 1. Claim a name, say something under it, then rename. The canvas now
    //    carries "Kenny" forever; the registry says "Kenny the Second".
    const claimed = await post({
      projectId: null,
      op: { type: "actor.claim", sessionKey: "cli:s-1", name: "Kenny" },
    });
    const actorId = claimed.envelope.actor.id;
    await post({
      projectId: null,
      actor: { id: actorId, name: "Kenny" },
      op: { type: "project.create", projectId: "prj_1", title: "Kenny's" },
    });
    await post({
      projectId: null,
      op: { type: "actor.claim", sessionKey: "cli:s-1", name: "Kenny the Second" },
    });

    // 2. Make the claim row go away, under a stopped daemon — the snapshot's
    //    `lastSeq` stays put, so the log tail does not put it back. This is
    //    what pruning did, and what phase 9's kill-a-badge will do.
    await daemon.close();
    const desk = JSON.parse(await fs.readFile(p.badgesFile(home), "utf8")) as {
      badges: Record<string, { claims: unknown[] }>;
    };
    desk.badges[badge.badgeId]!.claims = [];
    await fs.writeFile(p.badgesFile(home), JSON.stringify(desk));
    await boot();

    // 3. Nobody speaks as that actor any more — and they are still called what
    //    they renamed themselves to, not what the canvas remembers.
    const fresh = await mintTestBadge(base);
    const read = async (url: string) =>
      (await fetch(`${base}${url}`, { headers: fresh.headers })).json() as Promise<any>;

    expect(await read("/api/actors")).toEqual([]); // the claim really is gone
    const names = (await read("/api/names")) as Record<string, string>;
    expect(names[actorId]).toBe("Kenny the Second");

    // And the stale name is genuinely still on the canvas, which is the whole
    // reason the registry has to answer for it.
    const snapshot = await read("/api/projects/prj_1/canvas");
    expect(snapshot.project.createdBy).toEqual({ id: actorId, name: "Kenny" });
    expect(snapshot.names[actorId]).toBe("Kenny the Second");
  });
});

// ---- migrate ----

describe("the pre-badge home", () => {
  /** A home as it looked before the desk: claims keyed by session key, no
   * `desk/` at all. */
  async function seedLegacy(boundAt: string): Promise<void> {
    await daemon.close();
    await fs.rm(p.deskDir(home), { recursive: true, force: true });
    await fs.writeFile(
      p.actorsFile(home),
      JSON.stringify({
        lastSeq: 0,
        claims: { "isocan:legacy": { id: "usr_kenny", name: "Kenny", boundAt } },
        colors: { usr_kenny: "#0f8a80" },
      }),
    );
    await boot();
  }

  it("splits the old table in two and shelves the private half", async () => {
    const boundAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    await seedLegacy(boundAt);

    // The public half is the registry's, carrying its ORIGINAL timestamp so
    // recency carries over.
    const actors = JSON.parse(await fs.readFile(p.actorsFile(home), "utf8")) as {
      names: Record<string, { name: string; at: string }>;
      colors: Record<string, string>;
    };
    expect(actors.names["usr_kenny"]).toEqual({ name: "Kenny", at: boundAt });
    expect(actors.colors).toEqual({ usr_kenny: "#0f8a80" });

    // The old file is kept as the record of who held what when the desk
    // opened, per house precedent.
    const kept = JSON.parse(await fs.readFile(p.preBadgeActorsFile(home), "utf8")) as {
      claims: Record<string, unknown>;
    };
    expect(Object.keys(kept.claims)).toEqual(["isocan:legacy"]);

    // The private half is on the shelf: a claim belonging to no badge yet.
    const desk = await deskFile();
    expect(desk.shelf["isocan:legacy"]).toMatchObject({ actorId: "usr_kenny" });
  });

  it("hands the returning client its actor back, once", async () => {
    // Exactly today's posture — a client asserting a sessionKey is handed
    // that actor, with no credential in the picture — preserved for one hop
    // and then extinguished.
    await seedLegacy(new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());
    const returning = await mintTestBadge(base);

    // A read is a presentation of the key: `whoami` never writes, so if only
    // claiming collected the row, every upgraded agent's first command would
    // resolve to somebody else.
    const bindings = (await (
      await fetch(`${base}/api/actors?keys=isocan:legacy`, { headers: returning.headers })
    ).json()) as { key: string; actor: { id: string; name: string } }[];
    expect(bindings).toEqual([
      expect.objectContaining({ key: "isocan:legacy", actor: { id: "usr_kenny", name: "Kenny" } }),
    ]);

    // The shelf emptied itself onto the badge.
    const desk = await deskFile();
    expect(desk.shelf).toEqual({});
    expect(desk.badges[returning.badgeId]!.claims).toEqual([
      expect.objectContaining({ actorId: "usr_kenny", sessionKey: "isocan:legacy" }),
    ]);

    // First-come: a second client presenting the same key gets nothing, and
    // must come back deliberately with `--as`.
    const latecomer = await mintTestBadge(base);
    const nothing = await (
      await fetch(`${base}/api/actors?keys=isocan:legacy`, { headers: latecomer.headers })
    ).json();
    expect(nothing).toEqual([]);
  });

  it("still refuses a stranger who wants the shelved actor's name", async () => {
    // A shelved row counts as a claim for "is this name taken" and for
    // `as`-is-refused-while-somebody-is-alive. Unchanged semantics.
    await seedLegacy(new Date().toISOString());
    const stranger = await mintTestBadge(base);
    const taken = await fetch(`${base}/api/ops`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...stranger.headers },
      body: JSON.stringify({
        projectId: null,
        op: { type: "actor.claim", sessionKey: "cli:new", name: "Kenny" },
      }),
    });
    expect(taken.status).toBe(400);
    expect(((await taken.json()) as { code: string }).code).toBe("name-taken");

    const stolen = await fetch(`${base}/api/ops`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...stranger.headers },
      body: JSON.stringify({
        projectId: null,
        op: { type: "actor.claim", sessionKey: "cli:new", as: "usr_kenny" },
      }),
    });
    expect(stolen.status).toBe(400);
    expect(((await stolen.json()) as { code: string }).code).toBe("name-taken");
  });

  it("runs once — a rebooted home does not re-shelf", async () => {
    await seedLegacy(new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());
    const returning = await mintTestBadge(base);
    await fetch(`${base}/api/actors?keys=isocan:legacy`, { headers: returning.headers });
    await daemon.close();
    await boot();
    expect((await deskFile()).shelf).toEqual({});
  });
});
