import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const item = read("../src/components/ItemView.tsx");
const fan = read("../src/components/VersionFanOut.tsx");
const css = read("../src/styles.css");

/**
 * **What a thing IS, once the chrome has gone** (7 Sep 2026).
 *
 * Dion: *"I would like to have clear differences based on the type of node on
 * the canvas."* The audit found the signal had not been missing — it had been
 * deleted by zoom. `.item-titlebar` is `display: none` below
 * `hasRoomForChrome`, and the kind icon lives in it, so at exactly the zoom
 * where a wall of pale rectangles is hardest to read, every type signal goes
 * at once.
 */
describe("the kind mark stands in for the chrome that hid", () => {
  it("appears only once the chrome has gone", () => {
    expect(item).toContain("const kindMark = !roomy");
  });

  it("exempts the kinds that already say what they are", () => {
    /* An image, a video and a drawing ARE their small form — a mark over one
       says nothing it did not already say and covers the thing it names. It is
       the pale rectangles that become indistinguishable. This is the same rule
       `textIsLegible` applies to words, reaching the other kinds. */
    expect(item).toContain('const picture = kind === "image" || kind === "video" || kind === "drawing"');
    expect(item).toMatch(/kindMark = !roomy && !isText && !picture/);
  });

  it("is sized by the item, using the rule the text mark already uses", () => {
    // "Forty oversized glyphs are the same smear in a different hat" — the
    // text mark's own comment, and the reason this shares its size rule rather
    // than picking a second one.
    expect(item).toContain("textMarkSize(width, height, scale) / scale");
  });

  it("stops drawing once it would be too small to read", () => {
    /**
     * Found by looking, at 5% zoom on a real canvas: a 16x10 item was carrying
     * an 8-pixel glyph. That is not an answer to "what is this" — it is a
     * smudge, and a canvas of them is the smear the mark existed to replace.
     * The text mark's own comment says it: "forty oversized glyphs are the
     * same smear in a different hat."
     *
     * `hasRoomForChrome` decides when the mark takes over; without a floor of
     * its own it went on shrinking to nothing. Below the floor the honest
     * thing to draw is nothing — the minimap answers "what is where" at that
     * scale, and answers it better.
     */
    expect(item).toContain("markPx >= KIND_MARK_MIN");
    expect(item, "sized once, not twice").not.toMatch(/textMarkSize\(width, height, scale\)[\s\S]{0,40}textMarkSize\(/);
  });

  it("does not paint state colours, because state is the outline's job", () => {
    /* The recommendation the audit landed on. `--accent` means "this one,
       wherever you are pointing at it from" — the files panel row and the
       minimap peek use it too — so colouring hover or selection by TYPE would
       spend that invariant, and add a fourth colour language to pixels already
       carrying three. */
    const block = css.slice(css.indexOf(".kind-mark"), css.indexOf(".text-mark"));
    expect(block).toContain("var(--ink-soft)");
    expect(block).not.toContain("--accent");
  });
});

/**
 * **A version draws as the thing the item is.**
 *
 * A DESIGN.md carries its tokens as swatches on the canvas, and every older
 * version fanned out beside it as a wall of raw markdown — *"version: alpha
 * name: Stitch description:…"*. `VersionContent` takes a `designSystem` flag
 * and three callers pass it; the fan was the fourth and did not.
 */
describe("the version fan hands over the same facts as the canvas", () => {
  it("tells VersionContent when the item is a design system", () => {
    expect(fan).toContain("designSystem={isDesignSystem(item)}");
  });

  it("tells it about a canvas card too, for the same reason", () => {
    // Otherwise a canvas item's earlier versions are its ADDRESS as text
    // rather than the place drawn small.
    expect(fan).toContain("canvasOf={canvasIdOf(item)}");
    expect(fan).toContain("canvasSource={sourceOf(item)}");
  });

  it("keeps the four callers in step", () => {
    /* The drift a shared component exists to prevent: three callers agreeing
       and one not is invisible in review, because each file looks right on its
       own. */
    for (const rel of [
      "../src/components/ItemView.tsx",
      "../src/components/ArtifactStage.tsx",
      "../src/components/Viewer.tsx",
      "../src/components/VersionFanOut.tsx",
    ]) {
      expect(read(rel), `${rel} passes designSystem`).toContain("designSystem={isDesignSystem(item)}");
    }
  });
});
