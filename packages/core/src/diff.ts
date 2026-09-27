import { parse as parseHtml, type DefaultTreeAdapterMap } from "parse5";
import type { Item, ItemVersion } from "./model.ts";
import { parentOf } from "./lineage.ts";

/**
 * **What changed between two versions** — the engine under `isocan diff` and
 * the web's "Compare versions" (docs/projects/version-diff/design.md).
 *
 * The canvas diverges (variations, `wire vary`) and converges (`choose`), and
 * until this nothing said what was actually different: two small pictures in
 * the fan and a person squinting. Choosing without seeing is guessing, and a
 * person reviewing an agent's edit had only the agent's word for it.
 *
 * Pure and deterministic, and on its own export path (`@isocan/core/diff`) so
 * parse5 never reaches the entry chunk or core's index: the web loads this on
 * the click and the CLI on the verb. Both call `diffVersions`, so the
 * sentence the terminal prints is the sentence the inspector shows.
 *
 * It only ever READS. Nothing here builds an op; the decisions a person makes
 * after reading (`item.setCurrentVersion`, `choose`) are the existing ones.
 */

type P5Node = DefaultTreeAdapterMap["childNode"];
type P5Element = DefaultTreeAdapterMap["element"];

/** What kind of comparison a pair of versions gets, from its MIME type and — for HTML — whether a wireframe spec rides inside. */
type DiffKind = "text" | "html" | "wire" | "image" | "binary";

/** What happened to one thing between the two sides. */
export type ChangeOp = "added" | "removed" | "changed" | "moved";

/**
 * Where a change sits on one side. `path` is for a reader (`html/body/main[1]/h1[1]`,
 * a wireframe's slot id, or `line 12`); `at` is the source offset where a
 * highlight attribute can be inserted into that element's start tag, which is
 * how a sandboxed frame gets marks nobody outside it could draw (`markSource`).
 */
interface DiffSpot {
  path: string;
  at?: number;
  line?: number;
}

/** One step of a diff: numbered from 1, in reading order, with a sentence and where it sits on each side. */
interface DiffChange {
  step: number;
  op: ChangeOp;
  what: string;
  before?: DiffSpot;
  after?: DiffSpot;
  /**
   * A stylesheet rule's change: the selector it styles, and on which sides
   * the rule exists. A comparison frame marks the elements it matches.
   */
  selector?: { selector: string; sides: Array<"before" | "after"> };
}

/** A run of words in a changed line: `changed` marks the words that differ on that side. */
export interface WordPart {
  text: string;
  changed: boolean;
}

/** One row of a side-by-side text view, aligned — so a surface draws it and never recomputes it. */
export interface TextRow {
  op: "same" | ChangeOp;
  before?: string;
  after?: string;
  beforeLine?: number;
  afterLine?: number;
  /** The change this row belongs to. */
  step?: number;
  /** On a line replaced one-for-one: which words moved. */
  words?: { before: WordPart[]; after: WordPart[] };
}

/**
 * **The whole answer.** `summary` is the one sentence both surfaces print;
 * `changes` is the list a person steps through; `counts` are in `unit`s
 * (lines of text, elements of HTML, blocks of a wireframe, fields of a file's
 * metadata). `rows` only for text. `note` says what this comparison cannot
 * see, out loud — an image compared by metadata says so.
 */
export interface VersionDiff {
  kind: DiffKind;
  unit: string;
  identical: boolean;
  summary: string;
  counts: Record<ChangeOp, number>;
  changes: DiffChange[];
  rows?: TextRow[];
  note?: string;
}

/** One side of a comparison: the version's facts, and its text when the kind is textual. */
export interface DiffSide {
  mimeType: string;
  filename: string;
  size: number;
  blobHash?: string;
  text?: string;
}

// ---------------------------------------------------------------------------
// Kinds

const bareMime = (mime: string) => mime.split(";")[0]!.trim().toLowerCase();

/**
 * Whether a version's bytes are worth reading as text to compare. Both
 * surfaces ask before they fetch, so an image is never downloaded to be
 * compared by its size.
 */
export function isTextualMime(mimeType: string): boolean {
  const mime = bareMime(mimeType);
  return (
    mime.startsWith("text/") ||
    mime === "image/svg+xml" ||
    /^application\/(json|xml|javascript|x-yaml|yaml|toml)$/.test(mime) ||
    mime.endsWith("+json") ||
    mime.endsWith("+xml")
  );
}

function kindOf(side: DiffSide): DiffKind {
  const mime = bareMime(side.mimeType);
  if (mime === "text/html") {
    if (side.text === undefined) return "html";
    return embeddedWire(side.text) ? "wire" : "html";
  }
  if (isTextualMime(mime)) return "text";
  if (mime.startsWith("image/")) return "image";
  return "binary";
}

// ---------------------------------------------------------------------------
// Versions: which two, by what name

/** `v3` for the third version on the stack — how both surfaces name one to a person. */
export function versionLabel(item: Item, versionId: string): string {
  const index = item.versions.findIndex((v) => v.id === versionId);
  return index < 0 ? versionId : `v${index + 1}`;
}

/**
 * A version named the way a person or an agent names one: its id, an id
 * prefix, `v3`, or `3` — the same forms `get --rev` and `version promote`
 * take between them.
 */
export function versionRef(item: Item, ref: string): ItemVersion | null {
  const exact = item.versions.find((v) => v.id === ref);
  if (exact) return exact;
  const numbered = /^v?(\d+)$/i.exec(ref.trim());
  if (numbered) return item.versions[Number(numbered[1]) - 1] ?? null;
  const prefixed = item.versions.filter((v) => v.id.startsWith(ref));
  return prefixed.length === 1 ? prefixed[0]! : null;
}

/**
 * **The pair a bare `diff` compares**: the version before the one showing,
 * against the one showing — "what did the last edit do". When the one showing
 * is the first, it is compared with the one after it, since there is nothing
 * before. One version is nothing to compare, and says so.
 */
export function defaultVersionPair(item: Item): { from: ItemVersion; to: ItemVersion } | { refused: string } {
  if (item.versions.length < 2) {
    return { refused: `"${item.title || item.id}" has one version — there is nothing to compare it with yet` };
  }
  const current = Math.max(0, item.versions.findIndex((v) => v.id === item.currentVersionId));
  return current === 0
    ? { from: item.versions[0]!, to: item.versions[1]! }
    : { from: item.versions[current - 1]!, to: item.versions[current]! };
}

/**
 * **A variation against what it was made from** — the pair `choose` is about
 * to decide: the source's current version, then this item's. Refuses with the
 * same sentences `convergePlan` would, so the two doors agree about what a
 * variation is.
 */
export function sourcePair(
  items: Record<string, Item>,
  item: Item,
): { source: Item; from: ItemVersion; to: ItemVersion } | { refused: string } {
  const parentId = parentOf(item);
  if (parentId === null) return { refused: `"${item.title}" was not made from anything — there is no source to compare it with` };
  const source = items[parentId];
  if (!source) return { refused: `"${item.title}" was made from an item that is no longer on the canvas` };
  const from = source.versions.find((v) => v.id === source.currentVersionId) ?? source.versions[0];
  const to = item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0];
  if (!from || !to) return { refused: `"${item.title}" has no content to compare` };
  return { source, from, to };
}

// ---------------------------------------------------------------------------
// The engine's front door

/**
 * **Compare two versions.** Text arrives in `before.text`/`after.text` when
 * the kind is textual (`isTextualMime`); anything else is compared by its
 * facts. Deterministic: the same two inputs give the same steps, the same
 * offsets and the same sentence, on either surface.
 */
export function diffVersions(before: DiffSide, after: DiffSide): VersionDiff {
  const kinds = [kindOf(before), kindOf(after)];
  const same = before.blobHash !== undefined && before.blobHash === after.blobHash;
  // A wire on one side and plain HTML on the other is compared as HTML: the
  // spec only means something when both sides have one.
  const kind: DiffKind =
    kinds[0] === kinds[1] ? kinds[0]! : kinds.every((k) => k === "wire" || k === "html") ? "html" : kinds.includes("binary") || kinds.includes("image") ? "binary" : "text";
  if (kind === "image" || kind === "binary" || before.text === undefined || after.text === undefined) {
    return finish(kind === "image" ? "image" : kind === "binary" ? "binary" : kind, "field", metadataChanges(before, after, same), undefined, metadataNote(kind));
  }
  if (!same && before.text === after.text) {
    return finish(kind, unitOf(kind), metadataChanges(before, after, true));
  }
  if (kind === "text") {
    const { changes, rows, counts } = diffText(before.text, after.text);
    return finish("text", "line", changes, rows, undefined, counts);
  }
  if (kind === "wire") {
    const wire = diffWire(before.text, after.text);
    if (wire) return finish("wire", "block", wire);
  }
  return finish("html", "element", diffHtml(before.text, after.text));
}

function unitOf(kind: DiffKind): string {
  return kind === "text" ? "line" : kind === "wire" ? "block" : kind === "html" ? "element" : "field";
}

function metadataNote(kind: DiffKind): string | undefined {
  if (kind === "image") return "images are compared by their metadata only — the pictures are shown side by side, not diffed pixel by pixel";
  if (kind === "binary") return "this kind of file is compared by its metadata only";
  return undefined;
}

type Draft = Omit<DiffChange, "step">;

function metadataChanges(before: DiffSide, after: DiffSide, sameBytes: boolean): Draft[] {
  const out: Draft[] = [];
  const spot = { path: "file" };
  if (before.filename !== after.filename) out.push({ op: "changed", what: `renamed “${before.filename}” → “${after.filename}”`, before: spot, after: spot });
  if (bareMime(before.mimeType) !== bareMime(after.mimeType)) out.push({ op: "changed", what: `type ${bareMime(before.mimeType)} → ${bareMime(after.mimeType)}`, before: spot, after: spot });
  if (!sameBytes) {
    const sizes = before.size === after.size ? `same size (${bytes(after.size)})` : `${bytes(before.size)} → ${bytes(after.size)}`;
    out.push({ op: "changed", what: `different bytes, ${sizes}`, before: spot, after: spot });
  }
  return out;
}

function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function finish(kind: DiffKind, unit: string, drafts: Draft[], rows?: TextRow[], note?: string, unitCounts?: Record<ChangeOp, number>): VersionDiff {
  const changes = drafts.map((d, i) => ({ step: i + 1, ...d }));
  if (rows) {
    // Rows carry the step of the change they belong to — assigned by the text
    // walker as a draft index, now made a step number.
    for (const row of rows) if (row.step !== undefined) row.step += 1;
  }
  const counts: Record<ChangeOp, number> = unitCounts ?? { added: 0, removed: 0, changed: 0, moved: 0 };
  if (!unitCounts) for (const c of changes) counts[c.op] += 1;
  const identical = changes.length === 0;
  const diff: VersionDiff = { kind, unit, identical, summary: "", counts, changes };
  if (rows) diff.rows = rows;
  if (note) diff.note = note;
  diff.summary = summarize(diff);
  return diff;
}

/**
 * The sentence: how many of what, then the first two changes in words —
 * "2 blocks added, 1 changed: added a data table in main section 3, the
 * header's title “List” → “Orders”…". Short enough for a status line; the
 * list is where the rest is.
 */
function summarize(diff: VersionDiff): string {
  if (diff.identical) return "no difference — the two versions have the same content";
  const plural = (n: number) => `${n} ${diff.unit}${n === 1 ? "" : "s"}`;
  const parts: string[] = [];
  const ops: ChangeOp[] = ["added", "removed", "changed", "moved"];
  for (const op of ops) {
    const n = diff.counts[op];
    if (n > 0) parts.push(parts.length === 0 ? `${plural(n)} ${op}` : `${n} ${op}`);
  }
  const lead = parts.join(", ");
  const first = diff.changes.slice(0, 2).map((c) => c.what);
  const more = diff.changes.length > 2 ? `, and ${diff.changes.length - 2} more` : "";
  return `${lead}: ${first.join("; ")}${more}`;
}

const SYMBOL: Record<ChangeOp, string> = { added: "+", removed: "-", changed: "~", moved: "↕" };

/**
 * **The terminal's rendering**: the heading, the summary, then one numbered
 * line per change. `isocan diff` prints exactly this; the web draws the same
 * `changes` as a list it can step through.
 */
export function diffReport(diff: VersionDiff, heading: string): string {
  const lines = [heading, diff.summary];
  if (diff.note) lines.push(`(${diff.note})`);
  for (const c of diff.changes) {
    const where = c.after?.path ?? c.before?.path;
    const at = where && where !== "file" && diff.kind !== "text" ? `  [${where}]` : "";
    lines.push(`  ${String(c.step).padStart(2)}. ${SYMBOL[c.op]} ${c.what}${at}`);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Sequence alignment, shared by every kind

/**
 * Longest common subsequence as matched index pairs, ascending. The common
 * head and tail are matched first and cost nothing; the table is built over
 * what is left, and past `cap` cells the middle is treated as one replaced
 * block rather than letting a pathological file hang a surface.
 */
function lcsPairs<T>(a: readonly T[], b: readonly T[], eq: (x: T, y: T) => boolean, cap = 4_000_000): Array<[number, number]> {
  let head = 0;
  while (head < a.length && head < b.length && eq(a[head]!, b[head]!)) head += 1;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && eq(a[a.length - 1 - tail]!, b[b.length - 1 - tail]!)) tail += 1;
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < head; i++) pairs.push([i, i]);
  const n = a.length - head - tail;
  const m = b.length - head - tail;
  if (n > 0 && m > 0 && n * m <= cap) {
    const width = m + 1;
    const table = new Uint32Array((n + 1) * width);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        table[i * width + j] = eq(a[head + i]!, b[head + j]!)
          ? table[(i + 1) * width + j + 1]! + 1
          : Math.max(table[(i + 1) * width + j]!, table[i * width + j + 1]!);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (eq(a[head + i]!, b[head + j]!)) {
        pairs.push([head + i, head + j]);
        i += 1;
        j += 1;
      } else if (table[(i + 1) * width + j]! >= table[i * width + j + 1]!) i += 1;
      else j += 1;
    }
  }
  for (let k = tail; k > 0; k--) pairs.push([a.length - k, b.length - k]);
  return pairs;
}

/**
 * **Order-preserving alignment by weight** — LCS where a pair is worth what
 * `score` says and zero means "these may not pair". It is what lets an
 * inserted third `<div>` be one added element: three identical-tag siblings
 * against four pair by how much they actually share, not first-come.
 */
function alignWeighted<T>(a: readonly T[], b: readonly T[], score: (x: T, y: T) => number, cap = 250_000): Array<[number, number]> {
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0) return [];
  if (n * m > cap) return lcsPairs(a, b, (x, y) => score(x, y) >= 3);
  const width = m + 1;
  const best = new Float64Array((n + 1) * width);
  const scores = new Float64Array(n * m);
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) scores[i * m + j] = score(a[i]!, b[j]!);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      const s = scores[i * m + j]!;
      const take = s > 0 ? s + best[(i + 1) * width + j + 1]! : -1;
      best[i * width + j] = Math.max(take, best[(i + 1) * width + j]!, best[i * width + j + 1]!);
    }
  }
  const pairs: Array<[number, number]> = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    const s = scores[i * m + j]!;
    if (s > 0 && best[i * width + j] === s + best[(i + 1) * width + j + 1]!) {
      pairs.push([i, j]);
      i += 1;
      j += 1;
    } else if (best[(i + 1) * width + j]! >= best[i * width + j + 1]!) i += 1;
    else j += 1;
  }
  return pairs;
}

/** The stretches between matched pairs: what only `a` has and what only `b` has, in order. */
function gaps(aLength: number, bLength: number, pairs: Array<[number, number]>): Array<{ a: [number, number]; b: [number, number] }> {
  const out: Array<{ a: [number, number]; b: [number, number] }> = [];
  let ai = 0;
  let bi = 0;
  for (const pair of [...pairs, [aLength, bLength] as [number, number]]) {
    if (pair[0] > ai || pair[1] > bi) out.push({ a: [ai, pair[0]], b: [bi, pair[1]] });
    ai = pair[0] + 1;
    bi = pair[1] + 1;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Text

const clip = (text: string, max = 48): string => {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

function words(line: string): string[] {
  return line.match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu) ?? [];
}

/** Which words of a replaced line differ, on each side. */
function wordDiff(before: string, after: string): { before: WordPart[]; after: WordPart[] } {
  const a = words(before);
  const b = words(after);
  const pairs = lcsPairs(a, b, (x, y) => x === y);
  const mark = (tokens: string[], kept: Set<number>): WordPart[] => {
    const parts: WordPart[] = [];
    tokens.forEach((text, i) => {
      const changed = !kept.has(i) && text.trim() !== "";
      const last = parts[parts.length - 1];
      if (last && (last.changed === changed || text.trim() === "")) last.text += text;
      else parts.push({ text, changed });
    });
    return parts;
  };
  return { before: mark(a, new Set(pairs.map((p) => p[0]))), after: mark(b, new Set(pairs.map((p) => p[1]))) };
}

const changedWords = (parts: WordPart[]) => parts.filter((p) => p.changed).map((p) => p.text).join(" ").replace(/\s+/g, " ").trim();

/** How a line names itself: a Markdown heading by its words, anything else by its number. */
function lineName(line: string, number: number): string {
  const heading = /^#{1,6}\s+(.*)$/.exec(line.trim());
  return heading ? `the heading “${clip(heading[1]!, 40)}”` : `line ${number}`;
}

function diffText(before: string, after: string): { changes: Draft[]; rows: TextRow[]; counts: Record<ChangeOp, number> } {
  const a = before.split(/\r?\n/);
  const b = after.split(/\r?\n/);
  const pairs = lcsPairs(a, b, (x, y) => x === y);
  const rows: TextRow[] = [];
  const changes: Draft[] = [];
  const counts: Record<ChangeOp, number> = { added: 0, removed: 0, changed: 0, moved: 0 };
  let cursor: [number, number] = [0, 0];
  const same = (i: number, j: number) => rows.push({ op: "same", before: a[i]!, after: b[j]!, beforeLine: i + 1, afterLine: j + 1 });
  for (const gap of gaps(a.length, b.length, pairs)) {
    for (let i = cursor[0], j = cursor[1]; i < gap.a[0]; i++, j++) same(i, j);
    // Inside a replaced stretch, a line pairs with the one it most resembles
    // — "Contact us." with "Contact us today.", not with whatever happens to
    // sit at the same index — and the rest were added or removed outright.
    const removedLines = a.slice(gap.a[0], gap.a[1]);
    const addedLines = b.slice(gap.b[0], gap.b[1]);
    const alike = alignWeighted(removedLines, addedLines, (x, y) => {
      const s = jaccard(tokens(x), tokens(y));
      return s >= 0.34 || (removedLines.length === 1 && addedLines.length === 1) ? 1 + s : 0;
    });
    const stretch: TextRow[] = [];
    let ri = 0;
    let aj = 0;
    const loose = (rEnd: number, aEnd: number) => {
      for (; ri < rEnd; ri++) stretch.push({ op: "removed", before: removedLines[ri]!, beforeLine: gap.a[0] + ri + 1 });
      for (; aj < aEnd; aj++) stretch.push({ op: "added", after: addedLines[aj]!, afterLine: gap.b[0] + aj + 1 });
    };
    for (const [i, j] of alike) {
      loose(i, j);
      stretch.push({ op: "changed", before: removedLines[i]!, after: addedLines[j]!, beforeLine: gap.a[0] + i + 1, afterLine: gap.b[0] + j + 1, words: wordDiff(removedLines[i]!, addedLines[j]!) });
      ri = i + 1;
      aj = j + 1;
    }
    loose(removedLines.length, addedLines.length);

    // One step per run of rows of one kind: a paragraph rewritten is one
    // change to step to, not nine.
    for (let k = 0; k < stretch.length; ) {
      let end = k;
      while (end + 1 < stretch.length && stretch[end + 1]!.op === stretch[k]!.op) end += 1;
      const run = stretch.slice(k, end + 1);
      const step = changes.length;
      for (const row of run) {
        row.step = step;
        rows.push(row);
      }
      const first = run[0]!;
      const op = first.op as ChangeOp;
      counts[op] += run.length;
      const beforeSpot = first.beforeLine !== undefined ? { path: `line ${first.beforeLine}`, line: first.beforeLine } : undefined;
      const afterSpot = first.afterLine !== undefined ? { path: `line ${first.afterLine}`, line: first.afterLine } : undefined;
      if (op === "added") {
        changes.push({
          op,
          what: run.length === 1 ? `added ${lineName(first.after!, first.afterLine!)}: “${clip(first.after!)}”` : `added ${run.length} lines at line ${first.afterLine}, starting “${clip(first.after!)}”`,
          ...(afterSpot ? { after: afterSpot } : {}),
        });
      } else if (op === "removed") {
        changes.push({
          op,
          what: run.length === 1 ? `removed ${lineName(first.before!, first.beforeLine!)}: “${clip(first.before!)}”` : `removed ${run.length} lines at line ${first.beforeLine}, starting “${clip(first.before!)}”`,
          ...(beforeSpot ? { before: beforeSpot } : {}),
        });
      } else {
        let what: string;
        if (run.length === 1) {
          const was = changedWords(first.words!.before);
          const now = changedWords(first.words!.after);
          const detail = was && now ? `“${clip(was, 40)}” → “${clip(now, 40)}”` : now ? `added “${clip(now, 40)}”` : `dropped “${clip(was, 40)}”`;
          what = `${lineName(first.before!, first.afterLine!)}: ${detail}`;
        } else what = `${run.length} lines changed from line ${first.afterLine}, starting “${clip(first.after!)}”`;
        changes.push({ op, what, ...(beforeSpot ? { before: beforeSpot } : {}), ...(afterSpot ? { after: afterSpot } : {}) });
      }
      k = end + 1;
    }
    cursor = [gap.a[1], gap.b[1]];
    // The pair that closes this gap is a `same` row, emitted on the next pass.
  }
  for (let i = cursor[0], j = cursor[1]; i < a.length && j < b.length; i++, j++) same(i, j);
  return { changes, rows, counts };
}

// ---------------------------------------------------------------------------
// HTML

interface HNode {
  tag: string;
  attrs: Record<string, string>;
  /** Own text for a text node; the whole normalised text for an element. */
  text: string;
  children: HNode[];
  path: string;
  at?: number;
  hash: number;
}

function fnv(text: string, seed = 0x811c9dc5): number {
  let h = seed;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

const RAW = new Set(["script", "style", "textarea", "pre", "title"]);

/** Where a highlight attribute can go in this element's start tag, or undefined for an element the source never wrote (an implied `<body>`). */
function insertAt(source: string, el: P5Element): number | undefined {
  const tag = el.sourceCodeLocation?.startTag;
  if (!tag) return undefined;
  const end = tag.endOffset;
  return source[end - 2] === "/" ? end - 2 : end - 1;
}

function buildTree(source: string): HNode | null {
  const doc = parseHtml(source, { sourceCodeLocationInfo: true });
  const html = doc.childNodes.find((n): n is P5Element => n.nodeName === "html");
  if (!html) return null;
  const build = (el: P5Element, path: string): HNode => {
    const children: HNode[] = [];
    const counts = new Map<string, number>();
    const raw = RAW.has(el.tagName);
    for (const child of el.childNodes as P5Node[]) {
      if (child.nodeName === "#text") {
        const value = (child as DefaultTreeAdapterMap["textNode"]).value;
        const text = raw ? value.trim() : value.replace(/\s+/g, " ").trim();
        if (!text) continue;
        children.push({ tag: "#text", attrs: {}, text, children: [], path: `${path}/text()`, hash: fnv(`#${text}`) });
      } else if ("tagName" in child) {
        const tag = child.tagName;
        const n = (counts.get(tag) ?? 0) + 1;
        counts.set(tag, n);
        children.push(build(child, `${path}/${tag}[${n}]`));
      }
    }
    const attrs: Record<string, string> = {};
    for (const attr of el.attrs) attrs[attr.name] = attr.value;
    const text = children.map((c) => c.text).join(" ").trim();
    const own = `<${el.tagName} ${Object.keys(attrs).sort().map((k) => `${k}=${attrs[k]}`).join(" ")}>`;
    let hash = fnv(own);
    for (const c of children) hash = fnv(String(c.hash), hash);
    const at = insertAt(source, el);
    return { tag: el.tagName, attrs, text, children, path, hash, ...(at !== undefined ? { at } : {}) };
  };
  return build(html, "html");
}

function tokens(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let both = 0;
  for (const t of a) if (b.has(t)) both += 1;
  return both / (a.size + b.size - both);
}

function attrTokens(node: HNode): Set<string> {
  return new Set(Object.entries(node.attrs).flatMap(([k, v]) => [k, ...v.split(/\s+/).map((t) => `${k}=${t}`)]));
}

/** How much two siblings are the same thing: 0 = may not pair, 3 = identical. */
function pairScore(a: HNode, b: HNode): number {
  if (a.tag !== b.tag) return 0;
  if (a.hash === b.hash) return 3;
  if (a.tag === "#text") return 1 + jaccard(tokens(a.text), tokens(b.text));
  if (a.attrs.id && a.attrs.id === b.attrs.id) return 2.5;
  return 1 + 0.5 * jaccard(tokens(a.text), tokens(b.text)) + 0.5 * jaccard(attrTokens(a), attrTokens(b));
}

const TAG_WORDS: Record<string, string> = {
  h1: "heading", h2: "heading", h3: "heading", h4: "heading", h5: "heading", h6: "heading",
  p: "paragraph", a: "link", button: "button", img: "image", ul: "list", ol: "list", li: "list item",
  nav: "nav", header: "header", footer: "footer", section: "section", article: "article", main: "main area",
  aside: "sidebar", form: "form", input: "field", textarea: "text box", select: "menu", label: "label",
  table: "table", tr: "row", td: "cell", th: "header cell", div: "block", span: "span", figure: "figure",
  svg: "graphic", video: "video", strong: "bold text", em: "emphasis", body: "page body", title: "page title",
};

/** An element in words: `the “Buy now” button`, `a list (.plans)`, `the block #hero`. */
function describe(node: HNode, article: "the" | "a"): string {
  const word = TAG_WORDS[node.tag] ?? `<${node.tag}>`;
  const text = clip(node.text, 28);
  if (node.tag === "img" && node.attrs.alt) return `${article} image “${clip(node.attrs.alt, 28)}”`;
  if (text && node.tag !== "html" && node.tag !== "body") return `${article} “${text}” ${word}`;
  if (node.attrs.id) return `${article} ${word} #${node.attrs.id}`;
  const cls = node.attrs.class?.split(/\s+/).filter(Boolean)[0];
  if (cls) return `${article} ${word} (.${cls})`;
  return `${article} ${word}`;
}

function styleProps(style: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const decl of splitTop(style, ";")) {
    const colon = decl.indexOf(":");
    if (colon < 0) continue;
    const prop = decl.slice(0, colon).trim().toLowerCase();
    if (prop) out.set(prop, decl.slice(colon + 1).trim());
  }
  return out;
}

/** Split on a separator outside parentheses and quotes — a `url(data:…;base64,…)` is one value, not two. */
function splitTop(text: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote = "";
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
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

function propPhrases(before: Map<string, string>, after: Map<string, string>): string[] {
  const out: string[] = [];
  for (const [prop, value] of after) {
    const was = before.get(prop);
    if (was === undefined) out.push(`${prop} ${value} added`);
    else if (was !== value) out.push(`${prop} ${was} → ${value}`);
  }
  for (const [prop, value] of before) if (!after.has(prop)) out.push(`${prop} ${value} removed`);
  return out;
}

function attrPhrases(a: HNode, b: HNode): string[] {
  const out: string[] = [];
  const names = [...new Set([...Object.keys(a.attrs), ...Object.keys(b.attrs)])].sort();
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
    } else if (was === undefined) out.push(`${name} “${clip(now!, 40)}” added`);
    else if (now === undefined) out.push(`${name} “${clip(was, 40)}” removed`);
    else out.push(`${name} “${clip(was, 40)}” → “${clip(now, 40)}”`);
  }
  return out;
}

interface CssRule {
  key: string;
  label: string;
  /** The bare selector, without any `@media` prefix — what a frame can match. */
  selector: string;
  props: Map<string, string>;
  body: string;
}

/** A stylesheet as rules keyed by selector (with any `@media` prefix), in order. Nested at-rule blocks are flattened one level at a time. */
function cssRules(css: string, prefix = ""): CssRule[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: CssRule[] = [];
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf("{", i);
    const semi = text.indexOf(";", i);
    if (open < 0) break;
    if (semi >= 0 && semi < open) {
      // A statement at-rule (`@import`, `@charset`): one rule keyed by itself.
      const statement = text.slice(i, semi).trim();
      if (statement) out.push({ key: prefix + statement, label: prefix + statement, selector: "", props: new Map(), body: "" });
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
      out.push({ key: prefix + prelude, label: prefix + prelude, selector: atRule ? "" : prelude, props: atRule ? new Map() : styleProps(body), body: body.replace(/\s+/g, " ").trim() });
    }
    i = j;
  }
  // The same selector twice is two rules: key the later ones by occurrence.
  const seen = new Map<string, number>();
  for (const rule of out) {
    const n = (seen.get(rule.key) ?? 0) + 1;
    seen.set(rule.key, n);
    if (n > 1) rule.key = `${rule.key} #${n}`;
  }
  return out;
}

function cssChanges(before: string, after: string): Array<{ op: ChangeOp; what: string; selector: string }> {
  const a = cssRules(before);
  const b = cssRules(after);
  const byKey = new Map(a.map((r) => [r.key, r]));
  const out: Array<{ op: ChangeOp; what: string; selector: string }> = [];
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

const spotOf = (node: HNode): DiffSpot => ({ path: node.path, ...(node.at !== undefined ? { at: node.at } : {}) });

function diffHtml(before: string, after: string): Draft[] {
  const a = buildTree(before);
  const b = buildTree(after);
  const out: Draft[] = [];
  if (!a || !b) return out;

  const walk = (x: HNode, y: HNode) => {
    if (x.hash === y.hash) return;
    const phrases = attrPhrases(x, y);
    if (x.tag === "style") {
      // A stylesheet's change, rule by rule: the property is usually the edit.
      // Each rule's change carries its selector, so the comparison frame can
      // mark the elements the rule styles — a restyle is otherwise invisible,
      // since a `<style>` element has no box to outline.
      for (const rule of cssChanges(x.text, y.text)) {
        const sides: Array<"before" | "after"> = rule.op === "added" ? ["after"] : rule.op === "removed" ? ["before"] : ["before", "after"];
        out.push({
          op: "changed",
          what: `stylesheet — ${rule.what}`,
          before: spotOf(x),
          after: spotOf(y),
          ...(rule.selector ? { selector: { selector: rule.selector, sides } } : {}),
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
      if (x.text !== y.text) out.push({ op: "changed", what: `the page title “${clip(x.text, 40)}” → “${clip(y.text, 40)}”`, before: spotOf(x), after: spotOf(y) });
      return;
    }
    const pairs = alignWeighted(x.children, y.children, pairScore);
    const textPhrases: string[] = [];
    // In reading order: what went and came before each paired child, then
    // that child's own changes — so stepping walks down the page.
    const inOrder: Array<Draft | [HNode, HNode]> = [];
    let ai = 0;
    let bi = 0;
    const between = (aEnd: number, bEnd: number) => {
      for (; ai < aEnd; ai++) {
        const c = x.children[ai]!;
        if (c.tag === "#text") textPhrases.push(`text “${clip(c.text, 36)}” removed`);
        else inOrder.push({ op: "removed", what: `removed ${describe(c, "a")}`, before: spotOf(c) });
      }
      for (; bi < bEnd; bi++) {
        const d = y.children[bi]!;
        if (d.tag === "#text") textPhrases.push(`text “${clip(d.text, 36)}” added`);
        else inOrder.push({ op: "added", what: `added ${describe(d, "a")}`, after: spotOf(d) });
      }
    };
    for (const [i, j] of pairs) {
      between(i, j);
      const c = x.children[i]!;
      const d = y.children[j]!;
      if (c.tag === "#text") {
        if (c.text !== d.text) {
          const w = wordDiff(c.text, d.text);
          const was = changedWords(w.before);
          const now = changedWords(w.after);
          textPhrases.push(was && now ? `“${clip(was, 36)}” → “${clip(now, 36)}”` : now ? `text “${clip(now, 36)}” added` : `text “${clip(was, 36)}” dropped`);
        }
      } else inOrder.push([c, d]);
      ai = i + 1;
      bi = j + 1;
    }
    between(x.children.length, y.children.length);
    // The element's own change first — its attributes and its text, one step.
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

// ---------------------------------------------------------------------------
// Wireframes

/**
 * The wireframe module's marker and script id (`render.ts`: `WIRE_MARKER`,
 * `WIRE_SCRIPT_ID`). Repeated rather than imported because core cannot depend
 * on a module; `packages/modules/wireframe/test/diff.test.ts` holds this
 * reader equal to the module's `readWire` on a rendered screen, so the two
 * cannot drift apart quietly.
 */
const WIRE_MARKER = "<!-- isocan:wireframe -->";
const WIRE_SCRIPT = /<script type="application\/json" id="isocan-wireframe">([\s\S]*?)<\/script>/;

/** The parts of a wireframe spec a diff reads — structurally the module's `WireSpec`. */
interface WireSpecLike {
  title?: string;
  archetype?: string;
  platform?: string;
  slots?: Array<{ slot: string; block: string | null; props?: Record<string, unknown>; intents?: Record<string, string>; fill?: unknown }>;
  style?: unknown;
  content?: { title?: string; pack?: string } & Record<string, unknown>;
  flip?: { slot: string; from: string; to: string };
}

/** The spec a rendered wireframe screen carries, or null for any other HTML. */
export function embeddedWire(html: string): WireSpecLike | null {
  if (!html.includes(WIRE_MARKER)) return null;
  const m = WIRE_SCRIPT.exec(html);
  if (!m) return null;
  try {
    const spec = JSON.parse(m[1]!) as WireSpecLike;
    return spec && typeof spec === "object" && Array.isArray(spec.slots) ? spec : null;
  } catch {
    return null;
  }
}

const blockWords = (block: string | null) => (block === null ? "an undecided section" : block.replace(/-/g, " "));

/** A slot in words: `header` → "the header", `main.3` → "main section 3". */
function slotWords(slot: string): string {
  if (slot === "fab") return "the floating button";
  const numbered = /^([a-z]+)\.(\d+)$/.exec(slot);
  if (numbered) return `${numbered[1]} section ${numbered[2]}`;
  return `the ${slot.replace(/[-_.]/g, " ")}`;
}

const show = (value: unknown): string => (typeof value === "string" ? `“${clip(value, 32)}”` : JSON.stringify(value));

/** Every string leaf of a value, keyed by its path — how a slot's words are compared. */
function leaves(value: unknown, path = "", out = new Map<string, string>()): Map<string, string> {
  if (typeof value === "string") out.set(path, value);
  else if (Array.isArray(value)) value.forEach((v, i) => leaves(v, `${path}[${i}]`, out));
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) leaves(v, path ? `${path}.${k}` : k, out);
  return out;
}

function wordsPhrases(before: unknown, after: unknown): string[] {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (before === undefined) return ["sample words filled in"];
  if (after === undefined) return ["back to bars — its words taken out"];
  const a = leaves(before);
  const b = leaves(after);
  const out: string[] = [];
  for (const [path, value] of b) {
    const was = a.get(path);
    if (was !== undefined && was !== value) out.push(`“${clip(was, 28)}” → “${clip(value, 28)}”`);
  }
  if (out.length === 0) return ["its words changed"];
  return out.length > 3 ? [...out.slice(0, 3), `${out.length - 3} more words changed`] : out;
}

/** Where each slot's `<section data-slot>` starts on this side, and the frame itself — the elements a wire change is highlighted on. */
function wireSpots(html: string): { slots: Map<string, number>; frame?: number } {
  const slots = new Map<string, number>();
  let frame: number | undefined;
  const doc = parseHtml(html, { sourceCodeLocationInfo: true });
  const visit = (node: P5Node | DefaultTreeAdapterMap["document"]) => {
    if ("tagName" in node) {
      const slot = node.attrs.find((a) => a.name === "data-slot")?.value;
      const at = insertAt(html, node);
      if (slot !== undefined && at !== undefined && !slots.has(slot)) slots.set(slot, at);
      const cls = node.attrs.find((a) => a.name === "class")?.value.split(/\s+/) ?? [];
      if (frame === undefined && cls.includes("frame") && at !== undefined) frame = at;
    }
    if ("childNodes" in node) for (const child of node.childNodes as P5Node[]) visit(child);
  };
  visit(doc);
  return { slots, ...(frame !== undefined ? { frame } : {}) };
}

function diffWire(beforeHtml: string, afterHtml: string): Draft[] | null {
  const a = embeddedWire(beforeHtml);
  const b = embeddedWire(afterHtml);
  if (!a || !b) return null;
  const spotsA = wireSpots(beforeHtml);
  const spotsB = wireSpots(afterHtml);
  const frameA: DiffSpot = { path: "screen", ...(spotsA.frame !== undefined ? { at: spotsA.frame } : {}) };
  const frameB: DiffSpot = { path: "screen", ...(spotsB.frame !== undefined ? { at: spotsB.frame } : {}) };
  const slotSpot = (spots: { slots: Map<string, number> }, slot: string): DiffSpot => {
    const at = spots.slots.get(slot);
    return { path: slot, ...(at !== undefined ? { at } : {}) };
  };
  const out: Draft[] = [];

  // The screen as a whole: what it is, what it is called, how it looks.
  const screen = (what: string) => out.push({ op: "changed", what, before: frameA, after: frameB });
  if (a.archetype !== b.archetype) screen(`became a ${b.archetype} screen (was ${a.archetype})`);
  if (a.platform !== b.platform) screen(`platform ${a.platform} → ${b.platform}`);
  if (a.title !== b.title) screen(`the screen's title ${show(a.title)} → ${show(b.title)}`);
  if (JSON.stringify(a.flip) !== JSON.stringify(b.flip)) {
    screen(b.flip ? `now a variation: ${blockWords(b.flip.to)} instead of ${blockWords(b.flip.from)} in ${slotWords(b.flip.slot)}` : "no longer a variation");
  }
  if (JSON.stringify(a.style) !== JSON.stringify(b.style)) screen(b.style === undefined ? "back to the default greys" : "the look changed — a different style is mapped onto it");
  const contentA = a.content;
  const contentB = b.content;
  if (JSON.stringify(contentA) !== JSON.stringify(contentB)) {
    if (!contentA) screen(`fleshed out with sample content${contentB?.pack ? ` (${contentB.pack})` : ""}`);
    else if (!contentB) screen("its sample content taken out — back to bars");
    else {
      if (contentA.title !== contentB.title) screen(`the heading ${show(contentA.title)} → ${show(contentB.title)}`);
      if (contentA.pack !== contentB.pack) screen(`sample content ${show(contentA.pack)} → ${show(contentB.pack)}`);
    }
  }

  // The blocks, slot by slot.
  const slotsA = a.slots ?? [];
  const slotsB = b.slots ?? [];
  const byA = new Map(slotsA.map((s) => [s.slot, s]));
  const byB = new Map(slotsB.map((s) => [s.slot, s]));
  // Top to bottom, so stepping walks down the screen: a slot's place on the
  // new side, and a removed slot just after the slot it used to follow.
  const placed: Array<{ order: number; draft: Draft }> = [];
  const indexB = new Map(slotsB.map((s, i) => [s.slot, i]));
  let lastKept = -1;
  for (const s of slotsA) {
    const kept = indexB.get(s.slot);
    if (kept !== undefined) lastKept = kept;
    else placed.push({ order: lastKept + 0.5, draft: { op: "removed", what: `took ${blockWords(s.block)} out of ${slotWords(s.slot)}`, before: slotSpot(spotsA, s.slot) } });
  }
  for (const [index, s] of slotsB.entries()) {
    const was = byA.get(s.slot);
    if (!was) {
      placed.push({ order: index, draft: { op: "added", what: `added ${s.block === null ? "an undecided section" : `a ${blockWords(s.block)}`} in ${slotWords(s.slot)}`, after: slotSpot(spotsB, s.slot) } });
      continue;
    }
    const phrases: string[] = [];
    if (was.block !== s.block) {
      phrases.push(was.block === null ? `decided: ${blockWords(s.block)}` : s.block === null ? "back to undecided" : `${blockWords(was.block)} → ${blockWords(s.block)}`);
    } else {
      const pa = was.props ?? {};
      const pb = s.props ?? {};
      for (const key of [...new Set([...Object.keys(pa), ...Object.keys(pb)])].sort()) {
        const x = pa[key];
        const y = pb[key];
        if (JSON.stringify(x) === JSON.stringify(y)) continue;
        if (typeof y === "boolean" && (typeof x === "boolean" || x === undefined)) phrases.push(`${key} ${y ? "on" : "off"}`);
        else if (x === undefined) phrases.push(`${key} ${show(y)} added`);
        else if (y === undefined) phrases.push(`${key} removed`);
        else phrases.push(`${key} ${show(x)} → ${show(y)}`);
      }
      // Intents ARE the links: a wireframe's links are computed from them and
      // never stored (the module's links.ts), so this is the link change.
      const ia = was.intents ?? {};
      const ib = s.intents ?? {};
      for (const el of [...new Set([...Object.keys(ia), ...Object.keys(ib)])].sort()) {
        const x = ia[el];
        const y = ib[el];
        const name = el.replace(/-/g, " ");
        if (x === y) continue;
        if (x === undefined) phrases.push(`${name} does ${y}`);
        else if (y === undefined) phrases.push(`${name} no longer does ${x}`);
        else phrases.push(`${name} now does ${y} (link was ${x})`);
      }
    }
    phrases.push(...wordsPhrases(was.fill, s.fill));
    if (phrases.length === 0) continue;
    const who = `${slotWords(s.slot)}${s.block ? ` (${blockWords(s.block)})` : ""}`;
    placed.push({ order: index, draft: { op: "changed", what: `${who}: ${phrases.join("; ")}`, before: slotSpot(spotsA, s.slot), after: slotSpot(spotsB, s.slot) } });
  }
  out.push(...placed.sort((p, q) => p.order - q.order).map((p) => p.draft));

  // Reordered: the slots both sides have, in a different order.
  const commonA = slotsA.map((s) => s.slot).filter((s) => byB.has(s));
  const commonB = slotsB.map((s) => s.slot).filter((s) => byA.has(s));
  const stayed = new Set(lcsPairs(commonA, commonB, (x, y) => x === y).map(([i]) => commonA[i]!));
  for (const slot of commonB) {
    if (!stayed.has(slot)) out.push({ op: "moved", what: `${slotWords(slot)} moved to position ${commonB.indexOf(slot) + 1}`, before: slotSpot(spotsA, slot), after: slotSpot(spotsB, slot) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Highlights, for a frame nothing outside can reach into

/**
 * The stylesheet a comparison render carries. Outlines, which take no
 * layout, drawn a pixel outside the box so they do not cut through a line's
 * descenders (a whole screen's goes inside, where the edge cannot clip it),
 * and an inset tint, so not one pixel of layout moves. Green added, red
 * removed, amber changed, dashed for the whole screen; the step in focus
 * is a thicker blue, a colour no kind of change uses.
 */
const HIGHLIGHT_CSS = `[data-isocan-change]{outline:3px solid var(--isocan-diff)!important;outline-offset:1px!important;box-shadow:inset 0 0 0 100vmax var(--isocan-diff-tint)!important}
[data-isocan-change=added]{--isocan-diff:#15803d;--isocan-diff-tint:rgba(22,163,74,.14)}
[data-isocan-change=removed]{--isocan-diff:#dc2626;--isocan-diff-tint:rgba(220,38,38,.14)}
[data-isocan-change=changed],[data-isocan-change=moved]{--isocan-diff:#d97706;--isocan-diff-tint:rgba(245,158,11,.10)}
[data-isocan-whole]{outline-style:dashed!important;outline-offset:-3px!important;box-shadow:none!important}
[data-isocan-focus]{outline:5px solid #2563eb!important;outline-offset:1px!important}`;

/**
 * The frame's half. First, a stylesheet rule's change marks the elements its
 * selector matches (`S`: step, selector, op) — skipping a selector that would
 * paint the whole page, and at most forty elements each, so a `div` rule does
 * not drown the picture. Then stepping: the inspector posts
 * `{ isocanDiffStep: n }`, and this scrolls that change into view and marks
 * it in focus. It listens to its parent only. The one thing it says back is
 * its own size (`{ isocanDiffSize: [w, h] }`: a `<meta name="viewport">`
 * width when the document declares one, as a wireframe does, and the height
 * its content reaches), so both sides can be drawn whole at one scale — the
 * card's box on the canvas is not the document's size. The frame still
 * reaches nothing.
 */
const frameScript = (selectors: Array<[number, string, ChangeOp]>) =>
  `(function(){var S=${JSON.stringify(selectors).replace(/</g, "\\u003c")};S.forEach(function(s){var q=s[1].split(",").map(function(p){return p.replace(/::?(before|after|hover|focus|focus-visible|focus-within|active|visited|placeholder|marker|selection|first-line|first-letter)\\b(\\([^)]*\\))?/g,"").trim()}).filter(function(p){return p&&!/^(html|body|:root|\\*)$/.test(p)}).join(",");if(!q)return;try{var els=document.querySelectorAll(q)}catch(e){return}for(var i=0;i<els.length&&i<40;i++){var el=els[i];var had=el.getAttribute("data-isocan-step");el.setAttribute("data-isocan-step",had?had+" "+s[0]:String(s[0]));if(!el.hasAttribute("data-isocan-change"))el.setAttribute("data-isocan-change",s[2])}});addEventListener("message",function(e){if(e.source!==parent)return;var n=e.data&&e.data.isocanDiffStep;if(typeof n!=="number")return;var was=document.querySelectorAll("[data-isocan-focus]");for(var i=0;i<was.length;i++)was[i].removeAttribute("data-isocan-focus");var el=document.querySelector('[data-isocan-step~="'+n+'"]');if(el){el.setAttribute("data-isocan-focus","");el.scrollIntoView({block:"center",inline:"center"})}});function size(){var b=document.body;if(!b)return;var m=document.querySelector('meta[name="viewport"]');var w=m&&/width=(\\d+)/.exec(m.getAttribute("content")||"");var h=b.scrollHeight,k=b.children;for(var i=0;i<k.length;i++){var r=k[i].getBoundingClientRect();h=Math.max(h,r.bottom+scrollY)}parent.postMessage({isocanDiffSize:[w?+w[1]:document.documentElement.scrollWidth,Math.ceil(h+(parseFloat(getComputedStyle(b).marginBottom)||0))]},"*")}addEventListener("load",size);if(window.ResizeObserver)new ResizeObserver(size).observe(document.documentElement)})();`;

/**
 * **One side's source, with the diff written into it** — the only way a
 * highlight reaches inside an `allow-scripts` frame whose origin is opaque.
 *
 * Every changed element on this side gets `data-isocan-change` and
 * `data-isocan-step` in its own start tag, at the offset the diff recorded,
 * and one `<style>` and one `<script>` go in before `</body>`. The result is a
 * string for a comparison frame's `srcdoc` and nothing else: the item and its
 * blob are never touched.
 */
export function markSource(html: string, diff: VersionDiff, side: "before" | "after"): string {
  const marks = new Map<number, { op: ChangeOp; steps: number[]; whole: boolean }>();
  const rank: Record<ChangeOp, number> = { changed: 0, moved: 1, removed: 2, added: 2 };
  const selectors: Array<[number, string, ChangeOp]> = [];
  for (const change of diff.changes) {
    if (change.selector) {
      // A rule marks what it styles, never its `<style>` element, which has
      // no box — stepping to it would scroll to nothing.
      const op: ChangeOp = change.selector.sides.length === 2 ? "changed" : side === "after" ? "added" : "removed";
      if (change.selector.sides.includes(side)) selectors.push([change.step, change.selector.selector, op]);
      continue;
    }
    const spot = change[side];
    if (spot?.at === undefined) continue;
    const mark = marks.get(spot.at);
    // A change to the whole screen or page (its title, its look) outlines
    // the frame dashed and does not tint it: a wash over everything would
    // bury the block-level marks inside it.
    const whole = spot.path === "screen" || /^html(\/body\[1\])?$/.test(spot.path);
    if (!mark) marks.set(spot.at, { op: change.op, steps: [change.step], whole });
    else {
      mark.steps.push(change.step);
      if (rank[change.op] > rank[mark.op]) mark.op = change.op;
    }
  }
  let out = html;
  for (const at of [...marks.keys()].sort((x, y) => y - x)) {
    const mark = marks.get(at)!;
    const space = /\s/.test(out[at - 1] ?? "") ? "" : " ";
    out = `${out.slice(0, at)}${space}data-isocan-change="${mark.op}" data-isocan-step="${mark.steps.join(" ")}"${mark.whole ? " data-isocan-whole" : ""}${out.slice(at)}`;
  }
  const extra = `<style data-isocan-diff>${HIGHLIGHT_CSS}</style><script data-isocan-diff>${frameScript(selectors)}</script>`;
  const close = out.toLowerCase().lastIndexOf("</body>");
  return close < 0 ? `${out}${extra}` : `${out.slice(0, close)}${extra}${out.slice(close)}`;
}
