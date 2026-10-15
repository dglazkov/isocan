import http from "node:http";
import net from "node:net";
import { existsSync, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startDaemon, type Daemon } from "@isocan/server/daemon";
import { configuredHomeAuthUrl, homeAuthFor, paths } from "@isocan/server";
import { resolveProxyAuth } from "../../server/src/attest.ts";
import { parseAuthHelperOutput } from "../src/auth-helper.ts";
import {
  DaemonClient,
  harnessVars,
  resolveIdentity,
} from "../src/index.ts";
import { cliEnv, runCli } from "../../cli/test/cli.ts";

const PRIYA = "priya@acme.test";
const LOGIN_URL = "https://login.acme.test/auth";

const proxyAuth = resolveProxyAuth({ ISOCAN_PROXY_EMAIL_HEADER: "x-forwarded-email" });

interface ReverseProxyControl {
  base: string;
  doorCalls: number;
  loginRedirects: number;
  expiredRejections: number;
  spoofedEmailSeen: string[];
  setActiveToken(token: string): void;
  expireToken(token: string, mode: "401" | "302"): void;
  close(): Promise<void>;
}

async function startAuthReverseProxy(targetPort: number, email: string): Promise<ReverseProxyControl> {
  const sockets = new Set<net.Socket>();
  let activeToken = "tok-initial";
  const expired401 = new Set<string>();
  const expired302 = new Set<string>();
  const spoofedEmailSeen: string[] = [];
  let doorCalls = 0;
  let loginRedirects = 0;
  let expiredRejections = 0;

  const server = http.createServer((req, res) => {
    if (req.url?.startsWith("/api/door")) {
      doorCalls += 1;
    }
    const clientEmail = req.headers["x-forwarded-email"];
    if (typeof clientEmail === "string") {
      spoofedEmailSeen.push(clientEmail);
    }

    const token = req.headers["x-acme-token"];
    if (typeof token !== "string" || token.length === 0 || expired302.has(token)) {
      loginRedirects += 1;
      res.writeHead(302, { location: LOGIN_URL });
      res.end();
      return;
    }
    if (expired401.has(token)) {
      expiredRejections += 1;
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "token expired" }));
      return;
    }
    if (token !== activeToken) {
      loginRedirects += 1;
      res.writeHead(302, { location: LOGIN_URL });
      res.end();
      return;
    }

    // Strip any client-supplied X-Forwarded-Email and inject the verified email upstream.
    const forwardedHeaders: http.IncomingHttpHeaders = { ...req.headers };
    delete forwardedHeaders["x-forwarded-email"];
    delete forwardedHeaders["x-acme-token"];
    forwardedHeaders["x-forwarded-email"] = email;

    const upstream = http.request(
      {
        host: "127.0.0.1",
        port: targetPort,
        method: req.method,
        path: req.url,
        headers: forwardedHeaders,
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
    get doorCalls() {
      return doorCalls;
    },
    get loginRedirects() {
      return loginRedirects;
    },
    get expiredRejections() {
      return expiredRejections;
    },
    spoofedEmailSeen,
    setActiveToken(token: string) {
      activeToken = token;
    },
    expireToken(token: string, mode: "401" | "302") {
      if (mode === "401") expired401.add(token);
      else expired302.add(token);
    },
    close: async () => {
      for (const s of sockets) s.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

async function startForwardProxy() {
  const sockets = new Set<net.Socket>();
  let proxiedRequests = 0;

  const server = http.createServer((req, res) => {
    proxiedRequests += 1;
    const target = new URL(req.url ?? "");
    const upstream = http.request(
      {
        host: target.hostname,
        port: Number(target.port || 80),
        method: req.method,
        path: `${target.pathname}${target.search}`,
        headers: req.headers,
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
    proxyUrl: `http://127.0.0.1:${addr.port}`,
    get proxiedRequests() {
      return proxiedRequests;
    },
    close: async () => {
      for (const s of sockets) s.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

let tempDir: string;
let daemon: Daemon | null = null;
let daemonPort = 0;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-auth-helper-"));
  const daemonHome = path.join(tempDir, "daemon-home");
  await fs.mkdir(daemonHome, { recursive: true });
  daemon = await startDaemon({
    host: "127.0.0.1",
    port: 0,
    home: daemonHome,
    birthHome: null,
    contentPort: "off",
    proxyAuth,
  });
  const addr = daemon.app.server.address();
  daemonPort = typeof addr === "object" && addr ? addr.port : 0;
});

afterEach(async () => {
  await daemon?.close();
  daemon = null;
  await fs.rm(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe("homeAuth configuration and credential helper parsing", () => {
  it("resolves homeAuth from config.json, ISOCAN_HOME_AUTH, and ISOCAN_AUTH_HEADER_COMMAND", async () => {
    const clientHome = path.join(tempDir, "cfg-home");
    await fs.mkdir(clientHome, { recursive: true });
    await fs.writeFile(
      paths.configFile(clientHome),
      JSON.stringify({
        homeAuth: {
          "https://canvas.acme.test/": {
            authHeaderCommand: ["acme-helper", "--header"],
            httpProxy: "http://127.0.0.1:3128",
            ttlSeconds: 120,
          },
        },
      }),
    );

    expect(configuredHomeAuthUrl(clientHome, {})).toBe("https://canvas.acme.test");
    expect(homeAuthFor("https://canvas.acme.test", clientHome, {})).toEqual({
      authHeaderCommand: ["acme-helper", "--header"],
      httpProxy: "http://127.0.0.1:3128",
      ttlSeconds: 120,
    });

    const fromEnvMap = homeAuthFor("https://other.acme.test/", clientHome, {
      ISOCAN_HOME_AUTH: JSON.stringify({
        "https://other.acme.test": {
          authHeaderCommand: '["acme-env-helper","--token"]',
          ttlSeconds: 60,
        },
      }),
    });
    expect(fromEnvMap).toEqual({
      authHeaderCommand: ["acme-env-helper", "--token"],
      ttlSeconds: 60,
    });

    const fromEnvCommand = homeAuthFor("https://single.acme.test", path.join(tempDir, "empty-home"), {
      ISOCAN_HOME_URL: "https://single.acme.test/",
      ISOCAN_AUTH_HEADER_COMMAND: '["acme-single","--print"]',
    });
    expect(fromEnvCommand).toEqual({
      authHeaderCommand: ["acme-single", "--print"],
    });
  });

  it("parses header lines and JSON output while rejecting control characters", () => {
    expect(parseAuthHelperOutput("X-Acme-Token: tok-123\n")).toEqual({
      headers: { "X-Acme-Token": "tok-123" },
    });

    expect(
      parseAuthHelperOutput(
        JSON.stringify({
          headers: { Authorization: "Bearer sec-456" },
          expiresAt: "2026-10-15T19:00:00.000Z",
        }),
      ),
    ).toEqual({
      headers: { Authorization: "Bearer sec-456" },
      expiresAtMs: Date.parse("2026-10-15T19:00:00.000Z"),
    });

    expect(() =>
      parseAuthHelperOutput(
        JSON.stringify({
          headers: { "X-Acme-Token": "bad\r\nX-Injected: pwned" },
        }),
      ),
    ).toThrow(/control character/);

    expect(() =>
      parseAuthHelperOutput(
        JSON.stringify({
          headers: { "Bad\0Name": "val" },
        }),
      ),
    ).toThrow(/control character/);
  });
});

describe("external credential helper and forward-proxy transport (Phase 2 proof)", () => {
  it("runs isocan whoami and isocan add end-to-end against an authenticating reverse proxy with zero identity.json, zero /api/door calls, 0600 disk cache, and automatic refresh on 401 and 302", async () => {
    const proxy = await startAuthReverseProxy(daemonPort, PRIYA);
    const clientHome = path.join(tempDir, "client-home");
    const workDir = path.join(tempDir, "work");
    const stateDir = path.join(tempDir, "helper-state");
    await fs.mkdir(clientHome, { recursive: true });
    await fs.mkdir(path.join(workDir, ".git"), { recursive: true });
    await fs.mkdir(stateDir, { recursive: true });

    const tokenFile = path.join(stateDir, "current-token.txt");
    const countFile = path.join(stateDir, "invocations.log");
    await fs.writeFile(tokenFile, "tok-1", "utf8");
    proxy.setActiveToken("tok-1");

    // Synthetic credential helper invoked via node -e (execFile, shell: false).
    const helperInline = [
      'const fs = require("node:fs");',
      "const [tokenFile, countFile, expectedTarget] = process.argv.slice(1);",
      "if (process.env.ISOCAN_TARGET_URL !== expectedTarget) {",
      '  process.stderr.write(`unexpected ISOCAN_TARGET_URL=${process.env.ISOCAN_TARGET_URL}`);',
      "  process.exit(2);",
      "}",
      "const token = fs.readFileSync(tokenFile, 'utf8').trim();",
      "fs.appendFileSync(countFile, `${token}\\n`);",
      "process.stdout.write(`X-Acme-Token: ${token}\\n`);",
    ].join("\n");

    // Configure ONLY homeAuth in config.json — no identity.json, no home key, no badge.
    await fs.writeFile(
      paths.configFile(clientHome),
      JSON.stringify({
        homeAuth: {
          [proxy.base]: {
            authHeaderCommand: [process.execPath, "-e", helperInline, tokenFile, countFile, proxy.base],
            ttlSeconds: 300,
          },
        },
      }),
    );

    const helperInvocations = async (): Promise<string[]> => {
      if (!existsSync(countFile)) return [];
      const text = await fs.readFile(countFile, "utf8");
      return text.trim().split("\n").filter(Boolean);
    };

    try {
      // Unauthenticated requests without helper header are rejected with 302 to login URL,
      // and spoofed client X-Forwarded-Email headers never bypass authentication.
      const unauthRes = await fetch(`${proxy.base}/api/actors?keys=home%3Aperson`, {
        redirect: "manual",
        headers: { "x-forwarded-email": "mallory@acme.test" },
      });
      expect(unauthRes.status).toBe(302);
      expect(unauthRes.headers.get("location")).toBe(LOGIN_URL);
      expect(proxy.spoofedEmailSeen).toContain("mallory@acme.test");

      // 1. Run `isocan whoami` in a fresh ISOCAN_HOME with only homeAuth configured.
      const whoamiRun = await runCli(["whoami"], {
        env: cliEnv({ ISOCAN_HOME: clientHome }),
        cwd: workDir,
      });
      expect(whoamiRun.code, whoamiRun.stderr).toBe(0);
      expect(whoamiRun.stdout).toMatch(/^priya \(usr_[A-Za-z0-9_-]+\)/);

      // Helper was invoked once and wrote a 0600 cache file under ~/.isocan/auth-cache/.
      expect(await helperInvocations()).toEqual(["tok-1"]);
      const cacheDir = paths.authCacheDir(clientHome);
      const cacheFiles = await fs.readdir(cacheDir);
      expect(cacheFiles).toHaveLength(1);
      const cacheStat = await fs.stat(path.join(cacheDir, cacheFiles[0]!));
      expect(cacheStat.mode & 0o777).toBe(0o600);

      // 2. Run `isocan add` as a second CLI process — reuses the cached token without re-invoking the helper.
      const notePath = path.join(workDir, "note.md");
      await fs.writeFile(notePath, "# Acme Architecture\n\nProxy identity proof.\n", "utf8");

      const addRun = await runCli(["add", notePath, "--title", "Acme Note"], {
        env: cliEnv({ ISOCAN_HOME: clientHome }),
        cwd: workDir,
      });
      expect(addRun.code, addRun.stderr).toBe(0);
      expect(await helperInvocations()).toEqual(["tok-1"]);

      // Zero identity.json on disk, zero /api/door calls to the proxy/daemon.
      expect(existsSync(paths.identityFile(clientHome))).toBe(false);
      expect(proxy.doorCalls).toBe(0);

      // Verify the added item landed on the canvas authored by Priya.
      const verifyClient = new DaemonClient(proxy.base, clientHome);
      verifyClient.direct = true;
      const canvases = await verifyClient.listCanvases();
      expect(canvases).toHaveLength(1);
      const log = await verifyClient.getLog(canvases[0]!.id, 0);
      expect(log.length).toBeGreaterThanOrEqual(2);
      expect(log.every((entry) => entry.envelope.actor.name === "priya")).toBe(true);

      // 3. Expire tok-1 with 401 — next command evicts cache, re-invokes helper for tok-2, and replays.
      await fs.writeFile(tokenFile, "tok-2", "utf8");
      proxy.setActiveToken("tok-2");
      proxy.expireToken("tok-1", "401");

      const whoamiAfter401 = await runCli(["whoami"], {
        env: cliEnv({ ISOCAN_HOME: clientHome }),
        cwd: workDir,
      });
      expect(whoamiAfter401.code, whoamiAfter401.stderr).toBe(0);
      expect(whoamiAfter401.stdout).toMatch(/^priya \(usr_[A-Za-z0-9_-]+\)/);
      expect(proxy.expiredRejections).toBeGreaterThanOrEqual(1);
      expect(await helperInvocations()).toEqual(["tok-1", "tok-2"]);

      // 4. Expire tok-2 with 302 redirect to login — next call intercepts redirect, re-invokes helper for tok-3, and replays.
      await fs.writeFile(tokenFile, "tok-3", "utf8");
      proxy.setActiveToken("tok-3");
      proxy.expireToken("tok-2", "302");

      const whoamiAfter302 = await runCli(["whoami"], {
        env: cliEnv({ ISOCAN_HOME: clientHome }),
        cwd: workDir,
      });
      expect(whoamiAfter302.code, whoamiAfter302.stderr).toBe(0);
      expect(whoamiAfter302.stdout).toMatch(/^priya \(usr_[A-Za-z0-9_-]+\)/);
      expect(await helperInvocations()).toEqual(["tok-1", "tok-2", "tok-3"]);
      expect(existsSync(paths.identityFile(clientHome))).toBe(false);
      expect(proxy.doorCalls).toBe(0);
    } finally {
      await proxy.close();
    }
  });

  it("routes requests through homeAuth.httpProxy while attaching credential helper headers", async () => {
    const authProxy = await startAuthReverseProxy(daemonPort, PRIYA);
    const forwardProxy = await startForwardProxy();
    const clientHome = path.join(tempDir, "proxy-client-home");
    await fs.mkdir(clientHome, { recursive: true });

    authProxy.setActiveToken("tok-fwd");
    const helperInline = 'process.stdout.write(JSON.stringify({ headers: { "X-Acme-Token": "tok-fwd" } }));';

    await fs.writeFile(
      paths.configFile(clientHome),
      JSON.stringify({
        homeAuth: {
          [authProxy.base]: {
            authHeaderCommand: [process.execPath, "-e", helperInline],
            httpProxy: forwardProxy.proxyUrl,
            ttlSeconds: 300,
          },
        },
      }),
    );

    try {
      const saved: Record<string, string | undefined> = {};
      for (const key of harnessVars) {
        saved[key] = process.env[key];
        delete process.env[key];
      }
      try {
        const client = new DaemonClient(authProxy.base, clientHome);
        client.direct = true;
        const resolved = await resolveIdentity(client, clientHome);
        expect(resolved).not.toBeNull();
        expect(resolved!.actor.name).toBe("priya");
        expect(forwardProxy.proxiedRequests).toBeGreaterThanOrEqual(1);
        expect(authProxy.doorCalls).toBe(0);
        expect(existsSync(paths.identityFile(clientHome))).toBe(false);
      } finally {
        for (const [key, val] of Object.entries(saved)) {
          if (val === undefined) delete process.env[key];
          else process.env[key] = val;
        }
      }
    } finally {
      await forwardProxy.close();
      await authProxy.close();
    }
  });
});
