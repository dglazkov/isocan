import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  parse
} from "./chunk-XSMUJNBI.mjs";
import {
  parentOf
} from "./chunk-GUY4UN4O.mjs";

// packages/core/src/diff.ts
var bareMime = (mime) => mime.split(";")[0].trim().toLowerCase();
function isTextualMime(mimeType) {
  const mime = bareMime(mimeType);
  return mime.startsWith("text/") || mime === "image/svg+xml" || /^application\/(json|xml|javascript|x-yaml|yaml|toml)$/.test(mime) || mime.endsWith("+json") || mime.endsWith("+xml");
}
function kindOf(side) {
  const mime = bareMime(side.mimeType);
  if (mime === "text/html") {
    if (side.text === void 0) return "html";
    return embeddedWire(side.text) ? "wire" : "html";
  }
  if (isTextualMime(mime)) return "text";
  if (mime.startsWith("image/")) return "image";
  return "binary";
}
function versionLabel(item, versionId) {
  const index = item.versions.findIndex((v) => v.id === versionId);
  return index < 0 ? versionId : `v${index + 1}`;
}
function versionRef(item, ref) {
  const exact = item.versions.find((v) => v.id === ref);
  if (exact) return exact;
  const numbered = /^v?(\d+)$/i.exec(ref.trim());
  if (numbered) return item.versions[Number(numbered[1]) - 1] ?? null;
  const prefixed = item.versions.filter((v) => v.id.startsWith(ref));
  return prefixed.length === 1 ? prefixed[0] : null;
}
function defaultVersionPair(item) {
  if (item.versions.length < 2) {
    return { refused: `"${item.title || item.id}" has one version \u2014 there is nothing to compare it with yet` };
  }
  const current = Math.max(0, item.versions.findIndex((v) => v.id === item.currentVersionId));
  return current === 0 ? { from: item.versions[0], to: item.versions[1] } : { from: item.versions[current - 1], to: item.versions[current] };
}
function sourcePair(items, item) {
  const parentId = parentOf(item);
  if (parentId === null) return { refused: `"${item.title}" was not made from anything \u2014 there is no source to compare it with` };
  const source = items[parentId];
  if (!source) return { refused: `"${item.title}" was made from an item that is no longer on the canvas` };
  const from = source.versions.find((v) => v.id === source.currentVersionId) ?? source.versions[0];
  const to = item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0];
  if (!from || !to) return { refused: `"${item.title}" has no content to compare` };
  return { source, from, to };
}
function diffVersions(before, after) {
  const kinds = [kindOf(before), kindOf(after)];
  const same = before.blobHash !== void 0 && before.blobHash === after.blobHash;
  const kind = kinds[0] === kinds[1] ? kinds[0] : kinds.every((k) => k === "wire" || k === "html") ? "html" : kinds.includes("binary") || kinds.includes("image") ? "binary" : "text";
  if (kind === "image" || kind === "binary" || before.text === void 0 || after.text === void 0) {
    return finish(kind === "image" ? "image" : kind === "binary" ? "binary" : kind, "field", metadataChanges(before, after, same), void 0, metadataNote(kind));
  }
  if (!same && before.text === after.text) {
    return finish(kind, unitOf(kind), metadataChanges(before, after, true));
  }
  if (kind === "text") {
    const { changes, rows, counts } = diffText(before.text, after.text);
    return finish("text", "line", changes, rows, void 0, counts);
  }
  if (kind === "wire") {
    const wire = diffWire(before.text, after.text);
    if (wire) return finish("wire", "block", wire);
  }
  return finish("html", "element", diffHtml(before.text, after.text));
}
function unitOf(kind) {
  return kind === "text" ? "line" : kind === "wire" ? "block" : kind === "html" ? "element" : "field";
}
function metadataNote(kind) {
  if (kind === "image") return "images are compared by their metadata only \u2014 the pictures are shown side by side, not diffed pixel by pixel";
  if (kind === "binary") return "this kind of file is compared by its metadata only";
  return void 0;
}
function metadataChanges(before, after, sameBytes) {
  const out = [];
  const spot = { path: "file" };
  if (before.filename !== after.filename) out.push({ op: "changed", what: `renamed \u201C${before.filename}\u201D \u2192 \u201C${after.filename}\u201D`, before: spot, after: spot });
  if (bareMime(before.mimeType) !== bareMime(after.mimeType)) out.push({ op: "changed", what: `type ${bareMime(before.mimeType)} \u2192 ${bareMime(after.mimeType)}`, before: spot, after: spot });
  if (!sameBytes) {
    const sizes = before.size === after.size ? `same size (${bytes(after.size)})` : `${bytes(before.size)} \u2192 ${bytes(after.size)}`;
    out.push({ op: "changed", what: `different bytes, ${sizes}`, before: spot, after: spot });
  }
  return out;
}
function bytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
function finish(kind, unit, drafts, rows, note, unitCounts) {
  const changes = drafts.map((d, i) => ({ step: i + 1, ...d }));
  if (rows) {
    for (const row of rows) if (row.step !== void 0) row.step += 1;
  }
  const counts = unitCounts ?? { added: 0, removed: 0, changed: 0, moved: 0 };
  if (!unitCounts) for (const c of changes) counts[c.op] += 1;
  const identical = changes.length === 0;
  const diff = { kind, unit, identical, summary: "", counts, changes };
  if (rows) diff.rows = rows;
  if (note) diff.note = note;
  diff.summary = summarize(diff);
  return diff;
}
function summarize(diff) {
  if (diff.identical) return "no difference \u2014 the two versions have the same content";
  const plural = (n) => `${n} ${diff.unit}${n === 1 ? "" : "s"}`;
  const parts = [];
  const ops = ["added", "removed", "changed", "moved"];
  for (const op of ops) {
    const n = diff.counts[op];
    if (n > 0) parts.push(parts.length === 0 ? `${plural(n)} ${op}` : `${n} ${op}`);
  }
  const lead = parts.join(", ");
  const first = diff.changes.slice(0, 2).map((c) => c.what);
  const more = diff.changes.length > 2 ? `, and ${diff.changes.length - 2} more` : "";
  return `${lead}: ${first.join("; ")}${more}`;
}
var SYMBOL = { added: "+", removed: "-", changed: "~", moved: "\u2195" };
function diffReport(diff, heading) {
  const lines = [heading, diff.summary];
  if (diff.note) lines.push(`(${diff.note})`);
  for (const c of diff.changes) {
    const where = c.after?.path ?? c.before?.path;
    const at = where && where !== "file" && diff.kind !== "text" ? `  [${where}]` : "";
    lines.push(`  ${String(c.step).padStart(2)}. ${SYMBOL[c.op]} ${c.what}${at}`);
  }
  return lines.join("\n");
}
function lcsPairs(a, b, eq, cap = 4e6) {
  let head = 0;
  while (head < a.length && head < b.length && eq(a[head], b[head])) head += 1;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && eq(a[a.length - 1 - tail], b[b.length - 1 - tail])) tail += 1;
  const pairs = [];
  for (let i = 0; i < head; i++) pairs.push([i, i]);
  const n = a.length - head - tail;
  const m = b.length - head - tail;
  if (n > 0 && m > 0 && n * m <= cap) {
    const width = m + 1;
    const table = new Uint32Array((n + 1) * width);
    for (let i2 = n - 1; i2 >= 0; i2--) {
      for (let j2 = m - 1; j2 >= 0; j2--) {
        table[i2 * width + j2] = eq(a[head + i2], b[head + j2]) ? table[(i2 + 1) * width + j2 + 1] + 1 : Math.max(table[(i2 + 1) * width + j2], table[i2 * width + j2 + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (eq(a[head + i], b[head + j])) {
        pairs.push([head + i, head + j]);
        i += 1;
        j += 1;
      } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) i += 1;
      else j += 1;
    }
  }
  for (let k = tail; k > 0; k--) pairs.push([a.length - k, b.length - k]);
  return pairs;
}
function alignWeighted(a, b, score, cap = 25e4) {
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0) return [];
  if (n * m > cap) return lcsPairs(a, b, (x, y) => score(x, y) >= 3);
  const width = m + 1;
  const best = new Float64Array((n + 1) * width);
  const scores = new Float64Array(n * m);
  for (let i2 = 0; i2 < n; i2++) for (let j2 = 0; j2 < m; j2++) scores[i2 * m + j2] = score(a[i2], b[j2]);
  for (let i2 = n - 1; i2 >= 0; i2--) {
    for (let j2 = m - 1; j2 >= 0; j2--) {
      const s = scores[i2 * m + j2];
      const take = s > 0 ? s + best[(i2 + 1) * width + j2 + 1] : -1;
      best[i2 * width + j2] = Math.max(take, best[(i2 + 1) * width + j2], best[i2 * width + j2 + 1]);
    }
  }
  const pairs = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    const s = scores[i * m + j];
    if (s > 0 && best[i * width + j] === s + best[(i + 1) * width + j + 1]) {
      pairs.push([i, j]);
      i += 1;
      j += 1;
    } else if (best[(i + 1) * width + j] >= best[i * width + j + 1]) i += 1;
    else j += 1;
  }
  return pairs;
}
function gaps(aLength, bLength, pairs) {
  const out = [];
  let ai = 0;
  let bi = 0;
  for (const pair of [...pairs, [aLength, bLength]]) {
    if (pair[0] > ai || pair[1] > bi) out.push({ a: [ai, pair[0]], b: [bi, pair[1]] });
    ai = pair[0] + 1;
    bi = pair[1] + 1;
  }
  return out;
}
var clip = (text, max = 48) => {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}\u2026` : flat;
};
function words(line) {
  return line.match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu) ?? [];
}
function wordDiff(before, after) {
  const a = words(before);
  const b = words(after);
  const pairs = lcsPairs(a, b, (x, y) => x === y);
  const mark = (tokens2, kept) => {
    const parts = [];
    tokens2.forEach((text, i) => {
      const changed = !kept.has(i) && text.trim() !== "";
      const last = parts[parts.length - 1];
      if (last && (last.changed === changed || text.trim() === "")) last.text += text;
      else parts.push({ text, changed });
    });
    return parts;
  };
  return { before: mark(a, new Set(pairs.map((p) => p[0]))), after: mark(b, new Set(pairs.map((p) => p[1]))) };
}
var changedWords = (parts) => parts.filter((p) => p.changed).map((p) => p.text).join(" ").replace(/\s+/g, " ").trim();
function lineName(line, number) {
  const heading = /^#{1,6}\s+(.*)$/.exec(line.trim());
  return heading ? `the heading \u201C${clip(heading[1], 40)}\u201D` : `line ${number}`;
}
function diffText(before, after) {
  const a = before.split(/\r?\n/);
  const b = after.split(/\r?\n/);
  const pairs = lcsPairs(a, b, (x, y) => x === y);
  const rows = [];
  const changes = [];
  const counts = { added: 0, removed: 0, changed: 0, moved: 0 };
  let cursor = [0, 0];
  const same = (i, j) => rows.push({ op: "same", before: a[i], after: b[j], beforeLine: i + 1, afterLine: j + 1 });
  for (const gap of gaps(a.length, b.length, pairs)) {
    for (let i = cursor[0], j = cursor[1]; i < gap.a[0]; i++, j++) same(i, j);
    const removedLines = a.slice(gap.a[0], gap.a[1]);
    const addedLines = b.slice(gap.b[0], gap.b[1]);
    const alike = alignWeighted(removedLines, addedLines, (x, y) => {
      const s = jaccard(tokens(x), tokens(y));
      return s >= 0.34 || removedLines.length === 1 && addedLines.length === 1 ? 1 + s : 0;
    });
    const stretch = [];
    let ri = 0;
    let aj = 0;
    const loose = (rEnd, aEnd) => {
      for (; ri < rEnd; ri++) stretch.push({ op: "removed", before: removedLines[ri], beforeLine: gap.a[0] + ri + 1 });
      for (; aj < aEnd; aj++) stretch.push({ op: "added", after: addedLines[aj], afterLine: gap.b[0] + aj + 1 });
    };
    for (const [i, j] of alike) {
      loose(i, j);
      stretch.push({ op: "changed", before: removedLines[i], after: addedLines[j], beforeLine: gap.a[0] + i + 1, afterLine: gap.b[0] + j + 1, words: wordDiff(removedLines[i], addedLines[j]) });
      ri = i + 1;
      aj = j + 1;
    }
    loose(removedLines.length, addedLines.length);
    for (let k = 0; k < stretch.length; ) {
      let end = k;
      while (end + 1 < stretch.length && stretch[end + 1].op === stretch[k].op) end += 1;
      const run = stretch.slice(k, end + 1);
      const step = changes.length;
      for (const row of run) {
        row.step = step;
        rows.push(row);
      }
      const first = run[0];
      const op = first.op;
      counts[op] += run.length;
      const beforeSpot = first.beforeLine !== void 0 ? { path: `line ${first.beforeLine}`, line: first.beforeLine } : void 0;
      const afterSpot = first.afterLine !== void 0 ? { path: `line ${first.afterLine}`, line: first.afterLine } : void 0;
      if (op === "added") {
        changes.push({
          op,
          what: run.length === 1 ? `added ${lineName(first.after, first.afterLine)}: \u201C${clip(first.after)}\u201D` : `added ${run.length} lines at line ${first.afterLine}, starting \u201C${clip(first.after)}\u201D`,
          ...afterSpot ? { after: afterSpot } : {}
        });
      } else if (op === "removed") {
        changes.push({
          op,
          what: run.length === 1 ? `removed ${lineName(first.before, first.beforeLine)}: \u201C${clip(first.before)}\u201D` : `removed ${run.length} lines at line ${first.beforeLine}, starting \u201C${clip(first.before)}\u201D`,
          ...beforeSpot ? { before: beforeSpot } : {}
        });
      } else {
        let what;
        if (run.length === 1) {
          const was = changedWords(first.words.before);
          const now = changedWords(first.words.after);
          const detail = was && now ? `\u201C${clip(was, 40)}\u201D \u2192 \u201C${clip(now, 40)}\u201D` : now ? `added \u201C${clip(now, 40)}\u201D` : `dropped \u201C${clip(was, 40)}\u201D`;
          what = `${lineName(first.before, first.afterLine)}: ${detail}`;
        } else what = `${run.length} lines changed from line ${first.afterLine}, starting \u201C${clip(first.after)}\u201D`;
        changes.push({ op, what, ...beforeSpot ? { before: beforeSpot } : {}, ...afterSpot ? { after: afterSpot } : {} });
      }
      k = end + 1;
    }
    cursor = [gap.a[1], gap.b[1]];
  }
  for (let i = cursor[0], j = cursor[1]; i < a.length && j < b.length; i++, j++) same(i, j);
  return { changes, rows, counts };
}
function fnv(text, seed = 2166136261) {
  let h = seed;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}
var RAW = /* @__PURE__ */ new Set(["script", "style", "textarea", "pre", "title"]);
function insertAt(source, el) {
  const tag = el.sourceCodeLocation?.startTag;
  if (!tag) return void 0;
  const end = tag.endOffset;
  return source[end - 2] === "/" ? end - 2 : end - 1;
}
function buildTree(source) {
  const doc = parse(source, { sourceCodeLocationInfo: true });
  const html = doc.childNodes.find((n) => n.nodeName === "html");
  if (!html) return null;
  const build = (el, path) => {
    const children = [];
    const counts = /* @__PURE__ */ new Map();
    const raw = RAW.has(el.tagName);
    for (const child of el.childNodes) {
      if (child.nodeName === "#text") {
        const value = child.value;
        const text2 = raw ? value.trim() : value.replace(/\s+/g, " ").trim();
        if (!text2) continue;
        children.push({ tag: "#text", attrs: {}, text: text2, children: [], path: `${path}/text()`, hash: fnv(`#${text2}`) });
      } else if ("tagName" in child) {
        const tag = child.tagName;
        const n = (counts.get(tag) ?? 0) + 1;
        counts.set(tag, n);
        children.push(build(child, `${path}/${tag}[${n}]`));
      }
    }
    const attrs = {};
    for (const attr of el.attrs) attrs[attr.name] = attr.value;
    const text = children.map((c) => c.text).join(" ").trim();
    const own = `<${el.tagName} ${Object.keys(attrs).sort().map((k) => `${k}=${attrs[k]}`).join(" ")}>`;
    let hash = fnv(own);
    for (const c of children) hash = fnv(String(c.hash), hash);
    const at = insertAt(source, el);
    return { tag: el.tagName, attrs, text, children, path, hash, ...at !== void 0 ? { at } : {} };
  };
  return build(html, "html");
}
function tokens(text) {
  return new Set(text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
}
function jaccard(a, b) {
  if (a.size === 0 && b.size === 0) return 1;
  let both = 0;
  for (const t of a) if (b.has(t)) both += 1;
  return both / (a.size + b.size - both);
}
function attrTokens(node) {
  return new Set(Object.entries(node.attrs).flatMap(([k, v]) => [k, ...v.split(/\s+/).map((t) => `${k}=${t}`)]));
}
function pairScore(a, b) {
  if (a.tag !== b.tag) return 0;
  if (a.hash === b.hash) return 3;
  if (a.tag === "#text") return 1 + jaccard(tokens(a.text), tokens(b.text));
  if (a.attrs.id && a.attrs.id === b.attrs.id) return 2.5;
  return 1 + 0.5 * jaccard(tokens(a.text), tokens(b.text)) + 0.5 * jaccard(attrTokens(a), attrTokens(b));
}
var TAG_WORDS = {
  h1: "heading",
  h2: "heading",
  h3: "heading",
  h4: "heading",
  h5: "heading",
  h6: "heading",
  p: "paragraph",
  a: "link",
  button: "button",
  img: "image",
  ul: "list",
  ol: "list",
  li: "list item",
  nav: "nav",
  header: "header",
  footer: "footer",
  section: "section",
  article: "article",
  main: "main area",
  aside: "sidebar",
  form: "form",
  input: "field",
  textarea: "text box",
  select: "menu",
  label: "label",
  table: "table",
  tr: "row",
  td: "cell",
  th: "header cell",
  div: "block",
  span: "span",
  figure: "figure",
  svg: "graphic",
  video: "video",
  strong: "bold text",
  em: "emphasis",
  body: "page body",
  title: "page title"
};
function describe(node, article) {
  const word = TAG_WORDS[node.tag] ?? `<${node.tag}>`;
  const text = clip(node.text, 28);
  if (node.tag === "img" && node.attrs.alt) return `${article} image \u201C${clip(node.attrs.alt, 28)}\u201D`;
  if (text && node.tag !== "html" && node.tag !== "body") return `${article} \u201C${text}\u201D ${word}`;
  if (node.attrs.id) return `${article} ${word} #${node.attrs.id}`;
  const cls = node.attrs.class?.split(/\s+/).filter(Boolean)[0];
  if (cls) return `${article} ${word} (.${cls})`;
  return `${article} ${word}`;
}
function styleProps(style) {
  const out = /* @__PURE__ */ new Map();
  for (const decl of splitTop(style, ";")) {
    const colon = decl.indexOf(":");
    if (colon < 0) continue;
    const prop = decl.slice(0, colon).trim().toLowerCase();
    if (prop) out.set(prop, decl.slice(colon + 1).trim());
  }
  return out;
}
function splitTop(text, sep) {
  const out = [];
  let depth = 0;
  let quote = "";
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === quote && text[i - 1] !== "\\") quote = "";
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(") depth += 1;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    else if (ch === sep && depth === 0) {
      out.push(text.slice(start, i));
      start = i + 1;
    }
  }
  out.push(text.slice(start));
  return out.map((s) => s.trim()).filter(Boolean);
}
function propPhrases(before, after) {
  const out = [];
  for (const [prop, value] of after) {
    const was = before.get(prop);
    if (was === void 0) out.push(`${prop} ${value} added`);
    else if (was !== value) out.push(`${prop} ${was} \u2192 ${value}`);
  }
  for (const [prop, value] of before) if (!after.has(prop)) out.push(`${prop} ${value} removed`);
  return out;
}
function attrPhrases(a, b) {
  const out = [];
  const names = [.../* @__PURE__ */ new Set([...Object.keys(a.attrs), ...Object.keys(b.attrs)])].sort();
  for (const name of names) {
    const was = a.attrs[name];
    const now = b.attrs[name];
    if (was === now) continue;
    if (name === "class") {
      const before = new Set((was ?? "").split(/\s+/).filter(Boolean));
      const after = new Set((now ?? "").split(/\s+/).filter(Boolean));
      const gained = [...after].filter((c) => !before.has(c));
      const lost = [...before].filter((c) => !after.has(c));
      const bits = [gained.length ? `now .${gained.join(" .")}` : "", lost.length ? `no longer .${lost.join(" .")}` : ""].filter(Boolean);
      if (bits.length) out.push(`class ${bits.join(", ")}`);
    } else if (name === "style") {
      const phrases = propPhrases(styleProps(was ?? ""), styleProps(now ?? ""));
      if (phrases.length) out.push(`style ${phrases.join(", ")}`);
    } else if (was === void 0) out.push(`${name} \u201C${clip(now, 40)}\u201D added`);
    else if (now === void 0) out.push(`${name} \u201C${clip(was, 40)}\u201D removed`);
    else out.push(`${name} \u201C${clip(was, 40)}\u201D \u2192 \u201C${clip(now, 40)}\u201D`);
  }
  return out;
}
function cssRules(css, prefix = "") {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = [];
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf("{", i);
    const semi = text.indexOf(";", i);
    if (open < 0) break;
    if (semi >= 0 && semi < open) {
      const statement = text.slice(i, semi).trim();
      if (statement) out.push({ key: prefix + statement, label: prefix + statement, selector: "", props: /* @__PURE__ */ new Map(), body: "" });
      i = semi + 1;
      continue;
    }
    let depth = 1;
    let j = open + 1;
    while (j < text.length && depth > 0) {
      if (text[j] === "{") depth += 1;
      else if (text[j] === "}") depth -= 1;
      j += 1;
    }
    const prelude = text.slice(i, open).replace(/\s+/g, " ").trim();
    const body = text.slice(open + 1, j - 1);
    if (/^@(media|supports|container|layer|document)\b/.test(prelude)) out.push(...cssRules(body, `${prefix}${prelude} `));
    else {
      const atRule = /^@/.test(prelude);
      out.push({ key: prefix + prelude, label: prefix + prelude, selector: atRule ? "" : prelude, props: atRule ? /* @__PURE__ */ new Map() : styleProps(body), body: body.replace(/\s+/g, " ").trim() });
    }
    i = j;
  }
  const seen = /* @__PURE__ */ new Map();
  for (const rule of out) {
    const n = (seen.get(rule.key) ?? 0) + 1;
    seen.set(rule.key, n);
    if (n > 1) rule.key = `${rule.key} #${n}`;
  }
  return out;
}
function cssChanges(before, after) {
  const a = cssRules(before);
  const b = cssRules(after);
  const byKey = new Map(a.map((r) => [r.key, r]));
  const out = [];
  for (const rule of b) {
    const was = byKey.get(rule.key);
    if (!was) out.push({ op: "added", what: `new rule ${clip(rule.label, 40)}`, selector: rule.selector });
    else if (was.body !== rule.body) {
      const phrases = rule.props.size || was.props.size ? propPhrases(was.props, rule.props) : [];
      out.push({ op: "changed", what: `${clip(rule.label, 40)}: ${phrases.length ? phrases.join(", ") : "changed"}`, selector: rule.selector });
    }
  }
  const kept = new Set(b.map((r) => r.key));
  for (const rule of a) if (!kept.has(rule.key)) out.push({ op: "removed", what: `rule ${clip(rule.label, 40)} removed`, selector: rule.selector });
  return out;
}
var spotOf = (node) => ({ path: node.path, ...node.at !== void 0 ? { at: node.at } : {} });
function diffHtml(before, after) {
  const a = buildTree(before);
  const b = buildTree(after);
  const out = [];
  if (!a || !b) return out;
  const walk = (x, y) => {
    if (x.hash === y.hash) return;
    const phrases = attrPhrases(x, y);
    if (x.tag === "style") {
      for (const rule of cssChanges(x.text, y.text)) {
        const sides = rule.op === "added" ? ["after"] : rule.op === "removed" ? ["before"] : ["before", "after"];
        out.push({
          op: "changed",
          what: `stylesheet \u2014 ${rule.what}`,
          before: spotOf(x),
          after: spotOf(y),
          ...rule.selector ? { selector: { selector: rule.selector, sides } } : {}
        });
      }
      if (phrases.length) out.push({ op: "changed", what: `the stylesheet: ${phrases.join("; ")}`, before: spotOf(x), after: spotOf(y) });
      return;
    }
    if (x.tag === "script") {
      if (x.text !== y.text || phrases.length) out.push({ op: "changed", what: `a script changed${x.attrs.src || y.attrs.src ? ` (${clip(y.attrs.src ?? x.attrs.src ?? "", 40)})` : ""}`, before: spotOf(x), after: spotOf(y) });
      return;
    }
    if (x.tag === "title") {
      if (x.text !== y.text) out.push({ op: "changed", what: `the page title \u201C${clip(x.text, 40)}\u201D \u2192 \u201C${clip(y.text, 40)}\u201D`, before: spotOf(x), after: spotOf(y) });
      return;
    }
    const pairs = alignWeighted(x.children, y.children, pairScore);
    const textPhrases = [];
    const inOrder = [];
    let ai = 0;
    let bi = 0;
    const between = (aEnd, bEnd) => {
      for (; ai < aEnd; ai++) {
        const c = x.children[ai];
        if (c.tag === "#text") textPhrases.push(`text \u201C${clip(c.text, 36)}\u201D removed`);
        else inOrder.push({ op: "removed", what: `removed ${describe(c, "a")}`, before: spotOf(c) });
      }
      for (; bi < bEnd; bi++) {
        const d = y.children[bi];
        if (d.tag === "#text") textPhrases.push(`text \u201C${clip(d.text, 36)}\u201D added`);
        else inOrder.push({ op: "added", what: `added ${describe(d, "a")}`, after: spotOf(d) });
      }
    };
    for (const [i, j] of pairs) {
      between(i, j);
      const c = x.children[i];
      const d = y.children[j];
      if (c.tag === "#text") {
        if (c.text !== d.text) {
          const w = wordDiff(c.text, d.text);
          const was = changedWords(w.before);
          const now = changedWords(w.after);
          textPhrases.push(was && now ? `\u201C${clip(was, 36)}\u201D \u2192 \u201C${clip(now, 36)}\u201D` : now ? `text \u201C${clip(now, 36)}\u201D added` : `text \u201C${clip(was, 36)}\u201D dropped`);
        }
      } else inOrder.push([c, d]);
      ai = i + 1;
      bi = j + 1;
    }
    between(x.children.length, y.children.length);
    const own = [...phrases, ...textPhrases];
    if (own.length) out.push({ op: "changed", what: `${describe(x, "the")}: ${own.join("; ")}`, before: spotOf(x), after: spotOf(y) });
    for (const next of inOrder) {
      if (Array.isArray(next)) walk(next[0], next[1]);
      else out.push(next);
    }
  };
  walk(a, b);
  return out;
}
var WIRE_MARKER = "<!-- isocan:wireframe -->";
var WIRE_SCRIPT = /<script type="application\/json" id="isocan-wireframe">([\s\S]*?)<\/script>/;
function embeddedWire(html) {
  if (!html.includes(WIRE_MARKER)) return null;
  const m = WIRE_SCRIPT.exec(html);
  if (!m) return null;
  try {
    const spec = JSON.parse(m[1]);
    return spec && typeof spec === "object" && Array.isArray(spec.slots) ? spec : null;
  } catch {
    return null;
  }
}
var blockWords = (block) => block === null ? "an undecided section" : block.replace(/-/g, " ");
function slotWords(slot) {
  if (slot === "fab") return "the floating button";
  const numbered = /^([a-z]+)\.(\d+)$/.exec(slot);
  if (numbered) return `${numbered[1]} section ${numbered[2]}`;
  return `the ${slot.replace(/[-_.]/g, " ")}`;
}
var show = (value) => typeof value === "string" ? `\u201C${clip(value, 32)}\u201D` : JSON.stringify(value);
function leaves(value, path = "", out = /* @__PURE__ */ new Map()) {
  if (typeof value === "string") out.set(path, value);
  else if (Array.isArray(value)) value.forEach((v, i) => leaves(v, `${path}[${i}]`, out));
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) leaves(v, path ? `${path}.${k}` : k, out);
  return out;
}
function wordsPhrases(before, after) {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (before === void 0) return ["sample words filled in"];
  if (after === void 0) return ["back to bars \u2014 its words taken out"];
  const a = leaves(before);
  const b = leaves(after);
  const out = [];
  for (const [path, value] of b) {
    const was = a.get(path);
    if (was !== void 0 && was !== value) out.push(`\u201C${clip(was, 28)}\u201D \u2192 \u201C${clip(value, 28)}\u201D`);
  }
  if (out.length === 0) return ["its words changed"];
  return out.length > 3 ? [...out.slice(0, 3), `${out.length - 3} more words changed`] : out;
}
function wireSpots(html) {
  const slots = /* @__PURE__ */ new Map();
  let frame;
  const doc = parse(html, { sourceCodeLocationInfo: true });
  const visit = (node) => {
    if ("tagName" in node) {
      const slot = node.attrs.find((a) => a.name === "data-slot")?.value;
      const at = insertAt(html, node);
      if (slot !== void 0 && at !== void 0 && !slots.has(slot)) slots.set(slot, at);
      const cls = node.attrs.find((a) => a.name === "class")?.value.split(/\s+/) ?? [];
      if (frame === void 0 && cls.includes("frame") && at !== void 0) frame = at;
    }
    if ("childNodes" in node) for (const child of node.childNodes) visit(child);
  };
  visit(doc);
  return { slots, ...frame !== void 0 ? { frame } : {} };
}
function diffWire(beforeHtml, afterHtml) {
  const a = embeddedWire(beforeHtml);
  const b = embeddedWire(afterHtml);
  if (!a || !b) return null;
  const spotsA = wireSpots(beforeHtml);
  const spotsB = wireSpots(afterHtml);
  const frameA = { path: "screen", ...spotsA.frame !== void 0 ? { at: spotsA.frame } : {} };
  const frameB = { path: "screen", ...spotsB.frame !== void 0 ? { at: spotsB.frame } : {} };
  const slotSpot = (spots, slot) => {
    const at = spots.slots.get(slot);
    return { path: slot, ...at !== void 0 ? { at } : {} };
  };
  const out = [];
  const screen = (what) => out.push({ op: "changed", what, before: frameA, after: frameB });
  if (a.archetype !== b.archetype) screen(`became a ${b.archetype} screen (was ${a.archetype})`);
  if (a.platform !== b.platform) screen(`platform ${a.platform} \u2192 ${b.platform}`);
  if (a.title !== b.title) screen(`the screen's title ${show(a.title)} \u2192 ${show(b.title)}`);
  if (JSON.stringify(a.flip) !== JSON.stringify(b.flip)) {
    screen(b.flip ? `now a variation: ${blockWords(b.flip.to)} instead of ${blockWords(b.flip.from)} in ${slotWords(b.flip.slot)}` : "no longer a variation");
  }
  if (JSON.stringify(a.style) !== JSON.stringify(b.style)) screen(b.style === void 0 ? "back to the default greys" : "the look changed \u2014 a different style is mapped onto it");
  const contentA = a.content;
  const contentB = b.content;
  if (JSON.stringify(contentA) !== JSON.stringify(contentB)) {
    if (!contentA) screen(`fleshed out with sample content${contentB?.pack ? ` (${contentB.pack})` : ""}`);
    else if (!contentB) screen("its sample content taken out \u2014 back to bars");
    else {
      if (contentA.title !== contentB.title) screen(`the heading ${show(contentA.title)} \u2192 ${show(contentB.title)}`);
      if (contentA.pack !== contentB.pack) screen(`sample content ${show(contentA.pack)} \u2192 ${show(contentB.pack)}`);
    }
  }
  const slotsA = a.slots ?? [];
  const slotsB = b.slots ?? [];
  const byA = new Map(slotsA.map((s) => [s.slot, s]));
  const byB = new Map(slotsB.map((s) => [s.slot, s]));
  const placed = [];
  const indexB = new Map(slotsB.map((s, i) => [s.slot, i]));
  let lastKept = -1;
  for (const s of slotsA) {
    const kept = indexB.get(s.slot);
    if (kept !== void 0) lastKept = kept;
    else placed.push({ order: lastKept + 0.5, draft: { op: "removed", what: `took ${blockWords(s.block)} out of ${slotWords(s.slot)}`, before: slotSpot(spotsA, s.slot) } });
  }
  for (const [index, s] of slotsB.entries()) {
    const was = byA.get(s.slot);
    if (!was) {
      placed.push({ order: index, draft: { op: "added", what: `added ${s.block === null ? "an undecided section" : `a ${blockWords(s.block)}`} in ${slotWords(s.slot)}`, after: slotSpot(spotsB, s.slot) } });
      continue;
    }
    const phrases = [];
    if (was.block !== s.block) {
      phrases.push(was.block === null ? `decided: ${blockWords(s.block)}` : s.block === null ? "back to undecided" : `${blockWords(was.block)} \u2192 ${blockWords(s.block)}`);
    } else {
      const pa = was.props ?? {};
      const pb = s.props ?? {};
      for (const key of [.../* @__PURE__ */ new Set([...Object.keys(pa), ...Object.keys(pb)])].sort()) {
        const x = pa[key];
        const y = pb[key];
        if (JSON.stringify(x) === JSON.stringify(y)) continue;
        if (typeof y === "boolean" && (typeof x === "boolean" || x === void 0)) phrases.push(`${key} ${y ? "on" : "off"}`);
        else if (x === void 0) phrases.push(`${key} ${show(y)} added`);
        else if (y === void 0) phrases.push(`${key} removed`);
        else phrases.push(`${key} ${show(x)} \u2192 ${show(y)}`);
      }
      const ia = was.intents ?? {};
      const ib = s.intents ?? {};
      for (const el of [.../* @__PURE__ */ new Set([...Object.keys(ia), ...Object.keys(ib)])].sort()) {
        const x = ia[el];
        const y = ib[el];
        const name = el.replace(/-/g, " ");
        if (x === y) continue;
        if (x === void 0) phrases.push(`${name} does ${y}`);
        else if (y === void 0) phrases.push(`${name} no longer does ${x}`);
        else phrases.push(`${name} now does ${y} (link was ${x})`);
      }
    }
    phrases.push(...wordsPhrases(was.fill, s.fill));
    if (phrases.length === 0) continue;
    const who = `${slotWords(s.slot)}${s.block ? ` (${blockWords(s.block)})` : ""}`;
    placed.push({ order: index, draft: { op: "changed", what: `${who}: ${phrases.join("; ")}`, before: slotSpot(spotsA, s.slot), after: slotSpot(spotsB, s.slot) } });
  }
  out.push(...placed.sort((p, q) => p.order - q.order).map((p) => p.draft));
  const commonA = slotsA.map((s) => s.slot).filter((s) => byB.has(s));
  const commonB = slotsB.map((s) => s.slot).filter((s) => byA.has(s));
  const stayed = new Set(lcsPairs(commonA, commonB, (x, y) => x === y).map(([i]) => commonA[i]));
  for (const slot of commonB) {
    if (!stayed.has(slot)) out.push({ op: "moved", what: `${slotWords(slot)} moved to position ${commonB.indexOf(slot) + 1}`, before: slotSpot(spotsA, slot), after: slotSpot(spotsB, slot) });
  }
  return out;
}
var HIGHLIGHT_CSS = `[data-isocan-change]{outline:3px solid var(--isocan-diff)!important;outline-offset:1px!important;box-shadow:inset 0 0 0 100vmax var(--isocan-diff-tint)!important}
[data-isocan-change=added]{--isocan-diff:#15803d;--isocan-diff-tint:rgba(22,163,74,.14)}
[data-isocan-change=removed]{--isocan-diff:#dc2626;--isocan-diff-tint:rgba(220,38,38,.14)}
[data-isocan-change=changed],[data-isocan-change=moved]{--isocan-diff:#d97706;--isocan-diff-tint:rgba(245,158,11,.10)}
[data-isocan-whole]{outline-style:dashed!important;outline-offset:-3px!important;box-shadow:none!important}
[data-isocan-focus]{outline:5px solid #2563eb!important;outline-offset:1px!important}`;
var frameScript = (selectors) => `(function(){var S=${JSON.stringify(selectors).replace(/</g, "\\u003c")};S.forEach(function(s){var q=s[1].split(",").map(function(p){return p.replace(/::?(before|after|hover|focus|focus-visible|focus-within|active|visited|placeholder|marker|selection|first-line|first-letter)\\b(\\([^)]*\\))?/g,"").trim()}).filter(function(p){return p&&!/^(html|body|:root|\\*)$/.test(p)}).join(",");if(!q)return;try{var els=document.querySelectorAll(q)}catch(e){return}for(var i=0;i<els.length&&i<40;i++){var el=els[i];var had=el.getAttribute("data-isocan-step");el.setAttribute("data-isocan-step",had?had+" "+s[0]:String(s[0]));if(!el.hasAttribute("data-isocan-change"))el.setAttribute("data-isocan-change",s[2])}});addEventListener("message",function(e){if(e.source!==parent)return;var n=e.data&&e.data.isocanDiffStep;if(typeof n!=="number")return;var was=document.querySelectorAll("[data-isocan-focus]");for(var i=0;i<was.length;i++)was[i].removeAttribute("data-isocan-focus");var el=document.querySelector('[data-isocan-step~="'+n+'"]');if(el){el.setAttribute("data-isocan-focus","");el.scrollIntoView({block:"center",inline:"center"})}});function size(){var b=document.body;if(!b)return;var m=document.querySelector('meta[name="viewport"]');var w=m&&/width=(\\d+)/.exec(m.getAttribute("content")||"");var h=b.scrollHeight,k=b.children;for(var i=0;i<k.length;i++){var r=k[i].getBoundingClientRect();h=Math.max(h,r.bottom+scrollY)}parent.postMessage({isocanDiffSize:[w?+w[1]:document.documentElement.scrollWidth,Math.ceil(h+(parseFloat(getComputedStyle(b).marginBottom)||0))]},"*")}addEventListener("load",size);if(window.ResizeObserver)new ResizeObserver(size).observe(document.documentElement)})();`;
function markSource(html, diff, side) {
  const marks = /* @__PURE__ */ new Map();
  const rank = { changed: 0, moved: 1, removed: 2, added: 2 };
  const selectors = [];
  for (const change of diff.changes) {
    if (change.selector) {
      const op = change.selector.sides.length === 2 ? "changed" : side === "after" ? "added" : "removed";
      if (change.selector.sides.includes(side)) selectors.push([change.step, change.selector.selector, op]);
      continue;
    }
    const spot = change[side];
    if (spot?.at === void 0) continue;
    const mark = marks.get(spot.at);
    const whole = spot.path === "screen" || /^html(\/body\[1\])?$/.test(spot.path);
    if (!mark) marks.set(spot.at, { op: change.op, steps: [change.step], whole });
    else {
      mark.steps.push(change.step);
      if (rank[change.op] > rank[mark.op]) mark.op = change.op;
    }
  }
  let out = html;
  for (const at of [...marks.keys()].sort((x, y) => y - x)) {
    const mark = marks.get(at);
    const space = /\s/.test(out[at - 1] ?? "") ? "" : " ";
    out = `${out.slice(0, at)}${space}data-isocan-change="${mark.op}" data-isocan-step="${mark.steps.join(" ")}"${mark.whole ? " data-isocan-whole" : ""}${out.slice(at)}`;
  }
  const extra = `<style data-isocan-diff>${HIGHLIGHT_CSS}</style><script data-isocan-diff>${frameScript(selectors)}</script>`;
  const close = out.toLowerCase().lastIndexOf("</body>");
  return close < 0 ? `${out}${extra}` : `${out.slice(0, close)}${extra}${out.slice(close)}`;
}

export {
  isTextualMime,
  versionLabel,
  versionRef,
  defaultVersionPair,
  sourcePair,
  diffVersions,
  diffReport,
  embeddedWire,
  markSource
};
