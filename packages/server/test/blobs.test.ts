import { reservePort } from "../../../test/ports.ts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { encodeFilename } from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";
import * as p from "../src/paths.ts";

const alice = { id: "usr_alice", name: "Alice" };

let home: string;
let daemon: Daemon;
let base: string;
let badge: TestBadge;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-blobs-"));
  daemon = await startDaemon({ port: await reservePort(), home });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  badge = await mintTestBadge(base);
  await badge.speakAs(alice); // a badge speaks only for actors it claims
  const res = await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify({
      canvasId: null,
      actor: alice,
      op: { type: "project.create", canvasId: "prj_1", title: "P" },
    }),
  });
  expect(res.status).toBe(200);
});

afterEach(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true });
});

async function upload(content: string, filename: string): Promise<string> {
  const res = await fetch(`${base}/api/projects/prj_1/blobs`, {
    method: "POST",
    headers: { "Content-Type": "text/markdown", "X-Isocan-Filename": filename, ...badge.headers },
    body: content,
  });
  expect(res.status).toBe(200);
  return ((await res.json()) as { blobHash: string }).blobHash;
}

/** The blob GET carries a badge, because since phase 9 it must: the route was
 * the one named hole in `isOpen` and is now behind the door like everything
 * else about a canvas. */
async function fetchBlob(
  hash: string,
  init: RequestInit = {},
): Promise<{ status: number; body: string }> {
  const res = await fetch(`${base}/api/projects/prj_1/blobs/${hash}`, {
    ...init,
    headers: { ...badge.headers, ...(init.headers as Record<string, string> | undefined) },
  });
  return { status: res.status, body: await res.text() };
}

describe("concurrent blob uploads", () => {
  /**
   * `blobs.json` is read whole, mutated, and written whole. Two clients
   * uploading at once — two `isocan add` processes, a CLI beside the web app —
   * used to read the same pre-upload index, and the second write erased the
   * first's entry: the bytes were on disk but nothing could name them, so the
   * item that referenced them served `{"error":"blob not found"}` forever.
   */
  it("all land in the index — no upload erases another's entry", async () => {
    const names = ["alpha", "beta", "gamma", "delta", "epsilon"];
    const hashes = await Promise.all(names.map((name) => upload(`# ${name}\n`, `${name}.md`)));

    expect(new Set(hashes).size).toBe(names.length);
    const index = JSON.parse(await fs.readFile(p.blobsIndexFile(home, "prj_1"), "utf8"));
    expect(Object.keys(index)).toHaveLength(names.length);

    for (const [i, hash] of hashes.entries()) {
      expect(await fetchBlob(hash)).toEqual({ status: 200, body: `# ${names[i]}\n` });
    }
  });

  it("dedupes identical content instead of double-indexing it", async () => {
    const hashes = await Promise.all([
      upload("# same\n", "one.md"),
      upload("# same\n", "two.md"),
      upload("# same\n", "three.md"),
    ]);

    expect(new Set(hashes).size).toBe(1);
    const index = JSON.parse(await fs.readFile(p.blobsIndexFile(home, "prj_1"), "utf8"));
    expect(Object.keys(index)).toHaveLength(1);
    expect((await fetchBlob(hashes[0]!)).status).toBe(200);
  });
});

describe("the blob route honors Range", () => {
  /**
   * The map has said "Downloads stream through the daemon (Range honored)"
   * since it was drawn, and until phase 4 the route did no such thing: it sent
   * a whole `createReadStream` with no `Accept-Ranges` and no `Range` parsing,
   * and Fastify adds neither. The doc was the better half of that
   * disagreement, so the code moved. It matters more in the cloud than on a
   * disk — a video blob seeking through the instance without ranges re-reads
   * the whole object from the bucket every single time.
   */
  const CONTENT = "0123456789abcdefghij";

  async function range(hash: string, header: string) {
    const res = await fetch(`${base}/api/projects/prj_1/blobs/${hash}`, {
      headers: { Range: header, ...badge.headers },
    });
    return {
      status: res.status,
      contentRange: res.headers.get("content-range"),
      body: await res.text(),
    };
  }

  it("advertises byte ranges on every blob, before anybody asks", async () => {
    const hash = await upload(CONTENT, "digits.txt");
    const res = await fetch(`${base}/api/projects/prj_1/blobs/${hash}`, {
      headers: badge.headers,
    });
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect(res.headers.get("content-length")).toBe(String(CONTENT.length));
    expect(await res.text()).toBe(CONTENT);
  });

  it("serves a closed range as 206 with the range it actually sent", async () => {
    const hash = await upload(CONTENT, "digits.txt");
    expect(await range(hash, "bytes=5-9")).toEqual({
      status: 206,
      contentRange: `bytes 5-9/${CONTENT.length}`,
      body: "56789",
    });
  });

  it("serves an open range and a suffix range", async () => {
    const hash = await upload(CONTENT, "digits.txt");
    // `bytes=15-` — from here to the end, which is how a resumed download asks.
    expect(await range(hash, "bytes=15-")).toEqual({
      status: 206,
      contentRange: `bytes 15-19/${CONTENT.length}`,
      body: "fghij",
    });
    // `bytes=-4` — the LAST four bytes, which is how a player reads a trailer.
    expect(await range(hash, "bytes=-4")).toEqual({
      status: 206,
      contentRange: `bytes 16-19/${CONTENT.length}`,
      body: "ghij",
    });
  });

  it("clamps a range that runs off the end, and refuses one that starts past it", async () => {
    const hash = await upload(CONTENT, "digits.txt");
    expect(await range(hash, "bytes=18-999")).toEqual({
      status: 206,
      contentRange: `bytes 18-19/${CONTENT.length}`,
      body: "ij",
    });
    const beyond = await range(hash, "bytes=99-200");
    expect(beyond.status).toBe(416);
    expect(beyond.contentRange).toBe(`bytes */${CONTENT.length}`);
  });

  /**
   * **The exact edges, which are the only places a range parser is ever
   * wrong.**
   *
   * Every case above asks for a range comfortably inside the blob or
   * comfortably outside it, and four separate boundary tests in `parseRange`
   * survived being deleted with this file green:
   *
   * - `if (start >= size)` weakened to `>` — a range starting on the byte just
   *   past the last one is "satisfiable", and answers 206 with
   *   `Content-Range: bytes 20-19/20` and a Content-Length of 0. A resumed
   *   download that has already finished asks exactly this
   *   (`curl -C -` sends `bytes=<size>-`), and a client that gets a 206 for it
   *   believes there is more file coming.
   * - `if (end < start)` deleted — an inverted range gets a negative
   *   Content-Length.
   * - the suffix clamp `Math.max(0, size - wanted)` — a trailer request bigger
   *   than the file seeks to a negative offset.
   * - `bytes=-0` — RFC 9110 says a zero-length suffix is unsatisfiable.
   *
   * None of them is exotic; three of the four are what a media element and a
   * resumed download send on their own.
   */
  it("refuses a range that starts on the byte just past the end", async () => {
    const hash = await upload(CONTENT, "digits.txt");
    // Not 99 — twenty, the first offset that does not exist. `>=` and `>`
    // differ here and nowhere else.
    const atTheEdge = await range(hash, `bytes=${CONTENT.length}-`);
    expect(atTheEdge.status, "bytes=20- on a 20-byte blob is unsatisfiable").toBe(416);
    expect(atTheEdge.contentRange).toBe(`bytes */${CONTENT.length}`);
    // And the last byte that DOES exist is still served, so this is a boundary
    // and not a blanket refusal.
    expect(await range(hash, `bytes=${CONTENT.length - 1}-`)).toEqual({
      status: 206,
      contentRange: `bytes 19-19/${CONTENT.length}`,
      body: "j",
    });
  });

  it("refuses an inverted range instead of serving a negative length", async () => {
    const hash = await upload(CONTENT, "digits.txt");
    const backwards = await range(hash, "bytes=9-5");
    expect(backwards.status).toBe(416);
    expect(backwards.contentRange).toBe(`bytes */${CONTENT.length}`);
    // The one-byte range at the same place is fine: 9-9 is not inverted.
    expect((await range(hash, "bytes=9-9")).status).toBe(206);
  });

  it("clamps a suffix range longer than the blob to the whole blob", async () => {
    const hash = await upload(CONTENT, "digits.txt");
    // A player asking for a 1 KB trailer off a 20-byte file. Without the clamp
    // the read starts at a negative offset.
    expect(await range(hash, "bytes=-1024")).toEqual({
      status: 206,
      contentRange: `bytes 0-19/${CONTENT.length}`,
      body: CONTENT,
    });
    // And the suffix that fits exactly still says so.
    expect((await range(hash, `bytes=-${CONTENT.length}`)).contentRange).toBe(
      `bytes 0-19/${CONTENT.length}`,
    );
  });

  it("refuses a zero-length suffix, which asks for nothing at all", async () => {
    const hash = await upload(CONTENT, "digits.txt");
    const nothing = await range(hash, "bytes=-0");
    expect(nothing.status).toBe(416);
    expect(nothing.contentRange).toBe(`bytes */${CONTENT.length}`);
  });

  /**
   * **Why `size === 0` never reaches the parser, held as a test rather than as
   * an assumption.**
   *
   * A suffix range on a zero-byte blob computes `end = size - 1`, which is
   * **-1**: `Content-Range: bytes 0--1/0` and a `Content-Length` of 0 on a 206.
   * The parser has no branch for it, and it does not need one — but only
   * because all THREE ways bytes can be named refuse a zero length, in three
   * separate places, none of which mentions the other. That is a rule with
   * three copies (lessons.md #10), and the day one of them relaxes — an empty
   * file is a perfectly ordinary thing to drag onto a canvas — the parser
   * starts answering nonsense with no test between the change and the bug.
   *
   * So: assert the reachability argument itself. If this goes red, the range
   * parser needs a `size === 0` branch before the door is opened.
   */
  it("cannot make a zero-byte blob by any of the three doors", async () => {
    const direct = await fetch(`${base}/api/projects/prj_1/blobs`, {
      method: "POST",
      headers: { "Content-Type": "text/markdown", "X-Isocan-Filename": "empty.md", ...badge.headers },
      body: "",
    });
    expect(direct.status, "POST /blobs with no bytes").toBe(400);

    const named = { blobHash: "b".repeat(64), mimeType: "text/markdown", filename: "empty.md" };
    for (const route of ["blobs/upload-url", "blobs/register"]) {
      const res = await fetch(`${base}/api/projects/prj_1/${route}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...badge.headers },
        body: JSON.stringify({ ...named, size: 0 }),
      });
      expect(res.status, `${route} with size 0`).toBe(400);
      expect(((await res.json()) as { error: string }).error).toMatch(/positive integer/);
    }
  });

  it("ignores a header it cannot parse, rather than 416-ing a whole download", async () => {
    // RFC 9110 is explicit: a Range that cannot be understood must be treated
    // as absent. Answering 416 to a garbled header would break a client that
    // was perfectly happy to take the whole file.
    const hash = await upload(CONTENT, "digits.txt");
    expect(await range(hash, "furlongs=1-2")).toEqual({
      status: 200,
      contentRange: null,
      body: CONTENT,
    });
  });
});

describe("the direct-upload routes on a file home", () => {
  async function post(route: string, body: unknown) {
    const res = await fetch(`${base}/api/projects/prj_1/${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...badge.headers },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: (await res.json().catch(() => null)) as any };
  }

  const request = {
    blobHash: "a".repeat(64),
    mimeType: "video/mp4",
    filename: "clip.mp4",
    size: 40 * 1024 * 1024,
  };

  it("say plainly that this home takes the bytes itself", async () => {
    const asked = await post("blobs/upload-url", request);
    expect(asked.status).toBe(409);
    expect(asked.json.code).toBe("bad-op");
    expect(asked.json.error).toMatch(/POST them/);
  });

  it("refuse a malformed request before anything is signed for", async () => {
    expect((await post("blobs/upload-url", { blobHash: "nope" })).status).toBe(400);
    expect((await post("blobs/upload-url", { ...request, size: 0 })).status).toBe(400);
    expect((await post("blobs/register", { ...request, mimeType: "" })).status).toBe(400);
  });

  it("answer for a blob that is already here instead of minting anything", async () => {
    const hash = await upload("# already here\n", "here.md");
    const asked = await post("blobs/upload-url", {
      blobHash: hash,
      mimeType: "text/markdown",
      filename: "here.md",
      size: 16,
    });
    expect(asked.status).toBe(200);
    expect(asked.json.blob.blobHash).toBe(hash);
    expect(asked.json.upload).toBeUndefined();
  });

  it("are behind the door, like every route about one canvas", async () => {
    // No badge headers at all: the POST-only shape means `isOpen`'s GET-only
    // blob hole does not cover these, and the hook refuses by default.
    const res = await fetch(`${base}/api/projects/prj_1/blobs/upload-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    expect(res.status).toBe(401);
  });
});

/**
 * **The route phase 9 closed, and the reason it could be** (see `isOpen`).
 *
 * It was the one named hole in the badge check, held open by an argument about
 * sandboxed iframes that turned out to describe the wrong request — measured
 * in Chrome rather than reasoned about: the request that LOADS a sandboxed
 * iframe is issued by the parent page, same-site, and carries the `Lax` badge
 * cookie. `phases.md` had recorded the hole as the limit of revocation ("a
 * sweep that expels somebody does not expel the hashes they wrote down"), and
 * closing it is what makes expulsion reach the bytes.
 */
describe("the blob route is behind the door", () => {
  it("refuses a badge-less caller, so a hash on its own is not a capability", async () => {
    const hash = await upload("# secret\n", "secret.md");
    const res = await fetch(`${base}/api/projects/prj_1/blobs/${hash}`);
    expect(res.status).toBe(401);
    expect(((await res.json()) as { code: string }).code).toBe("no-badge");
  });

  it("EXPULSION REACHES THE BYTES — the whole point of closing it", async () => {
    const hash = await upload("# secret\n", "secret.md");
    const stranger = await mintTestBadge(base);
    const url = `${base}/api/projects/prj_1/blobs/${hash}`;

    // While the link is on, a stranger who presents the address is admitted
    // and gets the bytes. That is the link grant working, not a hole.
    expect((await fetch(url, { headers: stranger.headers })).status).toBe(200);

    // Turn the link off. The sweep expels the badges rooted in it — and now
    // the hash they wrote down is worth nothing, which is exactly what
    // `phases.md` said revocation could not reach.
    const { grants } = (await (
      await fetch(`${base}/api/projects/prj_1/grants`, { headers: badge.headers })
    ).json()) as { grants: { id: string }[] };
    await fetch(`${base}/api/projects/prj_1/grants/${grants[0]!.id}`, {
      method: "DELETE",
      headers: badge.headers,
    });

    const res = await fetch(url, { headers: stranger.headers });
    // 403 rather than 401 because the credential is fine — sending it back to
    // the door would mint badges forever and none of them would get in.
    expect(res.status).toBe(403);
    expect(((await res.json()) as { code: string }).code).toBe("not-admitted");
    // And the badge that made the canvas is untouched: `{root: "created"}` is
    // the one root a sweep never walks.
    expect((await fetch(url, { headers: badge.headers })).status).toBe(200);
  });

  it("marks the bytes private, so a shared cache cannot serve what the door refused", async () => {
    const hash = await upload("# cached\n", "cached.md");
    const res = await fetchBlobResponse(hash);
    // `USE_ORIGIN_HEADERS` at the hosted home means this header IS the CDN
    // policy. A credentialed response cached at an edge would hand a swept
    // badge exactly the bytes it was expelled from, without the request ever
    // reaching the door.
    expect(res.headers.get("cache-control")).toContain("private");
    expect(res.headers.get("cache-control")).toContain("immutable");
  });

  it("cannot resolve a relative asset inside a blob, which is why it never needed to stay open", async () => {
    // A blob is addressed by content hash, so `<img src="pic.png">` inside one
    // resolves to `…/blobs/pic.png` — not a hash, and nothing has ever been
    // able to answer it. The relative-asset case the route was held open for
    // has never worked and cannot.
    await upload("<img src=\"pic.png\">", "page.html");
    expect((await fetchBlob("pic.png")).status).toBe(404);
  });
});

async function fetchBlobResponse(hash: string): Promise<Response> {
  return fetch(`${base}/api/projects/prj_1/blobs/${hash}`, { headers: badge.headers });
}

describe("filenames that are not ByteStrings", () => {
  /**
   * Every macOS screenshot is named "Screenshot … at 8.05.12 PM.png" with
   * U+202F (narrow no-break space) before AM/PM. A header value is a
   * ByteString, so handing that name to `fetch` throws before a request is
   * made — in the web app, inside an async drop handler with nothing
   * catching it, which is how dropping a PNG on the canvas failed in total
   * silence. Filenames travel percent-encoded now; the daemon decodes.
   */
  const SCREENSHOT = "Screenshot 2026-08-16 at 8.05.12 PM.png";

  async function uploadNamed(name: string, encoded: string): Promise<Record<string, { filename: string }>> {
    const res = await fetch(`${base}/api/projects/prj_1/blobs`, {
      method: "POST",
      headers: { "Content-Type": "image/png", "X-Isocan-Filename": encoded, ...badge.headers },
      body: `bytes of ${name}`,
    });
    expect(res.status).toBe(200);
    return JSON.parse(await fs.readFile(p.blobsIndexFile(home, "prj_1"), "utf8"));
  }

  it("survives the round trip when percent-encoded", async () => {
    const index = await uploadNamed(SCREENSHOT, encodeFilename(SCREENSHOT));
    expect(Object.values(index).map((entry) => entry.filename)).toEqual([SCREENSHOT]);
  });

  it("keeps emoji and non-Latin names intact", async () => {
    const name = "Скриншот 🌍.png";
    const index = await uploadNamed(name, encodeFilename(name));
    expect(Object.values(index).map((entry) => entry.filename)).toEqual([name]);
  });

  it("still accepts a literal name — an older client, or curl by hand", async () => {
    const index = await uploadNamed("plain.png", "plain.png");
    expect(Object.values(index).map((entry) => entry.filename)).toEqual(["plain.png"]);
  });

  it("does not mangle a name that merely contains a percent", async () => {
    const name = "100% done.png";
    const index = await uploadNamed(name, encodeFilename(name));
    expect(Object.values(index).map((entry) => entry.filename)).toEqual([name]);
  });
});
