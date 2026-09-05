import type { DefaultTreeAdapterMap } from "parse5";

/**
 * Patching one text node — or one attribute of one element — of an HTML file
 * by its LOCATION in the source: the parse5 upgrade the WYSIWYG research
 * staged (`docs/research/2026-08-26-wysiwyg.md`, "the native path"), and
 * its second stage, element properties.
 *
 * **What this replaces, and why it had to go.** The V0 matched by string: an
 * edit applied only if the old text appeared in the source verbatim and
 * exactly once. That is structurally unable to corrupt a file, which is why
 * it shipped, and it refused two things people actually do:
 *
 * - **Entities.** A headline reading `Rest & Play` is `Rest &amp; Play` in
 *   the source, so the DOM's text was never found. The very first in-place
 *   edit anybody attempted hit this.
 * - **Repeats.** Two buttons saying `Submit` made either one unpatchable,
 *   because a string search cannot tell which was clicked.
 *
 * **The correspondence that fixes both.** parse5 implements the same parsing
 * algorithm the browser does, so for one input the two build the same tree —
 * and the edit frame's scripts are DEAD (that is why the frame freezes the
 * page), so nothing mutates the DOM out from under that equivalence. The nth
 * text node in the frame IS the nth text node parse5 sees, and the nth
 * ELEMENT is the nth element. So an edit names its node by ORDINAL rather
 * than by content, `sourceCodeLocation` gives that node's byte range — or
 * that attribute's, or the start tag's when the attribute is not there yet —
 * and the splice is exact: entities are irrelevant because nothing is
 * searched for, and repeats are unambiguous because a position is not a
 * string.
 *
 * `from` survives as a CHECK rather than a search key — if the node at that
 * ordinal no longer says what it said when you clicked it, the file moved
 * under the edit and the save is refused. The worst outcome is still a polite
 * no, and the rest of the file is still byte-for-byte untouched.
 */

type PatchOutcome = { ok: true; source: string } | { ok: false; reason: string };

/** One committed in-place text edit. */
export interface TextEdit {
  /** Which text node, counted in document order over the whole document —
   * the one number the frame and the parser can both compute. */
  ordinal: number;
  /** What the node said when it was clicked. A check, never a search. */
  from: string;
  to: string;
}

/**
 * One committed attribute edit — stage 2, element properties. The panel
 * writes `style` and `class`; the shape is any attribute, because the
 * splice does not care which.
 */
export interface AttrEdit {
  kind: "attr";
  /** Which element, counted in document order over the whole document
   *  (`createTreeWalker(SHOW_ELEMENT)` on the frame's side). */
  ordinal: number;
  /** Lowercased tag name, checked against the source so a moved file
   *  cannot land a style on the wrong kind of thing. */
  tag: string;
  name: string;
  /** The attribute's value when the element was selected; null when it had
   *  none. A check, never a search. */
  from: string | null;
  /** The value to write; null removes the attribute. */
  to: string | null;
}

export type InPlaceEdit = TextEdit | AttrEdit;

export function isAttrEdit(edit: InPlaceEdit): edit is AttrEdit {
  return (edit as AttrEdit).kind === "attr";
}

/** Raw-text elements: their content is NOT entity-decoded by a parser, so it
 * must not be entity-ENCODED on the way back in. They are also invisible in
 * the frozen frame (scripts dead, styles not text), so nothing should be
 * editable inside one — this exists to make that true rather than assumed. */
const RAW_TEXT = new Set(["script", "style"]);

/**
 * A text node's value, escaped for the place it is going.
 *
 * Only `&` and `<` can change the meaning of character data — `>` is
 * unambiguous outside a tag, and leaving it alone keeps diffs small, which is
 * the whole point of splicing rather than serializing.
 */
function encodeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

/** An attribute value, escaped for double quotes — the one quoting this
 *  writes, whatever the file used, because a splice writes the whole
 *  `name="value"` and never has to match the old quotes. */
function encodeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

type Node = DefaultTreeAdapterMap["node"];
type TextNode = DefaultTreeAdapterMap["textNode"];
type Element = DefaultTreeAdapterMap["element"];

interface Found {
  node: TextNode;
  /** Lowercased tag name of the element holding it, or null at the top. */
  parentTag: string | null;
}

/** Every text node, in document order — the same walk a browser's
 * `createTreeWalker(SHOW_TEXT)` makes, including `<template>` content, which
 * both trees hold off to the side in the same way. */
function textNodes(root: Node, out: Found[] = [], parentTag: string | null = null): Found[] {
  const asElement = root as Element;
  const tag = "tagName" in root ? String(asElement.tagName).toLowerCase() : parentTag;
  const template = (root as DefaultTreeAdapterMap["template"]).content;
  if (template) textNodes(template as unknown as Node, out, tag);
  for (const child of (asElement.childNodes ?? []) as Node[]) {
    if (child.nodeName === "#text") {
      out.push({ node: child as TextNode, parentTag: tag });
    } else {
      textNodes(child, out, tag);
    }
  }
  return out;
}

/** Every element, in document order — the browser's
 * `createTreeWalker(SHOW_ELEMENT)` over the document, which does NOT step
 * into `<template>` content (a separate fragment), so neither does this. */
function elements(root: Node, out: Element[] = []): Element[] {
  const asElement = root as Element;
  for (const child of (asElement.childNodes ?? []) as Node[]) {
    if ("tagName" in child) {
      out.push(child as Element);
      elements(child, out);
    }
  }
  return out;
}

/**
 * Apply every edit to the source, or none of them.
 *
 * Splices are computed against the ORIGINAL offsets and applied from the back
 * forward, so one edit cannot shift the coordinates of the next — which is
 * what lets every edit be checked against the file as it actually is rather
 * than against a running guess. One refusal refuses the whole save: a version
 * holding three of four edits is a version nobody asked for.
 */
export async function applyEdits(
  source: string,
  edits: readonly InPlaceEdit[],
): Promise<PatchOutcome> {
  const real = edits.filter((edit) => edit.from !== edit.to);
  if (real.length === 0) return { ok: false, reason: "nothing changed" };

  // Loaded here rather than at module scope: a parser is only needed by
  // somebody who actually saved an edit, and the stage should not pay for it
  // to render a preview.
  const { parse } = await import("parse5");
  const document = parse(source, { sourceCodeLocationInfo: true }) as unknown as Node;
  const nodes = textNodes(document);
  const tags = elements(document);

  const splices: Array<{ start: number; end: number; text: string }> = [];
  for (const edit of real) {
    if (isAttrEdit(edit)) {
      const splice = attrSplice(tags, edit);
      if (!splice.ok) return splice;
      splices.push(splice.splice);
      continue;
    }
    const found = nodes[edit.ordinal];
    if (!found) {
      return { ok: false, reason: "that text is no longer in the file — reload and try again" };
    }
    if (found.node.value !== edit.from) {
      // The file changed under the edit: somebody else saved, or a version
      // landed. Refusing is the only honest answer — the ordinal still
      // resolves, so a splice here would overwrite a stranger's words.
      return {
        ok: false,
        reason: "the file changed while you were editing — reload and try again",
      };
    }
    if (found.parentTag && RAW_TEXT.has(found.parentTag)) {
      return { ok: false, reason: `that text is inside <${found.parentTag}> — this one needs the editor` };
    }
    const at = found.node.sourceCodeLocation;
    if (!at) {
      // Reconstructed rather than parsed — an implied tag's filler. There is
      // no byte range to splice, so there is nothing honest to do.
      return { ok: false, reason: "that text has no place in the source — this one needs the editor" };
    }
    splices.push({ start: at.startOffset, end: at.endOffset, text: encodeText(edit.to) });
  }

  // Two edits may not touch the same bytes: a text edit inside an element
  // whose start tag is also being changed is fine (different ranges); two
  // attribute edits on one element are folded before they get here.
  let patched = source;
  for (const splice of splices.sort((a, b) => b.start - a.start)) {
    patched = patched.slice(0, splice.start) + splice.text + patched.slice(splice.end);
  }
  return patched === source
    ? { ok: false, reason: "nothing changed" }
    : { ok: true, source: patched };
}

/**
 * Where an attribute edit lands in the source.
 *
 * Three cases, all from `sourceCodeLocation`: the attribute exists, so its
 * own range (`name="value"`, whatever the quoting was) is replaced whole;
 * it is being removed, so its range and the space before it go; it is new,
 * so ` name="value"` is inserted just before the start tag's closing `>`
 * (or `/>`). An element the parser had to imply — `<html>`, `<head>`,
 * `<body>` on a page that never wrote them — has no start tag to splice
 * into, and is refused rather than invented.
 */
function attrSplice(
  tags: readonly Element[],
  edit: AttrEdit,
): { ok: true; splice: { start: number; end: number; text: string } } | { ok: false; reason: string } {
  const element = tags[edit.ordinal];
  if (!element) return { ok: false, reason: "that element is no longer in the file — reload and try again" };
  if (String(element.tagName).toLowerCase() !== edit.tag.toLowerCase()) {
    return { ok: false, reason: "the file changed while you were editing — reload and try again" };
  }
  const name = edit.name.toLowerCase();
  const current = element.attrs.find((a) => a.name.toLowerCase() === name);
  const currentValue = current ? current.value : null;
  if (currentValue !== edit.from) {
    return { ok: false, reason: "the file changed while you were editing — reload and try again" };
  }
  const at = element.sourceCodeLocation;
  if (!at || !at.startTag) {
    return { ok: false, reason: `<${edit.tag}> was implied by the parser, not written — this one needs the editor` };
  }
  const attrAt = at.attrs?.[name];
  if (current && attrAt) {
    if (edit.to === null) {
      // Take the space before it too, so `<p class="x" id="y">` loses one
      // attribute and keeps one space.
      return { ok: true, splice: { start: attrAt.startOffset - 1, end: attrAt.endOffset, text: "" } };
    }
    return { ok: true, splice: { start: attrAt.startOffset, end: attrAt.endOffset, text: `${current.name}="${encodeAttr(edit.to)}"` } };
  }
  if (edit.to === null) return { ok: false, reason: "nothing changed" };
  // New attribute: before the `>` or `/>` that closes the start tag.
  const close = at.startTag.endOffset;
  const selfClosing = /\/>$/.test(String(edit.tag)) ? 2 : 1;
  const insertAt = close - selfClosing;
  return { ok: true, splice: { start: insertAt, end: insertAt, text: ` ${name}="${encodeAttr(edit.to)}"` } };
}

/**
 * Fold a new edit into the pending list.
 *
 * By ordinal (and, for an attribute, by name), which is what the parser
 * upgrade simplified: the same node edited twice is one entry — the ORIGINAL
 * `from` the file still holds, mapped to the latest `to` — and an edit that
 * returns a node to what it said disappears. The V0 chained these by
 * matching strings, which could not tell two nodes saying the same thing
 * apart.
 */
export function foldEdit<E extends InPlaceEdit>(pending: readonly E[], edit: E): E[] {
  const next = [...pending];
  const same = (one: InPlaceEdit) =>
    isAttrEdit(one) === isAttrEdit(edit) &&
    one.ordinal === edit.ordinal &&
    (!isAttrEdit(one) || !isAttrEdit(edit) || one.name === edit.name);
  const at = next.findIndex(same);
  if (at === -1) return edit.from === edit.to ? next : [...next, edit];
  const original = next[at]!.from;
  if (original === edit.to) next.splice(at, 1);
  else next[at] = { ...edit, from: original } as E;
  return next;
}
