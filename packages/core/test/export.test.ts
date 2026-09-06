import { describe, expect, it } from "vitest";
import type { LogEntry } from "../src/index.ts";
import {
  blobFileName,
  blobsNamedBy,
  opsTouching,
  parseExportTarget,
  parseItemAddress,
} from "../src/index.ts";

/**
 * **A backup is the log and the bytes it names** — the pure half of
 * `isocan export`, held here so both surfaces mean the same thing by "what
 * gets backed up" without either owning the answer.
 */

const entry = (seq: number, op: unknown, inverse: unknown = null): LogEntry =>
  ({
    seq,
    envelope: { actor: { id: "usr_a", name: "A" }, ts: `2026-09-02T00:00:0${seq}Z`, op },
    inverse,
  }) as unknown as LogEntry;

const version = (hash: string, filename = "note.md", mimeType = "text/markdown") => ({
  id: `ver_${hash}`,
  blobHash: hash,
  mimeType,
  filename,
  size: 12,
});

describe("what an export target names", () => {
  it("reads the three addresses this product writes", () => {
    expect(parseExportTarget("https://isocan.io")).toEqual({ kind: "home", origin: "https://isocan.io" });
    expect(parseExportTarget("https://isocan.io/")).toEqual({ kind: "home", origin: "https://isocan.io" });
    expect(parseExportTarget("https://isocan.io/p/prj_x")).toEqual({
      kind: "canvas",
      origin: "https://isocan.io",
      canvasId: "prj_x",
    });
    expect(parseExportTarget("isocan.io/p/prj_x")).toEqual({
      kind: "canvas",
      origin: "https://isocan.io",
      canvasId: "prj_x",
    });
    expect(parseExportTarget("https://isocan.io/p/prj_x/i/itm_y")).toEqual({
      kind: "item",
      origin: "https://isocan.io",
      canvasId: "prj_x",
      itemId: "itm_y",
    });
  });

  it("takes a loopback home without a scheme, the way a developer types it", () => {
    expect(parseExportTarget("127.0.0.1:4441")).toEqual({ kind: "home", origin: "http://127.0.0.1:4441" });
    expect(parseExportTarget("localhost:4441/")).toEqual({ kind: "home", origin: "http://localhost:4441" });
  });

  it("leaves a ref alone — an id, a title, even a title with a dot in it", () => {
    // A rule that guessed `https://` in front of anything with a dot would
    // export the wrong thing from the wrong place. A home has to carry its
    // scheme; a canvas titled "notes.md" is a canvas.
    expect(parseExportTarget("prj_x")).toBeNull();
    expect(parseExportTarget("Moving Day")).toBeNull();
    expect(parseExportTarget("notes.md")).toBeNull();
    expect(parseExportTarget("")).toBeNull();
  });

  it("refuses an address that is nearly one of ours", () => {
    // The workbench is a page, not a canvas, and a deeper path is not a home.
    expect(parseExportTarget("https://isocan.io/p/prj_x/w")).toBeNull();
    expect(parseExportTarget("https://isocan.io/about")).toBeNull();
    expect(parseExportTarget("ftp://isocan.io")).toBeNull();
  });
});

describe("one item's address, read back", () => {
  it("is the inverse of itemUrl, pass fragment dropped and trailing slash forgiven", () => {
    expect(parseItemAddress("https://isocan.io/p/prj_x/i/itm_y/#pass.secret")).toEqual({
      origin: "https://isocan.io",
      canvasId: "prj_x",
      itemId: "itm_y",
    });
    expect(parseItemAddress("https://isocan.io/p/prj_x")).toBeNull();
    expect(parseItemAddress("https://isocan.io/p/prj_x/i/")).toBeNull();
  });
});

describe("which blobs a log names", () => {
  it("finds every version spec, whichever op carries it, once each", () => {
    const entries = [
      entry(1, { type: "project.create", canvasId: "prj_x", title: "T" }),
      entry(2, { type: "item.add", itemId: "itm_a", version: version("aaa") }),
      entry(3, { type: "item.addVersion", itemId: "itm_a", version: version("bbb", "pic.png", "image/png") }),
      // The same bytes named twice are one blob.
      entry(4, { type: "item.add", itemId: "itm_b", version: version("aaa") }),
      // A future op that names bytes in a nested place is still found.
      entry(5, { type: "something.new", payload: { inner: [{ version: version("ccc") }] } }),
    ];
    const named = blobsNamedBy(entries);
    expect([...named.keys()].sort()).toEqual(["aaa", "bbb", "ccc"]);
    expect(named.get("bbb")).toEqual({ mimeType: "image/png", filename: "pic.png", size: 12 });
  });

  it("walks the inverse too — an undone add's bytes are still history", () => {
    const entries = [
      entry(1, { type: "item.remove", itemId: "itm_a" }, { type: "item.add", itemId: "itm_a", version: version("ddd") }),
    ];
    expect([...blobsNamedBy(entries).keys()]).toEqual(["ddd"]);
  });
});

describe("which entries touch one item", () => {
  it("matches the id wherever an op carries it, and nothing else", () => {
    const entries = [
      entry(1, { type: "item.add", itemId: "itm_a", version: version("aaa") }),
      entry(2, { type: "item.add", itemId: "itm_b", version: version("bbb") }),
      entry(3, { type: "item.moveMany", moves: [{ itemId: "itm_a", x: 1, y: 2 }] }),
      entry(4, { type: "thread.create", threadId: "thr_1", anchorItemId: "itm_a" }),
      entry(5, { type: "item.set", itemId: "itm_ab", title: "not a prefix match" }),
    ];
    expect(opsTouching(entries, "itm_a").map((e) => e.seq)).toEqual([1, 3, 4]);
  });
});

describe("what a blob is called on disk", () => {
  it("files bytes the way FileStore does, so a hand-copied backup is a canvas", () => {
    expect(blobFileName("abc", "pic.png", "image/png")).toBe("abc.png");
    expect(blobFileName("abc", "noext", "image/webp")).toBe("abc.webp");
    expect(blobFileName("abc", "noext", "application/x-unknown")).toBe("abc.bin");
  });
});
