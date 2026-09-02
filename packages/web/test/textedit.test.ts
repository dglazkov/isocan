import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const composer = read("../src/components/TextComposer.tsx");
const text = read("../src/lib/text.ts");
const css = read("../src/styles.css");

/**
 * **The composer's contract, after three flows were reported broken at once.**
 *
 * 1. Type on a new note, pick yellow, click the Select tool: the words vanish.
 * 2. Double-click a caption, pick yellow, click away: it stays a caption.
 * 3. Double-click a caption: a short white field sits inside the item.
 *
 * One and two were the same bug. `pending.body` is the BASELINE — the words
 * the node had when the composer opened — and `textCommit` compares the draft
 * against it to decide whether anything was said. `restyle` copied the draft
 * into it, so "type, then choose" made the baseline equal the draft, and the
 * commit read "unchanged": a new note dropped on the floor, an existing one
 * never recoloured. Three was the composer sizing itself to the measured
 * words and painting a card, for a node that has its own box and wears none.
 *
 * The contract these guard:
 * - the baseline is written when a composer OPENS and never again;
 * - a look change on an existing node lands NOW, as its own undo step;
 * - a look change on a new node is held and travels with the words;
 * - an existing node is edited on its own box, transparent, words selected.
 */
describe("the baseline is the words the node had, never the draft", () => {
  const restyle = composer.slice(composer.indexOf("function restyle("), composer.indexOf("async function commit("));

  it("does not write the draft into pending.body on a restyle", () => {
    expect(restyle).not.toMatch(/^\s*body,\s*$/m);
    expect(restyle).not.toContain("body:");
  });

  it("commits against pending.body, the baseline", () => {
    expect(composer).toContain("textCommit(body, at.body, at.itemId !== null)");
  });
});

describe("a look change on an existing node lands now", () => {
  it("sends restyleTextNode from the composer, for existing nodes only", () => {
    const restyle = composer.slice(composer.indexOf("function restyle("), composer.indexOf("async function commit("));
    expect(restyle).toMatch(/if \(at\.itemId\) \{\s*void restyleTextNode\(/);
  });

  it("is an item.update through the shared look patch, not a version", () => {
    const fn = text.slice(text.indexOf("export async function restyleTextNode"));
    const body = fn.slice(0, fn.indexOf("\n}\n"));
    expect(body).toContain('type: "item.update"');
    expect(body).toContain("lookPatch(style, face, paper)");
    expect(body).not.toContain("item.addVersion");
  });

  it("groups the square it may take with the restyle — one ⌘Z", () => {
    const fn = text.slice(text.indexOf("export async function restyleTextNode"));
    const body = fn.slice(0, fn.indexOf("\n}\n"));
    expect(body).toContain("const group = newGroupId();");
    expect(body).toMatch(/item\.resize[\s\S]*group/);
  });

  it("takes the square only when paper goes ON a caption", () => {
    // Paper off keeps the box; paper on a note that already has some keeps it
    // too. Only caption → note changes the shape, and only up to the square.
    expect(composer).toContain("at.itemId && paper2 !== null && (at.paper ?? null) === null");
    expect(composer).toContain("Math.max(at.width ?? 0, PAPER_SIZE)");
  });

  it("revises words and restyles through the SAME patch, so they cannot drift", () => {
    expect(text.match(/lookPatch\(style, face, paper\)/g)?.length).toBe(2);
  });
});

describe("a new node remembers the paper you chose, like the step", () => {
  it("opens the next composer on the last paper, from both entry points", () => {
    expect(read("../src/components/CanvasViewport.tsx")).toContain("paper: ui.lastPaper,");
    expect(read("../src/lib/menuentries.tsx")).toContain("paper: ui.lastPaper,");
  });

  it("writes the paper with the step and face", () => {
    expect(composer).toContain("ui.setLastText(style2, face2, paper2)");
    const ui = read("../src/stores/uiStore.ts");
    expect(ui).toMatch(/function writeText\(style: TextStyle, face: TextFace, paper: Paper \| null\)/);
  });
});

describe("an existing node is edited on its own box", () => {
  it("uses the node's width for a caption, and lets it grow downward only", () => {
    expect(composer).toContain("editing ? (pending.width ?? fit.width) : fit.width");
    expect(composer).toContain("editing ? Math.max(pending.height ?? 0, fit.height) : fit.height");
  });

  it("selects the words on open, like a rename", () => {
    expect(composer).toContain("if (pending.itemId) el.select();");
  });

  it("paints no card under the field — a caption wears none", () => {
    const rule = css.slice(css.indexOf(".text-composer textarea {"));
    const body = rule.slice(0, rule.indexOf("}"));
    expect(body).toContain("background: transparent;");
    expect(body).not.toContain("var(--card)");
  });
});

/**
 * **Hovering a swatch previews the paper; only a click chooses it.**
 *
 * The bar's principle is that a choice is previewed by the thing you are
 * typing into. A hover is the same principle one step earlier: the composer
 * wears the paper under the pointer for as long as it is there, and goes
 * back when it leaves. Nothing is sent or remembered by a hover.
 */
describe("hovering a swatch previews its paper", () => {
  const swatch = composer.slice(composer.indexOf("[null, ...PAPERS]"), composer.indexOf("</div>", composer.indexOf("[null, ...PAPERS]")));

  it("dresses the composer in the hovered paper and undresses on leave", () => {
    expect(swatch).toContain("onPointerEnter={() => setPeek(one)}");
    expect(swatch).toContain("onPointerLeave={() => setPeek(undefined)}");
    expect(composer).toContain("const paper = peek !== undefined ? peek : (pending?.paper ?? null);");
  });

  it("sends nothing on hover — restyle is the click's alone", () => {
    expect(swatch).not.toMatch(/onPointerEnter=\{[^}]*restyle/);
    expect(swatch).toContain("onClick={() => restyle({ paper: one })}");
  });

  it("forgets the hover when a new composer opens", () => {
    const reset = composer.slice(composer.indexOf("setBody(pending?.body"), composer.indexOf("placeCaret.current = true;"));
    expect(reset).toContain("setPeek(undefined)");
  });
});

/**
 * **The bar says sizes, and both surfaces read the same map.**
 *
 * B / H / T / D were the initials of the step names, a code for anyone not
 * told the words. S / M / L / XL is a vocabulary everybody has. The labels
 * live in core so the bar cannot say one thing and the CLI accept another.
 */
describe("the step buttons say sizes", () => {
  it("draws the label from core, never a hand-written initial", () => {
    expect(composer).toContain("{TEXT_STYLE_LABEL[s]}");
    expect(composer).not.toContain("{s[0]!.toUpperCase()}");
  });

  it("keeps the step's name and its promise one hover away", () => {
    expect(composer).toMatch(/title=\{`\$\{s\} — readable down to/);
  });

  it("is accepted by the CLI in the same spelling", () => {
    const cli = read("../../cli/src/main.ts");
    expect(cli).toContain("textStyleFrom(opts.style)");
    expect(cli).toContain("S | M | L | XL");
  });

  it("is a control you can see — 28px, between the rail and a chip", () => {
    const rule = css.slice(css.indexOf(".text-style-btn {"));
    const body = rule.slice(0, rule.indexOf("}"));
    expect(body).toContain("height: 28px");
  });
});

describe("hovering a step or a face previews it too", () => {
  it("draws the composer in the hovered step and face, chosen otherwise", () => {
    expect(composer).toContain('const style = peekStyle ?? pending?.style ?? "body";');
    expect(composer).toContain('const face = peekFace ?? pending?.face ?? "sans";');
  });

  it("previews on enter, restores on leave, chooses only on click", () => {
    expect(composer).toContain("onPointerEnter={() => setPeekStyle(s)}");
    expect(composer).toContain("onPointerLeave={() => setPeekStyle(undefined)}");
    expect(composer).toContain("onPointerEnter={() => setPeekFace(f)}");
    expect(composer).toContain("onPointerLeave={() => setPeekFace(undefined)}");
  });

  it("commits and restyles from what was chosen, never from a hover", () => {
    const restyle = composer.slice(composer.indexOf("function restyle("), composer.indexOf("async function commit("));
    expect(restyle).toContain("next.style ?? at.style");
    expect(restyle).not.toContain("peekStyle");
    const commit = composer.slice(composer.indexOf("async function commit("), composer.indexOf("commitRef.current = commit"));
    expect(commit).toContain("at.style");
    expect(commit).not.toContain("peekStyle");
    expect(commit).not.toContain("peekFace");
  });

  it("forgets the hover when a new composer opens", () => {
    const reset = composer.slice(composer.indexOf("setBody(pending?.body"), composer.indexOf("placeCaret.current = true;"));
    expect(reset).toContain("setPeekStyle(undefined)");
    expect(reset).toContain("setPeekFace(undefined)");
  });
});
