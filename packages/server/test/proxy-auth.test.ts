import http from "node:http";
import net from "node:net";
import { existsSync, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { LINK } from "@isocan/core";
import { DaemonClient } from "@isocan/api";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { attestationFromProxy, resolveProxyAuth } from "../src/attest.ts";
import { readHomes } from "../src/homes.ts";

/** Build a protobuf wire message containing field #2 (`wireType=2`) with `email`, base64url encoded. */
function makeProtoEmailToken(email: string): string {
  const emailBytes = Buffer.from(email, "utf8");
  const tag = (2 << 3) | 2;
  const header: number[] = [tag];
  let len = emailBytes.length;
  while (len >= 0x80) {
    header.push((len & 0x7f) | 0x80);
    len >>>= 7;
  }
  header.push(len);
  return Buffer.concat([Buffer.from(header), emailBytes]).toString("base64url");
}

/** Local authenticating gateway forwarding HTTP + WebSocket upgrades with proxy identity headers. */
async function startAuthGateway(targetPort: number, emailForRequest: () => string) {
  const sockets = new Set<net.Socket>();
  const server = http.createServer((req, res) => {
    const email = emailForRequest();
    const headers: http.OutgoingHttpHeaders = {
      ...req.headers,
      host: "canvas.acme.example",
      "x-forwarded-proto": "https",
      "x-proxy-auth-token": makeProtoEmailToken(email),
    };
    const proxy = http.request(
      {
        host: "127.0.0.1",
        port: targetPort,
        method: req.method,
        path: req.url,
        headers,
      },
      (upstream) => {
        res.writeHead(upstream.statusCode ?? 502, upstream.headers);
        upstream.pipe(res);
      },
    );
    proxy.on("error", () => res.destroy());
    req.pipe(proxy);
  });

  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });

  server.on("upgrade", (req, clientSocket, head) => {
    const email = emailForRequest();
    const upstream = net.connect(targetPort, "127.0.0.1", () => {
      const lines = [`GET ${req.url} HTTP/1.1`];
      const skip = new Set(["host", "x-forwarded-proto", "x-proxy-auth-token"]);
      for (const [k, v] of Object.entries(req.headers)) {
        if (skip.has(k.toLowerCase()) || v === undefined) continue;
        lines.push(`${k}: ${Array.isArray(v) ? v.join(", ") : v}`);
      }
      lines.push("Host: canvas.acme.example");
      lines.push("X-Forwarded-Proto: https");
      lines.push(`X-Proxy-Auth-Token: ${makeProtoEmailToken(email)}`);
      lines.push("", "");
      upstream.write(lines.join("\r\n"));
      if (head.length > 0) upstream.write(head);
      clientSocket.pipe(upstream).pipe(clientSocket);
    });
    upstream.on("error", () => clientSocket.destroy());
    clientSocket.on("error", () => upstream.destroy());
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const { port } = server.address() as net.AddressInfo;
  return {
    port,
    url: `http://127.0.0.1:${port}`,
    close: async () => {
      for (const s of sockets) s.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

const cleanup: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanup.length > 0) {
    const fn = cleanup.pop()!;
    await fn();
  }
});

async function tempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-proxy-auth-"));
  cleanup.push(() => fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
  return dir;
}

describe("Reverse-proxy identity attestation + per-home transport gateway", () => {
  it("parses plain and protobuf proxy headers, strips configured capsule prefixes, and rejects sentinels", () => {
    const plainCfg = resolveProxyAuth({ ISOCAN_PROXY_EMAIL_HEADER: "x-forwarded-email" })!;
    expect(
      attestationFromProxy({ "x-forwarded-email": "issuer.acme.example:Alice@Acme.Example" }, plainCfg, 1_700_000_000_000),
    ).toEqual({
      attribute: "email:alice@acme.example",
      verifiedVia: "proxy",
      at: new Date(1_700_000_000_000).toISOString(),
    });
    expect(attestationFromProxy({ "x-forwarded-email": "anonymous@acme.example" }, plainCfg)).toBeNull();

    const protoCfg = resolveProxyAuth({
      ISOCAN_PROXY_EMAIL_HEADER: "x-proxy-auth-token,x-proxy-auth-fallback",
      ISOCAN_PROXY_EMAIL_PROTO_FIELD: "2",
      ISOCAN_PROXY_EMAIL_STRIP_PREFIX: "^agent-[a-z0-9-]+-",
    })!;
    const emailFrom = (token: string) =>
      attestationFromProxy({ "x-proxy-auth-token": token }, protoCfg)?.attribute ?? null;
    expect(emailFrom(makeProtoEmailToken("alice@acme.example"))).toBe("email:alice@acme.example");
    expect(emailFrom(makeProtoEmailToken("agent-prod-alice@acme.example"))).toBe("email:alice@acme.example");
    expect(emailFrom(makeProtoEmailToken("agent-dev-bob.smith@acme.example"))).toBe("email:bob.smith@acme.example");
    expect(emailFrom(makeProtoEmailToken("noone@acme.example"))).toBeNull();
    expect(emailFrom(makeProtoEmailToken("anonymous"))).toBeNull();
    expect(emailFrom("")).toBeNull();
  });

  it("auto-attests HTTP + WebSocket badges, exposes email attester without Firebase UI, syncs replicas via gateway, and allows operator acts", async () => {
    let currentCaller = "alice@acme.example";
    const remoteHomeDir = await tempDir();
    const proxyAuth = resolveProxyAuth({
      ISOCAN_PROXY_EMAIL_HEADER: "x-proxy-auth-token",
      ISOCAN_PROXY_EMAIL_PROTO_FIELD: "2",
      ISOCAN_PROXY_EMAIL_STRIP_PREFIX: "^agent-[a-z0-9-]+-",
    });
    const hostedDaemon: Daemon = await startDaemon({
      port: 0,
      home: remoteHomeDir,
      host: "127.0.0.1",
      servesWorld: true,
      contentPort: "off",
      proxyAuth,
      operators: ["email:ops@acme.example"],
    });
    cleanup.push(() => hostedDaemon.close());

    const hostedPort = (hostedDaemon.app.server.address() as net.AddressInfo).port;
    const gw = await startAuthGateway(hostedPort, () => currentCaller);
    cleanup.push(() => gw.close());

    // When the web bundle is built, GET / stamps `data-sso="true"` on `<html>`
    // so the browser skips the anonymous marketing landing page on first paint.
    const distIndex = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../web/dist/index.html");
    if (existsSync(distIndex)) {
      const pageRes = await fetch(`${gw.url}/`);
      expect(pageRes.status).toBe(200);
      expect(await pageRes.text()).toContain('<html lang="en" data-sso="true">');
    }

    // 1. Alice configures gateway mapping for canonical https://canvas.acme.example
    const aliceHome = await tempDir();
    await fs.writeFile(
      path.join(aliceHome, "config.json"),
      JSON.stringify({ gateways: { "https://canvas.acme.example": gw.url } }, null, 2),
    );
    const aliceClient = new DaemonClient("https://canvas.acme.example", aliceHome);

    // Attest offer advertises email capability while keeping `auth: null` (no Firebase popup)
    await aliceClient.badges();
    const aliceCred = JSON.parse(await fs.readFile(path.join(aliceHome, "identity.json"), "utf8")).auth[
      "https://canvas.acme.example"
    ];
    const offerRes = await fetch(`${gw.url}/api/attest`, {
      headers: { Authorization: `Bearer ${aliceCred.badgeId}.${aliceCred.secret}` },
    });
    expect(await offerRes.json()).toMatchObject({
      attesters: ["email"],
      auth: null,
      attestations: [{ attribute: "email:alice@acme.example", verifiedVia: "proxy" }],
    });

    // Alice claims identity, creates a private canvas shared ONLY with bob@acme.example, and closes the public link
    const claim = await aliceClient.claimActor({ type: "actor.claim", sessionKey: "cli", name: "Alice" });
    const alice = claim.envelope.actor;
    await aliceClient.sendOp("prj_secret", alice, {
      type: "project.create",
      canvasId: "prj_secret",
      title: "Acme Secret",
    });
    const { grants } = await aliceClient.grants("prj_secret");
    const linkGrant = grants.find((g) => g.subject === LINK)!;
    await aliceClient.revokeGrant("prj_secret", linkGrant.id, alice.id);
    await aliceClient.createGrant("prj_secret", "email:bob@acme.example", "edit", alice.id);

    // 2. Mallory (mallory@acme.example) is refused at the door
    currentCaller = "mallory@acme.example";
    const malloryHome = await tempDir();
    await fs.writeFile(
      path.join(malloryHome, "config.json"),
      JSON.stringify({ gateways: { "https://canvas.acme.example": gw.url } }, null, 2),
    );
    const malloryClient = new DaemonClient("https://canvas.acme.example", malloryHome);
    await expect(malloryClient.snapshot("prj_secret")).rejects.toThrow();

    // 3. Bob's agent capsule (`agent-prod-bob@acme.example`) arrives through a syncing local replica
    // configured with canonical `birthHome: "https://canvas.acme.example"` and gateway `gw.url`!
    currentCaller = "agent-prod-bob@acme.example";
    const bobWorkstationHome = await tempDir();
    await fs.writeFile(
      path.join(bobWorkstationHome, "config.json"),
      JSON.stringify({
        home: "https://canvas.acme.example",
        gateways: { "https://canvas.acme.example": gw.url },
      }),
    );
    const bobReplica = await startDaemon({
      port: 0,
      home: bobWorkstationHome,
      contentPort: "off",
      homePollMs: 100,
    });
    cleanup.push(() => bobReplica.close());

    const replicaPort = (bobReplica.app.server.address() as net.AddressInfo).port;
    const bobLocalClient = new DaemonClient(`http://127.0.0.1:${replicaPort}`, bobWorkstationHome);
    const joined = await bobLocalClient.joinFromHome("prj_secret", "https://canvas.acme.example");
    expect(joined.title).toBe("Acme Secret");

    // Canonical URL preserved in homes.json AND identity.json on Bob's workstation!
    expect(await readHomes(bobWorkstationHome)).toEqual({ prj_secret: "https://canvas.acme.example" });
    const bobIdentity = JSON.parse(await fs.readFile(path.join(bobWorkstationHome, "identity.json"), "utf8"));
    expect(bobIdentity.auth["https://canvas.acme.example"]).toBeDefined();

    // Live WebSocket replication syncs ops seamlessly between hosted home and Bob's local replica!
    const bobClaim = await bobLocalClient.claimActor({ type: "actor.claim", sessionKey: "cli", name: "Bob" });
    await bobLocalClient.sendOp("prj_secret", bobClaim.envelope.actor, {
      type: "project.update",
      patch: { title: "Acme Synced Live" },
    });
    currentCaller = "alice@acme.example";
    expect((await aliceClient.snapshot("prj_secret")).project.title).toBe("Acme Synced Live");

    // 4. Operator acts work seamlessly via reverse-proxy identity header without Firebase tokens
    currentCaller = "ops@acme.example";
    const opsHome = await tempDir();
    await fs.writeFile(
      path.join(opsHome, "config.json"),
      JSON.stringify({ gateways: { "https://canvas.acme.example": gw.url } }, null, 2),
    );
    const opsClient = new DaemonClient("https://canvas.acme.example", opsHome);
    const show = await opsClient.operatorShow("prj_secret", "");
    expect(show.reach.title).toBe("Acme Synced Live");
  });
});
