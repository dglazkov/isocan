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
