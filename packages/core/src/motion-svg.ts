/**
 * **A selected SVG, made safe and made a layer** (motion phase 0;
 * `docs/projects/motion/design.md` §2, §6).
 *
 * A motion document inlines its sources' markup, so whatever a source SVG
 * carries runs in the motion's page. A motion runs no one else's code and
 * fetches nothing, so this strips, and says what it stripped: `<script>`,
 * every `on*` attribute, `<foreignObject>`, any `href` that is not a
 * same-document `#…` or a `data:` URL, remote `url(…)` and `@import` in CSS,
 * `javascript:` anywhere, and SMIL animation (`<animate>`, `<set>`, …),
 * because a motion's only clock is `render(t)`.
 *
 * **Parsed by the HTML parser the browser will use.** The markup is read
 * with parse5 as HTML foreign content, exactly as the motion document will
 * be read, so what is kept here is what the browser builds — an `<img>`
 * that would break out of `<svg>` breaks out here too, lands outside the
 * root, and is dropped with the rest of what is not the drawing.
 *
 * **Several SVGs share one document**, so ids are prefixed per layer (with
 * every `#id` and `url(#id)` that points at one), and a source's
 * `<style>` is wrapped in `@scope` to its own layer — two exports that
 * both say `.st0` keep their own colours.
 */
import { defaultTreeAdapter, html, parseFragment, serializeOuter, type DefaultTreeAdapterMap } from "parse5";
import type { CssNode, List, ListItem } from "css-tree";
// @types/css-tree declares the complete library, but not its documented browser subpaths.
// @ts-expect-error public parser subpath has no upstream declaration
import parser from "css-tree/parser";
// @ts-expect-error public walker subpath has no upstream declaration
import walker from "css-tree/walker";
// @ts-expect-error public generator subpath has no upstream declaration
import generator from "css-tree/generator";
import type { MotionBox, MotionLayer } from "./motion-engine.ts";

const parseCss: typeof import("css-tree").parse = parser;
const walkCss: typeof import("css-tree").walk = walker;
const generateCss: typeof import("css-tree").generate = generator;

type Element = DefaultTreeAdapterMap["element"];
type ChildNode = DefaultTreeAdapterMap["childNode"];

const SVG_NS = "http://www.w3.org/2000/svg";
const SMIL = new Set(["animate", "animateMotion", "animateTransform", "animateColor", "set", "discard"]);
const GEOMETRY = new Set(["path", "circle", "ellipse", "rect", "line", "polyline", "polygon"]);

/** What a layer is built from: one SVG item on the canvas, its bytes, and where it sat. */
export interface MotionSource {
  item: string;
  version: string;
  title: string;
  /** The item's rect in canvas (world) coordinates. */
  box: MotionBox;
  svg: string;
}

/**
 * A source made safe and addressable: the layer record the spec carries,
 * the cleaned `<svg>` element ready to inline, and what was taken out, in
 * words.
 */
export interface PreparedLayer {
  layer: MotionLayer;
  root: Element;
  stripped: string[];
}

const isElement = (node: ChildNode): node is Element => "tagName" in node;
const attr = (el: Element, name: string): string | undefined => el.attrs.find((a) => a.name === name && !a.prefix)?.value;
const isHref = (a: { name: string; prefix?: string }) => a.name === "href";

function setAttr(el: Element, name: string, value: string): void {
  const hit = el.attrs.find((a) => a.name === name && !a.prefix);
  if (hit) hit.value = value;
  else el.attrs.push({ name, value });
}

function dropAttr(el: Element, name: string): void {
  el.attrs = el.attrs.filter((a) => !(a.name === name && !a.prefix));
}


function count(stripped: Map<string, number>, what: string): void {
  stripped.set(what, (stripped.get(what) ?? 0) + 1);
}

function inWords(stripped: Map<string, number>): string[] {
  return [...stripped].map(([what, n]) => (n === 1 ? what : `${what} ×${n}`));
}

/** `url(…)` and `href` targets a motion may keep: the same document, or bytes carried inline. */
const local = (ref: string) => /^\s*(#|data:)/i.test(ref);

// ---------------------------------------------------------------------------
// CSS: scope it, rename the ids it points at, and take out what fetches.

function cleanCss(text: string, context: "stylesheet" | "declarationList", rename: (id: string) => string, stripped: Map<string, number>): string {
  let ast: CssNode;
  try {
    ast = parseCss(text, { context });
  } catch {
    count(stripped, "CSS that would not parse");
    return "";
  }
  walkCss(ast, {
    enter(node: CssNode, item: ListItem<CssNode>, list: List<CssNode>) {
      if (node.type === "Atrule" && node.name.toLowerCase() === "import") {
        count(stripped, "CSS @import");
        list?.remove(item);
        return;
      }
      if (node.type === "Declaration") {
        let remote = false;
        walkCss(node, (inner: CssNode) => {
          if (inner.type === "Url" && !local(inner.value)) remote = true;
        });
        if (remote || /javascript:/i.test(generateCss(node))) {
          count(stripped, "remote url() in CSS");
          list?.remove(item);
        }
        return;
      }
      if (node.type === "IdSelector") node.name = rename(node.name);
      if (node.type === "Url" && node.value.startsWith("#")) node.value = `#${rename(node.value.slice(1))}`;
    },
  });
  return generateCss(ast);
}

// ---------------------------------------------------------------------------
// The walk that strips.

function sanitize(el: Element, stripped: Map<string, number>): void {
  const kept: ChildNode[] = [];
  for (const child of el.childNodes) {
    if (!isElement(child)) {
      if (child.nodeName === "#comment") continue;
      kept.push(child);
      continue;
    }
    if (child.namespaceURI !== SVG_NS) {
      count(stripped, `<${child.tagName}> (not SVG)`);
      continue;
    }
    if (child.tagName === "script") {
      count(stripped, "<script>");
      continue;
    }
    if (child.tagName === "foreignObject") {
      count(stripped, "<foreignObject>");
      continue;
    }
    if (SMIL.has(child.tagName)) {
      count(stripped, `<${child.tagName}> (SMIL animation)`);
      continue;
    }
    cleanAttrs(child, stripped);
    sanitize(child, stripped);
    kept.push(child);
  }
  el.childNodes = kept;
  for (const child of kept) child.parentNode = el;
}

function cleanAttrs(el: Element, stripped: Map<string, number>): void {
  el.attrs = el.attrs.filter((a) => {
    if (/^on/i.test(a.name)) {
      count(stripped, `${a.name} attribute`);
      return false;
    }
    if (isHref(a) && !local(a.value)) {
      count(stripped, "external href");
      return false;
    }
    if (/javascript:/i.test(a.value)) {
      count(stripped, "javascript: URL");
      return false;
    }
    const urls = [...a.value.matchAll(/url\(\s*['"]?([^'")]*)/gi)].map((m) => m[1] ?? "");
    if (a.name !== "style" && urls.some((u) => !local(u))) {
      count(stripped, "remote url()");
      return false;
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// Renaming: every id, and every reference to one.

function collectIds(el: Element, ids: Set<string>): void {
  const id = attr(el, "id");
  if (id) ids.add(id);
  for (const child of el.childNodes) if (isElement(child)) collectIds(child, ids);
}

function renameRefs(el: Element, rename: (id: string) => string, stripped: Map<string, number>): void {
  for (const a of el.attrs) {
    if (a.name === "id" && !a.prefix) a.value = rename(a.value);
    else if (isHref(a) && a.value.startsWith("#")) a.value = `#${rename(a.value.slice(1))}`;
    else if (a.name === "style" && !a.prefix) a.value = cleanCss(a.value, "declarationList", rename, stripped);
    else if (a.value.includes("url(")) a.value = a.value.replace(/url\(\s*(['"]?)#([^'")\s]+)\1\s*\)/g, (_m, _q, id: string) => `url(#${rename(id)})`);
    else if (/^aria-(labelledby|describedby)$/.test(a.name)) a.value = a.value.split(/\s+/).map(rename).join(" ");
  }
  if (el.tagName === "style") {
    const text = el.childNodes.map((c) => ("value" in c ? c.value : "")).join("");
    const css = cleanCss(text, "stylesheet", rename, stripped);
    el.childNodes = [];
    if (css) defaultTreeAdapter.insertText(el, css);
  }
  for (const child of el.childNodes) if (isElement(child)) renameRefs(child, rename, stripped);
}

// ---------------------------------------------------------------------------
// Coarse geometry: enough for a default pivot and the "own centre" check.

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
const mul = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
const numbers = (text: string): number[] => (text.match(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? []).map(Number);

/** An SVG `transform` list as one matrix. */
function transformMatrix(text: string | undefined): Matrix {
  let m = IDENTITY;
  for (const [, fn, args] of (text ?? "").matchAll(/(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g)) {
    const n = numbers(args ?? "");
    const rad = ((n[0] ?? 0) * Math.PI) / 180;
    let step: Matrix = IDENTITY;
    if (fn === "matrix" && n.length >= 6) step = n.slice(0, 6) as Matrix;
    else if (fn === "translate") step = [1, 0, 0, 1, n[0] ?? 0, n[1] ?? 0];
    else if (fn === "scale") step = [n[0] ?? 1, 0, 0, n[1] ?? n[0] ?? 1, 0, 0];
    else if (fn === "rotate") {
      const r: Matrix = [Math.cos(rad), Math.sin(rad), -Math.sin(rad), Math.cos(rad), 0, 0];
      const cx = n[1] ?? 0, cy = n[2] ?? 0;
      step = mul(mul([1, 0, 0, 1, cx, cy], r), [1, 0, 0, 1, -cx, -cy]);
    } else if (fn === "skewX") step = [1, 0, Math.tan(rad), 1, 0, 0];
    else if (fn === "skewY") step = [1, Math.tan(rad), 0, 1, 0, 0];
    m = mul(m, step);
  }
  return m;
}

/** Every point a path's data passes through or pulls toward — control points and arc extents included. */
function pathPoints(d: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? [];
  let i = 0, cmd = "M", x = 0, y = 0, sx = 0, sy = 0;
  const num = () => Number(tokens[i++] ?? 0);
  while (i < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[i]!)) cmd = tokens[i++]!;
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const pt = (): [number, number] => {
      const px = num(), py = num();
      return rel ? [x + px, y + py] : [px, py];
    };
    if (C === "Z") {
      x = sx; y = sy;
      continue;
    }
    if (i >= tokens.length || /^[A-Za-z]$/.test(tokens[i]!)) continue;
    if (C === "M" || C === "L" || C === "T") {
      [x, y] = pt();
      out.push([x, y]);
      if (C === "M") { sx = x; sy = y; cmd = rel ? "l" : "L"; }
    } else if (C === "H") {
      x = rel ? x + num() : num();
      out.push([x, y]);
    } else if (C === "V") {
      y = rel ? y + num() : num();
      out.push([x, y]);
    } else if (C === "C" || C === "S" || C === "Q") {
      const pts = C === "C" ? [pt(), pt(), pt()] : [pt(), pt()];
      out.push(...pts);
      [x, y] = pts[pts.length - 1]!;
    } else if (C === "A") {
      const rx = Math.abs(num()), ry = Math.abs(num());
      num(); num(); num();
      const [ex, ey] = pt();
      const r = Math.max(rx, ry);
      out.push([x - r, y - r], [x + r, y + r], [ex - r, ey - r], [ex + r, ey + r]);
      x = ex; y = ey;
    } else i++;
  }
  return out;
}

function shapePoints(el: Element): Array<[number, number]> {
  const n = (name: string) => Number(attr(el, name) ?? 0) || 0;
  switch (el.tagName) {
    case "path": return pathPoints(attr(el, "d") ?? "");
    case "circle": return [[n("cx") - n("r"), n("cy") - n("r")], [n("cx") + n("r"), n("cy") + n("r")]];
    case "ellipse": return [[n("cx") - n("rx"), n("cy") - n("ry")], [n("cx") + n("rx"), n("cy") + n("ry")]];
    case "rect": case "image": case "use": return [[n("x"), n("y")], [n("x") + n("width"), n("y") + n("height")]];
    case "line": return [[n("x1"), n("y1")], [n("x2"), n("y2")]];
    case "polyline": case "polygon": {
      const v = numbers(attr(el, "points") ?? "");
      const out: Array<[number, number]> = [];
      for (let k = 0; k + 1 < v.length; k += 2) out.push([v[k]!, v[k + 1]!]);
      return out;
    }
    case "text": return [[n("x"), n("y")]];
    default: return [];
  }
}

/** The coarse box of an element's children, in the coordinates inside its own transform. */
function boxOf(el: Element): MotionBox | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const visit = (node: Element, m: Matrix) => {
    for (const child of node.childNodes) {
      if (!isElement(child) || child.tagName === "defs" || child.tagName === "clipPath" || child.tagName === "mask") continue;
      const cm = mul(m, transformMatrix(attr(child, "transform")));
      for (const [px, py] of shapePoints(child)) {
        const wx = cm[0] * px + cm[2] * py + cm[4];
        const wy = cm[1] * px + cm[3] * py + cm[5];
        x0 = Math.min(x0, wx); y0 = Math.min(y0, wy); x1 = Math.max(x1, wx); y1 = Math.max(y1, wy);
      }
      visit(child, cm);
    }
  };
  visit(el, IDENTITY);
  if (!Number.isFinite(x0)) return null;
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

// ---------------------------------------------------------------------------
// Paint: is a layer all line, and which shapes carry a stroke to draw on.

interface Paint { fill: string; stroke: string }

function paintOf(el: Element, inherited: Paint): Paint {
  const style = attr(el, "style") ?? "";
  const fromStyle = (name: string) => new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`, "i").exec(style)?.[1]?.trim();
  return {
    fill: fromStyle("fill") ?? attr(el, "fill") ?? inherited.fill,
    stroke: fromStyle("stroke") ?? attr(el, "stroke") ?? inherited.stroke,
  };
}

/** Every geometry element under `el` with the paint it ends up with. */
function shapes(el: Element, inherited: Paint, out: Array<{ el: Element; paint: Paint }> = []): Array<{ el: Element; paint: Paint }> {
  for (const child of el.childNodes) {
    if (!isElement(child) || child.tagName === "defs" || child.tagName === "clipPath" || child.tagName === "mask") continue;
    const paint = paintOf(child, inherited);
    if (GEOMETRY.has(child.tagName)) out.push({ el: child, paint });
    shapes(child, paint, out);
  }
  return out;
}

const none = (paint: string) => /^(none|transparent)$/i.test(paint);
const ROOT_PAINT: Paint = { fill: "black", stroke: "none" };

// ---------------------------------------------------------------------------

function viewBoxOf(root: Element, box: MotionBox): MotionBox {
  const v = numbers(attr(root, "viewBox") ?? "");
  if (v.length === 4 && v[2]! > 0 && v[3]! > 0) return { x: v[0]!, y: v[1]!, width: v[2]!, height: v[3]! };
  const w = Number.parseFloat(attr(root, "width") ?? ""), h = Number.parseFloat(attr(root, "height") ?? "");
  if (w > 0 && h > 0) return { x: 0, y: 0, width: w, height: h };
  return { x: 0, y: 0, width: box.width, height: box.height };
}

function wrapChildren(el: Element, target: string): void {
  const g = defaultTreeAdapter.createElement("g", html.NS.SVG, [{ name: "data-motion", value: target }]);
  g.childNodes = el.childNodes;
  for (const child of g.childNodes) child.parentNode = g;
  el.childNodes = [g];
  g.parentNode = el;
}

/**
 * **One source SVG as a layer**: stripped, its ids prefixed, its named
 * `<g id>` groups found and wrapped so the engine can move each without
 * clobbering a transform the drawing already had, and the whole drawing
 * wrapped once more for the layer's own moves.
 *
 * `id` is the layer's id in the spec; `offset` is the stage's top-left in
 * canvas coordinates. Throws, in words, when there is no `<svg>` to keep.
 */
export function prepareMotionLayer(source: MotionSource, id: string, offset: { x: number; y: number }): PreparedLayer {
  const stripped = new Map<string, number>();
  const fragment = parseFragment(source.svg);
  const tops = fragment.childNodes.filter(isElement);
  const root = tops.find((el) => el.tagName === "svg" && el.namespaceURI === SVG_NS);
  if (!root) throw new Error(`${source.title} has no <svg> to animate`);
  for (const el of tops) if (el !== root) count(stripped, `<${el.tagName}> outside the <svg> root`);
  cleanAttrs(root, stripped);
  sanitize(root, stripped);

  const ids = new Set<string>();
  collectIds(root, ids);
  const rename = (name: string) => (ids.has(name) ? `m-${id}-${name}` : name);

  // Parts: named groups, found before renaming so the spec says `wheat/stalk`.
  const parts: Record<string, MotionBox> = {};
  const partEls: Array<{ el: Element; name: string }> = [];
  const findParts = (el: Element) => {
    for (const child of el.childNodes) {
      if (!isElement(child)) continue;
      const pid = child.tagName === "g" ? attr(child, "id") : undefined;
      if (pid && /^[A-Za-z][\w-]*$/.test(pid) && !(pid in parts)) {
        const box = boxOf(child);
        if (box) {
          parts[pid] = box;
          partEls.push({ el: child, name: pid });
        }
      }
      findParts(child);
    }
  };
  findParts(root);
  renameRefs(root, rename, stripped);

  const viewBox = viewBoxOf(root, source.box);
  const all = shapes(root, paintOf(root, ROOT_PAINT));
  const ink = all.length > 0 && all.every((s) => none(s.paint.fill) && !none(s.paint.stroke)) ? "outline" : "filled";

  for (const { el, name } of partEls) wrapChildren(el, `${id}/${name}`);
  wrapChildren(root, id);
  for (const name of ["x", "y", "width", "height", "viewBox", "xmlns", "xmlns:xlink", "overflow"]) dropAttr(root, name);
  root.attrs = root.attrs.filter((a) => !(a.prefix === "xmlns" || a.name === "xmlns"));
  const box = { x: source.box.x - offset.x, y: source.box.y - offset.y, width: source.box.width, height: source.box.height };
  setAttr(root, "data-motion-layer", id);
  setAttr(root, "x", String(box.x));
  setAttr(root, "y", String(box.y));
  setAttr(root, "width", String(box.width));
  setAttr(root, "height", String(box.height));
  setAttr(root, "viewBox", `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
  setAttr(root, "overflow", "visible");
  // A layer's <style> applies to its own layer only.
  const scopeStyles = (el: Element) => {
    for (const child of el.childNodes) {
      if (!isElement(child)) continue;
      if (child.tagName === "style") {
        const css = child.childNodes.map((c) => ("value" in c ? c.value : "")).join("");
        child.childNodes = [];
        if (css) defaultTreeAdapter.insertText(child, `@scope ([data-motion-layer="${id}"]) { ${css} }`);
      } else scopeStyles(child);
    }
  };
  scopeStyles(root);

  return {
    layer: { id, item: source.item, version: source.version, title: source.title, box, viewBox, parts, ink },
    root,
    stripped: inWords(stripped),
  };
}

/**
 * The layer's markup for the document, with the strokes of every target the
 * spec draws on made drawable: `pathLength="1"`, a dash as long as the path,
 * and `data-motion-draw` naming the target whose `draw` channel offsets it.
 */
export function motionLayerMarkup(prepared: PreparedLayer, drawn: ReadonlySet<string>): string {
  const mark = (el: Element, target: string | null, paint: Paint) => {
    for (const child of el.childNodes) {
      if (!isElement(child)) continue;
      const here = attr(child, "data-motion");
      const t = here !== undefined && drawn.has(here) ? here : target;
      const p = paintOf(child, paint);
      if (t && GEOMETRY.has(child.tagName) && !none(p.stroke)) {
        setAttr(child, "pathLength", "1");
        setAttr(child, "stroke-dasharray", "1 1");
        setAttr(child, "stroke-dashoffset", "0");
        setAttr(child, "data-motion-draw", t);
      }
      mark(child, t, p);
    }
  };
  mark(prepared.root, null, paintOf(prepared.root, ROOT_PAINT));
  return serializeOuter(prepared.root);
}
