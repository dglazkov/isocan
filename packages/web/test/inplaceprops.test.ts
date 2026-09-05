import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { applyEdits, foldEdit, type AttrEdit, type InPlaceEdit } from "../src/lib/textPatch.ts";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const frame = read("../src/components/TextEditFrame.tsx");
const css = read("../src/styles.css");

/**
 * **Element properties on the stage** (WYSIWYG, stage 2). An attribute edit
 * names its element by ORDINAL — the browser's element walk and parse5's
 * agree, scripts being dead — and splices the attribute's own source range,
 * or inserts a new one just inside the start tag. The same discipline as
 * text: a check against what the file says now, a refusal by name, nothing
 * else touched. Element ordinals include the `<html>`, `<head>` and
 * `<body>` the parser implies, exactly as a browser's walker counts them.
 */
const attr = (ordinal: number, tag: string, name: string, from: string | null, to: string | null): AttrEdit => ({
  kind: "attr",
  ordinal,
  tag,
  name,
  from,
  to,
});

describe("an attribute, spliced by position", () => {
  // html(0) head(1) body(2) p(3) p(4)
  const page = '<p style="color: red">one</p><p class="x">two</p>';

  it("replaces an existing attribute's own range, whatever the quoting was", async () => {
    const out = await applyEdits(page, [attr(3, "p", "style", "color: red", "color: blue; padding: 4px")]);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.source).toBe('<p style="color: blue; padding: 4px">one</p><p class="x">two</p>');
    const single = await applyEdits("<p style='color: red'>one</p>", [attr(3, "p", "style", "color: red", "color: blue")]);
    if (single.ok) expect(single.source).toBe('<p style="color: blue">one</p>');
  });

  it("adds an attribute the element did not have, just inside the start tag", async () => {
    const out = await applyEdits(page, [attr(4, "p", "style", null, "margin: 0")]);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.source).toBe('<p style="color: red">one</p><p class="x" style="margin: 0">two</p>');
  });

  it("removes an attribute and the space before it", async () => {
    const out = await applyEdits(page, [attr(4, "p", "class", "x", null)]);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.source).toBe('<p style="color: red">one</p><p>two</p>');
  });

  it("tells two identical elements apart, and edits the second", async () => {
    const twins = "<button>Go</button><button>Go</button>";
    const out = await applyEdits(twins, [attr(4, "button", "class", null, "primary")]);
    if (out.ok) expect(out.source).toBe('<button>Go</button><button class="primary">Go</button>');
  });

  it("escapes the value, so a quote in a class cannot end the attribute", async () => {
    const out = await applyEdits("<p>x</p>", [attr(3, "p", "class", null, 'a"b & c')]);
    if (out.ok) expect(out.source).toBe('<p class="a&quot;b &amp; c">x</p>');
  });

  it("refuses when the element moved, or no longer says what it said", async () => {
    const wrongTag = await applyEdits(page, [attr(3, "div", "style", "color: red", "color: blue")]);
    expect(wrongTag.ok).toBe(false);
    const moved = await applyEdits(page, [attr(3, "p", "style", "color: green", "color: blue")]);
    expect(moved.ok).toBe(false);
    if (!moved.ok) expect(moved.reason).toContain("changed while you were editing");
  });

  it("refuses an element the parser implied rather than read — there is no tag to splice", async () => {
    // <body> is ordinal 2 here and was never written.
    const out = await applyEdits("<p>x</p>", [attr(2, "body", "style", null, "margin: 0")]);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toContain("implied");
  });

  it("lands beside a text edit on the same element without either shifting the other", async () => {
    const edits: InPlaceEdit[] = [{ ordinal: 0, from: "one", to: "uno" }, attr(3, "p", "style", "color: red", "color: blue")];
    const out = await applyEdits(page, edits);
    if (out.ok) expect(out.source).toBe('<p style="color: blue">uno</p><p class="x">two</p>');
  });

  it("folds repeated changes to one attribute into one edit against the original value", () => {
    let pending: AttrEdit[] = [];
    pending = foldEdit(pending, attr(3, "p", "style", "color: red", "color: blue"));
    pending = foldEdit(pending, attr(3, "p", "style", "color: blue", "color: green"));
    expect(pending).toEqual([attr(3, "p", "style", "color: red", "color: green")]);
    // Back to where it started: no edit at all.
    pending = foldEdit(pending, attr(3, "p", "style", "color: green", "color: red"));
    expect(pending).toEqual([]);
    // Two attributes on one element are two edits.
    pending = foldEdit(pending, attr(3, "p", "class", null, "big"));
    pending = foldEdit(pending, attr(3, "p", "style", "color: red", "color: blue"));
    expect(pending.length).toBe(2);
  });
});

describe("the frame's properties panel", () => {
  it("selects an element on click, counts it the browser's way, and skips its own marker", () => {
    expect(frame).toContain('theDoc.addEventListener("click", onClick);');
    expect(frame).toContain("createTreeWalker(theDoc, NodeFilter.SHOW_ELEMENT)");
    expect(frame).toContain("if (walker.currentNode === marker) continue;");
  });

  it("offers the class and a handful of inline styles, writes the frame live, and records the whole attribute", () => {
    expect(frame).toContain('{ prop: "background-color", label: "Background" }');
    expect(frame).toContain("el.style.setProperty(name, value);");
    expect(frame).toContain('record({ kind: "attr", ordinal, tag, name: "style", from: styleFrom, to: el.getAttribute("style") });');
    expect(css).toContain(".props-panel {");
  });

  it("keeps the frame frozen: same-origin, no scripts, exactly as before", () => {
    const iframe = frame.slice(frame.indexOf("<iframe"), frame.indexOf("/>", frame.indexOf("<iframe")));
    expect(iframe).toContain('sandbox="allow-same-origin"');
    expect(iframe).not.toContain("allow-scripts");
  });
});
