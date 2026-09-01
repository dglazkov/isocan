import { describe, expect, it } from "vitest";
import type { Item } from "../src/model.ts";
import { FILE_PROP, backingOf, cleanFilePath, fileOf } from "../src/backing.ts";

const actor = { id: "usr_a", name: "A" };

const item = (properties: Record<string, string>, hash = "hash_now"): Item => ({
  id: "itm_1",
  x: 0,
  y: 0,
  width: 100,
  height: 80,
  title: "Screen",
  description: "",
  properties,
  versions: [
    {
      id: "ver_1",
      blobHash: "hash_old",
      mimeType: "text/html",
      filename: "a.html",
      size: 1,
      createdAt: "",
      createdBy: actor,
    },
    {
      id: "ver_2",
      blobHash: hash,
      mimeType: "text/html",
      filename: "a.html",
      size: 1,
      createdAt: "",
      createdBy: actor,
    },
  ],
  currentVersionId: "ver_2",
  createdAt: "",
  createdBy: actor,
  updatedAt: "",
  updatedBy: actor,
});

describe("where an item belongs", () => {
  it("is nowhere by default, which stays perfectly useful", () => {
    expect(fileOf(item({}))).toBe(null);
    expect(backingOf(item({}), true, () => "x")).toBe(null);
  });

  it("is the property, trimmed", () => {
    expect(fileOf(item({ [FILE_PROP]: "  src/a.html  " }))).toBe("src/a.html");
    // Whitespace is not a path.
    expect(fileOf(item({ [FILE_PROP]: "   " }))).toBe(null);
  });
});

describe("what one machine's disk says", () => {
  const tracked = item({ [FILE_PROP]: "src/a.html" });

  it("written: the file is there and matches the current version", () => {
    expect(backingOf(tracked, true, () => "hash_now")).toEqual({
      path: "src/a.html",
      state: "written",
    });
  });

  it("drifted: there, and not anything this item has EVER been", () => {
    // Somebody edited it outside the canvas. A write would eat their work,
    // so this is the state the write route refuses on.
    expect(backingOf(tracked, true, () => "hash_theirs")?.state).toBe("drifted");
  });

  it("behind: there, and holding an OLDER version of this same item", () => {
    /**
     * This case used to answer "drifted", and the reasoning written beside it
     * was that behind is still "not what would be written". True of the
     * write, and false of the WORD — which is where it did damage.
     *
     * `writeBound` has always refused on "not anything this canvas ever
     * wrote", and it is handed every version's hash; this function compared
     * against the current one alone. So the two halves of one rule
     * disagreed, and the client called a file drifted that the daemon would
     * have written without complaint. The web believed the client, offered
     * "Overwrite file", and that button passes `force` — which is exactly
     * what switches the real drift check OFF. The one state that never
     * needed the escape hatch was the only one being handed it.
     *
     * `version promote` produces this state every time, because nothing
     * writes a file on its own.
     */
    expect(backingOf(tracked, true, () => "hash_old")?.state).toBe("behind");
  });

  it("agrees with the daemon about what is ours", () => {
    // The set the client tests against must be the set the daemon writes
    // against — every version, not the current one. This is the guard on the
    // fold: if either side narrows it again, they disagree again.
    const everyHash = tracked.versions.map((v) => v.blobHash);
    for (const hash of everyHash) {
      expect(backingOf(tracked, true, () => hash)?.state, `${hash} read as foreign`).not.toBe(
        "drifted",
      );
    }
  });

  it("absent: tracked, never written here", () => {
    expect(backingOf(tracked, true, () => null)?.state).toBe("absent");
  });

  it("unbound is not absent — no checkout is a different answer", () => {
    // The distinction that keeps "you have no repo here" from reading as
    // "somebody deleted your file". Every hosted canvas is unbound.
    expect(backingOf(tracked, false, () => null)?.state).toBe("unbound");
    expect(backingOf(tracked, false, () => "anything")?.state).toBe("unbound");
  });
});

describe("what a canvas may name", () => {
  it("takes an ordinary relative path", () => {
    expect(cleanFilePath("src/views/start.html")).toBe("src/views/start.html");
    expect(cleanFilePath("  index.html ")).toBe("index.html");
    expect(cleanFilePath("./a/./b.html")).toBe("a/b.html");
    // Windows spelling of the same thing.
    expect(cleanFilePath("src\\a.html")).toBe("src/a.html");
  });

  it("refuses what is an answer about a MACHINE, not a canvas", () => {
    expect(cleanFilePath("/etc/passwd")).toBe(null);
    expect(cleanFilePath("../../secrets")).toBe(null);
    expect(cleanFilePath("a/../../b")).toBe(null);
  });

  it("refuses dot segments, at any depth", () => {
    // `listable` refuses these at the far end; offering them here would be
    // an affordance that leads to a refusal.
    expect(cleanFilePath(".env")).toBe(null);
    expect(cleanFilePath(".git/config")).toBe(null);
    expect(cleanFilePath("src/.ssh/key")).toBe(null);
  });

  it("refuses nothing at all", () => {
    expect(cleanFilePath("")).toBe(null);
    expect(cleanFilePath("   ")).toBe(null);
    expect(cleanFilePath("/")).toBe(null);
  });
});
