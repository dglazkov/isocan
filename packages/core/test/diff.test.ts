import { describe, expect, it } from "vitest";
import type { Item } from "@isocan/core";
import { defaultVersionPair, diffReport, diffVersions, isTextualMime, markSource, sourcePair, versionLabel, versionRef, type DiffSide } from "@isocan/core/diff";

/**
 * **What changed between two versions, per kind** (docs/projects/version-diff/design.md).
 *
 * The engine both `isocan diff` and the web's Compare inspector call. Held
 * here for each kind it reads — text, HTML, and the metadata-only kinds — and
 * for the one thing a sandboxed frame needs from it: marks written into the
 * source at the offsets the diff recorded. Wireframes are held beside the
 * module that draws them (`packages/modules/wireframe/test/diff.test.ts`).
 *
 * Synthetic throughout: Acme's pricing page.
 */

const html = (text: string): DiffSide => ({ mimeType: "text/html", filename: "acme.html", size: text.length, text });
const md = (text: string): DiffSide => ({ mimeType: "text/markdown", filename: "acme.md", size: text.length, text });

const BEFORE = `<!doctype html><html><head><title>Acme</title><style>.btn{color:#333;padding:4px}</style></head><body>
<header><h1>Pricing</h1></header>
<main><div class="card">Basic</div><div class="card">Pro</div><button class="btn ghost">Buy</button></main></body></html>`;
const AFTER = `<!doctype html><html><head><title>Acme plans</title><style>.btn{color:#d00;padding:4px;border:0}</style></head><body>
<header><h1>Plans</h1></header>
<main><div class="card">Basic</div><div class="card">Team</div><div class="card">Pro</div><button class="btn primary" style="margin:2px">Buy now</button></main></body></html>`;

describe("text and Markdown", () => {
  it("diffs by line, pairs a rewritten line with the one it resembles, and names the words", () => {
    const d = diffVersions(md("# Pricing\nOne plan for all.\nContact us."), md("# Plans\nOne plan for all.\nA new line.\nContact us today."));
    expect(d.kind).toBe("text");
    expect(d.counts).toMatchObject({ added: 1, changed: 2, removed: 0 });
    expect(d.changes.map((c) => c.what)).toEqual([
      "the heading “Pricing”: “Pricing” → “Plans”",
      "added line 3: “A new line.”",
      "line 4: added “today”",
    ]);
    const changed = d.rows!.find((r) => r.afterLine === 4)!;
    expect(changed.words!.after.filter((w) => w.changed).map((w) => w.text.trim())).toEqual(["today"]);
    expect(d.rows!.filter((r) => r.op === "same")).toHaveLength(1);
    // Every non-same row belongs to a step a person can move to.
    expect(d.rows!.filter((r) => r.op !== "same").every((r) => r.step && r.step <= d.changes.length)).toBe(true);
    expect(d.summary).toMatch(/^1 line added, 2 changed: /);
  });

  it("says so when there is nothing to see", () => {
    const d = diffVersions(md("same"), md("same"));
    expect(d.identical).toBe(true);
    expect(d.summary).toContain("no difference");
  });
});

describe("HTML", () => {
  const d = diffVersions(html(BEFORE), html(AFTER));

  it("reads the DOM, not the bytes: one inserted card is one added element", () => {
    expect(d.kind).toBe("html");
    const added = d.changes.filter((c) => c.op === "added");
    expect(added.map((c) => c.what)).toEqual(["added a “Team” block"]);
    expect(added[0]!.after!.path).toBe("html/body[1]/main[1]/div[2]");
    expect(d.changes.some((c) => c.op === "removed")).toBe(false);
  });

  it("names attribute, class, inline style, text and stylesheet changes", () => {
    const whats = d.changes.map((c) => c.what);
    expect(whats).toContain("the page title “Acme” → “Acme plans”");
    expect(whats).toContain("the “Pricing” heading: “Pricing” → “Plans”");
    expect(whats).toContain("stylesheet — .btn: color #333 → #d00, border 0 added");
    expect(whats.find((w) => w.startsWith("the “Buy” button"))).toBe(
      "the “Buy” button: class now .primary, no longer .ghost; style margin 2px added; text “now” added",
    );
    // In reading order: steps number the page from the top.
    expect(d.changes.map((c) => c.step)).toEqual(d.changes.map((_, i) => i + 1));
  });

  it("is deterministic — the same pair, the same answer", () => {
    expect(diffVersions(html(BEFORE), html(AFTER))).toEqual(d);
  });

  it("writes marks into each side's source for a frame nothing outside can reach", () => {
    const after = markSource(AFTER, d, "after");
    expect(after).toContain('<div class="card" data-isocan-change="added" data-isocan-step="');
    expect(after).toMatch(/<h1 data-isocan-change="changed" data-isocan-step="\d+">Plans<\/h1>/);
    // The stylesheet rule marks what it styles, from inside the frame.
    expect(after).toContain('".btn"');
    expect(after.indexOf("<style data-isocan-diff>")).toBeLessThan(after.indexOf("</body>"));
    // Unmarked, the source is exactly what it was: marks are insertions only.
    const stripped = after
      .replace(/ data-isocan-change="\w+" data-isocan-step="[\d ]+"/g, "")
      .replace(/<style data-isocan-diff>[\s\S]*?<\/script>/, "");
    expect(stripped).toBe(AFTER);
    // The before side marks its own elements, not the after side's.
    expect(markSource(BEFORE, d, "before")).not.toContain('data-isocan-change="added"');
  });

  it("prints one line per change for the terminal", () => {
    const report = diffReport(d, "v1 → v2 of Acme");
    expect(report.split("\n")[0]).toBe("v1 → v2 of Acme");
    expect(report.split("\n")[1]).toBe(d.summary);
    expect(report).toContain("+ added a “Team” block  [html/body[1]/main[1]/div[2]]");
  });
});

describe("images and other files", () => {
  it("compares an image by its metadata, and says so", () => {
    const d = diffVersions(
      { mimeType: "image/png", filename: "logo.png", size: 2048, blobHash: "a" },
      { mimeType: "image/png", filename: "logo@2x.png", size: 4096, blobHash: "b" },
    );
    expect(d.kind).toBe("image");
    expect(d.note).toMatch(/metadata only/);
    expect(d.changes.map((c) => c.what)).toEqual(["renamed “logo.png” → “logo@2x.png”", "different bytes, 2.0 KB → 4.0 KB"]);
    expect(isTextualMime("image/png")).toBe(false);
    expect(isTextualMime("image/svg+xml")).toBe(true);
  });

  it("calls the same bytes the same", () => {
    expect(diffVersions({ mimeType: "image/png", filename: "a.png", size: 1, blobHash: "x" }, { mimeType: "image/png", filename: "a.png", size: 1, blobHash: "x" }).identical).toBe(true);
  });
});

describe("which two versions", () => {
  const v = (id: string) => ({ id, blobHash: id, mimeType: "text/plain", filename: "a.txt", size: 1, createdAt: "", createdBy: { id: "u", name: "Acme" } });
  const item = { id: "itm_a", title: "Acme", properties: {}, versions: [v("ver_one"), v("ver_two"), v("ver_three")], currentVersionId: "ver_two" } as unknown as Item;

  it("defaults to the version before the one showing, against the one showing", () => {
    const pair = defaultVersionPair(item);
    expect("refused" in pair ? null : [pair.from.id, pair.to.id]).toEqual(["ver_one", "ver_two"]);
    const first = defaultVersionPair({ ...item, currentVersionId: "ver_one" });
    expect("refused" in first ? null : [first.from.id, first.to.id]).toEqual(["ver_one", "ver_two"]);
    expect(defaultVersionPair({ ...item, versions: [v("ver_one")] })).toHaveProperty("refused");
  });

  it("reads a version the ways people name one", () => {
    expect(versionRef(item, "v3")?.id).toBe("ver_three");
    expect(versionRef(item, "1")?.id).toBe("ver_one");
    expect(versionRef(item, "ver_tw")?.id).toBe("ver_two");
    expect(versionRef(item, "ver_t")).toBeNull(); // ambiguous
    expect(versionLabel(item, "ver_three")).toBe("v3");
  });

  it("pairs a variation with its source, and refuses what was made from nothing", () => {
    const child = { ...item, id: "itm_b", title: "Acme bold", properties: { parent: "itm_a" } } as unknown as Item;
    const pair = sourcePair({ itm_a: item, itm_b: child }, child);
    expect("refused" in pair ? null : [pair.source.id, pair.from.id, pair.to.id]).toEqual(["itm_a", "ver_two", "ver_two"]);
    expect(sourcePair({ itm_a: item }, item)).toEqual({ refused: expect.stringContaining("was not made from anything") });
  });
});
