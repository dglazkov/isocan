import http from "node:http";
import net from "node:net";
import { existsSync, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { WebSocket } from "ws";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ACTOR_KINDS_ROUTE,
  BADGE_ENDED,
  CANVAS_GROUPS_FEATURE,
  CLIENT_FEATURES_HEADER,
  ENDED,
  NOT_ADMITTED,
  ownsAgent,
  parseSessionHeader,
  REFUSED,
  SESSION_HEADER,
  WS_BAD_ORIGIN,
  WS_NO_BADGE,
  WS_NOT_ADMITTED,
  type ActorBindingRecord,
  type ActorKinds,
  type ServerMessage,
} from "@isocan/core";
import { DaemonClient, harnessVars, HOME_CLAIM_KEY, resolveIdentity } from "@isocan/api";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { proxyBadgeId, resolveProxyAuth } from "../src/attest.ts";
import { currentSocketUrl, mintTestBadge } from "./badge.ts";

const PRIYA = "priya@acme.test";
const SAM = "sam@acme.test";
const OLU = "olu@acme.test";
const CANVAS = "prj_acme_proxy";

const proxyAuth = resolveProxyAuth({ ISOCAN_PROXY_EMAIL_HEADER: "x-forwarded-email" });

let home: string;
let daemon: Daemon | null = null;
let base: string;
let port: number;
const origAllowedOrigins = process.env.ISOCAN_ALLOWED_ORIGINS;

async function boot(options: { proxy?: typeof proxyAuth; operators?: string[] } = {}) {
  daemon = await startDaemon({
    host: "127.0.0.1",
    port: 0,
    home,
    birthHome: null,
    contentPort: "off",
    proxyAuth: options.proxy === undefined ? proxyAuth : options.proxy,
    operators: options.operators ?? [`email:${OLU}`],
  });
  const addr = daemon.app.server.address();
  port = typeof addr === "object" && addr ? addr.port : 0;
  base = `http://127.0.0.1:${port}`;
}

function proxyHeaders(email: string, extra: Record<string, string> = {}): Record<string, string> {
  return {
    "x-forwarded-email": email,
    [CLIENT_FEATURES_HEADER]: CANVAS_GROUPS_FEATURE,
    ...extra,
  };
}

function connectSocket(
  url: string,
  headers: Record<string, string> = {},
): Promise<{
  outcome: "message" | "close" | "error";
  message?: ServerMessage;
  code?: number;
  reason?: string;
  ws: WebSocket;
}> {
  return new Promise((resolve) => {
    const ws = new WebSocket(url, { headers });
    let settled = false;
    const finish = (result: {
      outcome: "message" | "close" | "error";
      message?: ServerMessage;
      code?: number;
      reason?: string;
      ws: WebSocket;
    }) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    ws.once("message", (data) => {
      const parsed = JSON.parse(String(data)) as ServerMessage;
      finish({ outcome: "message", message: parsed, ws });
    });
    ws.once("close", (code, reason) => {
      finish({ outcome: "close", code, reason: reason.toString("utf8"), ws });
    });
    ws.once("error", () => {
      finish({ outcome: "error", ws });
    });
  });
}

async function startReverseProxy(targetPort: number, email: string) {
  const sockets = new Set<net.Socket>();
  const server = http.createServer((req, res) => {
    const upstream = http.request(
      {
        host: "127.0.0.1",
        port: targetPort,
        method: req.method,
        path: req.url,
        headers: {
          ...req.headers,
          "x-forwarded-email": email,
        },
      },
      (upRes) => {
        res.writeHead(upRes.statusCode ?? 502, upRes.headers);
        upRes.pipe(res);
      },
    );
    upstream.on("error", (err) => {
      if (!res.headersSent) res.writeHead(502);
      res.end(err.message);
    });
    req.pipe(upstream);
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const addr = server.address() as net.AddressInfo;
  return {
    base: `http://127.0.0.1:${addr.port}`,
    close: async () => {
      for (const s of sockets) s.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-proxy-identity-"));
});

afterEach(async () => {
  if (origAllowedOrigins === undefined) delete process.env.ISOCAN_ALLOWED_ORIGINS;
  else process.env.ISOCAN_ALLOWED_ORIGINS = origAllowedOrigins;
  await daemon?.close();
  daemon = null;
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe("proxyBadgeId", () => {
  it("computes a deterministic bdg_prx_ id over the normalized attribute", () => {
    const id = proxyBadgeId("email:priya@acme.test");
    expect(id).toMatch(/^bdg_prx_[A-Za-z0-9_-]{16}$/);
    expect(proxyBadgeId("email:Priya@Acme.Test")).toBe(id);
    expect(proxyBadgeId("email:sam@acme.test")).not.toBe(id);
  });
});

describe("stateless proxy principal at the door", () => {
  it("accepts badge-less HTTP requests and /ws upgrades carrying X-Forwarded-Email, binding one deterministic proxy badge and human actor", async () => {
    await boot();
    const expectedBadgeId = proxyBadgeId(`email:${PRIYA}`);

    // First arrival: two concurrent badge-less reads serialize and mint a single usr_... actor.
    const [firstRes, secondRes] = await Promise.all([
      fetch(`${base}/api/actors?keys=${encodeURIComponent(HOME_CLAIM_KEY)}`, {
        headers: proxyHeaders(PRIYA),
      }),
      fetch(`${base}/api/actors?keys=${encodeURIComponent(HOME_CLAIM_KEY)}`, {
        headers: proxyHeaders(PRIYA),
      }),
    ]);
    expect(firstRes.status).toBe(200);
    expect(secondRes.status).toBe(200);

    const firstBindings = (await firstRes.json()) as ActorBindingRecord[];
    const secondBindings = (await secondRes.json()) as ActorBindingRecord[];
    expect(firstBindings).toHaveLength(1);
    expect(firstBindings[0]!.key).toBe(HOME_CLAIM_KEY);
    expect(firstBindings[0]!.actor.name).toBe("priya");
    expect(firstBindings[0]!.actor.id).toMatch(/^usr_/);
    expect(secondBindings[0]!.actor).toEqual(firstBindings[0]!.actor);

    const priyaActor = firstBindings[0]!.actor;

    // GET /api/attest includes bound: priyaActor so SsoGate adopts home:person without a redundant claim.
    const attestRes = await fetch(`${base}/api/attest`, {
      headers: proxyHeaders(PRIYA),
    });
    expect(attestRes.status).toBe(200);
    expect(await attestRes.json()).toMatchObject({
      attesters: ["email"],
      auth: null,
      attestations: [{ attribute: `email:${PRIYA}`, verifiedVia: "proxy" }],
      resumable: [],
      bound: priyaActor,
    });

    // Desk holds the deterministic proxy badge with secretHash: "" and the proxy attestation.
    const record = await daemon!.desk.badge(expectedBadgeId);
    expect(record).not.toBeNull();
    expect(record!.secretHash).toBe("");
    expect(record!.attestations).toEqual([
      expect.objectContaining({ attribute: `email:${PRIYA}`, verifiedVia: "proxy" }),
    ]);

    // Badge-less POST /api/ops creates a canvas under Priya's resolved actor.
    const createRes = await fetch(`${base}/api/ops`, {
      method: "POST",
      headers: {
        ...proxyHeaders(PRIYA),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        canvasId: null,
        actor: priyaActor,
        op: { type: "project.create", canvasId: CANVAS, title: "Acme roadmap" },
      }),
    });
    expect(createRes.status).toBe(200);

    // Badge-less WebSocket upgrade carrying X-Forwarded-Email receives the canvas snapshot.
    const wsUrl = currentSocketUrl(`ws://127.0.0.1:${port}/ws?canvasId=${CANVAS}`);
    const connected = await connectSocket(wsUrl, { "x-forwarded-email": PRIYA });
    expect(connected.outcome).toBe("message");
    expect(connected.message?.type).toBe("snapshot");
    connected.ws.close();
  });

  it("folds onto an existing person actor when another live badge already attested the same email", async () => {
    await boot();

    // Pre-existing badge claims Priya's human identity and attests email:priya@acme.test.
    const legacy = await mintTestBadge(base);
    const existingPriya = { id: "usr_priya_existing", name: "Priya" };
    await legacy.speakAs(existingPriya, "web:browser-1");
    await daemon!.desk.attest(legacy.badgeId, {
      attribute: `email:${PRIYA}`,
      verifiedVia: "proxy",
      at: new Date().toISOString(),
    });

    // Badge-less proxy arrival folds onto usr_priya_existing rather than minting a duplicate.
    const res = await fetch(`${base}/api/actors?keys=${encodeURIComponent(HOME_CLAIM_KEY)}`, {
      headers: proxyHeaders(PRIYA),
    });
    expect(res.status).toBe(200);
    const bindings = (await res.json()) as ActorBindingRecord[];
    expect(bindings).toHaveLength(1);
    expect(bindings[0]!.actor).toEqual(existingPriya);
  });

  it("allocates distinct human actors when two domains share an email local-part", async () => {
    await boot();

    const first = await fetch(`${base}/api/actors?keys=${encodeURIComponent(HOME_CLAIM_KEY)}`, {
      headers: proxyHeaders("priya@acme.test"),
    });
    const second = await fetch(`${base}/api/actors?keys=${encodeURIComponent(HOME_CLAIM_KEY)}`, {
      headers: proxyHeaders("priya@partner.test"),
    });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const firstActor = ((await first.json()) as ActorBindingRecord[])[0]!.actor;
    const secondActor = ((await second.json()) as ActorBindingRecord[])[0]!.actor;
    expect(firstActor.name).toBe("priya");
    expect(secondActor.name).toBe("priya");
    expect(firstActor.id).not.toBe(secondActor.id);
  });

  it("refuses Authorization: Bearer bdg_prx_....anything when the proxy header is absent", async () => {
    await boot();
    const id = proxyBadgeId(`email:${PRIYA}`);

    // Materialize the proxy badge on the desk first.
    expect(
      (
        await fetch(`${base}/api/actors?keys=${encodeURIComponent(HOME_CLAIM_KEY)}`, {
          headers: proxyHeaders(PRIYA),
        })
      ).status,
    ).toBe(200);

    // Presenting bdg_prx_... as a bearer token without the proxy header is refused.
    const forged = await fetch(`${base}/api/actors?keys=${encodeURIComponent(HOME_CLAIM_KEY)}`, {
      headers: {
        Authorization: `Bearer ${id}.anything`,
        [CLIENT_FEATURES_HEADER]: CANVAS_GROUPS_FEATURE,
      },
    });
    expect(forged.status).toBe(401);
    expect(((await forged.json()) as { code: string }).code).toBe("bad-badge");
  });

  it("refuses cross-origin HTTP requests and /ws upgrades outside ISOCAN_ALLOWED_ORIGINS", async () => {
    process.env.ISOCAN_ALLOWED_ORIGINS = "https://trusted.acme.test";
    await boot();

    // Allowed origin succeeds.
    const allowedRes = await fetch(`${base}/api/actors?keys=${encodeURIComponent(HOME_CLAIM_KEY)}`, {
      headers: proxyHeaders(PRIYA, { Origin: "https://trusted.acme.test" }),
    });
    expect(allowedRes.status).toBe(200);
    const priyaActor = ((await allowedRes.json()) as ActorBindingRecord[])[0]!.actor;

    // Seed a canvas from the allowed origin.
    expect(
      (
        await fetch(`${base}/api/ops`, {
          method: "POST",
          headers: {
            ...proxyHeaders(PRIYA, { Origin: "https://trusted.acme.test" }),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            canvasId: null,
            actor: priyaActor,
            op: { type: "project.create", canvasId: CANVAS, title: "Acme security" },
          }),
        })
      ).status,
    ).toBe(200);

    // Cross-origin POST outside ISOCAN_ALLOWED_ORIGINS is refused 403 bad-origin.
    const evilPost = await fetch(`${base}/api/ops`, {
      method: "POST",
      headers: {
        ...proxyHeaders(PRIYA, { Origin: "https://evil.acme.test" }),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        canvasId: null,
        actor: priyaActor,
        op: { type: "project.create", canvasId: "prj_evil", title: "Evil" },
      }),
    });
    expect(evilPost.status).toBe(403);
    expect(((await evilPost.json()) as { code: string }).code).toBe("bad-origin");

    // Cross-origin /ws upgrade outside ISOCAN_ALLOWED_ORIGINS is closed WS_BAD_ORIGIN (4403).
    const wsUrl = currentSocketUrl(`ws://127.0.0.1:${port}/ws?canvasId=${CANVAS}`);
    const evilWs = await connectSocket(wsUrl, {
      "x-forwarded-email": PRIYA,
      origin: "https://evil.acme.test",
    });
    expect(evilWs.outcome).toBe("close");
    expect(evilWs.code).toBe(WS_BAD_ORIGIN);
  });

  it("honors operator badge ends without resurrecting the proxy badge on HTTP or /ws", async () => {
    await boot();
    const samBadgeId = proxyBadgeId(`email:${SAM}`);

    // Sam arrives behind the proxy and creates a canvas.
    const samRes = await fetch(`${base}/api/actors?keys=${encodeURIComponent(HOME_CLAIM_KEY)}`, {
      headers: proxyHeaders(SAM),
    });
    const samActor = ((await samRes.json()) as ActorBindingRecord[])[0]!.actor;
    expect(
      (
        await fetch(`${base}/api/ops`, {
          method: "POST",
          headers: { ...proxyHeaders(SAM), "Content-Type": "application/json" },
          body: JSON.stringify({
            canvasId: null,
            actor: samActor,
            op: { type: "project.create", canvasId: CANVAS, title: "Sam canvas" },
          }),
        })
      ).status,
    ).toBe(200);

    // Operator Olu ends Sam's proxy badge.
    const endRes = await fetch(`${base}/api/operator/end/${encodeURIComponent(samBadgeId)}`, {
      method: "POST",
      headers: { ...proxyHeaders(OLU), "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "harassment" }),
    });
    expect(endRes.status).toBe(200);

    // Subsequent badge-less HTTP request from Sam meets 401 badge-ended and does not resurrect.
    const afterHttp = await fetch(`${base}/api/actors?keys=${encodeURIComponent(HOME_CLAIM_KEY)}`, {
      headers: proxyHeaders(SAM),
    });
    expect(afterHttp.status).toBe(401);
    const body = (await afterHttp.json()) as { code: string; reason: string; error: string };
    expect(body.code).toBe(BADGE_ENDED);
    expect(body.reason).toBe("operator");
    expect(body.error).toContain("ended by the operator");
    expect(await daemon!.desk.badge(samBadgeId)).toBeNull();

    // Subsequent badge-less /ws upgrade from Sam closes WS_NOT_ADMITTED with reason ENDED.
    const wsUrl = currentSocketUrl(`ws://127.0.0.1:${port}/ws?canvasId=${CANVAS}`);
    const afterWs = await connectSocket(wsUrl, { "x-forwarded-email": SAM });
    expect(afterWs.outcome).toBe("close");
    expect(afterWs.code).toBe(WS_NOT_ADMITTED);
    expect(afterWs.reason).toBe(ENDED);
  });

  it("honors operator address refusals on proxy-authenticated HTTP requests and /ws upgrades", async () => {
    await boot();

    // Priya creates a canvas; Operator Olu refuses email:sam@acme.test before Sam arrives.
    const priyaRes = await fetch(`${base}/api/actors?keys=${encodeURIComponent(HOME_CLAIM_KEY)}`, {
      headers: proxyHeaders(PRIYA),
    });
    const priyaActor = ((await priyaRes.json()) as ActorBindingRecord[])[0]!.actor;
    expect(
      (
        await fetch(`${base}/api/ops`, {
          method: "POST",
          headers: { ...proxyHeaders(PRIYA), "Content-Type": "application/json" },
          body: JSON.stringify({
            canvasId: null,
            actor: priyaActor,
            op: { type: "project.create", canvasId: CANVAS, title: "Acme canvas" },
          }),
        })
      ).status,
    ).toBe(200);

    const refuseRes = await fetch(
      `${base}/api/operator/refuse/${encodeURIComponent(`email:${SAM}`)}`,
      {
        method: "POST",
        headers: { ...proxyHeaders(OLU), "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "spam" }),
      },
    );
    expect(refuseRes.status).toBe(200);

    // Sam arriving behind the proxy is turned away from the canvas with 403 not-admitted (refused).
    const samCanvasHttp = await fetch(`${base}/api/projects/${CANVAS}/canvas`, {
      headers: proxyHeaders(SAM),
    });
    expect(samCanvasHttp.status).toBe(403);
    const body = (await samCanvasHttp.json()) as { code: string; reason: string; error: string };
    expect(body.code).toBe(NOT_ADMITTED);
    expect(body.reason).toBe(REFUSED);
    expect(body.error).toContain(`will not admit ${SAM}`);

    // Sam's WebSocket upgrade is closed WS_NOT_ADMITTED with reason REFUSED.
    const wsUrl = currentSocketUrl(`ws://127.0.0.1:${port}/ws?canvasId=${CANVAS}`);
    const samWs = await connectSocket(wsUrl, { "x-forwarded-email": SAM });
    expect(samWs.outcome).toBe("close");
    expect(samWs.code).toBe(WS_NOT_ADMITTED);
    expect(samWs.reason).toBe(REFUSED);
  });

  it("leaves a daemon without ISOCAN_PROXY_EMAIL_HEADER refusing badge-less requests with 401 no-badge", async () => {
    await boot({ proxy: null });

    const res = await fetch(`${base}/api/actors?keys=${encodeURIComponent(HOME_CLAIM_KEY)}`, {
      headers: proxyHeaders(PRIYA),
    });
    expect(res.status).toBe(401);
    expect(((await res.json()) as { code: string }).code).toBe("no-badge");

    const wsUrl = currentSocketUrl(`ws://127.0.0.1:${port}/ws?canvasId=${CANVAS}`);
    const ws = await connectSocket(wsUrl, { "x-forwarded-email": PRIYA });
    expect(ws.outcome).toBe("close");
    expect(ws.code).toBe(WS_NO_BADGE);
  });

  it("discovers the proxy-bound human actor in resolveIdentity with no ~/.isocan/identity.json", async () => {
    await boot();
    const proxy = await startReverseProxy(port, PRIYA);
    const clientHome = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-proxy-client-"));

    try {
      const client = new DaemonClient(proxy.base, clientHome);
      client.direct = true;

      // Ensure no harness session env vars interfere with the human terminal path.
      const savedEnv: Record<string, string | undefined> = {};
      for (const key of harnessVars) {
        if (key in process.env) {
          savedEnv[key] = process.env[key];
          delete process.env[key];
        }
      }

      try {
        const resolved = await resolveIdentity(client, clientHome);
        expect(resolved).not.toBeNull();
        expect(resolved!.source).toBe("home");
        expect(resolved!.key).toBe(HOME_CLAIM_KEY);
        expect(resolved!.actor.name).toBe("priya");
        expect(resolved!.actor.id).toMatch(/^usr_/);

        // Zero local state was needed or written to ~/.isocan/identity.json.
        expect(existsSync(path.join(clientHome, "identity.json"))).toBe(false);
      } finally {
        for (const [k, v] of Object.entries(savedEnv)) {
          if (v === undefined) delete process.env[k];
          else process.env[k] = v;
        }
      }
    } finally {
      await proxy.close();
      await fs.rm(clientHome, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });
});

describe("parseSessionHeader", () => {
  it("accepts valid <harness>:<sessionId> keys and rejects person/replica harnesses or malformed values", () => {
    expect(parseSessionHeader("claude-code:conv-1")).toBe("claude-code:conv-1");
    expect(parseSessionHeader("  antigravity:630e3ee9  ")).toBe("antigravity:630e3ee9");
    expect(parseSessionHeader(["codex:thr-12", "ignored"])).toBe("codex:thr-12");

    // Person harnesses and replica transport keys are never accepted as agent sessions.
    expect(parseSessionHeader("web:tab-1")).toBeNull();
    expect(parseSessionHeader("home:person")).toBeNull();
    expect(parseSessionHeader("cli:term-1")).toBeNull();
    expect(parseSessionHeader("person:one")).toBeNull();
    expect(parseSessionHeader("replica:sync-1")).toBeNull();

    // Missing parts, internal whitespace, control characters, non-ASCII, and > 256 length are rejected.
    expect(parseSessionHeader(undefined)).toBeNull();
    expect(parseSessionHeader(null)).toBeNull();
    expect(parseSessionHeader("")).toBeNull();
    expect(parseSessionHeader("claude-code")).toBeNull();
    expect(parseSessionHeader("claude-code:")).toBeNull();
    expect(parseSessionHeader(":conv-1")).toBeNull();
    expect(parseSessionHeader("claude-code:conv 1")).toBeNull();
    expect(parseSessionHeader("claude-code:conv\r\n1")).toBeNull();
    expect(parseSessionHeader("claude-code:conv\x001")).toBeNull();
    expect(parseSessionHeader("claude-code:café")).toBeNull();
    expect(parseSessionHeader(`claude-code:${"x".repeat(250)}`)).toBeNull();
  });
});

describe("stateless per-session agent attribution on proxy-authenticated homes", () => {
  const C_NAMES = ["Charlie", "Cass", "Cleo", "Cyrus", "Coral", "Caleb", "Cato", "Ciri"];

  it("auto-claims distinct session agent actors on Priya's proxy badge on first sight, while requests without X-Isocan-Session speak as Priya", async () => {
    await boot();
    const expectedBadgeId = proxyBadgeId(`email:${PRIYA}`);

    // First session (claude-code:conv-1) arrives with two concurrent requests: serializes and mints one C-name agent.
    const [s1First, s1Second] = await Promise.all([
      fetch(`${base}/api/actors?keys=${encodeURIComponent("claude-code:conv-1")}`, {
        headers: proxyHeaders(PRIYA, { [SESSION_HEADER]: "claude-code:conv-1" }),
      }),
      fetch(`${base}/api/actors?keys=${encodeURIComponent("claude-code:conv-1")}`, {
        headers: proxyHeaders(PRIYA, { [SESSION_HEADER]: "claude-code:conv-1" }),
      }),
    ]);
    expect(s1First.status).toBe(200);
    expect(s1Second.status).toBe(200);

    const b1First = (await s1First.json()) as ActorBindingRecord[];
    const b1Second = (await s1Second.json()) as ActorBindingRecord[];
    expect(b1First).toHaveLength(1);
    expect(b1Second[0]!.actor).toEqual(b1First[0]!.actor);
    const agent1 = b1First[0]!.actor;
    expect(C_NAMES).toContain(agent1.name);

    // Second session (claude-code:conv-2) arrives and receives a distinct C-name agent.
    const s2Res = await fetch(
      `${base}/api/actors?keys=${encodeURIComponent("claude-code:conv-2")}`,
      {
        headers: proxyHeaders(PRIYA, { [SESSION_HEADER]: "claude-code:conv-2" }),
      },
    );
    expect(s2Res.status).toBe(200);
    const b2 = (await s2Res.json()) as ActorBindingRecord[];
    expect(b2).toHaveLength(1);
    const agent2 = b2[0]!.actor;
    expect(C_NAMES).toContain(agent2.name);
    expect(agent2.id).not.toBe(agent1.id);
    expect(agent2.name).not.toBe(agent1.name);

    // Request with no X-Isocan-Session resolves Priya's human actor (home:person).
    const humanRes = await fetch(
      `${base}/api/actors?keys=${encodeURIComponent(HOME_CLAIM_KEY)}`,
      {
        headers: proxyHeaders(PRIYA),
      },
    );
    expect(humanRes.status).toBe(200);
    const priyaActor = ((await humanRes.json()) as ActorBindingRecord[])[0]!.actor;
    expect(priyaActor.name).toBe("priya");
    expect(priyaActor.id).not.toBe(agent1.id);
    expect(priyaActor.id).not.toBe(agent2.id);

    // Both session actors are classified as agents in actorKinds, while Priya is a person.
    const kindsRes = await fetch(`${base}${ACTOR_KINDS_ROUTE}`, {
      headers: proxyHeaders(PRIYA),
    });
    expect(kindsRes.status).toBe(200);
    const kinds = (await kindsRes.json()) as ActorKinds;
    expect(kinds[agent1.id]).toBe("agent");
    expect(kinds[agent2.id]).toBe("agent");
    expect(kinds[priyaActor.id]).toBeUndefined();

    // Both session agents sit on Priya's proxy badge alongside home:person, so ownsAgent is true.
    const proxyBadge = await daemon!.desk.badge(expectedBadgeId);
    expect(proxyBadge).not.toBeNull();
    expect(ownsAgent([proxyBadge!.claims], priyaActor.id, kinds[agent1.id] === "agent")).toBe(true);
    expect(ownsAgent([proxyBadge!.claims], priyaActor.id, kinds[agent2.id] === "agent")).toBe(true);
  });

  it("ignores X-Isocan-Session when proxyAuth is not configured on the daemon", async () => {
    await boot({ proxy: null });
    const badge = await mintTestBadge(base);

    const res = await fetch(
      `${base}/api/actors?keys=${encodeURIComponent("claude-code:conv-local")}`,
      {
        headers: {
          ...badge.headers,
          [CLIENT_FEATURES_HEADER]: CANVAS_GROUPS_FEATURE,
          [SESSION_HEADER]: "claude-code:conv-local",
        },
      },
    );
    expect(res.status).toBe(200);
    const bindings = (await res.json()) as ActorBindingRecord[];
    expect(bindings).toEqual([]);
  });
});
