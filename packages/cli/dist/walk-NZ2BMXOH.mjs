import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  sayInChat
} from "./chunk-ANAE7B2G.mjs";
import {
  propose
} from "./chunk-JJX2ZQ3J.mjs";
import {
  parser_default
} from "./chunk-UAFOAOKH.mjs";
import {
  parse
} from "./chunk-XSMUJNBI.mjs";
import {
  anchorAtFraction,
  critiqueCannot,
  isGroupItem,
  modules,
  newCommentId,
  newThreadId,
  nightLead,
  proposalMarked,
  titleSlug
} from "./chunk-NP5K66IV.mjs";
import "./chunk-GUY4UN4O.mjs";
import {
  luminance,
  parseSrgb
} from "./chunk-K4TDP4L5.mjs";
import "./chunk-JYOOXWJZ.mjs";

// packages/core/src/walk-read.ts
var parseCss = parser_default;
var DEFAULT_INK = "#000000";
var DEFAULT_PAPER = "#ffffff";
var UA_COLOUR = { a: "#0000ee" };
var UA_BACKGROUND = { button: "#efefef", mark: "#ffff00" };
var UA_SIZE = { h1: 32, h2: 24, h3: 18.72, h4: 16, h5: 13.28, h6: 10.72, small: 13.33, button: 13.33, input: 13.33, select: 13.33, textarea: 13.33 };
var UA_BOLD = /* @__PURE__ */ new Set(["h1", "h2", "h3", "h4", "h5", "h6", "b", "strong", "th"]);
var NAMED = { black: "#000000", white: "#ffffff", gray: "#808080", grey: "#808080", silver: "#c0c0c0", red: "#ff0000", green: "#008000", blue: "#0000ff", navy: "#000080", orange: "#ffa500", yellow: "#ffff00", purple: "#800080", maroon: "#800000", teal: "#008080", lightgray: "#d3d3d3", lightgrey: "#d3d3d3", darkgray: "#a9a9a9", darkgrey: "#a9a9a9", dimgray: "#696969", dimgrey: "#696969", whitesmoke: "#f5f5f5", gainsboro: "#dcdcdc" };
var SKIP = /* @__PURE__ */ new Set(["head", "script", "style", "template", "noscript", "title", "meta", "link"]);
var INTERACTIVE_ROLES = /* @__PURE__ */ new Set(["button", "link", "tab", "menuitem", "checkbox", "radio", "switch", "option", "textbox", "combobox", "slider", "searchbox"]);
function rgbaOf(value) {
  const v = value.trim().toLowerCase();
  if (v === "transparent") return "transparent";
  const named = NAMED[v];
  const s = parseSrgb(named ?? v);
  return s ? { r: s.r, g: s.g, b: s.b, a: s.alpha ?? 1 } : null;
}
var hex = (c) => `#${[c.r, c.g, c.b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("")}`;
var over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
function backgroundColour(value) {
  if (/url\(|gradient\(/i.test(value)) return null;
  const tokens = value.match(/#[0-9a-f]{3,8}\b|(?:rgba?|hsla?)\([^)]*\)|\b[a-z]+\b/gi) ?? [];
  for (const t of tokens) {
    const c = rgbaOf(t);
    if (c) return t;
  }
  return "none";
}
var attr = (el, name) => el.attrs.find((a) => a.name === name)?.value;
var elements = (node) => "childNodes" in node ? node.childNodes.filter((c) => "tagName" in c) : [];
var kids = (node) => "children" in node && node.children ? node.children.toArray() : [];
function matchCompound(parts, el) {
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
      if (has === void 0) return false;
      if (!part.matcher) continue;
      const want = part.value ? part.value.type === "String" ? part.value.value : part.value.name : "";
      if (part.matcher === "=" ? has !== want : part.matcher === "~=" ? !has.split(/\s+/).includes(want) : part.matcher === "^=" ? !has.startsWith(want) : part.matcher === "$=" ? !has.endsWith(want) : part.matcher === "*=" ? !has.includes(want) : part.matcher === "|=" ? !(has === want || has.startsWith(`${want}-`)) : true) return false;
    } else if (part.type === "PseudoClassSelector" && part.name === "root") {
      if (el.tagName !== "html") return false;
    } else if (part.type === "PseudoClassSelector" && /^(hover|focus|focus-visible|focus-within|active|visited|target|checked|disabled|placeholder-shown)$/.test(part.name)) {
      return false;
    } else if (part.type === "PseudoElementSelector") {
      return false;
    } else return null;
  }
  return true;
}
function specificity(parts) {
  let n = 0;
  for (const p of parts) {
    if (p.type === "IdSelector") n += 1e6;
    else if (p.type === "ClassSelector" || p.type === "AttributeSelector" || p.type === "PseudoClassSelector") n += 1e3;
    else if (p.type === "TypeSelector" && p.name !== "*") n += 1;
  }
  return n;
}
function matchSelector(selector, el) {
  const parts = kids(selector);
  const compounds = [];
  let current = [];
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
  const at = (i, node) => {
    const m = matchCompound(compounds[i].parts, node);
    if (m !== true) return m;
    if (i === 0) return true;
    const comb = compounds[i - 1].combinator;
    let up = node.parentNode;
    if (comb === ">") return up && "tagName" in up ? at(i - 1, up) : false;
    while (up && "tagName" in up) {
      const r2 = at(i - 1, up);
      if (r2 === null) return null;
      if (r2) return true;
      up = up.parentNode;
    }
    return false;
  };
  const r = at(last, el);
  return r === null ? null : r ? spec : -1;
}
function pathOf(el) {
  const parts = [];
  let node = el;
  while (node && "tagName" in node) {
    const parent = node.parentNode;
    const tag = node.tagName;
    if (!parent || !("tagName" in parent)) {
      parts.unshift(tag);
      break;
    }
    const sibs = elements(parent);
    parts.unshift(tag === "body" || tag === "html" || tag === "head" ? tag : `${tag}:nth-child(${sibs.indexOf(node) + 1})`);
    node = parent;
  }
  return parts.join(" > ");
}
function textOf(node, withAlt = true) {
  if ("value" in node && node.nodeName === "#text") return node.value;
  if ("tagName" in node) {
    const el = node;
    if (SKIP.has(el.tagName) || attr(el, "aria-hidden") === "true" || attr(el, "hidden") !== void 0) return "";
    if (el.tagName === "img") return withAlt ? ` ${attr(el, "alt") ?? ""} ` : "";
  }
  return "childNodes" in node ? node.childNodes.map((c) => textOf(c, withAlt)).join("") : "";
}
var tidy = (s, max = 80) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}\u2026` : t;
};
function px(value, fontPx, of) {
  if (value === void 0) return null;
  const m = /^(-?[\d.]+)(px|rem|em|%|vw|vh)?$/.exec(value.trim());
  if (!m) return null;
  const n = Number(m[1]);
  if (Number.isNaN(n)) return null;
  switch (m[2]) {
    case void 0:
      return n === 0 ? 0 : null;
    case "px":
      return n;
    case "rem":
      return n * 16;
    case "em":
      return n * fontPx;
    case "%":
      return of === null ? null : n / 100 * of;
    default:
      return null;
  }
}
function readScreen(html, viewport) {
  const doc = parse(html);
  const root = elements(doc).find((e) => e.tagName === "html");
  const empty = { viewport, texts: [], targets: [], order: [], noAlt: [], unread: { rules: 0, colours: 0 } };
  if (!root) return empty;
  let vp = { ...viewport };
  const all = [];
  const collect = (el) => {
    all.push(el);
    for (const c of elements(el)) collect(c);
  };
  collect(root);
  const meta = all.find((e) => e.tagName === "meta" && attr(e, "name") === "viewport");
  const metaWidth = meta ? /width\s*=\s*(\d+)/.exec(attr(meta, "content") ?? "")?.[1] : void 0;
  if (metaWidth) vp = { width: Number(metaWidth), height: Math.round(viewport.height * Number(metaWidth) / Math.max(1, viewport.width)) };
  const rules = [];
  let unreadRules = 0;
  let order = 0;
  for (const style2 of all.filter((e) => e.tagName === "style")) {
    let ast;
    try {
      ast = parseCss(style2.childNodes.map((n) => "value" in n ? n.value : "").join(""), { parseValue: false, parseCustomProperty: false, onParseError: () => void 0 });
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
      const decls = kids(node.block).flatMap((d) => d.type === "Declaration" && d.value.type === "Raw" ? [{ property: d.property.toLowerCase(), value: d.value.value.trim(), important: Boolean(d.important) }] : []);
      for (const sel of node.prelude.type === "SelectorList" ? kids(node.prelude) : []) rules.push({ selector: sel, decls, order: order++ });
    }
  }
  const unsupported = /* @__PURE__ */ new Set();
  const declared = (el) => {
    const hits = [];
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
        const ast = parseCss(inline, { context: "declarationList", parseValue: false, parseCustomProperty: false, onParseError: () => void 0 });
        for (const d of kids(ast)) if (d.type === "Declaration" && d.value.type === "Raw") hits.push({ spec: 1e9, order: 1e9, important: Boolean(d.important), property: d.property.toLowerCase(), value: d.value.value.trim() });
      } catch {
      }
    }
    hits.sort((a, b) => Number(a.important) - Number(b.important) || a.spec - b.spec || a.order - b.order);
    const out = /* @__PURE__ */ new Map();
    for (const h of hits) out.set(h.property, h.value);
    return out;
  };
  const computed = /* @__PURE__ */ new Map();
  let unreadColours = 0;
  const resolveVars = (value, vars, depth = 0) => {
    if (!value.includes("var(")) return value;
    if (depth > 8) return null;
    const out = value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\))?[^()]*))?\)/g, (_m, name, fallback) => vars.get(name) ?? fallback?.trim() ?? "\0");
    if (out.includes("\0")) return null;
    return resolveVars(out, vars, depth + 1);
  };
  const compute = (el, parent) => {
    const decl = declared(el);
    const vars = new Map(parent?.vars ?? []);
    for (const [k, v] of decl) if (k.startsWith("--")) vars.set(k, v);
    const get = (k) => {
      const v = decl.get(k);
      return v === void 0 ? void 0 : resolveVars(v, vars) ?? "\0";
    };
    const tag = el.tagName;
    const parentBg = parent?.bg ?? (parent ? null : rgbaOf(DEFAULT_PAPER));
    let bg = parentBg;
    const bgRaw = get("background-color") ?? (decl.has("background") ? (() => {
      const v = get("background");
      const c2 = v === "\0" ? null : backgroundColour(v);
      return c2 === "none" ? void 0 : c2 ?? "\0";
    })() : void 0) ?? UA_BACKGROUND[tag];
    if (bgRaw !== void 0) {
      const c2 = bgRaw === "\0" ? null : rgbaOf(bgRaw);
      if (c2 === null) {
        bg = null;
        unreadColours++;
      } else if (c2 !== "transparent" && parentBg) bg = over(c2, parentBg);
      else if (c2 !== "transparent") bg = c2.a >= 1 ? c2 : null;
    }
    let fg = parent ? parent.fg : rgbaOf(DEFAULT_INK);
    const fgRaw = get("color") ?? UA_COLOUR[tag];
    if (fgRaw !== void 0 && !/^(inherit|currentcolor)$/i.test(fgRaw)) {
      const c2 = fgRaw === "\0" ? null : rgbaOf(fgRaw);
      if (c2 === null || c2 === "transparent") {
        fg = null;
        if (c2 === null) unreadColours++;
      } else fg = c2;
    }
    const parentFont = parent?.fontPx ?? 16;
    const fsRaw = get("font-size");
    const KEYWORD = { "x-small": 10, small: 13, medium: 16, large: 18, "x-large": 24, "xx-large": 32 };
    const fontPx = fsRaw && (KEYWORD[fsRaw] ?? px(fsRaw, parentFont, parentFont)) || UA_SIZE[tag] || parentFont;
    const fwRaw = get("font-weight");
    const bold = fwRaw ? /bold|bolder/.test(fwRaw) || Number(fwRaw) >= 600 : UA_BOLD.has(tag) || Boolean(parent?.bold);
    const hidden = Boolean(parent?.hidden) || get("display") === "none" || get("visibility") === "hidden" || attr(el, "hidden") !== void 0;
    const c = { vars, fg, bg, fontPx, bold, hidden, decl };
    computed.set(el, c);
    for (const child of elements(el)) compute(child, c);
  };
  compute(root, null);
  const style = (el, k) => {
    const c = computed.get(el);
    const v = c.decl.get(k);
    return v === void 0 ? void 0 : resolveVars(v, c.vars) ?? void 0;
  };
  const boxes = /* @__PURE__ */ new Map();
  const sizeOf = (el, cb) => {
    const f = computed.get(el).fontPx;
    const pad = (style(el, "padding") ?? "").split(/\s+/).filter(Boolean).map((v) => px(v, f, cb?.width ?? null) ?? 0);
    const [pt, pr, pb, pl] = [pad[0] ?? 0, pad[1] ?? pad[0] ?? 0, pad[2] ?? pad[0] ?? 0, pad[3] ?? pad[1] ?? pad[0] ?? 0];
    const side = (k, fallback) => px(style(el, k), f, cb?.width ?? null) ?? fallback;
    const border = style(el, "box-sizing") === "border-box";
    const w = px(style(el, "width"), f, cb?.width ?? null) ?? px(style(el, "min-width"), f, cb?.width ?? null);
    const h = px(style(el, "height"), f, cb?.height ?? null) ?? px(style(el, "min-height"), f, cb?.height ?? null);
    return {
      width: w === null ? null : border ? w : w + side("padding-left", pl) + side("padding-right", pr),
      height: h === null ? null : border ? h : h + side("padding-top", pt) + side("padding-bottom", pb)
    };
  };
  const view = { x: 0, y: 0, width: vp.width, height: vp.height };
  const boxOf = (el) => {
    if (boxes.has(el)) return boxes.get(el);
    boxes.set(el, null);
    const pos = style(el, "position");
    let cb = null;
    if (pos === "fixed") cb = view;
    else if (pos === "absolute") {
      let up = el.parentNode;
      while (up && "tagName" in up && !/^(relative|absolute|fixed|sticky)$/.test(style(up, "position") ?? "")) up = up.parentNode;
      cb = up && "tagName" in up ? boxOf(up) : view;
    }
    if (!cb) return null;
    const f = computed.get(el).fontPx;
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
  const byId = new Map(all.flatMap((e) => attr(e, "id") ? [[attr(e, "id"), e]] : []));
  const labelFor = (el) => {
    const id = attr(el, "id");
    const label = id ? all.find((e) => e.tagName === "label" && attr(e, "for") === id) : void 0;
    let up = el.parentNode;
    while (!label && up && "tagName" in up && up.tagName !== "label") up = up.parentNode;
    const wrap = label ?? (up && "tagName" in up ? up : void 0);
    return wrap ? tidy(textOf(wrap)) : "";
  };
  const roleOf = (el) => {
    const explicit = attr(el, "role");
    if (explicit) return explicit;
    const tag = el.tagName;
    if (tag === "a") return attr(el, "href") !== void 0 ? "link" : null;
    if (tag === "button" || tag === "summary") return "button";
    if (tag === "select") return "combobox";
    if (tag === "textarea") return "textbox";
    if (tag === "input") {
      const t = (attr(el, "type") ?? "text").toLowerCase();
      return t === "hidden" ? null : t === "checkbox" || t === "radio" ? t : ["button", "submit", "reset", "image"].includes(t) ? "button" : t === "range" ? "slider" : t === "search" ? "searchbox" : "textbox";
    }
    return null;
  };
  const actsWithoutRole = (el) => attr(el, "onclick") !== void 0 || attr(el, "tabindex") !== void 0 && Number(attr(el, "tabindex")) >= 0;
  const nameOf = (el) => {
    const by = attr(el, "aria-labelledby");
    if (by) {
      const t = tidy(by.split(/\s+/).map((id) => byId.get(id) ? textOf(byId.get(id)) : "").join(" "));
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
  const texts = [];
  const targets = [];
  const spoken = [];
  const noAlt = [];
  const visit = (el, inTarget, srHidden) => {
    if (SKIP.has(el.tagName)) return;
    const c = computed.get(el);
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
      if (alt === void 0) noAlt.push({ path: pathOf(el), src: tidy(attr(el, "src") ?? "", 40) });
      if (alt !== "") spoken.push({ path: pathOf(el), role: "image", name: alt === void 0 ? tidy(attr(el, "src") ?? "unlabelled image", 40) : tidy(alt) });
    }
    const own = tidy(el.childNodes.filter((n) => n.nodeName === "#text").map((n) => n.value).join(" "));
    if (own) {
      let up = el;
      let at = null;
      while (up && "tagName" in up && !at) {
        at = boxOf(up);
        const p = up.parentNode;
        up = p && "tagName" in p ? p : null;
      }
      texts.push({ path: pathOf(el), text: own, fg: c.fg ? hex(c.bg && c.fg.a < 1 ? over(c.fg, c.bg) : c.fg) : null, bg: c.bg ? hex(c.bg) : null, fontPx: Math.round(c.fontPx * 100) / 100, bold: c.bold, at, inTarget: inTarget || acts });
    }
    for (const child of elements(el)) visit(child, inTarget || acts, hiddenFromSr);
  };
  const body = elements(root).find((e) => e.tagName === "body");
  if (body) visit(body, false, false);
  return { viewport: vp, texts, targets, order: spoken, noAlt, unread: { rules: unsupported.size + unreadRules, colours: unreadColours } };
}

// packages/core/src/walk.ts
var WALK_NOTICE = "These are simulations, not people: each walker is one situation and one constraint, measured where the screen's code allows and judged by the lead where it does not. They do not replace testing with the people they stand for.";
var WALKERS = [
  { id: "one-handed", name: "One-handed on a phone", situation: "holding the phone in one hand, on the move", constraint: "reaches the screen only with the thumb of the hand that holds it (the right, here)", checks: ["reach"] },
  { id: "low-vision", name: "Low vision", situation: "reading a phone at about a third of a metre, with acuity near 20/80", constraint: "reads large, high-contrast text; small or faint text blurs into what is behind it", checks: ["contrast"] },
  { id: "screen-reader", name: "A screen-reader user", situation: "hearing the screen read aloud, one thing at a time", constraint: "reaches only what has a name and a role, in the order the code puts it", checks: ["names"] },
  { id: "first-time", name: "A first-time visitor", situation: "has never seen this product before", constraint: "knows the task, not the words this product uses for it", checks: [] }
];
var DEFAULT_WALKERS = ["one-handed", "low-vision"];
var WALKERS_MAX = 6;
var ALIASES = {
  thumb: "one-handed",
  "one-hand": "one-handed",
  onehanded: "one-handed",
  "low-sight": "low-vision",
  lowvision: "low-vision",
  "low-vis": "low-vision",
  "screenreader": "screen-reader",
  sr: "screen-reader",
  blind: "screen-reader",
  "first-timer": "first-time",
  firsttime: "first-time",
  newcomer: "first-time",
  "first-visit": "first-time"
};
var slug = (s) => titleSlug(s, { max: 40, ascii: true });
var IDENTITY = /\b(old|older|elderly|senior|grandma|grandpa|granny|grandmother|grandfather|boomer|millennial|gen ?z|woman|women|man|men|girl|boy|lady|guy|teen|teenager|kid|retired|retiree|disabled person)\b/i;
function walkerOf(spec) {
  const raw = spec.trim();
  const colon = raw.indexOf(":");
  if (colon < 0) {
    const id2 = ALIASES[slug(raw).replace(/-/g, "")] ?? ALIASES[slug(raw)] ?? slug(raw);
    const found = WALKERS.find((w) => w.id === id2);
    if (found) return found;
    return { refused: `no walker "${raw}" \u2014 the starters are ${WALKERS.map((w) => w.id).join(", ")}; or describe one: "<name>: <what they are doing, and what they cannot do>"` };
  }
  const name = raw.slice(0, colon).trim();
  const constraint = raw.slice(colon + 1).replace(/\s+/g, " ").trim();
  const id = slug(name);
  if (!id) return { refused: 'a described walker has a name before the colon: "commuter: one hand on a strap, reading on a moving bus"' };
  if (WALKERS.some((w) => w.id === id)) return { refused: `"${name}" is a starter \u2014 name it alone (${id}), or call yours something else` };
  if (constraint.split(" ").length < 4) return { refused: `say what ${name} is doing and what they cannot do, in a few words: "${name}: one hand on a strap, reading on a moving bus"` };
  if (IDENTITY.test(`${name} ${constraint}`)) return { refused: "a walker is a situation and a constraint, not who someone is \u2014 say what they are doing and what they cannot do, not their age or who they are" };
  return { id, name: name.charAt(0).toUpperCase() + name.slice(1), situation: constraint, constraint: "judged by the lead from this description", checks: [], described: true };
}
var PX_PER_MM = 6;
var MAR_20_80 = 4;
var VIEWING_MM = 330;
var marPx = Math.tan(MAR_20_80 / 60 * Math.PI / 180) * VIEWING_MM * PX_PER_MM;
var blurPx = Math.round(marPx / 2 * 10) / 10;
var VEIL = 0.3;
var WALK_PARAMETERS = {
  phone: {
    width: 390,
    height: 844,
    pxPerMm: PX_PER_MM,
    source: "a current phone's CSS viewport (390\xD7844, iPhone 12\u201315); 6 CSS px per mm from a 460 ppi panel at a device pixel ratio of 3"
  },
  thumb: {
    hand: "right",
    innerMm: 15,
    easyMm: 60,
    stretchMm: 75,
    source: "the thumb pivots at the bottom corner of the holding hand: comfortable 15\u201360 mm from it, a stretch to 75 mm, hard beyond and very near. Shaped after Hoober's observation of how phones are held (UXmatters, 2013: 49% one-handed) and the thumb-zone map drawn from it (Hurff, 2014); a band rather than a disc because the thumb's functional area is (Bergstrom-Lehtovirta & Oulasvirta, CHI 2014). Radii are our approximation, not anthropometry"
  },
  target: {
    thumbPx: 44,
    minPx: 24,
    source: "WCAG 2.2: 2.5.8 Target Size (Minimum) 24\xD724 CSS px, AA; 2.5.5 Target Size (Enhanced) 44\xD744, AAA \u2014 the size we hold a thumb to outside its easy zone"
  },
  contrast: {
    body: 4.5,
    large: 3,
    enhanced: 7,
    largePx: 24,
    largeBoldPx: 18.66,
    source: "WCAG 2.2 1.4.3 Contrast (Minimum): 4.5:1, 3:1 for large text (24 px, or 18.66 px bold); 1.4.6 Contrast (Enhanced): 7:1"
  },
  lowVision: {
    acuity: "20/80",
    marArcmin: MAR_20_80,
    viewingMm: VIEWING_MM,
    blurPx,
    veil: VEIL,
    source: `blur: the minimum angle of resolution of 20/80 (4\u2032) at ${VIEWING_MM} mm \u2014 where people hold a phone to read (Bababekova et al., Optometry and Vision Science, 2011: 32\u201336 cm) \u2014 is about ${Math.round(marPx * 10) / 10} CSS px; the blur's deviation is half that, ${blurPx} px, which leaves detail at the resolution limit with about 29% of its contrast \u2014 near threshold, not gone. Wash: a veil of ${VEIL} of white's luminance, so 7:1 (WCAG's enhanced ratio, which its Understanding of 1.4.6 ties to about 20/80) is seen as 3:1. A stand-in for one kind of low vision, not a diagnosis`
  }
};
function thumbArcs(viewport) {
  const t = WALK_PARAMETERS.thumb;
  return { pivot: { x: viewport.width, y: viewport.height }, inner: t.innerMm * PX_PER_MM, easy: t.easyMm * PX_PER_MM, stretch: t.stretchMm * PX_PER_MM };
}
function thumbZone(point, viewport) {
  const a = thumbArcs(viewport);
  const d = Math.hypot(point.x - a.pivot.x, point.y - a.pivot.y);
  return d < a.inner ? "hard" : d <= a.easy ? "easy" : d <= a.stretch ? "stretch" : "hard";
}
var phoneSized = (viewport) => viewport.width <= 500;
var rawRatio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
var round2 = (n) => Math.round(n * 100) / 100;
function seenContrast(fg, bg) {
  const a = luminance(fg);
  const b = luminance(bg);
  if (a === null || b === null) return null;
  return round2((Math.max(a, b) + 0.05 + VEIL) / (Math.min(a, b) + 0.05 + VEIL));
}
function contrastFix(fg, bg, need) {
  const lb = luminance(bg);
  const f = /^#?([0-9a-f]{6})$/i.exec(fg.trim());
  if (lb === null || !f) return null;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(f[1].slice(i, i + 2), 16));
  const toward = lb >= 0.18 ? 0 : 255;
  for (let t = 0; t <= 100; t++) {
    const mix = [r, g, b].map((c) => Math.round(c + (toward - c) * t / 100));
    const hex2 = `#${mix.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
    const lf = luminance(hex2);
    if (rawRatio(lf, lb) >= need) return { colour: hex2, ratio: round2(rawRatio(lf, lb)) };
  }
  return null;
}
var isHtml = (item) => item.versions.find((v) => v.id === item.currentVersionId)?.mimeType === "text/html";
function readingOrder(items) {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows = [];
  for (const item of sorted) {
    const row = rows.at(-1);
    if (row && item.y - row[0].y < row[0].height / 2) row.push(item);
    else rows.push([item]);
  }
  return rows.flatMap((row) => row.sort((a, b) => a.x - b.x));
}
function flowReach(graph) {
  const seen = /* @__PURE__ */ new Set([graph.start]);
  const order = [graph.start];
  for (let i = 0; i < order.length; i++) {
    for (const l of graph.links) {
      if (l.from === order[i] && !seen.has(l.to) && graph.screens.includes(l.to)) {
        seen.add(l.to);
        order.push(l.to);
      }
    }
  }
  return { screens: order, unreached: graph.screens.filter((s) => !seen.has(s)) };
}
function walkFlow(canvas, itemId, html) {
  const item = canvas.items[itemId];
  if (!item) return { refused: `no item ${itemId} on this canvas` };
  const title = item.title || "Untitled";
  const screen = (id) => {
    const it = canvas.items[id];
    return it && isHtml(it) && !proposalMarked(it) ? it : null;
  };
  if (html !== null) {
    for (const m of modules()) {
      const graph = m.walkFlow?.(item, html);
      if (!graph) continue;
      const live = { start: graph.start, screens: graph.screens.filter((s) => screen(s)), links: graph.links };
      if (!screen(live.start)) return { refused: `\u201C${title}\u201D opens on a screen that is not on the canvas any more` };
      return { via: "prototype", title, ...flowReach(live) };
    }
  }
  if (isGroupItem(item)) {
    const inside = readingOrder(Object.values(canvas.items).filter((i) => i.containerId === item.id && screen(i.id)));
    if (!inside.length) return { refused: `\u201C${title}\u201D holds no screens \u2014 a walk goes over HTML screens` };
    return { via: "group", title, screens: inside.map((i) => i.id), unreached: [] };
  }
  if (screen(item.id)) return { via: "screen", title, screens: [item.id], unreached: [] };
  return { refused: `a walk goes over screens \u2014 a group of them, a prototype, or one screen; \u201C${title}\u201D is none of those` };
}
function walkScreen(item, versionId, html) {
  return { itemId: item.id, versionId, title: item.title || "Untitled", read: readScreen(html, { width: item.width, height: item.height }) };
}
var quote = (s) => `\u201C${s.length > 40 ? `${s.slice(0, 39)}\u2026` : s}\u201D`;
var where = (r, vp) => {
  const cx = r.x + r.width / 2;
  const cy = r.y + r.height / 2;
  const v = cy < vp.height / 3 ? "top" : cy > vp.height * 2 / 3 ? "bottom" : "middle";
  const h = cx < vp.width / 3 ? "left" : cx > vp.width * 2 / 3 ? "right" : "centre";
  return v === "middle" && h === "centre" ? "the middle" : `${v} ${h}`;
};
function measured(walker, s) {
  const out = [];
  const vp = s.read.viewport;
  const base = { walker: walker.id, itemId: s.itemId };
  if (walker.checks.includes("reach")) {
    const t = WALK_PARAMETERS.target;
    for (const target of s.read.targets) {
      const label = target.name || target.tag;
      const size = target.size;
      if (size && Math.min(size.width, size.height) < t.minPx) {
        out.push({ ...base, kind: "target", path: target.path, at: target.at, label, text: `${quote(label)} is ${size.width}\xD7${size.height} px \u2014 smaller than the ${t.minPx}\xD7${t.minPx} any finger needs` });
        continue;
      }
      if (!target.at || !phoneSized(vp)) continue;
      const zone = thumbZone({ x: target.at.x + target.at.width / 2, y: target.at.y + target.at.height / 2 }, vp);
      if (zone !== "easy" && Math.min(target.at.width, target.at.height) < t.thumbPx) {
        out.push({ ...base, kind: "reach", path: target.path, at: target.at, label, reach: { zone, width: target.at.width, height: target.at.height }, text: `${quote(label)} is ${target.at.width}\xD7${target.at.height} px in the ${zone === "hard" ? "hard-to-reach" : "stretch"} zone, ${where(target.at, vp)} \u2014 a thumb needs ${t.thumbPx}\xD7${t.thumbPx} there` });
      }
    }
  }
  if (walker.checks.includes("contrast")) {
    const c = WALK_PARAMETERS.contrast;
    const seen = /* @__PURE__ */ new Set();
    for (const run of s.read.texts) {
      if (!run.fg || !run.bg) continue;
      const lf = luminance(run.fg);
      const lb = luminance(run.bg);
      if (lf === null || lb === null) continue;
      const large = run.fontPx >= c.largePx || run.bold && run.fontPx >= c.largeBoldPx;
      const need = large ? c.large : c.body;
      const ratio = round2(rawRatio(lf, lb));
      if (rawRatio(lf, lb) >= need) continue;
      const key = `${run.text}|${run.fg}|${run.bg}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const reads = large ? c.body : c.enhanced;
      const fix = contrastFix(run.fg, run.bg, reads);
      const seenAt = seenContrast(run.fg, run.bg) ?? ratio;
      out.push({
        ...base,
        kind: "contrast",
        path: run.path,
        at: run.at,
        label: run.text,
        contrast: { fg: run.fg, bg: run.bg, fontPx: run.fontPx, bold: run.bold, ratio, need, seen: seenAt, fix: fix?.colour ?? null, fixRatio: fix?.ratio ?? null },
        text: `${quote(run.text)} is ${run.fg} on ${run.bg}, ${ratio}:1 \u2014 ${large ? "large text" : "text this size"} needs ${need}:1; through low vision it is about ${seenAt}:1${fix ? `. The fix, at the ${reads}:1 they read at: ${fix.colour} (${fix.ratio}:1)` : ""}`
      });
    }
  }
  if (walker.checks.includes("names")) {
    for (const target of s.read.targets) {
      if (target.role === null) out.push({ ...base, kind: "no-role", path: target.path, at: target.at, label: target.name || target.tag, text: `${target.name ? quote(target.name) : `a ${target.tag}`} acts on a click but has no role \u2014 it is read as plain text, and a keyboard may never reach it` });
      else if (!target.name) out.push({ ...base, kind: "unnamed", path: target.path, at: target.at, label: target.tag, text: `a ${target.role} with no name \u2014 it is read as \u201C${target.role}\u201D, and nothing says what it does` });
      else if (target.placeholderOnly) out.push({ ...base, kind: "placeholder", path: target.path, at: target.at, label: target.name, text: `the field ${quote(target.name)} is named only by its placeholder, which goes as they type` });
    }
    for (const img of s.read.noAlt) out.push({ ...base, kind: "no-alt", path: img.path, at: null, label: img.src || "image", text: `an image with no alt \u2014 it is read as its file name${img.src ? `, ${quote(img.src)}` : ""}` });
  }
  return out;
}
function walkFindings(walker, screens) {
  return screens.flatMap((s, i) => measured(walker, s).map((f, k) => ({ ...f, id: `${i + 1}.${k + 1}` })));
}
function walkNotes(walker, s) {
  const out = [];
  if (!walker.checks.length) out.push(walker.described ? "described by the person: the lead judges this walker, nothing is measured" : "judged by the lead: this walker meets meaning, which the code cannot measure");
  if (walker.checks.includes("reach")) {
    if (!phoneSized(s.read.viewport)) out.push(`${s.read.viewport.width} px wide \u2014 wider than a phone, so reach is not measured; target size still is`);
    const unplaced = s.read.targets.filter((t) => !t.at).length;
    if (unplaced) out.push(`${unplaced} ${unplaced === 1 ? "target" : "targets"} the read could not place \u2014 it knows only fixed and absolute positions; the lead judges ${unplaced === 1 ? "it" : "them"}`);
  }
  if (walker.checks.includes("contrast")) {
    const unread = s.read.texts.filter((t) => !t.fg || !t.bg).length + s.read.unread.colours;
    if (unread) out.push(`${unread} ${unread === 1 ? "colour" : "colours"} the read could not resolve (an image, a gradient, a name it does not know)`);
  }
  if (s.read.unread.rules) out.push(`${s.read.unread.rules} CSS ${s.read.unread.rules === 1 ? "rule" : "rules"} not read (states, @media, combinators it does not match)`);
  return out;
}
var WALK_ASK = "Walk it as someone else, please";
var ASK_RE = /Walk it as someone else, please \(([^)]*)\): “([^\n]*)” as [^\n]*\.\n/;
var listOf = (names) => names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
function walkAskBody(lead, task, screens, walkers, findings) {
  const titled = new Map(screens.map((s) => [s.itemId, s.title]));
  const measuredLines = findings.slice(0, 12).map((f) => `- ${f.walker} on \u201C${titled.get(f.itemId)}\u201D, ${f.id}: ${f.text}`);
  return [
    `@${lead.name} ${WALK_ASK} (${screens.map((s) => `${s.itemId}@${s.versionId}`).join(", ")}): \u201C${task.replace(/\s+/g, " ").trim()}\u201D as ${listOf(walkers.map((w) => w.name))}.`,
    ...walkers.map((w) => `- walker ${w.id}${w.described ? " (described)" : ""}: ${w.name} \u2014 ${w.situation}${w.described ? "" : `; ${w.constraint}`}`),
    "",
    findings.length ? `Measured (${findings.length}):` : "Measured: nothing in the way for these walkers.",
    ...measuredLines,
    ...findings.length > 12 ? [`- and ${findings.length - 12} more: \`isocan walk --json\``] : [],
    "",
    WALK_NOTICE,
    `Walk each one through the task on these screens, in order, and answer in one command: \`isocan walk --stumble "<walker> | <screen> | <measured id, or judged> | <what happened, one sentence>"\` for each stumble (it lands as a pin, worn as that walker), \`--outcome "<walker> | made it|stumbled|gave up | <one line>"\` for every walker, and where two or more stumble on one screen, \`--shared "<screen> | <the problem, in design words>" --fix <file> --why "\u2026"\` \u2014 one fix, a proposal. Edit nothing.`
  ].join("\n");
}
function readWalkAsk(c) {
  const m = ASK_RE.exec(`${c.body}
`);
  if (!m) return null;
  const screens = m[1].split(",").map((s) => s.trim()).flatMap((s) => {
    const [itemId, versionId] = s.split("@");
    return itemId && versionId ? [{ itemId, versionId }] : [];
  });
  const walkers = [...c.body.matchAll(/^- walker ([a-z0-9-]+)( \(described\))?: (.+?) — (.*)$/gm)].map((w) => {
    const starter = WALKERS.find((s) => s.id === w[1]);
    return starter && !w[2] ? starter : { id: w[1], name: w[3], situation: w[4], constraint: "judged by the lead from this description", checks: [], described: true };
  });
  if (!screens.length || !walkers.length) return null;
  return { id: c.id, createdAt: c.createdAt, by: c.author, task: m[2], screens, walkers };
}
var allComments = (canvas) => Object.values(canvas.threads).flatMap((t) => t.comments).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
function walkAsks(canvas) {
  return allComments(canvas).flatMap((c) => c.body.includes(WALK_ASK) ? [readWalkAsk(c)].filter((a) => a !== null) : []);
}
function stumbleBody(walker, walkId, finding, what) {
  return `${walker.name} stumbled here (walk ${walkId} \xB7 ${finding === "judged" ? "judged, not measured" : `measured ${finding}`}): ${what.replace(/\s+/g, " ").trim()}`;
}
var STUMBLE_RE = /stumbled here \(walk ([\w-]+) · (?:measured ([\d.]+)|judged, not measured)\): ([\s\S]*)$/;
function walkStumbles(canvas, walkId) {
  return Object.values(canvas.threads).flatMap((t) => {
    const c = t.comments[0];
    const m = c && c.persona && t.anchorItemId ? STUMBLE_RE.exec(c.body) : null;
    if (!m || m[1] !== walkId || !t.anchorItemId) return [];
    const item = canvas.items[t.anchorItemId];
    const at = item ? { x: Math.round(t.x / Math.max(1, item.width) * 100) / 100, y: Math.round(t.y / Math.max(1, item.height) * 100) / 100 } : void 0;
    return [{ createdAt: c.createdAt, s: { walk: walkId, walker: c.persona, itemId: t.anchorItemId, finding: m[2] ?? "judged", what: m[3].trim(), threadId: t.id, ...at ? { at } : {} } }];
  }).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((x) => x.s);
}
function walkShared(stumbles) {
  const by = /* @__PURE__ */ new Map();
  for (const s of stumbles) by.set(s.itemId, (by.get(s.itemId) ?? /* @__PURE__ */ new Set()).add(s.walker));
  return [...by].filter(([, w]) => w.size >= 2).map(([itemId, w]) => ({ itemId, walkers: [...w] }));
}
var WALK_OUTCOMES = ["made it", "stumbled", "gave up"];
var RECORD_MARK = "Walk read (walk ";
function walkRecordBody(ask, outcomes, shared, fix) {
  return [
    `${RECORD_MARK}${ask.id}): \u201C${ask.task}\u201D.`,
    ...outcomes.map((o) => `- outcome ${o.walker}: ${o.outcome} \u2014 ${o.line.replace(/\s+/g, " ").trim()}`),
    ...shared ? [`- shared ${shared.itemId}: ${shared.sentence.replace(/\s+/g, " ").trim()}`] : [],
    ...fix ? [`- fix ${fix}`] : [],
    "",
    WALK_NOTICE
  ].join("\n");
}
function walkRecordOf(canvas, walkId) {
  const c = allComments(canvas).find((x) => x.record && x.body.startsWith(`${RECORD_MARK}${walkId})`));
  if (!c) return null;
  const outcomes = [...c.body.matchAll(/^- outcome ([a-z0-9-]+): (made it|stumbled|gave up) — (.*)$/gm)].map((m) => ({ walker: m[1], outcome: m[2], line: m[3] }));
  const sh = /^- shared ([\w-]+): (.*)$/m.exec(c.body);
  const fix = /^- fix ([\w-]+)$/m.exec(c.body)?.[1] ?? null;
  return { walk: walkId, commentId: c.id, by: c.author, createdAt: c.createdAt, outcomes, shared: sh ? { itemId: sh[1], sentence: sh[2] } : null, fix };
}
function walkRecordRefusal(ask, findings, stumbles, outcomes, shared, fix) {
  const walkers = new Map(ask.walkers.map((w) => [w.id, w]));
  const screens = new Set(ask.screens.map((s) => s.itemId));
  for (const s of stumbles) {
    if (!walkers.has(s.walker)) return `${s.walker} did not walk this \u2014 the walkers are ${[...walkers.keys()].join(", ")}`;
    if (!screens.has(s.itemId)) return `a stumble happens on a screen the walk met \u2014 ${s.itemId} is not one of them`;
    if (s.finding !== "judged" && !findings.some((f) => f.walker === s.walker && f.itemId === s.itemId && f.id === s.finding)) {
      const there = findings.filter((f) => f.walker === s.walker && f.itemId === s.itemId).map((f) => f.id);
      return `${s.walker} has no measured ${s.finding} on that screen${there.length ? ` (it has ${there.join(", ")})` : " (nothing was measured there)"} \u2014 cite one, or say judged`;
    }
    if (!s.what.trim()) return "a stumble says what happened, in one sentence";
  }
  for (const w of walkers.keys()) {
    const ends = outcomes.filter((o) => o.walker === w);
    if (ends.length !== 1) return ends.length ? `${w} ends once \u2014 one --outcome each` : `every walker ends: ${w} has no --outcome (made it, stumbled or gave up)`;
  }
  for (const o of outcomes) {
    if (!walkers.has(o.walker)) return `${o.walker} did not walk this \u2014 the walkers are ${[...walkers.keys()].join(", ")}`;
    if (!WALK_OUTCOMES.includes(o.outcome)) return `an outcome is made it, stumbled or gave up \u2014 not "${o.outcome}"`;
    const pinned = stumbles.some((s) => s.walker === o.walker);
    if (o.outcome === "made it" && pinned) return `${o.walker} stumbled \u2014 say stumbled (or gave up), not made it`;
    if (o.outcome !== "made it" && !pinned) return `${o.walker} ${o.outcome} with no stumble pinned \u2014 pin where it happened, or say made it`;
  }
  const both = walkShared(stumbles);
  if (shared && !both.some((b) => b.itemId === shared.itemId)) return "a shared finding is a screen two or more walkers stumbled on \u2014 this one is not";
  if (!shared && both.length) return `${listOf(both[0].walkers)} all stumbled on one screen (${both[0].itemId}) \u2014 name the shared problem with --shared "<screen> | \u2026" and propose one fix`;
  if (shared && !fix) return 'the shared finding comes with one fix: --fix <file> --why "\u2026", a proposal beneath that screen';
  if (fix && !shared) return 'the fix answers the shared finding \u2014 name it with --shared "<screen> | \u2026"';
  return null;
}
function walkLanes(walkers, screens, stumbles, record) {
  return walkers.map((walker) => {
    const findings = walkFindings(walker, screens);
    return {
      walker,
      outcome: record?.outcomes.find((o) => o.walker === walker.id) ?? null,
      screens: screens.map((s) => ({
        itemId: s.itemId,
        title: s.title,
        findings: findings.filter((f) => f.itemId === s.itemId),
        stumbles: stumbles.filter((x) => x.walker === walker.id && x.itemId === s.itemId),
        notes: walkNotes(walker, s)
      }))
    };
  });
}

// packages/cli/src/walk.ts
async function leadFor(ctx, canvas, snapshot) {
  const [answering, sessions] = await Promise.all([ctx.client.rcAnswering(canvas.id).catch(() => null), ctx.client.listSessions(canvas.id).catch(() => [])]);
  const seen = { answering, sessions, ...snapshot.joined ? { joined: snapshot.joined } : {} };
  const lead = nightLead(snapshot.canvas, canvas.properties ?? {}, seen);
  return { lead: lead.agent?.actor ?? null, cannot: critiqueCannot(lead, ctx.actor.id, seen) ?? (lead.agent ? null : "no lead") };
}
var split = (raw, n, shape) => {
  const parts = raw.split("|").map((s) => s.trim());
  if (parts.length < n || parts.slice(0, n).some((p) => !p)) throw new Error(`write ${shape} \u2014 not "${raw}"`);
  return [...parts.slice(0, n - 1), parts.slice(n - 1).join(" | ")];
};
async function walk(ctx, deps, ref, opts) {
  const { canvas: p, snapshot } = await deps.canvasAndSnapshot(ctx);
  const canvas = snapshot.canvas;
  const read = async (hash) => (await ctx.client.downloadBlob(p.id, hash)).toString("utf8");
  const asks = walkAsks(canvas);
  const answering = (opts.stumble?.length ?? 0) > 0 || (opts.outcome?.length ?? 0) > 0 || opts.shared !== void 0 || opts.fix !== void 0;
  if (answering && (opts.task !== void 0 || (opts.as?.length ?? 0) > 0)) throw new Error("one act at a time: the person's --task (and --as), or the lead's --stumble / --outcome / --shared");
  const screensOf = async (ask) => (await Promise.all(ask.screens.map(async (s) => {
    const item2 = canvas.items[s.itemId];
    const v = item2?.versions.find((x) => x.id === s.versionId);
    return item2 && v ? [walkScreen(item2, v.id, await read(v.blobHash))] : [];
  }))).flat();
  const askNamed = ref ? asks.find((a) => a.id === ref) : void 0;
  if (answering) {
    const ask = askNamed ?? (ref ? void 0 : [...asks].reverse().find((a) => !walkRecordOf(canvas, a.id)));
    if (!ask) throw new Error(ref ? `no walk ${ref} here \u2014 \`isocan walk\` shows the newest` : "no walk is waiting for an answer here");
    await answer(ctx, deps, p.id, snapshot, ask, await screensOf(ask), opts);
    return;
  }
  if (!ref || askNamed) {
    const ask = askNamed ?? asks.at(-1);
    if (!ask) {
      if (ctx.json) return deps.printJson({ walk: null, notice: WALK_NOTICE });
      console.log('No walk has been asked here yet: `isocan walk <flow|screen> --task "\u2026" --as one-handed --as low-vision`.');
      return;
    }
    const screens2 = await screensOf(ask);
    const stumbles = walkStumbles(canvas, ask.id);
    const record = walkRecordOf(canvas, ask.id);
    const waits2 = record ? null : await leadFor(ctx, p, snapshot).then(({ lead, cannot }) => cannot || !lead ? `The walk waits: ${cannot ?? "no lead"}.` : `Asked ${lead.name} \u2014 its pins and outcomes have not come yet.`);
    return show(ctx, deps, { ask, task: ask.task, via: null, unreached: [], screens: screens2, walkers: ask.walkers, stumbles, record, waits: waits2, asked: null });
  }
  const item = deps.resolveItem(snapshot, ref);
  const current = item.versions.find((v) => v.id === item.currentVersionId);
  const html = current?.mimeType === "text/html" ? await read(current.blobHash) : null;
  const flow = walkFlow(canvas, item.id, html);
  if ("refused" in flow) throw new Error(flow.refused);
  const walkers = [];
  for (const spec of (opts.as?.length ? opts.as : [...DEFAULT_WALKERS]).flatMap((s) => s.includes(":") ? [s] : s.split(","))) {
    const w = walkerOf(spec);
    if ("refused" in w) throw new Error(w.refused);
    if (!walkers.some((x) => x.id === w.id)) walkers.push(w);
  }
  if (walkers.length > WALKERS_MAX) throw new Error(`at most ${WALKERS_MAX} walkers on one walk \u2014 more is a survey, not a walk`);
  const screens = await Promise.all(flow.screens.map(async (id) => {
    const it = canvas.items[id];
    const v = it.versions.find((x) => x.id === it.currentVersionId);
    return walkScreen(it, v.id, id === item.id && html !== null ? html : await read(v.blobHash));
  }));
  let asked = null;
  let waits = null;
  if (opts.task !== void 0) {
    const task = opts.task.replace(/\s+/g, " ").trim();
    if (!task) throw new Error('--task says what they are trying to do: "order a loaf for Saturday"');
    const { lead, cannot } = await leadFor(ctx, p, snapshot);
    if (cannot || !lead) waits = `The walk waits: ${cannot ?? "no lead"}. Nothing was asked; the lanes above are measured, and nobody has walked them.`;
    else {
      const findings = walkers.flatMap((w) => walkFindings(w, screens));
      const posted = await sayInChat(ctx, deps, p.id, snapshot, walkAskBody(lead, task, screens, walkers, findings), { items: screens.map((s) => s.itemId) });
      asked = posted.commentId;
      waits = `Asked ${lead.name} to walk it (${posted.commentId}) \u2014 stumbles land as pins on the screens, an outcome for each walker, and one fix where several stumble.`;
    }
  }
  return show(ctx, deps, { ask: null, task: opts.task ?? null, via: flow.via, unreached: flow.unreached, screens, walkers, stumbles: [], record: null, waits, asked });
}
async function answer(ctx, deps, canvasId, snapshot, ask, screens, opts) {
  const canvas = snapshot.canvas;
  if (walkRecordOf(canvas, ask.id)) throw new Error(`this walk was already answered \u2014 \`isocan walk ${ask.id}\` shows it`);
  const screenOf = (raw) => {
    const want = raw.replace(/^#/, "").trim().toLowerCase();
    const hit = screens.find((s) => s.itemId.toLowerCase() === want || s.title.toLowerCase() === want);
    if (!hit) throw new Error(`"${raw}" is not a screen this walk met \u2014 ${screens.map((s) => `\u201C${s.title}\u201D`).join(", ")}`);
    return hit;
  };
  const walkerId = (raw) => {
    const w = walkerOf(raw);
    return "refused" in w ? raw.trim() : w.id;
  };
  const stumbles = (opts.stumble ?? []).map((raw) => {
    const [w, s, f, what] = split(raw, 4, '"<walker> | <screen> | <measured id, or judged> | <what happened>"');
    const finding = f.toLowerCase() === "judged" ? "judged" : f.replace(/^measured\s*/i, "");
    return { walk: ask.id, walker: walkerId(w), itemId: screenOf(s).itemId, finding, what };
  });
  const outcomes = (opts.outcome ?? []).map((raw) => {
    const [w, o, line] = split(raw, 3, `"<walker> | ${WALK_OUTCOMES.join("|")} | <one line>"`);
    return { walker: walkerId(w), outcome: o.toLowerCase(), line };
  });
  const shared = opts.shared !== void 0 ? (() => {
    const [s, sentence] = split(opts.shared, 2, '"<screen> | <the problem, in design words>"');
    return { itemId: screenOf(s).itemId, sentence };
  })() : null;
  const findings = ask.walkers.flatMap((w) => walkFindings(w, screens));
  const refused = walkRecordRefusal(ask, findings, stumbles, outcomes, shared, opts.fix !== void 0);
  if (refused) throw new Error(refused);
  if (opts.fix !== void 0 && !opts.why?.trim()) throw new Error('the fix says why, in design words: --why "\u2026" (two sentences at most)');
  const fix = shared && opts.fix ? await propose(ctx, deps, shared.itemId, opts.fix, { cites: [`walk:${ask.id}`], why: opts.why, ...opts.hunch ? { hunch: true } : {} }, true) : void 0;
  const pins = [];
  const spare = /* @__PURE__ */ new Map();
  for (const s of stumbles) {
    const screen = screens.find((x) => x.itemId === s.itemId);
    const item = canvas.items[s.itemId];
    const f = findings.find((x) => x.walker === s.walker && x.itemId === s.itemId && x.id === s.finding);
    const vp = screen.read.viewport;
    const n = spare.get(s.itemId) ?? 0;
    const at = f?.at ? { x: Math.min(1, Math.max(0, (f.at.x + f.at.width / 2) / vp.width)), y: Math.min(1, Math.max(0, (f.at.y + f.at.height / 2) / vp.height)) } : (spare.set(s.itemId, n + 1), { x: 0.94, y: Math.min(0.95, 0.08 + n * 0.08) });
    const walker = ask.walkers.find((w) => w.id === s.walker);
    const threadId = newThreadId();
    await deps.sendOp(ctx, canvasId, { type: "thread.create", threadId, ...anchorAtFraction(item, at), anchorItemId: item.id, comment: { id: newCommentId(), body: stumbleBody(walker, ask.id, s.finding, s.what), persona: walker.id } });
    pins.push(threadId);
  }
  const typed = outcomes.map((o) => ({ ...o, outcome: o.outcome }));
  const posted = await sayInChat(ctx, deps, canvasId, snapshot, walkRecordBody(ask, typed, shared, fix?.itemId ?? null), { record: true, items: screens.map((s) => s.itemId) });
  if (ctx.json) return deps.printJson({ walk: ask.id, pins, record: posted.commentId, fix: fix?.itemId ?? null, shared: walkShared(stumbles) });
  console.log(`pinned ${stumbles.length} ${stumbles.length === 1 ? "stumble" : "stumbles"} on the screens, each worn as its walker; the outcomes are in the Chat (${posted.commentId})${fix ? `; one fix, ${fix.itemId}, hangs beneath \u201C${screens.find((s) => s.itemId === shared.itemId).title}\u201D citing walk:${ask.id}` : ""}. Nothing else was touched.`);
  console.log(WALK_NOTICE);
}
function show(ctx, deps, s) {
  const lanes = walkLanes(s.walkers, s.screens, s.stumbles, s.record);
  const shared = walkShared(s.stumbles);
  const titled = new Map(s.screens.map((x) => [x.itemId, x.title]));
  if (ctx.json) {
    return deps.printJson({
      walk: s.ask?.id ?? s.asked,
      task: s.task,
      via: s.via,
      notice: WALK_NOTICE,
      screens: s.screens.map((x) => ({ itemId: x.itemId, versionId: x.versionId, title: x.title })),
      unreached: s.unreached,
      walkers: s.walkers,
      lanes: lanes.map((l) => ({ walker: l.walker.id, outcome: l.outcome, screens: l.screens })),
      shared: s.record?.shared ? { ...s.record.shared, walkers: shared.find((x) => x.itemId === s.record.shared.itemId)?.walkers ?? [] } : shared,
      fix: s.record?.fix ?? null,
      waits: s.waits,
      parameters: WALK_PARAMETERS
    });
  }
  const via = s.via === "prototype" ? "a prototype's path" : s.via === "group" ? "a group's screens in reading order" : s.via === "screen" ? "one screen" : null;
  console.log(`${s.task ? `Walk \u201C${s.task}\u201D` : "Walk"} \xB7 ${s.screens.length} ${s.screens.length === 1 ? "screen" : "screens"}${via ? `, ${via}` : ""}: ${s.screens.map((x) => x.title).join(" \u2192 ")}${s.ask ? ` (${s.ask.id}, asked by ${s.ask.by.name})` : ""}`);
  console.log(WALK_NOTICE);
  if (s.unreached.length) console.log(`No link reaches ${s.unreached.length === 1 ? "one screen" : `${s.unreached.length} screens`} from where it opens; the walk does not meet ${s.unreached.length === 1 ? "it" : "them"}.`);
  for (const lane of lanes) printLane(lane);
  if (s.record?.shared) console.log(`
Shared: \u201C${titled.get(s.record.shared.itemId) ?? s.record.shared.itemId}\u201D \u2014 ${s.record.shared.sentence}${s.record.fix ? ` \xB7 one fix: ${s.record.fix}, a proposal beneath it` : ""}`);
  else if (shared.length) console.log(`
Shared: ${shared.map((x) => `\u201C${titled.get(x.itemId)}\u201D (${x.walkers.join(", ")})`).join("; ")}`);
  if (!s.task && !s.ask) console.log('\nMeasured only \u2014 nobody was asked. `--task "\u2026"` asks the canvas\'s lead to walk it.');
  if (s.waits) console.log(`
${s.waits}`);
}
function printLane(lane) {
  const w = lane.walker;
  console.log(`
${w.name} \u2014 ${w.situation}${w.described ? "" : `; ${w.constraint}`}${lane.outcome ? `  [${lane.outcome.outcome}: ${lane.outcome.line}]` : ""}`);
  lane.screens.forEach((sc, i) => {
    const clean = !sc.findings.length && !sc.stumbles.length;
    console.log(`  ${i + 1}. ${sc.title}${clean && w.checks.length ? " \u2014 nothing measured in the way" : ""}`);
    for (const f of sc.findings) console.log(`     ${f.id} ${f.text}`);
    for (const st of sc.stumbles) console.log(`     \u2717 stumbled (${st.finding === "judged" ? "judged, not measured" : `measured ${st.finding}`}): ${st.what}`);
    for (const n of sc.notes) console.log(`     \xB7 ${n}`);
  });
}
export {
  walk
};
