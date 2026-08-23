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
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  badge = await mintTestBadge(base);
  await badge.speakAs(alice); // a badge speaks only for actors it claims
  const res = await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify({
      projectId: null,
      actor: alice,
      op: { type: "project.create", projectId: "prj_1", title: "P" },
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

async function fetchBlob(hash: string): Promise<{ status: number; body: string }> {
  const res = await fetch(`${base}/api/projects/prj_1/blobs/${hash}`);
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
      headers: { Range: header },
    });
    return {
      status: res.status,
      contentRange: res.headers.get("content-range"),
      body: await res.text(),
    };
  }

  it("advertises byte ranges on every blob, before anybody asks", async () => {
    const hash = await upload(CONTENT, "digits.txt");
    const res = await fetch(`${base}/api/projects/prj_1/blobs/${hash}`);
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
