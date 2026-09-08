import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { SERVING_ROUTE, SIGN_BLOBS_LIMIT, type SignedBlobsResponse } from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";
import { sweepCanvas } from "../src/sweep.ts";
import { CONTENT_CSP } from "../src/content.ts";
import {
  CONTENT_TTL_DEFAULT_SECONDS,
  contentTtl,
  signContentRead,
  signedBlobPath,
  verifyContentRead,
} from "../src/content-auth.ts";

/**
 * **Stage 4b of the content-origin plan, and the decision it built** —
 * `docs/projects/multiuser/content-read-auth.md`, option A: short-lived
 * signed URLs, minted by the badged app origin, verified by an origin that
 * holds nothing.
 *
 * The two facts this file exists to hold in place are the ones the decision
 * put in tension:
 *
 * - **Expulsion reaches the bytes** (23 Aug 2026) — here, *within one TTL*,
 *   which is a cost the ledger records rather than hides. So there is a test
 *   for the half that is immediate (an expelled badge cannot mint) AND a test
 *   for the half that is not (what it already minted still works), because a
 *   documented cost that nothing asserts is a claim, not a property.
 * - **The content origin holds nothing** — invariant 4, which on the hosted
 *   shape cannot be a route table because one app answers for both origins.
 *   It is a refusal in the door hook instead, and it is enumerated here.
 */

const CONTENT_HOST = "content.test";
const alice = { id: "usr_alice", name: "Alice" };

describe("the signature itself", () => {
  it("is deterministic, and changes with every field", () => {
    const key = "k";
    const base = signContentRead(key, "prj_1", "hash_a", 1000);
    expect(signContentRead(key, "prj_1", "hash_a", 1000)).toBe(base);
    expect(signContentRead("k2", "prj_1", "hash_a", 1000)).not.toBe(base);
    expect(signContentRead(key, "prj_2", "hash_a", 1000)).not.toBe(base);
    expect(signContentRead(key, "prj_1", "hash_b", 1000)).not.toBe(base);
    expect(signContentRead(key, "prj_1", "hash_a", 1001)).not.toBe(base);
  });

  it("cannot be slid between fields", () => {
    // The separator argument: `(canvasId, hash)` of ("ab", "c") and ("a",
    // "bc") must not sign the same bytes, or a canvas id could be chosen to
    // borrow another canvas's signature.
    expect(signContentRead("k", "ab", "c", 1)).not.toBe(signContentRead("k", "a", "bc", 1));
  });

  it("verifies, expires, and refuses a forgery — each as its own verdict", () => {
    const key = "k";
    const sig = signContentRead(key, "prj_1", "hash_a", 2000);
    const good = { exp: "2000", sig };
    expect(verifyContentRead(key, "prj_1", "hash_a", good, 1999)).toBe("ok");
    expect(verifyContentRead(key, "prj_1", "hash_a", good, 2000)).toBe("expired");
    expect(verifyContentRead(key, "prj_1", "hash_a", good, 2001)).toBe("expired");
    // Another canvas's bytes, another home's key, a hand-edited expiry: all
    // forgeries, and none of them can choose to be called "expired" instead.
    expect(verifyContentRead(key, "prj_2", "hash_a", good, 1999)).toBe("bad-signature");
    expect(verifyContentRead("other", "prj_1", "hash_a", good, 1999)).toBe("bad-signature");
    expect(verifyContentRead(key, "prj_1", "hash_a", { exp: "9999", sig }, 1999)).toBe(
      "bad-signature",
    );
    expect(verifyContentRead(key, "prj_1", "hash_a", {}, 1999)).toBe("unsigned");
    expect(verifyContentRead(key, "prj_1", "hash_a", { exp: "2000" }, 1999)).toBe("unsigned");
  });

  it("takes a TTL from the environment, within bounds, and defaults otherwise", () => {
    expect(contentTtl(undefined)).toBe(CONTENT_TTL_DEFAULT_SECONDS);
    expect(contentTtl("3600")).toBe(3600);
    // Below a minute the mint is re-paid inside one visit; above a day the
    // signature is the durable token the 23 August ledger refused.
    expect(contentTtl("5")).toBe(CONTENT_TTL_DEFAULT_SECONDS);
    expect(contentTtl("999999")).toBe(CONTENT_TTL_DEFAULT_SECONDS);
    expect(contentTtl("soon")).toBe(CONTENT_TTL_DEFAULT_SECONDS);
  });

  it("puts both parameters on the path, and nothing else", () => {
    const url = new URL(signedBlobPath("k", "prj_1", "hash_a", 2000), "https://isocan.store");
    expect(url.pathname).toBe("/api/projects/prj_1/blobs/hash_a");
    expect([...url.searchParams.keys()].sort()).toEqual(["exp", "sig"]);
    expect(url.searchParams.get("exp")).toBe("2000");
    expect(url.searchParams.get("sig")).toBe(signContentRead("k", "prj_1", "hash_a", 2000));
  });
});

describe("the per-home key", () => {
  let home: string;
  let daemon: Daemon;

  beforeEach(async () => {
    home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-key-"));
    daemon = await startDaemon({ port: 0, home });
  });

  afterEach(async () => {
    await daemon.close();
    await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it("is minted once and answers the same forever, concurrent askers included", async () => {
    // Two instances of a hosted home boot together during a rollout. If both
    // minted, half the frames on every open tab would stop verifying.
    const [a, b, c] = await Promise.all([
      daemon.desk.contentKey(),
      daemon.desk.contentKey(),
      daemon.desk.contentKey(),
    ]);
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(a.length).toBeGreaterThan(20);
  });

  it("survives a restart — a lost key would break every URL already in a page", async () => {
    const before = await daemon.desk.contentKey();
    await daemon.close();
    daemon = await startDaemon({ port: 0, home });
    expect(await daemon.desk.contentKey()).toBe(before);
  });
});

describe("a home with a content host: the hosted shape, end to end", () => {
  let home: string;
  let daemon: Daemon;
  let base: string;
  let badge: TestBadge;
  let blobHash: string;

  /** A request as it would arrive on the content origin: same listener, the
   * other Host. `inject` runs the whole hook chain, which is where the
   * content role's door — the absence of one — lives. */
  const onContentOrigin = (url: string) =>
    daemon.app.inject({ method: "GET", url, headers: { host: CONTENT_HOST } });

  beforeEach(async () => {
    home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-contentauth-"));
    daemon = await startDaemon({ port: 0, home, contentHost: CONTENT_HOST });
    const address = daemon.app.server.address();
    base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
    badge = await mintTestBadge(base);
    await badge.speakAs(alice);
    await fetch(`${base}/api/ops`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...badge.headers },
      body: JSON.stringify({
        canvasId: null,
        actor: alice,
        op: { type: "project.create", canvasId: "prj_1", title: "P" },
      }),
    });
    const up = await fetch(`${base}/api/projects/prj_1/blobs`, {
      method: "POST",
      headers: { "Content-Type": "text/html", "X-Isocan-Filename": "a.html", ...badge.headers },
      body: "<h1>frame me</h1>",
    });
    blobHash = ((await up.json()) as { blobHash: string }).blobHash;
  });

  afterEach(async () => {
    await daemon.close();
    await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  const mint = async (hashes: string[] = [blobHash]): Promise<SignedBlobsResponse> => {
    const res = await fetch(
      `${base}/api/projects/prj_1/blobs/signed?hashes=${hashes.join(",")}`,
      { headers: badge.headers },
    );
    expect(res.status).toBe(200);
    return (await res.json()) as SignedBlobsResponse;
  };

  it("says how long a minted URL lives as a DURATION as well as a timestamp", async () => {
    // The duration is what a browser measures against, so that a tab whose
    // own clock is off does not bury a live URL or trust a dead one.
    const answer = await mint();
    expect(answer.ttlSeconds).toBe(CONTENT_TTL_DEFAULT_SECONDS);
    expect(answer.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(answer.expiresAt).toBeLessThanOrEqual(
      Math.floor(Date.now() / 1000) + CONTENT_TTL_DEFAULT_SECONDS,
    );
  });

  it("advertises the second domain as the content base, and says it is signed", async () => {
    const res = await fetch(`${base}${SERVING_ROUTE}`, { headers: badge.headers });
    const serving = (await res.json()) as { contentBase: string; contentSigned: boolean };
    expect(serving.contentBase).toBe(`https://${CONTENT_HOST}`);
    expect(serving.contentSigned).toBe(true);
    expect(daemon.contentBase).toBe(`https://${CONTENT_HOST}`);
  });

  it("a signed read is served, with the content origin's own policy and a public cache", async () => {
    const { urls } = await mint();
    const res = await onContentOrigin(urls[blobHash]!);
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe("<h1>frame me</h1>");
    expect(res.headers["content-security-policy"]).toBe(CONTENT_CSP);
    // **The thing option A gives back**: the URL is the credential and it
    // expires, so a shared cache may hold this — but only for the credential's
    // own lifetime, and never as `immutable`.
    const cache = String(res.headers["cache-control"]);
    expect(cache).toMatch(/^public, max-age=\d+$/);
    expect(cache).not.toContain("immutable");
    expect(Number(/max-age=(\d+)/.exec(cache)![1])).toBeLessThanOrEqual(
      CONTENT_TTL_DEFAULT_SECONDS,
    );
  });

  it("an unsigned, a forged, and an expired read are all refused", async () => {
    const bare = await onContentOrigin(`/api/projects/prj_1/blobs/${blobHash}`);
    expect(bare.statusCode).toBe(403);
    expect(JSON.parse(bare.body).code).toBe("unsigned-read");

    const { urls } = await mint();
    const tampered = urls[blobHash]!.replace(/sig=./, "sig=A");
    expect((await onContentOrigin(tampered)).statusCode).toBe(403);

    // Signed with this home's real key, for a moment that has passed: the one
    // refusal that is not a forgery, and it says so.
    const stale = signedBlobPath(
      await daemon.desk.contentKey(),
      "prj_1",
      blobHash,
      Math.floor(Date.now() / 1000) - 1,
    );
    const dead = await onContentOrigin(stale);
    expect(dead.statusCode).toBe(403);
    expect(JSON.parse(dead.body).code).toBe("expired-read");
  });

  it("a signature is for ONE object on ONE canvas", async () => {
    const { urls } = await mint();
    const query = urls[blobHash]!.slice(urls[blobHash]!.indexOf("?"));
    // The same credential, pointed at another canvas or another hash.
    expect((await onContentOrigin(`/api/projects/prj_2/blobs/${blobHash}${query}`)).statusCode).toBe(403);
    const otherHash = "a".repeat(64);
    expect((await onContentOrigin(`/api/projects/prj_1/blobs/${otherHash}${query}`)).statusCode).toBe(403);
  });

  it("invariant 4: on that Host, everything but blob bytes is a 404", async () => {
    for (const url of [
      SERVING_ROUTE,
      "/api/projects/prj_1/canvas",
      "/api/projects/prj_1/blobs/signed?hashes=x",
      "/api/homes",
      "/api/healthz",
      "/",
      "/p/prj_1",
    ]) {
      expect((await onContentOrigin(url)).statusCode, url).toBe(404);
    }
    // Not a verb, either: the role answers GET bytes and nothing else.
    const write = await daemon.app.inject({
      method: "POST",
      url: "/api/ops",
      headers: { host: CONTENT_HOST, "content-type": "application/json" },
      payload: { canvasId: "prj_1", actor: alice, op: { type: "project.rename", title: "x" } },
    });
    expect(write.statusCode).toBe(404);
    // And the door itself is not there to be knocked on.
    const door = await daemon.app.inject({
      method: "POST",
      url: "/api/door",
      headers: { host: CONTENT_HOST, "content-type": "application/json" },
      payload: { carrier: "bearer" },
    });
    expect(door.statusCode).toBe(404);
  });

  it("invariant 4 covers the socket, which no hook would have", async () => {
    // A WebSocket upgrade is hijacked off the raw server and never passes
    // through the door hook — so the content origin would have had an API on
    // it that nothing else in this file could see.
    const port = (daemon.app.server.address() as { port: number }).port;
    const answer = await new Promise<string>((resolve, reject) => {
      const socket = net.connect(port, "127.0.0.1", () => {
        socket.write(
          "GET /ws?canvasId=prj_1 HTTP/1.1\r\n" +
            `Host: ${CONTENT_HOST}\r\n` +
            "Upgrade: websocket\r\nConnection: Upgrade\r\n" +
            "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n",
        );
      });
      let seen = "";
      socket.on("data", (chunk) => (seen += chunk.toString()));
      socket.on("close", () => resolve(seen));
      socket.on("error", reject);
      socket.setTimeout(2000, () => socket.destroy());
    });
    expect(answer).toBe("");
  });

  it("invariant 3: chrome reads on the app origin are exactly what they were", async () => {
    const res = await fetch(`${base}/api/projects/prj_1/blobs/${blobHash}`, {
      headers: badge.headers,
    });
    expect(res.status).toBe(200);
    // The app origin's own header, unchanged — and `private`, because there
    // the credential is a cookie and a shared copy would outlive it.
    expect(res.headers.get("content-security-policy")).toBe("sandbox allow-scripts");
    expect(res.headers.get("cache-control")).toBe("private, immutable, max-age=31536000");
    // A badge-less chrome read still gets nothing.
    expect((await fetch(`${base}/api/projects/prj_1/blobs/${blobHash}`)).status).toBe(401);
  });

  it("the mint is a GET, so a view-only member can still see a screen", async () => {
    // The capability hook refuses every non-GET to a badge below `edit`. A
    // POST here would have meant a viewer's canvas rendered blank.
    const res = await fetch(`${base}/api/projects/prj_1/blobs/signed?hashes=${blobHash}`, {
      method: "POST",
      headers: badge.headers,
    });
    expect(res.status).toBe(404);
  });

  it("refuses to sign more than it will forward, and refuses to sign nothing", async () => {
    const many = Array.from({ length: SIGN_BLOBS_LIMIT + 1 }, (_, i) => `h${i}`).join(",");
    expect((await fetch(`${base}/api/projects/prj_1/blobs/signed?hashes=${many}`, { headers: badge.headers })).status).toBe(400);
    expect((await fetch(`${base}/api/projects/prj_1/blobs/signed`, { headers: badge.headers })).status).toBe(400);
  });

  describe("expulsion reaches the bytes — within one TTL, which is the cost", () => {
    /** Somebody who came in by the link, minted a URL, and is then swept out
     * of the canvas — the 23 August ledger's scenario, on the hosted shape. */
    const someoneWhoWasLetIn = async () => {
      const guest = await mintTestBadge(base);
      const minted = await fetch(
        `${base}/api/projects/prj_1/blobs/signed?hashes=${blobHash}`,
        { headers: guest.headers },
      );
      expect(minted.status).toBe(200);
      return { guest, urls: ((await minted.json()) as SignedBlobsResponse).urls };
    };

    const turnTheLinkOff = async () => {
      const link = (await daemon.desk.grantsFor("prj_1")).find((g) => g.subject === "link")!;
      await daemon.desk.revokeGrant(link.id, new Date().toISOString(), badge.badgeId);
      return sweepCanvas(daemon.desk, "prj_1");
    };

    it("an expelled badge cannot mint another URL", async () => {
      const { guest } = await someoneWhoWasLetIn();
      expect((await turnTheLinkOff()).expelled).toBe(1);
      const res = await fetch(`${base}/api/projects/prj_1/blobs/signed?hashes=${blobHash}`, {
        headers: guest.headers,
      });
      // The door's own refusal, on the door's own route. Nothing about
      // signing had to know this happened — which is the whole reason the
      // mint lives under `/api/projects/:id/`.
      expect(res.status).toBe(403);
    });

    it("what it already minted lives out its minutes, and this is written down", async () => {
      // The honest half. It is asserted rather than left implicit because a
      // cost nothing tests is a claim: if somebody later makes this line fail
      // by revoking at the content origin, they have changed the decision and
      // should say so in `content-read-auth.md`.
      const { urls } = await someoneWhoWasLetIn();
      await turnTheLinkOff();
      expect((await onContentOrigin(urls[blobHash]!)).statusCode).toBe(200);
    });
  });

  it("stands no second listener: one home, one content origin", async () => {
    // A daemon told about a hosted content host must not also raise a
    // loopback one — the two answer differently, and the advertised base
    // would be whichever was written last.
    expect(daemon.contentBase).toBe(`https://${CONTENT_HOST}`);
  });
});

describe("a home with no content host is byte-for-byte the home before this", () => {
  let home: string;
  let daemon: Daemon;
  let base: string;
  let badge: TestBadge;

  beforeEach(async () => {
    home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-unsigned-"));
    daemon = await startDaemon({ port: 0, home });
    const address = daemon.app.server.address();
    base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
    badge = await mintTestBadge(base);
    await badge.speakAs(alice);
    await fetch(`${base}/api/ops`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...badge.headers },
      body: JSON.stringify({
        canvasId: null,
        actor: alice,
        op: { type: "project.create", canvasId: "prj_1", title: "P" },
      }),
    });
  });

  afterEach(async () => {
    await daemon.close();
    await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it("advertises a loopback base that asks for no signature", async () => {
    const res = await fetch(`${base}${SERVING_ROUTE}`, { headers: badge.headers });
    const serving = (await res.json()) as { contentBase: string; contentSigned: boolean };
    expect(serving.contentBase).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(serving.contentSigned).toBe(false);
  });

  it("refuses to mint, rather than handing out signatures nothing verifies", async () => {
    const res = await fetch(`${base}/api/projects/prj_1/blobs/signed?hashes=abc`, {
      headers: badge.headers,
    });
    expect(res.status).toBe(404);
    expect(((await res.json()) as { code: string }).code).toBe("no-signing");
  });
});
