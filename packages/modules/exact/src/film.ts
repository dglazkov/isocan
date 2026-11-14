/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * **Time and state, the facts both surfaces share** (exact phase 4;
 * `docs/projects/exact/design.md` §8). Pure: no keys, no network, no node —
 * the CLI posts what the bridge printed, the web draws it, and both read it
 * through these.
 *
 * - **A film** is an ordinary animated PNG item: Exact's own `screenshot
 *   <file>.apng over <ms> every <ms>`, filmed on the agent's virtual clock
 *   after an interaction, so the same source is the same bytes. Its
 *   `exact.film` says when each frame was drawn; the web module splits the
 *   strip into its frames to scrub it (an `<img>` can play an APNG but not
 *   seek one).
 * - **State per frame** is `state` read between `clock +every` steps on a
 *   second cold driver — the same instants — kept on the film as
 *   `exact.frames`: the first frame's state whole, then only what each later
 *   frame changed. A property, not a blob, so garbage collection can never
 *   take it from under the film (exact phase 3's Open entry on blobs
 *   referenced only from a property).
 * - **A comment at a moment** is core's `Comment.at`, in seconds — motion's
 *   shape, unchanged: a comment made while the strip is scrubbed carries it,
 *   and opening that comment scrubs the strip back to it.
 * - **The inspector's facts** are the driver's `tree --ax`, `layout`, `perf`
 *   and `logs` for one screen, from a cold driver at the capture's shots.
 */

/** `exact.film`: when each frame of the strip was drawn, and how the film was made. */
export interface FilmFacts {
  /** The clock, in ms after the interaction ended, of the first frame. */
  from: number;
  every: number;
  steps: number;
  over: number;
  /** Each frame's clock, as the driver reported it. */
  at: number[];
  /** What the film depended on, digested — refilming with the same key versions the same item. */
  key: string;
  route: string;
  host: string;
  device: string;
  scheme: "light" | "dark";
  /** How the screen was reached (its shots), and the interaction filmed after. */
  shots: string;
  ops: string[];
  /** The node whose motion `exact.frames` follows (its `layout`), by testId, or null. */
  watch: string | null;
  /** The screen item filmed, when it was on the canvas. */
  screen: string | null;
}

export function parseFilm(text: string | undefined): FilmFacts | null {
  if (!text) return null;
  try {
    const v = JSON.parse(text) as Partial<FilmFacts>;
    if (!Number.isFinite(v?.every) || !Number.isInteger(v?.steps) || (v.steps ?? 0) < 1 || (v.every ?? 0) <= 0) return null;
    const from = Number.isFinite(v.from) ? v.from! : 0;
    const at = Array.isArray(v.at) && v.at.length === v.steps && v.at.every((n) => Number.isFinite(n)) ? v.at : Array.from({ length: v.steps! }, (_, i) => from + i * v.every!);
    return {
      from, every: v.every!, steps: v.steps!, over: Number.isFinite(v.over) ? v.over! : (v.steps! - 1) * v.every!, at,
      key: typeof v.key === "string" ? v.key : "",
      route: typeof v.route === "string" ? v.route : "",
      host: typeof v.host === "string" ? v.host : "web",
      device: typeof v.device === "string" ? v.device : "phone",
      scheme: v.scheme === "dark" ? "dark" : "light",
      shots: typeof v.shots === "string" ? v.shots : "",
      ops: Array.isArray(v.ops) ? v.ops.filter((o): o is string => typeof o === "string") : [],
      watch: typeof v.watch === "string" ? v.watch : null,
      screen: typeof v.screen === "string" ? v.screen : null,
    };
  } catch {
    return null;
  }
}

/** The strip's span in ms: the first frame's clock to the last's. */
export function filmSpan(film: FilmFacts): { min: number; max: number } {
  return { min: film.at[0] ?? film.from, max: film.at[film.steps - 1] ?? film.from + (film.steps - 1) * film.every };
}

/**
 * **The frame on screen at a moment** — the last one drawn at or before it,
 * as a film shows a frame until the next: 180 ms at 16 ms a frame is the
 * frame drawn at 176 ms.
 */
export function frameAt(film: FilmFacts, ms: number): number {
  let best = 0;
  for (let i = 0; i < film.at.length; i++) if (film.at[i]! <= ms + 1e-6) best = i;
  return best;
}

/** A moment clamped onto the strip, to the millisecond. */
export function clampMoment(film: FilmFacts, ms: number): number {
  const { min, max } = filmSpan(film);
  return Math.round(Math.min(max, Math.max(min, ms)));
}

/** Core's `Comment.at` (seconds, motion's shape) for a moment on the strip in ms, and back. */
export const commentAt = (ms: number): number => Math.round(ms) / 1000;
export const momentOf = (at: number): number => Math.round(at * 1000);

/** The words of the key a film is versioned under; the CLI digests it. */
export function filmKeyText(parts: { app: string; route: string; host: string; device: string; scheme: string; shots: string; ops: readonly string[]; over: number; every: number; watch: string | null }): string {
  return ["film", parts.app, parts.route, parts.host, parts.device, parts.scheme, parts.shots, parts.ops.join("\n"), parts.over, parts.every, parts.watch ?? ""].join("\u0000");
}

export function filmTitle(film: Pick<FilmFacts, "route" | "host" | "ops" | "over" | "every">): string {
  return `${film.route} — film of ${film.ops.join(", ") || "the screen"} (${film.over} ms every ${film.every}${film.host === "web" ? "" : `, ${film.host}`})`;
}

// ---------------------------------------------------------------- state per frame

/** What a filmed node's `layout` said at a frame: its box and the values that animate. */
export interface WatchedNode {
  testId: string | null;
  box: { x: number; y: number; w: number; h: number } | null;
  style: Record<string, string>;
  visible?: { inViewport?: boolean; clipped?: boolean; hidden?: boolean } | null;
}

/** The state at one frame, whole. */
export interface FrameState {
  at: number | null;
  slots: Record<string, unknown> | null;
  derives: Record<string, unknown> | null;
  watch?: WatchedNode | null;
}

/** `exact.frames`: the first frame whole, then each later frame's changes (top-level keys of `slots` and `derives`). */
export interface PackedFrames {
  first: FrameState;
  steps: Array<{ at: number | null; slots?: Record<string, unknown>; derives?: Record<string, unknown>; watch?: WatchedNode | null }>;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function changes(prev: Record<string, unknown> | null, next: Record<string, unknown> | null): Record<string, unknown> | undefined {
  if (!next) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(next)) if (!prev || !same(prev[k], v)) out[k] = v;
  return Object.keys(out).length ? out : undefined;
}

export function packFrames(frames: readonly FrameState[]): PackedFrames | null {
  if (frames.length === 0) return null;
  const [first, ...rest] = frames;
  const steps: PackedFrames["steps"] = [];
  let prev = first!;
  for (const f of rest) {
    const slots = changes(prev.slots, f.slots);
    const derives = changes(prev.derives, f.derives);
    steps.push({ at: f.at, ...(slots ? { slots } : {}), ...(derives ? { derives } : {}), ...(f.watch !== undefined ? { watch: f.watch } : {}) });
    prev = f;
  }
  return { first: first!, steps };
}

/** Every frame's state, whole again. */
export function unpackFrames(packed: PackedFrames): FrameState[] {
  const out: FrameState[] = [packed.first];
  let prev = packed.first;
  for (const s of packed.steps) {
    const next: FrameState = {
      at: s.at,
      slots: prev.slots || s.slots ? { ...(prev.slots ?? {}), ...(s.slots ?? {}) } : null,
      derives: prev.derives || s.derives ? { ...(prev.derives ?? {}), ...(s.derives ?? {}) } : null,
      ...(s.watch !== undefined ? { watch: s.watch } : prev.watch !== undefined ? { watch: null } : {}),
    };
    out.push(next);
    prev = next;
  }
  return out;
}

export function parseFrames(text: string | undefined): FrameState[] | null {
  if (!text) return null;
  try {
    const v = JSON.parse(text) as PackedFrames;
    if (!v?.first || !Array.isArray(v.steps)) return null;
    return unpackFrames(v);
  } catch {
    return null;
  }
}

/** The top-level state keys that differ between two frames — what the panel marks as moved. */
export function changedKeys(a: FrameState | undefined, b: FrameState | undefined): string[] {
  if (!a || !b) return [];
  const out: string[] = [];
  for (const part of ["slots", "derives"] as const) {
    const x = a[part] ?? {};
    const y = b[part] ?? {};
    for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) if (!same(x[k], y[k])) out.push(`${part === "slots" ? "" : "derive "}${k}`);
  }
  return out;
}

// ---------------------------------------------------------------- the strip, frame by frame

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

let crcTable: Uint32Array | null = null;
function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/**
 * **An animated PNG, split into one still PNG per frame** — so the strip can
 * be scrubbed: an `<img>` plays an APNG but cannot be told which frame to
 * show. Exact writes every frame whole (the image's own size, at 0,0,
 * replacing the last), which is the only shape this splits; anything else is
 * null, and the strip is shown as it plays. Each frame keeps the image's
 * header and ancillary chunks, with its own pixels as the image data.
 */
export function splitApng(bytes: Uint8Array): Uint8Array[] | null {
  if (bytes.length < 8 || PNG_SIGNATURE.some((b, i) => bytes[i] !== b)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let ihdr: Uint8Array | null = null;
  const before: Uint8Array[] = [];
  const frames: Uint8Array[][] = [];
  let current: Uint8Array[] | null = null;
  let width = 0, height = 0;
  let seenActl = false;
  for (let p = 8; p + 12 <= bytes.length;) {
    const len = view.getUint32(p);
    const type = String.fromCharCode(...bytes.subarray(p + 4, p + 8));
    const data = bytes.subarray(p + 8, p + 8 + len);
    if (p + 12 + len > bytes.length) return null;
    p += 12 + len;
    if (type === "IHDR") { ihdr = data; const hv = new DataView(data.buffer, data.byteOffset, data.byteLength); width = hv.getUint32(0); height = hv.getUint32(4); continue; }
    if (type === "acTL") { seenActl = true; continue; }
    if (type === "fcTL") {
      const fv = new DataView(data.buffer, data.byteOffset, data.byteLength);
      // Whole frames only: the image's size, at 0,0, nothing kept of the last (blend SOURCE).
      if (fv.getUint32(4) !== width || fv.getUint32(8) !== height || fv.getUint32(12) !== 0 || fv.getUint32(16) !== 0 || data[25] !== 0) return null;
      current = [];
      frames.push(current);
      continue;
    }
    if (type === "IDAT") { if (current) current.push(data); else if (!seenActl) return null; continue; }
    if (type === "fdAT") { if (!current) return null; current.push(data.subarray(4)); continue; }
    if (type === "IEND") break;
    if (!current && frames.length === 0) before.push(chunk(type, data));
  }
  if (!ihdr || !seenActl || frames.length === 0 || frames.some((f) => f.length === 0)) return null;
  const head = chunk("IHDR", ihdr);
  const end = chunk("IEND", new Uint8Array(0));
  return frames.map((parts) => {
    const pieces = [new Uint8Array(PNG_SIGNATURE), head, ...before, ...parts.map((d) => chunk("IDAT", d)), end];
    const out = new Uint8Array(pieces.reduce((n, x) => n + x.length, 0));
    let o = 0;
    for (const x of pieces) { out.set(x, o); o += x.length; }
    return out;
  });
}

// ---------------------------------------------------------------- the inspector (exact phase 4)

/** What a browser asks for when its door to this machine is shut: the facts of one screen. */
export interface InspectRequest {
  seq: number;
  by: string | null;
  host: string;
  size: string;
  scheme: "light" | "dark";
  shots: string;
}

/** What `isocan exact live` answers: the facts as a JSON blob of the canvas. */
export interface InspectAnswer {
  seq: number;
  ok: boolean;
  blobHash: string | null;
  ms: number;
  error?: string;
}

export function parseInspectRequest(text: string | undefined): InspectRequest | null {
  if (!text) return null;
  try {
    const v = JSON.parse(text) as InspectRequest;
    if (!Number.isFinite(v?.seq) || typeof v.host !== "string" || typeof v.shots !== "string") return null;
    return { seq: v.seq, by: typeof v.by === "string" ? v.by : null, host: v.host, size: typeof v.size === "string" ? v.size : "390x844", scheme: v.scheme === "dark" ? "dark" : "light", shots: v.shots };
  } catch {
    return null;
  }
}

export function parseInspectAnswer(text: string | undefined): InspectAnswer | null {
  if (!text) return null;
  try {
    const v = JSON.parse(text) as InspectAnswer;
    return Number.isFinite(v?.seq) ? v : null;
  } catch {
    return null;
  }
}

/** One element of the driver's `tree --ax`, as it printed it. */
export interface AxElement {
  i: number;
  parent: number | null;
  role: string;
  name: string;
  states?: Record<string, unknown>;
  interactive?: boolean;
  frame?: { x: number; y: number; w: number; h: number };
  testId?: string;
}

/** The facts the inspector shows: the driver's own replies, unchanged, and the command that prints the same tree. */
export interface ScreenFacts {
  ok: boolean;
  host: string;
  url: string;
  size: string;
  scheme: string;
  shots: string[];
  command: string[];
  ax: { ax?: { elements?: AxElement[]; platform?: string; source?: string } } | null;
  layout: { nodes?: Array<{ id: number; type: string; testId?: string; x: number; y: number; w: number; h: number; sourceMap?: { file?: string; line?: number } }> } | null;
  perf: { walked?: number; sites?: unknown[]; resources?: Array<{ name: string; asked: number }>; work?: unknown } | null;
  logs: { lines?: string[] } | null;
  ms: number;
  error?: string;
}

/** The accessibility tree as indented rows: depth from each element's parent chain, as the driver ordered them. */
export function axRows(elements: readonly AxElement[]): Array<{ i: number; depth: number; role: string; name: string; testId: string | null; interactive: boolean }> {
  const depth = new Map<number, number>();
  return elements.map((e) => {
    const d = e.parent === null || e.parent === undefined ? 0 : (depth.get(e.parent) ?? 0) + 1;
    depth.set(e.i, d);
    return { i: e.i, depth: d, role: e.role, name: e.name, testId: e.testId ?? null, interactive: e.interactive === true };
  });
}

// ---------------------------------------------------------------- one film, landed (exact phase 4)

/** What the bridge's `film` reports — the CLI, `isocan exact live` and a paired browser all land a film from this. */
export interface FilmReport {
  ok: boolean;
  error?: string;
  file?: string;
  sha256: string;
  bytes: number;
  png: { width: number; height: number } | null;
  steps: number;
  at: number[] | null;
  states: FrameState[];
  stateError?: string;
  ms: { film: number; state: number };
}

/** What a film is asked for with: where it starts, the press before it, and its clock. */
export interface FilmJob {
  host: string;
  size: string;
  scheme: "light" | "dark";
  shots: string;
  ops: string[];
  over: number;
  every: number;
  watch: string | null;
}

/** A film asked for on the canvas (`exact.filmAsk`) when the browser's door is shut; `isocan exact live` answers. */
export interface FilmAsk extends FilmJob { seq: number; by: string | null }

/** The answer (`exact.filmed`): the strip's item, its digest, or why not. */
export interface FilmAnswer { seq: number; ok: boolean; itemId: string | null; sha256: string | null; ms: number; error?: string }

export function parseFilmAsk(text: string | undefined): FilmAsk | null {
  if (!text) return null;
  try {
    const v = JSON.parse(text) as FilmAsk;
    if (!Number.isFinite(v?.seq) || typeof v.host !== "string" || typeof v.shots !== "string" || !Array.isArray(v.ops) || v.ops.some((o) => typeof o !== "string")) return null;
    const over = Number(v.over), every = Number(v.every);
    if (!Number.isInteger(over) || !Number.isInteger(every) || over < 0 || every < 1) return null;
    return { seq: v.seq, by: typeof v.by === "string" ? v.by : null, host: v.host, size: typeof v.size === "string" ? v.size : "390x844", scheme: v.scheme === "dark" ? "dark" : "light", shots: v.shots, ops: v.ops, over, every, watch: typeof v.watch === "string" && v.watch ? v.watch : null };
  } catch {
    return null;
  }
}

export function parseFilmAnswer(text: string | undefined): FilmAnswer | null {
  if (!text) return null;
  try { const v = JSON.parse(text) as FilmAnswer; return Number.isFinite(v?.seq) ? v : null; } catch { return null; }
}

/** The keys a film's item wears — handed in, so this file reads no module record. */
export interface FilmKeys { app: string; film: string; frames: string }

interface Placed { id: string; x: number; y: number; width: number; height: number; properties?: Record<string, string> }

/**
 * **Where a film lands and what it wears** — one computation for the CLI's
 * `film`, `isocan exact live`'s answer and a paired browser: its facts (keyed
 * on what it depends on, `key` being the SHA-256 of `filmKeyText`), the item
 * already holding that key, and beside the map — right of everything this
 * app has on the canvas, level with the screen filmed.
 */
export function landFilm(
  items: readonly Placed[],
  keys: FilmKeys,
  app: { id: string },
  screen: Placed & { properties?: Record<string, string> },
  where: { route: string; device: string },
  job: FilmJob,
  report: FilmReport,
  key: string,
): { facts: FilmFacts; existing: Placed | null; title: string; at: { x: number; y: number }; width: number; height: number; properties: Record<string, string> } {
  const appProp = JSON.stringify({ id: app.id });
  const ours = items.filter((i) => i.properties?.[keys.app] === appProp);
  const films = ours.filter((i) => parseFilm(i.properties?.[keys.film]));
  const facts: FilmFacts = { from: report.at?.[0] ?? 0, every: job.every, steps: report.at?.length ?? report.steps, over: job.over, at: report.at ?? [], key, route: where.route, host: job.host, device: where.device, scheme: job.scheme, shots: job.shots, ops: job.ops, watch: job.watch, screen: screen.id };
  const existing = films.find((i) => parseFilm(i.properties?.[keys.film])?.key === key) ?? null;
  const right = Math.max(...ours.filter((i) => !parseFilm(i.properties?.[keys.film])).map((i) => i.x + i.width), screen.x + screen.width) + 160 + films.length * 480;
  const width = 420;
  const height = Math.round((width * (report.png?.height ?? 844)) / (report.png?.width ?? 390)) + 360;
  const frames = packFrames(report.states);
  return {
    facts, existing, title: filmTitle(facts), at: { x: Math.round(right), y: Math.round(screen.y) }, width, height,
    properties: { [keys.app]: appProp, [keys.film]: JSON.stringify(facts), ...(frames ? { [keys.frames]: JSON.stringify(frames) } : {}) },
  };
}
