import http from "node:http";
import net from "node:net";
import { existsSync, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { newCommentId, newThreadId, ownsAgent } from "@isocan/core";
import { startDaemon, type Daemon } from "@isocan/server/daemon";
import { proxyBadgeId, resolveProxyAuth } from "../../server/src/attest.ts";
import {
  claimSessionIdentity,
  DaemonClient,
  harnessVars,
  HOME_CLAIM_KEY,
  resolveExplicitIdentity,
  resolveIdentity,
} from "../src/index.ts";

const PRIYA = "priya@acme.test";
const CANVAS = "prj_acme_session_proof";
const C_NAMES = ["Charlie", "Cass", "Cleo", "Cyrus", "Coral", "Caleb", "Cato", "Ciri"];

const proxyAuth = resolveProxyAuth({ ISOCAN_PROXY_EMAIL_HEADER: "x-forwarded-email" });

let daemonHome: string;
let daemon: Daemon | null = null;
let daemonPort: number;

async function boot(options: { proxy?: typeof proxyAuth } = {}) {
  daemon = await startDaemon({
    host: "127.0.0.1",
    port: 0,
    home: daemonHome,
    birthHome: null,
    contentPort: "off",
    proxyAuth: options.proxy === undefined ? proxyAuth : options.proxy,
  });
  const addr = daemon.app.server.address();
  daemonPort = typeof addr === "object" && addr ? addr.port : 0;
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

function withHarnessEnv<T>(vars: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
  const saved: Record<string, string | undefined> = {};
  for (const key of [...harnessVars, "ISOCAN_BADGE_UPSTREAM", "ISOCAN_ACTOR_ID", "ISOCAN_ACTOR_NAME"]) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return fn().finally(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
}

beforeEach(async () => {
  daemonHome = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-api-proxy-session-"));
});

afterEach(async () => {
  await daemon?.close();
  daemon = null;
  await fs.rm(daemonHome, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe("stateless per-session agent attribution through @isocan/api", () => {
  it("lands ops from CLAUDE_CODE_SESSION_ID=conv-1 and conv-2 as two distinct agent actors owned by Priya, while a session-less client lands as Priya", async () => {
    await boot();
    const proxy = await startReverseProxy(daemonPort, PRIYA);
    const clientHome1 = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-client-1-"));
    const clientHome2 = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-client-2-"));
    const clientHomeHuman = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-client-human-"));

    try {
      // 1. Human client with no harness session resolves Priya (home:person) and creates a canvas.
      const priyaResolved = await withHarnessEnv({}, async () => {
        const client = new DaemonClient(proxy.base, clientHomeHuman);
        client.direct = true;
        const resolved = await resolveIdentity(client, clientHomeHuman);
        expect(resolved).not.toBeNull();
        expect(resolved!.source).toBe("home");
        expect(resolved!.key).toBe(HOME_CLAIM_KEY);
        expect(resolved!.actor.name).toBe("priya");
        expect(existsSync(path.join(clientHomeHuman, "identity.json"))).toBe(false);

        await client.sendOp(null, resolved!.actor, {
          type: "project.create",
          canvasId: CANVAS,
          title: "Acme architecture",
        });
        return resolved!;
      });

      // 2. First agent client (CLAUDE_CODE_SESSION_ID=conv-1) with zero prior identity --session calls.
      const agent1Resolved = await withHarnessEnv({ CLAUDE_CODE_SESSION_ID: "conv-1" }, async () => {
        const client = new DaemonClient(proxy.base, clientHome1);
        client.direct = true;
        const resolved = await resolveIdentity(client, clientHome1);
        expect(resolved).not.toBeNull();
        expect(resolved!.source).toBe("session");
        expect(resolved!.harness).toBe("claude-code");
        expect(resolved!.key).toBe("claude-code:conv-1");
        expect(C_NAMES).toContain(resolved!.actor.name);
        expect(existsSync(path.join(clientHome1, "identity.json"))).toBe(false);

        await client.sendOp(CANVAS, resolved!.actor, {
          type: "thread.create",
          threadId: newThreadId(),
          x: 10,
          y: 10,
          anchorItemId: null,
          comment: { id: newCommentId(), body: "First session reporting in." },
        });
        return resolved!;
      });

      // 3. Second agent client (CLAUDE_CODE_SESSION_ID=conv-2) with zero prior identity --session calls.
      const agent2Resolved = await withHarnessEnv({ CLAUDE_CODE_SESSION_ID: "conv-2" }, async () => {
        const client = new DaemonClient(proxy.base, clientHome2);
        client.direct = true;
        const resolved = await resolveIdentity(client, clientHome2);
        expect(resolved).not.toBeNull();
        expect(resolved!.source).toBe("session");
        expect(resolved!.harness).toBe("claude-code");
        expect(resolved!.key).toBe("claude-code:conv-2");
        expect(C_NAMES).toContain(resolved!.actor.name);
        expect(resolved!.actor.id).not.toBe(agent1Resolved.actor.id);
        expect(resolved!.actor.name).not.toBe(agent1Resolved.actor.name);

        await client.sendOp(CANVAS, resolved!.actor, {
          type: "thread.create",
          threadId: newThreadId(),
          x: 40,
          y: 40,
          anchorItemId: null,
          comment: { id: newCommentId(), body: "Second session reporting in." },
        });
        return resolved!;
      });

      // Verify oplog authorship: project.create by Priya, two thread.creates by agent1 and agent2.
      const reader = new DaemonClient(proxy.base, clientHomeHuman);
      reader.direct = true;
      const log = await reader.getLog(CANVAS, 0);
      const actorsInLog = log.map((entry) => entry.envelope.actor);
      expect(actorsInLog).toEqual([
        priyaResolved.actor,
        agent1Resolved.actor,
        agent2Resolved.actor,
      ]);

      // Verify actorKinds marks both agents as "agent" and leaves Priya as a person.
      const kinds = await reader.actorKinds();
      expect(kinds[agent1Resolved.actor.id]).toBe("agent");
      expect(kinds[agent2Resolved.actor.id]).toBe("agent");
      expect(kinds[priyaResolved.actor.id]).toBeUndefined();

      // Verify ownsAgent holds for Priya over both session agents on her proxy badge.
      const proxyBadge = await daemon!.desk.badge(proxyBadgeId(`email:${PRIYA}`));
      expect(proxyBadge).not.toBeNull();
      expect(ownsAgent([proxyBadge!.claims], priyaResolved.actor.id, kinds[agent1Resolved.actor.id] === "agent")).toBe(true);
      expect(ownsAgent([proxyBadge!.claims], priyaResolved.actor.id, kinds[agent2Resolved.actor.id] === "agent")).toBe(true);
    } finally {
      await proxy.close();
      await fs.rm(clientHome1, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      await fs.rm(clientHome2, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      await fs.rm(clientHomeHuman, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it("supports explicit session identity while suppressing X-Isocan-Session for enrolled agent: keys and explicit claimSessionIdentity", async () => {
    await boot();
    const proxy = await startReverseProxy(daemonPort, PRIYA);
    const clientHome = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-client-explicit-"));

    try {
      await withHarnessEnv({}, async () => {
        const client = new DaemonClient(proxy.base, clientHome);
        client.direct = true;

        // Explicit coding-harness session auto-claims on a proxy-authenticated home.
        const explicitAgent = await resolveExplicitIdentity(client, clientHome, {
          harness: "claude-code",
          session: "conv-3",
        });
        expect(explicitAgent).not.toBeNull();
        expect(explicitAgent!.key).toBe("claude-code:conv-3");
        expect(C_NAMES).toContain(explicitAgent!.actor.name);

        // Enrolled agent: harness key does NOT auto-claim via X-Isocan-Session.
        const enrolledLookup = await resolveExplicitIdentity(client, clientHome, {
          harness: "agent",
          session: "unclaimed-bot",
        });
        expect(enrolledLookup).toBeNull();
      });

      // Explicit claimSessionIdentity with --name claims the requested name directly without pre-minting a C-name.
      await withHarnessEnv({ CLAUDE_CODE_SESSION_ID: "conv-named" }, async () => {
        const client = new DaemonClient(proxy.base, clientHome);
        client.direct = true;
        const named = await claimSessionIdentity(client, clientHome, { name: "Bespoke" });
        expect(named.actor.name).toBe("Bespoke");
        expect(named.harness).toBe("claude-code");
      });
    } finally {
      await proxy.close();
      await fs.rm(clientHome, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it("does not auto-claim an actor when talking to a non-proxy local daemon", async () => {
    await boot({ proxy: null });
    const clientHome = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-client-local-"));

    try {
      await withHarnessEnv({ CLAUDE_CODE_SESSION_ID: "conv-local" }, async () => {
        const client = new DaemonClient(`http://127.0.0.1:${daemonPort}`, clientHome);
        const resolved = await resolveIdentity(client, clientHome);
        expect(resolved).toBeNull();
      });
    } finally {
      await fs.rm(clientHome, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });
});
