import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  embeddedWire
} from "./chunk-NE45VMO5.mjs";
import {
  parse
} from "./chunk-XSMUJNBI.mjs";

// packages/core/src/copy-deck.ts
var HIDDEN = /* @__PURE__ */ new Set(["script", "style", "noscript", "template", "head", "title", "iframe", "xmp", "noembed", "noframes"]);
var BUTTON_INPUTS = /* @__PURE__ */ new Set(["submit", "button", "reset"]);
var LEAD = /^[ \t\n\r\f]*/;
var TRAIL = /[ \t\n\r\f]*$/;
var trim = (value) => value.replace(LEAD, "").replace(TRAIL, "");
var tagOf = (el) => String(el.tagName).toLowerCase();
var attr = (el, name) => el.attrs.find((a) => a.name.toLowerCase() === name)?.value;
function walkText(root, ancestors = [], out = []) {
  const asElement = root;
  const here = "tagName" in root ? [...ancestors, asElement] : ancestors;
  const template = root.content;
  if (template) walkText(template, here, out);
  for (const child of asElement.childNodes ?? []) {
    if (child.nodeName === "#text") out.push({ ordinal: out.length, node: child, ancestors: here });
    else walkText(child, here, out);
  }
  return out;
}
function walkElements(root, ancestors = [], out = []) {
  for (const child of root.childNodes ?? []) {
    if ("tagName" in child) {
      out.push({ el: child, ancestors });
      walkElements(child, [...ancestors, child], out);
    }
  }
  return out;
}
function roleOf(chain) {
  const explicit = [...chain].reverse().map((el) => attr(el, "data-copy-role")).find((v) => v !== void 0);
  if (explicit && ROLES.has(explicit)) return explicit;
  if (chain.some((el) => attr(el, "role") === "alert" || attr(el, "aria-live") === "assertive")) return "error";
  if (chain.some((el) => /^h[1-6]$/.test(tagOf(el)) || attr(el, "role") === "heading")) return "heading";
  if (chain.some((el) => tagOf(el) === "nav" || attr(el, "role") === "navigation")) return "nav";
  if (chain.some((el) => tagOf(el) === "button" || attr(el, "role") === "button")) return "button";
  if (chain.some((el) => tagOf(el) === "a" && attr(el, "href") !== void 0 || attr(el, "role") === "link")) return "link";
  if (chain.some((el) => ["label", "legend", "option", "th", "caption", "figcaption", "summary", "dt"].includes(tagOf(el)))) return "label";
  return "body";
}
var ROLES = /* @__PURE__ */ new Set(["heading", "body", "button", "link", "label", "placeholder", "alt", "error", "empty", "nav"]);
var nearestWf = (chain) => [...chain].reverse().map((el) => attr(el, "data-wf")).find((v) => v !== void 0);
function attrStrings(el, chain) {
  const out = [];
  const tag = tagOf(el);
  if (attr(el, "placeholder") !== void 0) out.push({ name: "placeholder", role: "placeholder" });
  if (tag === "img" && attr(el, "alt") !== void 0) out.push({ name: "alt", role: "alt" });
  if (tag === "input" && BUTTON_INPUTS.has((attr(el, "type") ?? "").toLowerCase()) && attr(el, "value") !== void 0) {
    out.push({ name: "value", role: roleOf([...chain, el]) === "nav" ? "nav" : "button" });
  }
  if (attr(el, "aria-label") !== void 0) out.push({ name: "aria-label", role: roleOf([...chain, el]) });
  return out;
}
function encodeText(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}
function locateHtml(html) {
  const document = parse(html, { sourceCodeLocationInfo: true });
  const out = [];
  for (const { ordinal, node, ancestors } of walkText(document)) {
    if (ancestors.some((el) => HIDDEN.has(tagOf(el)))) continue;
    const loc = node.sourceCodeLocation;
    if (!loc) continue;
    const text = trim(node.value);
    if (text === "") continue;
    const raw = html.slice(loc.startOffset, loc.endOffset);
    const lead = LEAD.exec(raw)[0].length;
    const trail = TRAIL.exec(raw)[0].length;
    const wf = nearestWf(ancestors);
    out.push({
      address: `t${ordinal}`,
      role: roleOf(ancestors),
      text,
      budget: null,
      ...wf !== void 0 ? { wf } : {},
      at: loc.startOffset,
      start: loc.startOffset + lead,
      end: loc.endOffset - trail,
      encode: encodeText
    });
  }
  walkElements(document).forEach(({ el, ancestors }, ordinal) => {
    if (ancestors.some((a) => HIDDEN.has(tagOf(a))) || HIDDEN.has(tagOf(el))) return;
    const loc = el.sourceCodeLocation;
    if (!loc?.startTag) return;
    for (const { name, role } of attrStrings(el, ancestors)) {
      const value = attr(el, name);
      const text = trim(value);
      const range = loc.attrs?.[name];
      if (text === "" || !range) continue;
      const span = attrValueSpan(html, range.startOffset, range.endOffset);
      if (!span) continue;
      const lead = LEAD.exec(value)[0].length;
      const trail = TRAIL.exec(value)[0].length;
      const wf = nearestWf([...ancestors, el]);
      const rawValue = html.slice(span.start, span.end);
      const rawLead = Math.min(lead, LEAD.exec(rawValue)[0].length);
      const rawTrail = Math.min(trail, TRAIL.exec(rawValue)[0].length);
      out.push({
        address: `a${ordinal}@${name}`,
        role,
        text,
        budget: null,
        ...wf !== void 0 ? { wf } : {},
        at: loc.startTag.startOffset,
        start: span.start + rawLead,
        end: span.end - rawTrail,
        encode: span.encode
      });
    }
  });
  return out.sort((a, b) => a.at - b.at);
}
function attrValueSpan(html, start, end) {
  const raw = html.slice(start, end);
  const eq = /^[^=]*=\s*/.exec(raw);
  if (!eq) return null;
  const open = raw[eq[0].length];
  if (open === '"' || open === "'") {
    const quote = open;
    return {
      start: start + eq[0].length + 1,
      end: end - 1,
      encode: (v) => v.replace(/&/g, "&amp;").replace(quote === '"' ? /"/g : /'/g, quote === '"' ? "&quot;" : "&#39;")
    };
  }
  return {
    start: start + eq[0].length,
    end,
    encode: (v) => v.replace(/&/g, "&amp;").replace(/[\s"'=<>`]/g, (c) => `&#${c.charCodeAt(0)};`)
  };
}
function wireWordsOf(fill) {
  const out = [];
  if (!fill || typeof fill !== "object") return out;
  const f = fill;
  const str = (v) => typeof v === "string";
  for (const key of ["heading", "sub", "person"]) if (str(f[key])) out.push([key, f[key]]);
  for (const key of ["lines", "labels", "values", "groups"]) {
    const list = f[key];
    if (Array.isArray(list)) list.forEach((w, i) => str(w) && out.push([`${key}.${i}`, w]));
  }
  if (Array.isArray(f.items)) {
    f.items.forEach((it, i) => {
      for (const key of ["title", "sub", "status", "meta", "person", "text"]) if (str(it?.[key])) out.push([`items.${i}.${key}`, it[key]]);
      if (Array.isArray(it?.cells)) it.cells.forEach((w, j) => str(w) && out.push([`items.${i}.cells.${j}`, w]));
    });
  }
  if (Array.isArray(f.stats)) {
    f.stats.forEach((s, i) => {
      if (str(s?.label)) out.push([`stats.${i}.label`, s.label]);
      if (str(s?.value)) out.push([`stats.${i}.value`, s.value]);
      if (str(s?.delta)) out.push([`stats.${i}.delta`, s.delta]);
    });
  }
  if (f.actions && typeof f.actions === "object") {
    for (const [element, w] of Object.entries(f.actions)) if (str(w)) out.push([`actions.${element}`, w]);
  }
  return out;
}
var NAV_BLOCKS = /* @__PURE__ */ new Set(["tab-bar", "side-nav", "navbar", "tabs", "segmented-control", "page-indicator"]);
function wireRole(block, region, path) {
  if (path.startsWith("actions.")) return region === "nav" || NAV_BLOCKS.has(block) ? "nav" : "button";
  if (block === "error-state") return "error";
  if (block === "empty-state") return "empty";
  if (region === "nav" || NAV_BLOCKS.has(block)) return "nav";
  if (path === "heading") return "heading";
  if (path.startsWith("labels.")) return block === "search-field" ? "placeholder" : "label";
  return "body";
}
function wireSections(html) {
  const out = /* @__PURE__ */ new Map();
  const document = parse(html, { sourceCodeLocationInfo: true });
  for (const { el } of walkElements(document)) {
    const sec = attr(el, "data-sec");
    if (sec !== void 0 && !out.has(sec)) out.set(sec, { at: el.sourceCodeLocation?.startOffset ?? Number.MAX_SAFE_INTEGER, region: attr(el, "data-region") ?? sec.split(".")[0] });
  }
  return out;
}
function wireDeck(html, spec) {
  if (!spec.content) return { kind: "wire", strings: [], unfleshed: true };
  const strings = [];
  strings.push({ address: "title", role: "heading", text: spec.content.title ?? spec.title ?? "", budget: null });
  if (spec.content.bar !== void 0) strings.push({ address: "bar", role: "heading", text: spec.content.bar, budget: null, wf: "header" });
  const sections = wireSections(html);
  const slots = [...spec.slots ?? []].filter((s) => s.block && s.fill).map((s, i) => ({ s, i, at: sections.get(s.slot)?.at ?? Number.MAX_SAFE_INTEGER })).sort((a, b) => a.at - b.at || a.i - b.i);
  for (const { s } of slots) {
    const region = sections.get(s.slot)?.region ?? s.slot.split(".")[0];
    for (const [path, text] of wireWordsOf(s.fill)) {
      strings.push({
        address: `${s.slot}/${path}`,
        role: wireRole(s.block, region, path),
        text,
        budget: null,
        wf: path.startsWith("actions.") ? `${s.slot}.${path.slice("actions.".length)}` : s.slot
      });
    }
  }
  return { kind: "wire", strings };
}
function copyDeck(html) {
  const spec = embeddedWire(html);
  if (spec) return wireDeck(html, spec);
  return { kind: "html", strings: locateHtml(html).map(({ address, role, text, budget, wf }) => ({ address, role, text, budget, ...wf !== void 0 ? { wf } : {} })) };
}
var show = (s) => JSON.stringify(s.length > 40 ? `${s.slice(0, 39)}\u2026` : s);
function checkCopyEdits(deck, edits) {
  const byAddress = new Map(deck.strings.map((s) => [s.address, s]));
  const seen = /* @__PURE__ */ new Set();
  const real = [];
  for (const edit of edits) {
    if (seen.has(edit.address)) return { ok: false, reason: `${edit.address} is edited twice \u2014 say it once` };
    seen.add(edit.address);
    const now = byAddress.get(edit.address);
    if (!now) {
      return { ok: false, reason: `no string at ${edit.address} any more (it read ${show(edit.text)}) \u2014 the screen changed since the deck was read; read it again` };
    }
    if (now.text !== trim(edit.text)) {
      return { ok: false, reason: `${edit.address} (${now.role}) read ${show(edit.text)} but now says ${show(now.text)} \u2014 the screen changed since the deck was read; read it again` };
    }
    if (typeof edit.to !== "string") return { ok: false, reason: `${edit.address}: "to" must be a string` };
    if (deck.kind === "wire" && edit.address === "title" && trim(edit.to) === "") return { ok: false, reason: "title must not be empty" };
    if (trim(edit.to) !== now.text) real.push(edit);
  }
  return { ok: true, edits: real };
}
function applyCopyDeck(html, edits) {
  if (embeddedWire(html)) {
    return { ok: false, reason: "this is a wireframe: its words live in its spec, and the wireframe module writes them (`isocan copy <screen> --apply` routes there)" };
  }
  const located = locateHtml(html);
  const deck = { kind: "html", strings: located };
  const checked = checkCopyEdits(deck, edits);
  if (!checked.ok) return checked;
  if (checked.edits.length === 0) return { ok: false, reason: "nothing changed" };
  const by = new Map(located.map((l) => [l.address, l]));
  const splices = checked.edits.map((e) => {
    const l = by.get(e.address);
    return { start: l.start, end: l.end, text: l.encode(trim(e.to)) };
  });
  let out = html;
  for (const s of splices.sort((a, b) => b.start - a.start)) out = out.slice(0, s.start) + s.text + out.slice(s.end);
  return { ok: true, html: out, changed: checked.edits.map((e) => e.address) };
}
function wireCopyFile(html, edits) {
  const deck = copyDeck(html);
  if (deck.kind !== "wire") return { ok: false, reason: "not a wireframe" };
  if (deck.unfleshed) return { ok: false, reason: "this wireframe draws bars \u2014 `isocan wire flesh <screen>` fills it first" };
  const checked = checkCopyEdits(deck, edits);
  if (!checked.ok) return checked;
  if (checked.edits.length === 0) return { ok: false, reason: "nothing changed" };
  const file = { slots: {} };
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
function parseCopyEdits(raw) {
  const list = Array.isArray(raw) ? raw : raw && typeof raw === "object" && Array.isArray(raw.strings) ? raw.strings : null;
  if (!list) throw new Error('a copy deck is { "strings": [{ "address", "text", "to" }] } \u2014 `isocan copy <item> --json` prints one to edit');
  const out = [];
  list.forEach((entry, i) => {
    if (!entry || typeof entry !== "object") throw new Error(`string ${i + 1} is not an object`);
    const e = entry;
    if (e.to === void 0) return;
    if (typeof e.address !== "string") throw new Error(`string ${i + 1} has no "address"`);
    if (typeof e.text !== "string") throw new Error(`${e.address} has no "text" \u2014 it is the check that the screen has not moved; keep it as the deck printed it`);
    if (typeof e.to !== "string") throw new Error(`${e.address}: "to" must be a string`);
    out.push({ address: e.address, text: e.text, to: e.to });
  });
  return out;
}

export {
  copyDeck,
  checkCopyEdits,
  applyCopyDeck,
  wireCopyFile,
  parseCopyEdits
};
