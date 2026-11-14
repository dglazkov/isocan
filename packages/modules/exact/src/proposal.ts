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
 * **Agents propose, the facts both surfaces share** (exact phase 6;
 * `docs/projects/exact/design.md` §10). Pure: no keys, no network, no node.
 *
 * - **Scopes from isocan's roles.** Tamber's wire orders `read` < `propose` <
 *   `write`. A viewer never reaches the bridge at all (the canvas refuses its
 *   writes); an enrolled agent — a standing agent on the canvas — proposes and
 *   never writes; anybody else whose write the canvas accepted may edit it, so
 *   is `write`. The bridge pairs the agent with the wire at `propose`, and the
 *   wire itself refuses that client an `accept`.
 * - **An ask** (`exact.propose` on a screen): Tamber operations from a closed
 *   list, and why. `isocan exact live` holds it on the dev loop's wire,
 *   pictures it before and after on every device and scheme, and posts a core
 *   proposal item under the screen whose current version is the screen as the
 *   proposal would draw it — so the person's Keep (core's choose) folds the
 *   picture in as the screen's next version, and only then does the bridge
 *   `accept` it and the files change.
 */

/** A Tamber operation a proposal may carry (`docs/tamber-protocol.md`, Operations): a closed list. */
export type TamberOp =
  | { op: "set-token"; name: string; value: string; when?: Array<{ axis: string; value: string }>; comment?: string }
  | { op: "set-row"; row: string; value: string | number; style?: string; file?: string; at?: { line: number; col: number }; sha256?: string; state?: string }
  | { op: "set-state"; style: string; state: string; row: string; value: string | number; file?: string };

export type Scope = "read" | "propose" | "write";

/** An agent proposes; a person whose write the canvas accepted writes (design §10's table). */
export function scopeFor(isAgent: boolean): Exclude<Scope, "read"> {
  return isAgent ? "propose" : "write";
}

/** What `exact.propose` asks: the operations, why, what prompted it, and the area to hang it in (a design-competition lane). */
export interface ProposeAsk { seq: number; by: string | null; ops: TamberOp[]; why: string; cites: Array<{ kind: string; ref: string }>; in: string | null }

/** The answer (`exact.proposed`): the proposal item, the wire's id and class, the asker's scope, or why not. */
export interface ProposeAnswer {
  seq: number; ok: boolean; itemId: string | null; proposal: string | null; class: "live" | "rebuild" | null;
  scope: "propose" | "write" | null; client: string | null; how: "scrub" | "staged" | null; previews: number;
  /** For an agent: the wire's answer when its own client tried to `accept` — 403 `needs: write` is the scope holding. */
  scopeCheck: { status: number; scope: string | null; needs: string | null } | null;
  ms: number; error?: string;
}

/** One picture pair of a proposal: a host, device and scheme, before and as proposed — each a version of the proposal item. */
export interface PreviewCell { host: string; device: string; scheme: "light" | "dark"; before: string; after: string; restored: boolean | null }

/** On a proposal item (`exact.proposal`): what was asked, by whom, at what scope, what the wire holds, and the pictures. */
export interface ProposalRecord {
  seq: number;
  route: string;
  asker: { id: string; name: string; kind: "agent" | "person" };
  scope: "propose" | "write";
  client: string;
  proposal: string;
  class: "live" | "rebuild";
  how: "scrub" | "staged";
  ops: TamberOp[];
  /** The design files' digests the wire planned against: a Keep after a file moved is refused by the wire. */
  files: Record<string, string>;
  changed: Array<{ file: string; token: string }>;
  previews: PreviewCell[];
  at: string;
}

/** On the screen a proposal hung under, once a Keep reached the wire (`exact.accepted`). */
export interface AcceptAnswer { item: string; version: string; ok: boolean; proposal: string | null; heldAgain: string | null; written: string[]; by: string | null; at: string; error?: string }

const TOKEN_NAME = /^[A-Za-z_][A-Za-z0-9_.-]{0,80}$/;
const ROW_NAME = /^-?[a-z][a-z0-9-]{0,60}$/;
const STYLE_NAME = /^[A-Z][A-Za-z0-9_]{0,60}$/;
const VALUE = /^[^\n\r\0]{1,200}$/;

/** Is this an operation a proposal may carry? A sentence saying why not, or null. */
export function opProblem(op: unknown): string | null {
  const o = op as Record<string, unknown> | null;
  if (!o || typeof o !== "object") return "an operation is an object";
  const value = (v: unknown) => (typeof v === "number" && Number.isFinite(v)) || (typeof v === "string" && VALUE.test(v));
  if (o.op === "set-token") {
    if (typeof o.name !== "string" || !TOKEN_NAME.test(o.name)) return `set-token names a token, not ${JSON.stringify(o.name)}`;
    if (typeof o.value !== "string" || !VALUE.test(o.value)) return "set-token's value is one short line";
    return null;
  }
  if (o.op === "set-row") {
    if (typeof o.row !== "string" || !ROW_NAME.test(o.row)) return `set-row names a row, not ${JSON.stringify(o.row)}`;
    if (!value(o.value)) return "set-row's value is a number or one short line";
    if (o.style !== undefined) return typeof o.style === "string" && STYLE_NAME.test(o.style) ? null : `set-row's style is a style's name, not ${JSON.stringify(o.style)}`;
    if (typeof o.file !== "string" || o.file.startsWith("/") || o.file.split(/[\\/]/).includes("..")) return "set-row at a place names the app's file";
    const at = o.at as { line?: unknown; col?: unknown } | undefined;
    if (!at || !Number.isInteger(at.line) || !Number.isInteger(at.col)) return "set-row at a place says where: at {line, col}";
    if (typeof o.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(o.sha256)) return "set-row at a place carries the file's sha256 as you read it";
    return null;
  }
  if (o.op === "set-state") {
    if (typeof o.style !== "string" || !STYLE_NAME.test(o.style) || typeof o.state !== "string" || typeof o.row !== "string" || !ROW_NAME.test(o.row) || !value(o.value)) return "set-state names a style, a state, a row and a value";
    return null;
  }
  return `a proposal carries set-token, set-row or set-state, not ${JSON.stringify(o.op)}`;
}

/**
 * The operations a terminal asks for: `--token radius.card=12px` (set-token),
 * `--row Price.background-color=-exact-tertiary-background` (set-row on a
 * style), `--op '<json>'` (any operation of the closed list, as Tamber spells
 * it). A malformed one is a sentence.
 */
export function opsFromFlags(tokens: readonly string[], rows: readonly string[], raw: readonly string[]): TamberOp[] {
  const ops: TamberOp[] = [];
  for (const t of tokens) {
    const at = t.indexOf("=");
    if (at <= 0) throw new Error(`--token takes name=value, not ${JSON.stringify(t)}`);
    ops.push({ op: "set-token", name: t.slice(0, at).trim(), value: t.slice(at + 1).trim() });
  }
  for (const r of rows) {
    const m = /^([A-Z][A-Za-z0-9_]*)\.(-?[a-z][a-z0-9-]*)=(.+)$/.exec(r.trim());
    if (!m) throw new Error(`--row takes Style.row=value (a row of a \`style\`), not ${JSON.stringify(r)}`);
    const v = m[3]!.trim();
    ops.push({ op: "set-row", style: m[1]!, row: m[2]!, value: /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v });
  }
  for (const j of raw) {
    let op: unknown;
    try { op = JSON.parse(j); } catch { throw new Error(`--op takes one Tamber operation as JSON, not ${JSON.stringify(j.slice(0, 80))}`); }
    ops.push(op as TamberOp);
  }
  if (ops.length === 0) throw new Error("a proposal says what it changes: --token name=value, --row Style.row=value or --op '<json>'");
  if (ops.length > 32) throw new Error("a proposal carries at most 32 operations");
  for (const op of ops) { const p = opProblem(op); if (p) throw new Error(p); }
  return ops;
}

/** One line per operation, as a person reads it. */
export function opWords(op: TamberOp): string {
  if (op.op === "set-token") return `${op.name} → ${op.value}`;
  if (op.op === "set-state") return `${op.style}:${op.state} ${op.row} → ${op.value}`;
  return `${op.style ?? `${op.file}:${op.at?.line}`} ${op.row} → ${op.value}`;
}

export function parseProposeAsk(text: string | undefined): ProposeAsk | null {
  if (!text) return null;
  try {
    const v = JSON.parse(text) as ProposeAsk;
    if (!Number.isFinite(v?.seq) || !Array.isArray(v.ops) || v.ops.length === 0 || v.ops.length > 32 || v.ops.some((o) => opProblem(o) !== null)) return null;
    if (typeof v.why !== "string" || !v.why.trim() || v.why.length > 600) return null;
    const cites = Array.isArray(v.cites) ? v.cites.filter((c) => c && typeof c.kind === "string" && typeof c.ref === "string" && c.ref).slice(0, 8) : [];
    return { seq: v.seq, by: typeof v.by === "string" ? v.by : null, ops: v.ops, why: v.why.trim(), cites, in: typeof v.in === "string" && v.in ? v.in : null };
  } catch {
    return null;
  }
}

export function parseProposeAnswer(text: string | undefined): ProposeAnswer | null {
  if (!text) return null;
  try { const v = JSON.parse(text) as ProposeAnswer; return Number.isFinite(v?.seq) ? v : null; } catch { return null; }
}

export function parseProposalRecord(text: string | undefined): ProposalRecord | null {
  if (!text) return null;
  try {
    const v = JSON.parse(text) as ProposalRecord;
    return v && typeof v.proposal === "string" && Array.isArray(v.ops) && Array.isArray(v.previews) && v.asker && typeof v.route === "string" ? v : null;
  } catch {
    return null;
  }
}

export function parseAcceptAnswer(text: string | undefined): AcceptAnswer | null {
  if (!text) return null;
  try { const v = JSON.parse(text) as AcceptAnswer; return v && typeof v.item === "string" && typeof v.version === "string" ? v : null; } catch { return null; }
}

const HOST_ORDER = ["web", "ios", "macos"];
const DEVICE_ORDER = ["phone", "tablet", "desktop"];

/** The preview grid, a row per host and device (web's phone, tablet, desktop, then iOS), each with light and dark. */
export function previewRows(cells: readonly PreviewCell[]): Array<{ host: string; device: string; light: PreviewCell | null; dark: PreviewCell | null }> {
  const keys = [...new Set(cells.map((c) => `${c.host}\u0000${c.device}`))];
  keys.sort((a, b) => {
    const [ha, da] = a.split("\u0000"), [hb, db] = b.split("\u0000");
    return HOST_ORDER.indexOf(ha!) - HOST_ORDER.indexOf(hb!) || DEVICE_ORDER.indexOf(da!) - DEVICE_ORDER.indexOf(db!);
  });
  return keys.map((k) => {
    const [host, device] = k.split("\u0000") as [string, string];
    const of = (s: "light" | "dark") => cells.find((c) => c.host === host && c.device === device && c.scheme === s) ?? null;
    return { host, device, light: of("light"), dark: of("dark") };
  });
}

/** The proposal item's title: who, and what, in a line. */
export function proposalTitle(asker: string, ops: readonly TamberOp[]): string {
  const what = ops.slice(0, 2).map(opWords).join("; ") + (ops.length > 2 ? ` and ${ops.length - 2} more` : "");
  return `Proposed by ${asker}: ${what}`.slice(0, 160);
}

/** A design token as the design-system item's table lists it (`build.ts`'s `designMarkdown`). */
export interface DesignToken { name: string; kind: string; light: string; dark: string }

/** The tokens the design-system item this module wrote lists, read from its table: what the token panel's chips drag. */
export function tokensOf(markdown: string): DesignToken[] {
  const out: DesignToken[] = [];
  for (const line of markdown.split("\n")) {
    const m = /^\| `([^`]+)` \| ([a-z-]+) \| ([^|]*)\| ([^|]*)\|/.exec(line);
    if (m) out.push({ name: m[1]!, kind: m[2]!, light: m[3]!.trim(), dark: m[4]!.trim() });
  }
  return out;
}
