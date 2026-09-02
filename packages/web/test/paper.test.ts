import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PAPERS } from "@isocan/core";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const css = read("../src/styles.css");

/**
 * **Paper is offered on both surfaces, or it is a habit.**
 *
 * The one law this project has: a rule the app enforces and the CLI does not
 * know about is not a rule. That applies to what you can MAKE as much as to
 * what you can do — a style only the app can set would be a canvas the
 * terminal cannot reproduce.
 */
describe("a post-it is a text node wearing paper", () => {
  it("is offered by the CLI too, not only by the Text tool", () => {
    const cli = read("../../cli/src/main.ts");
    expect(cli).toContain('.option("--paper <colour>"');
    expect(cli).toContain("PAPER_PROP");
  });

  it("asks core which papers exist, on both surfaces", () => {
    // Not a hand-written list in either place: one closed set, or the two
    // drift and a note made in the terminal renders as nothing in the app.
    expect(read("../src/components/TextComposer.tsx")).toContain("PAPERS");
    expect(read("../../cli/src/main.ts")).toContain("PAPERS");
  });

  it("gives every paper a colour in BOTH themes", () => {
    // A tint tuned on white and forgotten in the dark is the exact bug the
    // token rule exists for. Paper stays pale in both — it is a bright object
    // on a dark desk — so these are dimmed, never inverted.
    const roots = [...css.matchAll(/:root[^{]*\{([^}]*)\}/gs)].map((m) => m[1]!);
    const light = roots.find((b) => b.includes("--paper-yellow:"));
    const dark = roots.filter((b) => b.includes("--paper-yellow:"))[1];
    expect(light, "no light paper tokens").toBeTruthy();
    expect(dark, "no dark paper tokens").toBeTruthy();
    for (const one of PAPERS) {
      expect(light, `--paper-${one} missing in light`).toContain(`--paper-${one}:`);
      expect(dark, `--paper-${one} missing in dark`).toContain(`--paper-${one}:`);
    }
  });

  it("puts the card back that a plain text node takes away", () => {
    // `.item.textnode` is deliberately chromeless — transparent, no border,
    // no shadow. Paper is the opposite on purpose: edges and a shadow are
    // what make it read as an object you could pick up.
    const rule = css.slice(css.indexOf(".item.textnode.paper {"));
    const body = rule.slice(0, rule.indexOf("}"));
    expect(body).toContain("background: var(--paper)");
    expect(body).toContain("box-shadow:");
  });

  it("declares the swatch AFTER the button class it borrows", () => {
    /**
     * The swatches wear `.text-style-btn` for their size and hit area, and
     * that class sets `background: transparent; border: none` at the same
     * specificity. Declared above it, every swatch painted nothing and the
     * chosen one took `.on`'s accent fill — five invisible squares and a blue
     * one, reported as "the text tool is broken".
     *
     * Order is the whole fix, so order is what this guards. Nothing here
     * needs to out-specify anything; it needs to come second.
     */
    expect(css.indexOf(".text-paper {")).toBeGreaterThan(css.indexOf(".text-style-btn {"));
  });

  it("keeps a chosen swatch showing its paper rather than the accent", () => {
    // A swatch's whole job is to be the colour it stands for; filling it with
    // the accent to say "chosen" hides the one thing it exists to show.
    expect(css).toContain(".text-paper.on { background: var(--paper); outline:");
  });

  it("offers 'no paper' first, so a caption stays the default", () => {
    // A picker whose first option is a colour quietly makes every note a
    // sticky one.
    expect(read("../src/components/TextComposer.tsx")).toContain("[null, ...PAPERS]");
  });

  /**
   * **Re-opening a note is editing the note, not filling a form over it.**
   *
   * Reported with a picture: a yellow note somebody had dragged to 259×326,
   * double-clicked, and a white 220-square field sitting inside the yellow
   * with the words in it. Three things were wrong at once, and each has its
   * own guard because each was its own omission.
   */
  describe("re-opening a note for editing", () => {
    const composer = read("../src/components/TextComposer.tsx");

    it("carries the note's paper into the composer", () => {
      // `openTextEditor` passed the box, the step and the face, and not the
      // paper — so the composer opened as the plain white field, over the
      // note it was supposed to be.
      const view = read("../src/components/ItemView.tsx");
      const open = view.slice(view.indexOf("async function openTextEditor"));
      const call = open.slice(0, open.indexOf("});"));
      expect(call).toContain("paper,");
    });

    it("sits on the note's own box, not the default square", () => {
      // A new note is `PAPER_SIZE`; an existing one is whatever it was
      // dragged to, and the composer has to be that, edge for edge.
      expect(composer).toContain("pending.itemId ? (pending.width ?? PAPER_SIZE) : PAPER_SIZE");
      expect(composer).toContain("pending.itemId ? (pending.height ?? PAPER_SIZE) : PAPER_SIZE");
    });

    it("commits the note's box rather than the words' measure", () => {
      // The mirror measures prose. A post-it is fixed size by decision
      // (`core/textnode.ts`), so an edit must not hand `reviseTextNode` a
      // narrow measure that would resize the note to its sentence.
      expect(composer).toContain("at.paper ? { width, height } : { width: fit.width, height: fit.height }");
    });

    it("lands a paper changed mid-edit, through core's own patch", () => {
      // The swatches are on the composer during an edit too. Yellow opened
      // and pink chosen has to commit pink — and through `paperPatch`, so
      // the app and the CLI cannot spell the property two ways.
      const text = read("../src/lib/text.ts");
      const revise = text.slice(text.indexOf("export async function reviseTextNode"));
      expect(revise).toContain("paperPatch(paper)");
      expect(composer).toContain("at.paper ?? null,");
    });

    it("inks the note's words with the selector the words actually wear", () => {
      // The ink rule was written for `.text-view`, a class nothing renders,
      // so a committed note kept the canvas's ink — pale on yellow in dark
      // mode, the exact failure the rule's own comment describes — while
      // the composer over it used `--paper-ink`. The words changed colour
      // the moment they landed. `MarkdownView` renders `.md-view`.
      expect(css).toContain(".item.textnode.paper .md-view { color: var(--paper-ink); }");
      expect(css).not.toContain(".item.textnode.paper .text-view");
    });

    it("insets the words on a note exactly as the composer does", () => {
      // Composer and note share every metric or the words jump on commit.
      // Paper gave the composer 10px of breathing room and left the note at
      // the caption's 4px 6px, so every edit nudged the first line.
      const noteInset = css.match(/\.item\.textnode\.paper \.md-view \{ padding: ([^;]+);/)?.[1];
      const composerRule = css.slice(css.indexOf(".text-composer.on-paper textarea,"));
      const composerInset = composerRule.match(/padding: ([^;]+);/)?.[1];
      expect(noteInset, "the note's inset").toBeTruthy();
      expect(noteInset).toBe(composerInset);
    });
  });
});
