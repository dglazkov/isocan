import { parse as parseHtml, type DefaultTreeAdapterMap } from "parse5";
import type { CssNode } from "css-tree";
// @ts-expect-error public parser subpath has no upstream declaration (designaudit.ts reads it the same way)
import parser from "css-tree/parser";
import { parseSrgb } from "./tokens.ts";

/**
 * **A screen as a walker meets it, read from its HTML** (proactive-agent
 * phase 9, design §11: "what can be measured is measured, not narrated").
 *
 * A static read, with no browser: parse5 for the document, css-tree for its
 * `<style>` sheets and `style=""` attributes, and a small cascade — selectors
 * of tags, classes, ids and attributes joined by descendant and child
 * combinators, ordered by specificity and source order, custom properties
 * inherited and `var()` resolved — so the terminal and the canvas read the
 * same numbers from the same bytes.
 *
 * What it reads:
 * - **every run of text** with the colour it is drawn in and the background
 *   beneath it (the nearest ancestor that paints one, alpha composited), its
 *   size and weight — so contrast is a number (`contrast.ts`'s WCAG maths);
 * - **every target** a finger or a screen reader reaches — links, buttons,
 *   fields, anything with a role or a click handler — with its accessible
 *   name, its role, and its box **where the CSS states it** (`position:
 *   fixed` or `absolute` with lengths, or a declared width and height);
 * - **the reading order**: headings, targets and images, as a screen reader
 *   would announce them, in document order.
 *
 * What it does not: lay out normal flow. A button in a flex row has a size
 * only if its CSS says so and a place never; the read counts those as
 * *unplaced* and says so, rather than guessing. A rule it cannot match
 * (`:hover`, `:not()`, `@media`) is left out the same way.
 */
const parseCss: typeof import("css-tree").parse = parser;

type Element = DefaultTreeAdapterMap["element"];
type HtmlNode = DefaultTreeAdapterMap["node"];

/** A box in the screen's own CSS pixels, from its top-left corner. */
export interface WalkRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A run of text, the colours it is drawn in, and how big it is. */
export interface TextRun {
  /** Where it is in the document: `html > body > main:nth-child(2) > p:nth-child(1)`. */
  path: string;
  text: string;
  /** `#rrggbb` after compositing, or null when the CSS names a colour the read cannot resolve. */
  fg: string | null;
  bg: string | null;
  fontPx: number;
  bold: boolean;
  /** Its box, when the CSS states one. */
  at: WalkRect | null;
  /** Inside a target: the text a control is named by. */
  inTarget: boolean;
}

/** Something a finger or a screen reader reaches. */
export interface WalkTarget {
  path: string;
  tag: string;
  /** `button`, `link`, `textbox`, …; `null` for an element that acts (a click handler, a tabindex) with no role. */
  role: string | null;
  /** The accessible name, or "" when it has none. */
  name: string;
  /** A field named only by its placeholder (which disappears as they type). */
  placeholderOnly: boolean;
  /** Its box when the CSS places it; its size alone when the CSS sizes it; else null. */
  at: WalkRect | null;
  size: { width: number; height: number } | null;
}

/** One thing a screen reader would say, in order. */
export interface Spoken {
  path: string;
  role: string;
  name: string;
}

/** What the read found on one screen. */
export interface ScreenRead {
  viewport: { width: number; height: number };
  texts: TextRun[];
  targets: WalkTarget[];
  order: Spoken[];
  /** Images with no `alt` at all (a screen reader says the file name). */
  noAlt: { path: string; src: string }[];
  /** Rules the read could not match, and colours it could not resolve. */
  unread: { rules: number; colours: number };
}

/** The colours a browser paints before any CSS: ink on paper, link blue, a button's grey face. */
const DEFAULT_INK = "#000000";
const DEFAULT_PAPER = "#ffffff";
const UA_COLOUR: Record<string, string> = { a: "#0000ee" };
const UA_BACKGROUND: Record<string, string> = { button: "#efefef", mark: "#ffff00" };
const UA_SIZE: Record<string, number> = { h1: 32, h2: 24, h3: 18.72, h4: 16, h5: 13.28, h6: 10.72, small: 13.33, button: 13.33, input: 13.33, select: 13.33, textarea: 13.33 };
const UA_BOLD = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "b", "strong", "th"]);
const NAMED: Record<string, string> = { black: "#000000", white: "#ffffff", gray: "#808080", grey: "#808080", silver: "#c0c0c0", red: "#ff0000", green: "#008000", blue: "#0000ff", navy: "#000080", orange: "#ffa500", yellow: "#ffff00", purple: "#800080", maroon: "#800000", teal: "#008080", lightgray: "#d3d3d3", lightgrey: "#d3d3d3", darkgray: "#a9a9a9", darkgrey: "#a9a9a9", dimgray: "#696969", dimgrey: "#696969", whitesmoke: "#f5f5f5", gainsboro: "#dcdcdc" };
const SKIP = new Set(["head", "script", "style", "template", "noscript", "title", "meta", "link"]);
const INTERACTIVE_ROLES = new Set(["button", "link", "tab", "menuitem", "checkbox", "radio", "switch", "option", "textbox", "combobox", "slider", "searchbox"]);

interface Rule {
  selector: CssNode;
  decls: { property: string; value: string; important: boolean }[];
  order: number;
}

type Rgba = { r: number; g: number; b: number; a: number };

function rgbaOf(value: string): Rgba | null | "transparent" {
  const v = value.trim().toLowerCase();
  if (v === "transparent") return "transparent";
  const named = NAMED[v];
  const s = parseSrgb(named ?? v);
  return s ? { r: s.r, g: s.g, b: s.b, a: s.alpha ?? 1 } : null;
}

const hex = (c: Rgba) => `#${[c.r, c.g, c.b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("")}`;
const over = (top: Rgba, under: Rgba): Rgba => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });

/** The first colour in a `background` shorthand, or null when it paints an image or a gradient (or names nothing readable). */
function backgroundColour(value: string): string | null | "none" {
  if (/url\(|gradient\(/i.test(value)) return null;
  const tokens = value.match(/#[0-9a-f]{3,8}\b|(?:rgba?|hsla?)\([^)]*\)|\b[a-z]+\b/gi) ?? [];
  for (const t of tokens) {
    const c = rgbaOf(t);
    if (c) return t;
  }
  return "none";
}

const attr = (el: Element, name: string): string | undefined => el.attrs.find((a) => a.name === name)?.value;
const elements = (node: HtmlNode): Element[] => ("childNodes" in node ? (node.childNodes as HtmlNode[]).filter((c): c is Element => "tagName" in c) : []);
const kids = (node: CssNode): CssNode[] => ("children" in node && node.children ? node.children.toArray() : []);

/** One compound selector (no combinators) against one element — or null when it uses something this read does not match. */
function matchCompound(parts: readonly CssNode[], el: Element): boolean | null {
  for (const part of parts) {
    if (part.type === "TypeSelector") {
      if (part.name === "*") continue;
      if (el.tagName.toLowerCase() !== part.name.toLowerCase()) return false;
    } else if (part.type === "ClassSelector") {
      if (!(attr(el, "class") ?? "").split(/\s+/).includes(part.name)) return false;
    } else if (part.type === "IdSelector") {
      if (attr(el, "id") !== part.name) return false;
    } else if (part.type === "AttributeSelector") {
      const has = attr(el, part.name.name.toLowerCase());
      if (has === undefined) return false;
      if (!part.matcher) continue;
      const want = part.value ? (part.value.type === "String" ? part.value.value : part.value.name) : "";
      if (part.matcher === "=" ? has !== want : part.matcher === "~=" ? !has.split(/\s+/).includes(want) : part.matcher === "^=" ? !has.startsWith(want) : part.matcher === "$=" ? !has.endsWith(want) : part.matcher === "*=" ? !has.includes(want) : part.matcher === "|=" ? !(has === want || has.startsWith(`${want}-`)) : true) return false;
    } else if (part.type === "PseudoClassSelector" && part.name === "root") {
      if (el.tagName !== "html") return false;
    } else if (part.type === "PseudoClassSelector" && /^(hover|focus|focus-visible|focus-within|active|visited|target|checked|disabled|placeholder-shown)$/.test(part.name)) {
      // A state the walker is not in: the rule does not apply to the screen as first met.
      return false;
    } else if (part.type === "PseudoElementSelector") {
      return false;
    } else return null;
  }
  return true;
}

/** Specificity of one selector, as one number: ids, then classes and attributes, then types. */
function specificity(parts: readonly CssNode[]): number {
  let n = 0;
  for (const p of parts) {
    if (p.type === "IdSelector") n += 1_000_000;
    else if (p.type === "ClassSelector" || p.type === "AttributeSelector" || p.type === "PseudoClassSelector") n += 1000;
    else if (p.type === "TypeSelector" && p.name !== "*") n += 1;
  }
  return n;
}

/** A whole selector (descendant and child combinators) against an element: its specificity, -1 for no match, null for unsupported. */
function matchSelector(selector: CssNode, el: Element): number | null {
  const parts = kids(selector);
  // Split into compounds right to left, each with the combinator to its left.
  const compounds: { parts: CssNode[]; combinator: string | null }[] = [];
  let current: CssNode[] = [];
  for (const p of parts) {
    if (p.type === "Combinator") {
      compounds.push({ parts: current, combinator: p.name });
      current = [];
    } else current.push(p);
  }
  compounds.push({ parts: current, combinator: null });
  if (compounds.some((c) => c.combinator === "+" || c.combinator === "~")) return null;
  const spec = specificity(parts);
  const last = compounds.length - 1;
  const at = (i: number, node: Element): boolean | null => {
    const m = matchCompound(compounds[i]!.parts, node);
    if (m !== true) return m;
    if (i === 0) return true;
    const comb = compounds[i - 1]!.combinator;
    let up = node.parentNode as HtmlNode | null;
    if (comb === ">") return up && "tagName" in up ? at(i - 1, up as Element) : false;
    while (up && "tagName" in up) {
      const r = at(i - 1, up as Element);
      if (r === null) return null;
      if (r) return true;
      up = up.parentNode as HtmlNode | null;
    }
    return false;
  };
  const r = at(last, el);
  return r === null ? null : r ? spec : -1;
}

/** `html > body > main:nth-child(2) > button:nth-child(3)` — where an element is, as a selector a fix can target. */
function pathOf(el: Element): string {
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && "tagName" in node) {
    const parent = node.parentNode as HtmlNode | null;
    const tag = node.tagName;
    if (!parent || !("tagName" in parent)) {
      parts.unshift(tag);
      break;
    }
    const sibs = elements(parent);
    parts.unshift(tag === "body" || tag === "html" || tag === "head" ? tag : `${tag}:nth-child(${sibs.indexOf(node) + 1})`);
    node = parent as Element;
  }
  return parts.join(" > ");
}

function textOf(node: HtmlNode, withAlt = true): string {
  if ("value" in node && node.nodeName === "#text") return (node as DefaultTreeAdapterMap["textNode"]).value;
  if ("tagName" in node) {
    const el = node as Element;
    if (SKIP.has(el.tagName) || attr(el, "aria-hidden") === "true" || attr(el, "hidden") !== undefined) return "";
    if (el.tagName === "img") return withAlt ? ` ${attr(el, "alt") ?? ""} ` : "";
  }
  return "childNodes" in node ? (node.childNodes as HtmlNode[]).map((c) => textOf(c, withAlt)).join("") : "";
}
const tidy = (s: string, max = 80) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

/** A length in CSS px, against a font size and a containing length — or null for anything else (`auto`, `calc()`, …). */
function px(value: string | undefined, fontPx: number, of: number | null): number | null {
  if (value === undefined) return null;
  const m = /^(-?[\d.]+)(px|rem|em|%|vw|vh)?$/.exec(value.trim());
  if (!m) return null;
  const n = Number(m[1]);
  if (Number.isNaN(n)) return null;
  switch (m[2]) {
    case undefined: return n === 0 ? 0 : null;
    case "px": return n;
    case "rem": return n * 16;
    case "em": return n * fontPx;
    case "%": return of === null ? null : (n / 100) * of;
    default: return null;
  }
}

/**
 * **Read a screen.** `viewport` is the size it is shown at — an HTML item's
 * own width and height on the canvas, unless the file's viewport meta names a
 * width. Pure: the same bytes give the same read on every surface.
 */
export function readScreen(html: string, viewport: { width: number; height: number }): ScreenRead {
  const doc = parseHtml(html);
  const root = elements(doc).find((e) => e.tagName === "html");
  const empty: ScreenRead = { viewport, texts: [], targets: [], order: [], noAlt: [], unread: { rules: 0, colours: 0 } };
  if (!root) return empty;

  // The viewport meta, when it names a width, is the width the screen is laid out at.
  let vp = { ...viewport };
  const all: Element[] = [];
  const collect = (el: Element) => {
    all.push(el);
    for (const c of elements(el)) collect(c);
  };
  collect(root);
  const meta = all.find((e) => e.tagName === "meta" && attr(e, "name") === "viewport");
  const metaWidth = meta ? /width\s*=\s*(\d+)/.exec(attr(meta, "content") ?? "")?.[1] : undefined;
  if (metaWidth) vp = { width: Number(metaWidth), height: Math.round((viewport.height * Number(metaWidth)) / Math.max(1, viewport.width)) };

  // The sheets, in source order; a rule inside an at-rule is left out (and counted).
  const rules: Rule[] = [];
  let unreadRules = 0;
  let order = 0;
  for (const style of all.filter((e) => e.tagName === "style")) {
    let ast: CssNode;
    try {
      ast = parseCss((style.childNodes as HtmlNode[]).map((n) => ("value" in n ? (n as DefaultTreeAdapterMap["textNode"]).value : "")).join(""), { parseValue: false, parseCustomProperty: false, onParseError: () => undefined });
    } catch {
      unreadRules++;
      continue;
    }
    for (const node of kids(ast)) {
      if (node.type === "Atrule") {
        if (node.block) unreadRules += kids(node.block).filter((r) => r.type === "Rule").length;
        continue;
      }
      if (node.type !== "Rule") continue;
      const decls = kids(node.block).flatMap((d) => (d.type === "Declaration" && d.value.type === "Raw" ? [{ property: d.property.toLowerCase(), value: d.value.value.trim(), important: Boolean(d.important) }] : []));
      for (const sel of node.prelude.type === "SelectorList" ? kids(node.prelude) : []) rules.push({ selector: sel, decls, order: order++ });
    }
  }

  const unsupported = new Set<number>();
  /** The declared values on one element: matched rules by specificity and order, then its style attribute; !important last. */
  const declared = (el: Element): Map<string, string> => {
    const hits: { spec: number; order: number; important: boolean; property: string; value: string }[] = [];
    for (const r of rules) {
      const spec = matchSelector(r.selector, el);
      if (spec === null) {
        unsupported.add(r.order);
        continue;
      }
      if (spec < 0) continue;
      for (const d of r.decls) hits.push({ spec, order: r.order, ...d });
    }
    const inline = attr(el, "style");
    if (inline) {
      try {
        const ast = parseCss(inline, { context: "declarationList", parseValue: false, parseCustomProperty: false, onParseError: () => undefined });
        for (const d of kids(ast)) if (d.type === "Declaration" && d.value.type === "Raw") hits.push({ spec: 1e9, order: 1e9, important: Boolean(d.important), property: d.property.toLowerCase(), value: d.value.value.trim() });
      } catch {
        // An unreadable style attribute adds nothing.
      }
    }
    hits.sort((a, b) => Number(a.important) - Number(b.important) || a.spec - b.spec || a.order - b.order);
    const out = new Map<string, string>();
    for (const h of hits) out.set(h.property, h.value);
    return out;
  };

  interface Computed {
    vars: Map<string, string>;
    fg: Rgba | null;
    bg: Rgba | null;
    fontPx: number;
    bold: boolean;
    hidden: boolean;
    decl: Map<string, string>;
  }
  const computed = new Map<Element, Computed>();
  let unreadColours = 0;

  const resolveVars = (value: string, vars: Map<string, string>, depth = 0): string | null => {
    if (!value.includes("var(")) return value;
    if (depth > 8) return null;
    const out = value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\))?[^()]*))?\)/g, (_m, name: string, fallback?: string) => vars.get(name) ?? fallback?.trim() ?? "\u0000");
    if (out.includes("\u0000")) return null;
    return resolveVars(out, vars, depth + 1);
  };

  const compute = (el: Element, parent: Computed | null) => {
    const decl = declared(el);
    const vars = new Map(parent?.vars ?? []);
    for (const [k, v] of decl) if (k.startsWith("--")) vars.set(k, v);
    const get = (k: string) => {
      const v = decl.get(k);
      return v === undefined ? undefined : resolveVars(v, vars) ?? "\u0000";
    };
    const tag = el.tagName;
    const parentBg = parent?.bg ?? (parent ? null : rgbaOf(DEFAULT_PAPER) as Rgba);
    // Background: this element's paint over what is beneath it.
    let bg: Rgba | null = parentBg;
    const bgRaw = get("background-color") ?? (decl.has("background") ? (() => {
      const v = get("background")!;
      const c = v === "\u0000" ? null : backgroundColour(v);
      return c === "none" ? undefined : c ?? "\u0000";
    })() : undefined) ?? UA_BACKGROUND[tag];
    if (bgRaw !== undefined) {
      const c = bgRaw === "\u0000" ? null : rgbaOf(bgRaw);
      if (c === null) {
        bg = null;
        unreadColours++;
      } else if (c !== "transparent" && parentBg) bg = over(c, parentBg);
      else if (c !== "transparent") bg = c.a >= 1 ? c : null;
    }
    // Ink: inherited, unless this element says otherwise.
    let fg: Rgba | null = parent ? parent.fg : (rgbaOf(DEFAULT_INK) as Rgba);
    const fgRaw = get("color") ?? UA_COLOUR[tag];
    if (fgRaw !== undefined && !/^(inherit|currentcolor)$/i.test(fgRaw)) {
      const c = fgRaw === "\u0000" ? null : rgbaOf(fgRaw);
      if (c === null || c === "transparent") {
        fg = null;
        if (c === null) unreadColours++;
      } else fg = c;
    }
    const parentFont = parent?.fontPx ?? 16;
    const fsRaw = get("font-size");
    const KEYWORD: Record<string, number> = { "x-small": 10, small: 13, medium: 16, large: 18, "x-large": 24, "xx-large": 32 };
    const fontPx = (fsRaw && (KEYWORD[fsRaw] ?? px(fsRaw, parentFont, parentFont))) || UA_SIZE[tag] || parentFont;
    const fwRaw = get("font-weight");
    const bold = fwRaw ? /bold|bolder/.test(fwRaw) || Number(fwRaw) >= 600 : UA_BOLD.has(tag) || Boolean(parent?.bold);
    const hidden = Boolean(parent?.hidden) || get("display") === "none" || get("visibility") === "hidden" || attr(el, "hidden") !== undefined;
    const c: Computed = { vars, fg, bg, fontPx, bold, hidden, decl };
    computed.set(el, c);
    for (const child of elements(el)) compute(child, c);
  };
  compute(root, null);

  const style = (el: Element, k: string) => {
    const c = computed.get(el)!;
    const v = c.decl.get(k);
    return v === undefined ? undefined : resolveVars(v, c.vars) ?? undefined;
  };

  // Boxes: only where the CSS states them.
  const boxes = new Map<Element, WalkRect | null>();
  const sizeOf = (el: Element, cb: { width: number; height: number } | null): { width: number | null; height: number | null } => {
    const f = computed.get(el)!.fontPx;
    const pad = (style(el, "padding") ?? "").split(/\s+/).filter(Boolean).map((v) => px(v, f, cb?.width ?? null) ?? 0);
    const [pt, pr, pb, pl] = [pad[0] ?? 0, pad[1] ?? pad[0] ?? 0, pad[2] ?? pad[0] ?? 0, pad[3] ?? pad[1] ?? pad[0] ?? 0];
    const side = (k: string, fallback: number) => px(style(el, k), f, cb?.width ?? null) ?? fallback;
    const border = style(el, "box-sizing") === "border-box";
    const w = px(style(el, "width"), f, cb?.width ?? null) ?? px(style(el, "min-width"), f, cb?.width ?? null);
    const h = px(style(el, "height"), f, cb?.height ?? null) ?? px(style(el, "min-height"), f, cb?.height ?? null);
    return {
      width: w === null ? null : border ? w : w + side("padding-left", pl) + side("padding-right", pr),
      height: h === null ? null : border ? h : h + side("padding-top", pt) + side("padding-bottom", pb),
    };
  };
  const view: WalkRect = { x: 0, y: 0, width: vp.width, height: vp.height };
  const boxOf = (el: Element): WalkRect | null => {
    if (boxes.has(el)) return boxes.get(el)!;
    boxes.set(el, null);
    const pos = style(el, "position");
    let cb: WalkRect | null = null;
    if (pos === "fixed") cb = view;
    else if (pos === "absolute") {
      let up = el.parentNode as HtmlNode | null;
      while (up && "tagName" in up && !/^(relative|absolute|fixed|sticky)$/.test(style(up as Element, "position") ?? "")) up = up.parentNode as HtmlNode | null;
      cb = up && "tagName" in up ? boxOf(up as Element) : view;
    }
    if (!cb) return null;
    const f = computed.get(el)!.fontPx;
    const { width, height } = sizeOf(el, cb);
    const left = px(style(el, "left"), f, cb.width);
    const right = px(style(el, "right"), f, cb.width);
    const top = px(style(el, "top"), f, cb.height);
    const bottom = px(style(el, "bottom"), f, cb.height);
    const w = width ?? (left !== null && right !== null ? cb.width - left - right : null);
    const h = height ?? (top !== null && bottom !== null ? cb.height - top - bottom : null);
    if (w === null || h === null) return null;
    const x = left !== null ? cb.x + left : right !== null ? cb.x + cb.width - right - w : null;
    const y = top !== null ? cb.y + top : bottom !== null ? cb.y + cb.height - bottom - h : null;
    if (x === null || y === null) return null;
    const box = { x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) };
    boxes.set(el, box);
    return box;
  };

  const byId = new Map(all.flatMap((e) => (attr(e, "id") ? [[attr(e, "id")!, e] as const] : [])));
  const labelFor = (el: Element): string => {
    const id = attr(el, "id");
    const label = id ? all.find((e) => e.tagName === "label" && attr(e, "for") === id) : undefined;
    let up = el.parentNode as HtmlNode | null;
    while (!label && up && "tagName" in up && (up as Element).tagName !== "label") up = up.parentNode as HtmlNode | null;
    const wrap = label ?? (up && "tagName" in up ? (up as Element) : undefined);
    return wrap ? tidy(textOf(wrap)) : "";
  };
  const roleOf = (el: Element): string | null => {
    const explicit = attr(el, "role");
    if (explicit) return explicit;
    const tag = el.tagName;
    if (tag === "a") return attr(el, "href") !== undefined ? "link" : null;
    if (tag === "button" || tag === "summary") return "button";
    if (tag === "select") return "combobox";
    if (tag === "textarea") return "textbox";
    if (tag === "input") {
      const t = (attr(el, "type") ?? "text").toLowerCase();
      return t === "hidden" ? null : t === "checkbox" || t === "radio" ? t : ["button", "submit", "reset", "image"].includes(t) ? "button" : t === "range" ? "slider" : t === "search" ? "searchbox" : "textbox";
    }
    return null;
  };
  const actsWithoutRole = (el: Element) => attr(el, "onclick") !== undefined || (attr(el, "tabindex") !== undefined && Number(attr(el, "tabindex")) >= 0);
  const nameOf = (el: Element): { name: string; placeholderOnly: boolean } => {
    const by = attr(el, "aria-labelledby");
    if (by) {
      const t = tidy(by.split(/\s+/).map((id) => (byId.get(id) ? textOf(byId.get(id)!) : "")).join(" "));
      if (t) return { name: t, placeholderOnly: false };
    }
    const aria = tidy(attr(el, "aria-label") ?? "");
    if (aria) return { name: aria, placeholderOnly: false };
    if (["input", "select", "textarea"].includes(el.tagName)) {
      const t = (attr(el, "type") ?? "").toLowerCase();
      if (["button", "submit", "reset"].includes(t)) return { name: tidy(attr(el, "value") ?? (t === "submit" ? "Submit" : t === "reset" ? "Reset" : "")), placeholderOnly: false };
      if (t === "image") return { name: tidy(attr(el, "alt") ?? ""), placeholderOnly: false };
      const label = labelFor(el) || tidy(attr(el, "title") ?? "");
      if (label) return { name: label, placeholderOnly: false };
      const ph = tidy(attr(el, "placeholder") ?? "");
      return { name: ph, placeholderOnly: Boolean(ph) };
    }
    return { name: tidy(textOf(el)) || tidy(attr(el, "title") ?? ""), placeholderOnly: false };
  };

  const texts: TextRun[] = [];
  const targets: WalkTarget[] = [];
  const spoken: Spoken[] = [];
  const noAlt: { path: string; src: string }[] = [];
  const visit = (el: Element, inTarget: boolean, srHidden: boolean) => {
    if (SKIP.has(el.tagName)) return;
    const c = computed.get(el)!;
    if (c.hidden) return;
    const hiddenFromSr = srHidden || attr(el, "aria-hidden") === "true";
    const role = roleOf(el);
    const acts = role !== null && INTERACTIVE_ROLES.has(role) ? true : role === null && actsWithoutRole(el);
    if (acts && !inTarget) {
      const { name, placeholderOnly } = nameOf(el);
      const at = boxOf(el);
      const size = at ? { width: at.width, height: at.height } : (() => {
        const s = sizeOf(el, view);
        return s.width !== null && s.height !== null ? { width: Math.round(s.width), height: Math.round(s.height) } : null;
      })();
      targets.push({ path: pathOf(el), tag: el.tagName, role, name, placeholderOnly, at, size });
      if (!hiddenFromSr) spoken.push({ path: pathOf(el), role: role ?? "clickable", name });
    } else if (!hiddenFromSr && /^h[1-6]$/.test(el.tagName)) {
      spoken.push({ path: pathOf(el), role: `heading ${el.tagName[1]}`, name: tidy(textOf(el)) });
    } else if (!hiddenFromSr && el.tagName === "img" && !inTarget) {
      const alt = attr(el, "alt");
      if (alt === undefined) noAlt.push({ path: pathOf(el), src: tidy(attr(el, "src") ?? "", 40) });
      if (alt !== "") spoken.push({ path: pathOf(el), role: "image", name: alt === undefined ? tidy(attr(el, "src") ?? "unlabelled image", 40) : tidy(alt) });
    }
    const own = tidy((el.childNodes as HtmlNode[]).filter((n) => n.nodeName === "#text").map((n) => (n as DefaultTreeAdapterMap["textNode"]).value).join(" "));
    if (own) {
      let up: Element | null = el;
      let at: WalkRect | null = null;
      while (up && "tagName" in up && !at) {
        at = boxOf(up);
        const p = up.parentNode as HtmlNode | null;
        up = p && "tagName" in p ? (p as Element) : null;
      }
      texts.push({ path: pathOf(el), text: own, fg: c.fg ? hex(c.bg && c.fg.a < 1 ? over(c.fg, c.bg) : c.fg) : null, bg: c.bg ? hex(c.bg) : null, fontPx: Math.round(c.fontPx * 100) / 100, bold: c.bold, at, inTarget: inTarget || acts });
    }
    for (const child of elements(el)) visit(child, inTarget || acts, hiddenFromSr);
  };
  const body = elements(root).find((e) => e.tagName === "body");
  if (body) visit(body, false, false);
  return { viewport: vp, texts, targets, order: spoken, noAlt, unread: { rules: unsupported.size + unreadRules, colours: unreadColours } };
}
