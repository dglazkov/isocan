import { parse, type DefaultTreeAdapterMap } from "parse5";
import { embeddedWire } from "./diff.ts";

/**
 * **The copy deck: a screen's words as data** (copy-edit phase 1 —
 * `docs/projects/copy-edit/phases.md`, design `docs/research/2026-10-02-copy-edit.md`
 * §"The upgrade" point 1).
 *
 * An agent had no verb for "replace this text": `isocan edit` uploads a whole
 * new file, so a copy pass could and did drift layout, classes and markup.
 * The deck is the missing primitive. `copyDeck(html)` reads a screen and
 * returns its strings in reading order, each with a ROLE (what kind of words
 * these are), a stable ADDRESS, and a BUDGET (the room the layout gives it —
 * null until phase 4 measures it where screens render). `applyCopyDeck`
 * writes edited strings back and touches nothing else: every byte outside the
 * addressed text is the byte that was there.
 *
 * **Two kinds of screen, two kinds of address.**
 *
 * - **Any HTML** (`kind: "html"`). A text node is `t<n>` — the nth text node
 *   in document order, the SAME count the WYSIWYG splice uses
 *   (`packages/web/src/lib/textPatch.ts`, `TextEdit.ordinal`), so the two
 *   address one node identically (`packages/web/test/textpatch.test.ts`
 *   holds them equal). An attribute string is `a<n>@<name>` — the nth element
 *   (textPatch's `AttrEdit.ordinal`) and the attribute. An address is never
 *   trusted alone: an edit carries the `text` it read, and if the node at that
 *   address no longer says it, the edit is REFUSED by name — a deck made from
 *   an older file is refused, never guessed.
 * - **A wireframe** (`kind: "wire"`). Its rendered text is not its words:
 *   one row reads "Shared with 2 people · Archived · 5 h ago", which is three
 *   words (`sub`, `status`, `meta`) joined by the renderer; the avatar's "CA"
 *   is derived from a person's name; and a re-render from the embedded spec
 *   would undo any splice of the HTML. So a wire screen's address is the
 *   `wire copy` word path — `title`, `bar`, or `<slot>/<path>` such as
 *   `main.3/items.0.title` — read from the spec the screen carries, exactly
 *   the paths `blockContentSchema` and `wire copy --apply` take. That is the
 *   ONE canonical address for wire screens; `wf` beside it names the
 *   `data-wf` element the words draw in, for a person or a highlighter. The
 *   wire deck is written by the wireframe module (it re-renders), never
 *   spliced here.
 *
 * Core cannot import the wireframe module, so the word walk is repeated here
 * the way `diff.ts` repeats the marker; `packages/modules/wireframe/test/copy-deck.test.ts`
 * holds this deck's paths equal to `wordsOf` on rendered screens.
 */

type CopyRole =
  | "heading"
  | "body"
  | "button"
  | "link"
  | "label"
  | "placeholder"
  | "alt"
  | "error"
  | "empty"
  | "nav";

interface CopyString {
  /** Where the string lives: `t14`, `a3@placeholder` (HTML) or
   *  `main.3/items.0.title`, `title`, `bar` (wire). */
  address: string;
  role: CopyRole;
  /** What it says now — leading and trailing whitespace trimmed (and kept
   *  in place on apply). This is also the check an edit carries back. */
  text: string;
  /** The room the layout gives it. Null until it is measured where screens
   *  render (copy-edit phase 4); the field is here so the shape does not change. */
  budget: null;
  /** The nearest `data-wf` element the string draws in, when the screen has one. */
  wf?: string;
}

/** A screen's words as data: every string in reading order with its role and
 *  stable address, and whether the screen is plain HTML or a wireframe. */
export interface CopyDeck {
  kind: "html" | "wire";
  strings: CopyString[];
  /** A wireframe still drawing bars has no words yet: `wire flesh` fills it. */
  unfleshed?: true;
}

/** One edited string: its address, what it said when read (the check), and what it should say. */
export interface CopyEdit {
  address: string;
  text: string;
  to: string;
}

type CopyApplyOutcome = { ok: true; html: string; changed: string[] } | { ok: false; reason: string };

type Node = DefaultTreeAdapterMap["node"];
type Element = DefaultTreeAdapterMap["element"];
type TextNode = DefaultTreeAdapterMap["textNode"];

/** Raw-text and not-shown containers: counted (so ordinals agree with the
 *  WYSIWYG walk) but never offered as copy. */
const HIDDEN = new Set(["script", "style", "noscript", "template", "head", "title", "iframe", "xmp", "noembed", "noframes"]);

/** Strings an element carries in attributes, and when. */
const BUTTON_INPUTS = new Set(["submit", "button", "reset"]);

/** Whitespace a splice keeps: ASCII only, so a `&nbsp;` is words, not padding. */
const LEAD = /^[ \t\n\r\f]*/;
const TRAIL = /[ \t\n\r\f]*$/;
const trim = (value: string) => value.replace(LEAD, "").replace(TRAIL, "");

const tagOf = (el: Element) => String(el.tagName).toLowerCase();
const attr = (el: Element, name: string) => el.attrs.find((a) => a.name.toLowerCase() === name)?.value;

interface FoundText {
  ordinal: number;
  node: TextNode;
  ancestors: Element[];
}

/**
 * Every text node, in the WYSIWYG splice's order (`textPatch.ts` `textNodes`):
 * a `<template>`'s content first, then its children — the walk a browser's
 * `createTreeWalker(SHOW_TEXT)` makes. The ordinal is the index in this list.
 */
function walkText(root: Node, ancestors: Element[] = [], out: FoundText[] = []): FoundText[] {
  const asElement = root as Element;
  const here = "tagName" in root ? [...ancestors, asElement] : ancestors;
  const template = (root as DefaultTreeAdapterMap["template"]).content;
  if (template) walkText(template as unknown as Node, here, out);
  for (const child of (asElement.childNodes ?? []) as Node[]) {
    if (child.nodeName === "#text") out.push({ ordinal: out.length, node: child as TextNode, ancestors: here });
    else walkText(child, here, out);
  }
  return out;
}

/** Every element, in textPatch's `elements` order (no `<template>` content), with its ancestors. */
function walkElements(root: Node, ancestors: Element[] = [], out: Array<{ el: Element; ancestors: Element[] }> = []): Array<{ el: Element; ancestors: Element[] }> {
  for (const child of ((root as Element).childNodes ?? []) as Node[]) {
    if ("tagName" in child) {
      out.push({ el: child as Element, ancestors });
      walkElements(child, [...ancestors, child as Element], out);
    }
  }
  return out;
}

/**
 * What kind of words these are, from the markup alone. Nearest-first, and in
 * this precedence: an explicit `data-copy-role`; an error where the markup
 * says so (`role="alert"`, `aria-live="assertive"`); a heading; anything in
 * a `<nav>` or `role="navigation"`; a button; a link; a label; else body.
 * Empty states have no ARIA of their own, so only `data-copy-role="empty"`
 * names one — guessing from a class would be the kind of read this refuses.
 */
function roleOf(chain: readonly Element[]): CopyRole {
  const explicit = [...chain].reverse().map((el) => attr(el, "data-copy-role")).find((v) => v !== undefined);
  if (explicit && ROLES.has(explicit as CopyRole)) return explicit as CopyRole;
  if (chain.some((el) => attr(el, "role") === "alert" || attr(el, "aria-live") === "assertive")) return "error";
  if (chain.some((el) => /^h[1-6]$/.test(tagOf(el)) || attr(el, "role") === "heading")) return "heading";
  if (chain.some((el) => tagOf(el) === "nav" || attr(el, "role") === "navigation")) return "nav";
  if (chain.some((el) => tagOf(el) === "button" || attr(el, "role") === "button")) return "button";
  if (chain.some((el) => (tagOf(el) === "a" && attr(el, "href") !== undefined) || attr(el, "role") === "link")) return "link";
  if (chain.some((el) => ["label", "legend", "option", "th", "caption", "figcaption", "summary", "dt"].includes(tagOf(el)))) return "label";
  return "body";
}

const ROLES = new Set<CopyRole>(["heading", "body", "button", "link", "label", "placeholder", "alt", "error", "empty", "nav"]);

const nearestWf = (chain: readonly Element[]): string | undefined =>
  [...chain].reverse().map((el) => attr(el, "data-wf")).find((v) => v !== undefined);

/** The attribute strings an element offers, with their roles. */
function attrStrings(el: Element, chain: readonly Element[]): Array<{ name: string; role: CopyRole }> {
  const out: Array<{ name: string; role: CopyRole }> = [];
  const tag = tagOf(el);
  if (attr(el, "placeholder") !== undefined) out.push({ name: "placeholder", role: "placeholder" });
  if (tag === "img" && attr(el, "alt") !== undefined) out.push({ name: "alt", role: "alt" });
  if (tag === "input" && BUTTON_INPUTS.has((attr(el, "type") ?? "").toLowerCase()) && attr(el, "value") !== undefined) {
    out.push({ name: "value", role: roleOf([...chain, el]) === "nav" ? "nav" : "button" });
  }
  if (attr(el, "aria-label") !== undefined) out.push({ name: "aria-label", role: roleOf([...chain, el]) });
  return out;
}

interface Located extends CopyString {
  at: number;
  /** Splice range of the words themselves, whitespace excluded (HTML only). */
  start: number;
  end: number;
  /** How to encode the new words for this place. */
  encode: (value: string) => string;
}

function encodeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

/** A plain-HTML deck, with each string's splice range. */
function locateHtml(html: string): Located[] {
  const document = parse(html, { sourceCodeLocationInfo: true }) as unknown as Node;
  const out: Located[] = [];
  for (const { ordinal, node, ancestors } of walkText(document)) {
    if (ancestors.some((el) => HIDDEN.has(tagOf(el)))) continue;
    const loc = node.sourceCodeLocation;
    if (!loc) continue;
    const text = trim(node.value);
    if (text === "") continue;
    const raw = html.slice(loc.startOffset, loc.endOffset);
    const lead = LEAD.exec(raw)![0].length;
    const trail = TRAIL.exec(raw)![0].length;
    const wf = nearestWf(ancestors);
    out.push({
      address: `t${ordinal}`,
      role: roleOf(ancestors),
      text,
      budget: null,
      ...(wf !== undefined ? { wf } : {}),
      at: loc.startOffset,
      start: loc.startOffset + lead,
      end: loc.endOffset - trail,
      encode: encodeText,
    });
  }
  walkElements(document).forEach(({ el, ancestors }, ordinal) => {
    if (ancestors.some((a) => HIDDEN.has(tagOf(a))) || HIDDEN.has(tagOf(el))) return;
    const loc = el.sourceCodeLocation;
    if (!loc?.startTag) return;
    for (const { name, role } of attrStrings(el, ancestors)) {
      const value = attr(el, name)!;
      const text = trim(value);
      const range = loc.attrs?.[name];
      if (text === "" || !range) continue;
      const span = attrValueSpan(html, range.startOffset, range.endOffset);
      if (!span) continue;
      const lead = LEAD.exec(value)![0].length;
      const trail = TRAIL.exec(value)![0].length;
      const wf = nearestWf([...ancestors, el]);
      // Leading/trailing ASCII whitespace in a value is never written as an
      // entity in practice; if it were, the splice would keep it verbatim.
      const rawValue = html.slice(span.start, span.end);
      const rawLead = Math.min(lead, LEAD.exec(rawValue)![0].length);
      const rawTrail = Math.min(trail, TRAIL.exec(rawValue)![0].length);
      out.push({
        address: `a${ordinal}@${name}`,
        role,
        text,
        budget: null,
        ...(wf !== undefined ? { wf } : {}),
        at: loc.startTag.startOffset,
        start: span.start + rawLead,
        end: span.end - rawTrail,
        encode: span.encode,
      });
    }
  });
  // Reading order is source order; an element's attribute strings come
  // before the text inside it (its start tag opens before its first child),
  // and several on one element keep the order above (the sort is stable).
  return out.sort((a, b) => a.at - b.at);
}

/**
 * The bytes of an attribute's VALUE inside `name="value"`, and how a new
 * value is escaped for the quoting that is already there — so the quotes,
 * the name and the spacing around `=` stay the bytes they were.
 */
function attrValueSpan(html: string, start: number, end: number): { start: number; end: number; encode: (v: string) => string } | null {
  const raw = html.slice(start, end);
  const eq = /^[^=]*=\s*/.exec(raw);
  if (!eq) return null;
  const open = raw[eq[0].length];
  if (open === '"' || open === "'") {
    const quote = open;
    return {
      start: start + eq[0].length + 1,
      end: end - 1,
      encode: (v) => v.replace(/&/g, "&amp;").replace(quote === '"' ? /"/g : /'/g, quote === '"' ? "&quot;" : "&#39;"),
    };
  }
  // Unquoted: a new value that would need quotes is escaped to stay unquoted-safe.
  return {
    start: start + eq[0].length,
    end,
    encode: (v) => v.replace(/&/g, "&amp;").replace(/[\s"'=<>`]/g, (c) => `&#${c.charCodeAt(0)};`),
  };
}

// ---------------------------------------------------------------------------
// Wireframes

/** The words a wire slot's fill holds, by path — the wireframe module's
 *  `wordsOf` (`content/flesh-spec.ts`), repeated because core cannot import a
 *  module; its test holds the two equal. */
function wireWordsOf(fill: unknown): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  if (!fill || typeof fill !== "object") return out;
  const f = fill as Record<string, unknown>;
  const str = (v: unknown): v is string => typeof v === "string";
  for (const key of ["heading", "sub", "person"]) if (str(f[key])) out.push([key, f[key] as string]);
  for (const key of ["lines", "labels", "values", "groups"]) {
    const list = f[key];
    if (Array.isArray(list)) list.forEach((w, i) => str(w) && out.push([`${key}.${i}`, w]));
  }
  if (Array.isArray(f.items)) {
    f.items.forEach((it: Record<string, unknown>, i) => {
      for (const key of ["title", "sub", "status", "meta", "person", "text"]) if (str(it?.[key])) out.push([`items.${i}.${key}`, it[key] as string]);
      if (Array.isArray(it?.cells)) (it.cells as unknown[]).forEach((w, j) => str(w) && out.push([`items.${i}.cells.${j}`, w]));
    });
  }
  if (Array.isArray(f.stats)) {
    f.stats.forEach((s: Record<string, unknown>, i) => {
      if (str(s?.label)) out.push([`stats.${i}.label`, s.label as string]);
      if (str(s?.value)) out.push([`stats.${i}.value`, s.value as string]);
      if (str(s?.delta)) out.push([`stats.${i}.delta`, s.delta as string]);
    });
  }
  if (f.actions && typeof f.actions === "object") {
    for (const [element, w] of Object.entries(f.actions as Record<string, unknown>)) if (str(w)) out.push([`actions.${element}`, w]);
  }
  return out;
}

const NAV_BLOCKS = new Set(["tab-bar", "side-nav", "navbar", "tabs", "segmented-control", "page-indicator"]);

function wireRole(block: string, region: string, path: string): CopyRole {
  if (path.startsWith("actions.")) return region === "nav" || NAV_BLOCKS.has(block) ? "nav" : "button";
  if (block === "error-state") return "error";
  if (block === "empty-state") return "empty";
  if (region === "nav" || NAV_BLOCKS.has(block)) return "nav";
  if (path === "heading") return "heading";
  if (path.startsWith("labels.")) return block === "search-field" ? "placeholder" : "label";
  return "body";
}

/** Where each slot's section opens and what region it is, from the rendered markup. */
function wireSections(html: string): Map<string, { at: number; region: string }> {
  const out = new Map<string, { at: number; region: string }>();
  const document = parse(html, { sourceCodeLocationInfo: true }) as unknown as Node;
  for (const { el } of walkElements(document)) {
    const sec = attr(el, "data-sec");
    if (sec !== undefined && !out.has(sec)) out.set(sec, { at: el.sourceCodeLocation?.startOffset ?? Number.MAX_SAFE_INTEGER, region: attr(el, "data-region") ?? sec.split(".")[0]! });
  }
  return out;
}

interface WireSpecWords {
  title?: string;
  slots?: Array<{ slot: string; block: string | null; fill?: unknown }>;
  content?: { title?: string; bar?: string } & Record<string, unknown>;
}

function wireDeck(html: string, spec: WireSpecWords): CopyDeck {
  if (!spec.content) return { kind: "wire", strings: [], unfleshed: true };
  const strings: CopyString[] = [];
  strings.push({ address: "title", role: "heading", text: spec.content.title ?? spec.title ?? "", budget: null });
  if (spec.content.bar !== undefined) strings.push({ address: "bar", role: "heading", text: spec.content.bar, budget: null, wf: "header" });
  const sections = wireSections(html);
  const slots = [...(spec.slots ?? [])]
    .filter((s) => s.block && s.fill)
    .map((s, i) => ({ s, i, at: sections.get(s.slot)?.at ?? Number.MAX_SAFE_INTEGER }))
    .sort((a, b) => a.at - b.at || a.i - b.i);
  for (const { s } of slots) {
    const region = sections.get(s.slot)?.region ?? s.slot.split(".")[0]!;
    for (const [path, text] of wireWordsOf(s.fill)) {
      strings.push({
        address: `${s.slot}/${path}`,
        role: wireRole(s.block!, region, path),
        text,
        budget: null,
        wf: path.startsWith("actions.") ? `${s.slot}.${path.slice("actions.".length)}` : s.slot,
      });
    }
  }
  return { kind: "wire", strings };
}

// ---------------------------------------------------------------------------
// The deck and its apply

/** A screen's strings in reading order, each with a role, an address and a budget. */
export function copyDeck(html: string): CopyDeck {
  const spec = embeddedWire(html) as WireSpecWords | null;
  if (spec) return wireDeck(html, spec);
  return { kind: "html", strings: locateHtml(html).map(({ address, role, text, budget, wf }) => ({ address, role, text, budget, ...(wf !== undefined ? { wf } : {}) })) };
}

const show = (s: string) => JSON.stringify(s.length > 40 ? `${s.slice(0, 39)}…` : s);

/**
 * Check a set of edits against a deck: every address exists, every `text`
 * is what the string says now, no address twice. Returns the edits that
 * change something, or the refusal — naming WHICH string, in words.
 */
export function checkCopyEdits(deck: CopyDeck, edits: readonly CopyEdit[]): { ok: true; edits: CopyEdit[] } | { ok: false; reason: string } {
  const byAddress = new Map(deck.strings.map((s) => [s.address, s]));
  const seen = new Set<string>();
  const real: CopyEdit[] = [];
  for (const edit of edits) {
    if (seen.has(edit.address)) return { ok: false, reason: `${edit.address} is edited twice — say it once` };
    seen.add(edit.address);
    const now = byAddress.get(edit.address);
    if (!now) {
      return { ok: false, reason: `no string at ${edit.address} any more (it read ${show(edit.text)}) — the screen changed since the deck was read; read it again` };
    }
    if (now.text !== trim(edit.text)) {
      return { ok: false, reason: `${edit.address} (${now.role}) read ${show(edit.text)} but now says ${show(now.text)} — the screen changed since the deck was read; read it again` };
    }
    if (typeof edit.to !== "string") return { ok: false, reason: `${edit.address}: "to" must be a string` };
    if (deck.kind === "wire" && edit.address === "title" && trim(edit.to) === "") return { ok: false, reason: "title must not be empty" };
    if (trim(edit.to) !== now.text) real.push(edit);
  }
  return { ok: true, edits: real };
}

/**
 * Write edited strings into a plain-HTML screen: each addressed text node or
 * attribute value is replaced, its surrounding whitespace kept, and every
 * other byte of the file is the byte that was there. All or nothing — one
 * stale address refuses the whole set. A wireframe is refused: its words are
 * its spec's, and the wireframe module writes them (`wireCopyFile`).
 */
export function applyCopyDeck(html: string, edits: readonly CopyEdit[]): CopyApplyOutcome {
  if (embeddedWire(html)) {
    return { ok: false, reason: "this is a wireframe: its words live in its spec, and the wireframe module writes them (`isocan copy <screen> --apply` routes there)" };
  }
  const located = locateHtml(html);
  const deck: CopyDeck = { kind: "html", strings: located };
  const checked = checkCopyEdits(deck, edits);
  if (!checked.ok) return checked;
  if (checked.edits.length === 0) return { ok: false, reason: "nothing changed" };
  const by = new Map(located.map((l) => [l.address, l]));
  const splices = checked.edits.map((e) => {
    const l = by.get(e.address)!;
    return { start: l.start, end: l.end, text: l.encode(trim(e.to)) };
  });
  let out = html;
  for (const s of splices.sort((a, b) => b.start - a.start)) out = out.slice(0, s.start) + s.text + out.slice(s.end);
  return { ok: true, html: out, changed: checked.edits.map((e) => e.address) };
}

/** The `wire copy --apply` file a set of wire edits is: `{ title?, bar?, slots: { slot: { path: words } } }`. */
interface WireCopyFile {
  title?: string;
  bar?: string;
  slots: Record<string, Record<string, string>>;
}

/**
 * Turn checked wire edits into the file `wire copy --apply` takes — the
 * one writer of a wireframe's words. Checked against the screen's deck first,
 * so a stale string is refused here exactly as it is on plain HTML.
 */
export function wireCopyFile(html: string, edits: readonly CopyEdit[]): { ok: true; file: WireCopyFile; changed: string[] } | { ok: false; reason: string } {
  const deck = copyDeck(html);
  if (deck.kind !== "wire") return { ok: false, reason: "not a wireframe" };
  if (deck.unfleshed) return { ok: false, reason: "this wireframe draws bars — `isocan wire flesh <screen>` fills it first" };
  const checked = checkCopyEdits(deck, edits);
  if (!checked.ok) return checked;
  if (checked.edits.length === 0) return { ok: false, reason: "nothing changed" };
  const file: WireCopyFile = { slots: {} };
  for (const e of checked.edits) {
    const to = trim(e.to);
    if (e.address === "title") file.title = to;
    else if (e.address === "bar") file.bar = to;
    else {
      const cut = e.address.indexOf("/");
      const slot = e.address.slice(0, cut);
      (file.slots[slot] ??= {})[e.address.slice(cut + 1)] = to;
    }
  }
  return { ok: true, file, changed: checked.edits.map((e) => e.address) };
}

/**
 * Read an apply file: the deck as `isocan copy --json` printed it, with a
 * `to` beside each string that should change — or a bare array of
 * `{ address, text, to }`. Strings without a `to` are left alone.
 */
export function parseCopyEdits(raw: unknown): CopyEdit[] {
  const list = Array.isArray(raw) ? raw : raw && typeof raw === "object" && Array.isArray((raw as { strings?: unknown }).strings) ? (raw as { strings: unknown[] }).strings : null;
  if (!list) throw new Error('a copy deck is { "strings": [{ "address", "text", "to" }] } — `isocan copy <item> --json` prints one to edit');
  const out: CopyEdit[] = [];
  list.forEach((entry, i) => {
    if (!entry || typeof entry !== "object") throw new Error(`string ${i + 1} is not an object`);
    const e = entry as Record<string, unknown>;
    if (e.to === undefined) return;
    if (typeof e.address !== "string") throw new Error(`string ${i + 1} has no "address"`);
    if (typeof e.text !== "string") throw new Error(`${e.address} has no "text" — it is the check that the screen has not moved; keep it as the deck printed it`);
    if (typeof e.to !== "string") throw new Error(`${e.address}: "to" must be a string`);
    out.push({ address: e.address, text: e.text, to: e.to });
  });
  return out;
}
