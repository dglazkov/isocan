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
 * **A design system that travels between apps** (exact phase 9; design §13).
 * Pure: no keys, no network, no node — both surfaces read it.
 *
 * - **Extract** reads one app's design through Exact's printed interfaces —
 *   `forma ir` (each token's kind and source), `forma export dtcg` (each
 *   token's value per scheme, as Exact's own serializer writes it) and the
 *   named styles `contract symbols` names — into a design-system item that
 *   belongs to no app (`exact.system`, no `exact.app`), labelled with where
 *   it came from and the design's digest.
 * - **The mapping** from the system's token names to a target app's is shown
 *   before anything is held, every unmatched token named: a name the target
 *   has, of the same kind, matches; a person's `src=dst` says the rest. No
 *   guess is made silently — none is made at all.
 * - **Apply** writes nothing: the mapped tokens are written as a DTCG file
 *   under the target's names and handed to the target's served design as
 *   Exact's held import (`forma import dtcg <file> <url>`), which holds them
 *   as a proposal; Keep is phase 6's.
 */

/** One token of a system: Forma's kind and source, and each scheme's value as a DTCG leaf (`forma export dtcg`). */
export interface SystemToken {
  name: string;
  kind: string;
  /** The Forma source as the design wrote it (`light-dark(oklch(…), oklch(…))`). */
  source: string;
  /** Each scheme's DTCG leaf (`{$type, $value, $extensions?}`), as Exact's export wrote it; a person's edit rewrites it. */
  light: DtcgLeaf | null;
  dark: DtcgLeaf | null;
}

export interface DtcgLeaf { $type: string; $value: unknown; $extensions?: Record<string, unknown> }

/** A named style of the source app (`style Glass`), its rows as written. Exact's held import carries tokens only. */
export interface SystemStyle { name: string; file: string; line: number; rows: Array<{ row: string; value: string }> }

/** `exact.system` on a design-system item. */
export interface SystemRecord {
  from: { id: string; name: string; dir: string; commit: string | null };
  digest: string;
  tokens: SystemToken[];
  styles: SystemStyle[];
  at: string;
  /** Tokens a person changed on the canvas since the extract, by name: who, and the value before. */
  edited?: Record<string, { by: string; was: string }>;
}

export function parseSystem(text: string | undefined): SystemRecord | null {
  if (!text) return null;
  try {
    const v = JSON.parse(text) as SystemRecord;
    return v && v.from && typeof v.from.id === "string" && Array.isArray(v.tokens) && Array.isArray(v.styles) ? v : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- values a person reads and drags

/** A leaf's value as CSS, for a chip and the table: `oklch(0.55 0.17 255)`, `16px`, `6`. */
export function leafCss(leaf: DtcgLeaf | null): string {
  if (!leaf) return "";
  const v = leaf.$value as Record<string, unknown> | number | string;
  if (typeof v === "number" || typeof v === "string") return String(v);
  if (leaf.$type === "color" && v && Array.isArray(v.components)) {
    const c = (v.components as number[]).map((n) => +n.toFixed(4));
    const alpha = typeof v.alpha === "number" && v.alpha < 1 ? ` / ${+v.alpha.toFixed(3)}` : "";
    if (v.colorSpace === "oklch") return `oklch(${c.join(" ")}${alpha})`;
    if (typeof v.hex === "string") return alpha ? `${v.hex}${Math.round((v.alpha as number) * 255).toString(16).padStart(2, "0")}` : v.hex;
    return `color(${String(v.colorSpace)} ${c.join(" ")}${alpha})`;
  }
  if (leaf.$type === "dimension" && v && typeof v.value === "number") return `${v.value}${String(v.unit ?? "px")}`;
  if (leaf.$type === "shadow") return `a shadow of ${Array.isArray(v) ? v.length : 1} layer${Array.isArray(v) && v.length !== 1 ? "s" : ""}`;
  return JSON.stringify(v).slice(0, 80);
}

/** What a chip drags: an oklch colour's hue (degrees) or a dimension's px; null for anything else. */
export function dragOf(token: SystemToken): { what: "hue" | "px"; at: number } | null {
  const v = token.light?.$value as Record<string, unknown> | undefined;
  if (token.kind === "color" && v?.colorSpace === "oklch" && Array.isArray(v.components)) return { what: "hue", at: Number((v.components as number[])[2]) };
  if (token.light?.$type === "dimension" && typeof v?.value === "number" && (v.unit ?? "px") === "px") return { what: "px", at: v.value };
  return null;
}

/**
 * A token dragged to `to`: an oklch colour's hue turned by the same amount on
 * both schemes (so "warmer" is warmer in dark mode too), a px dimension set.
 * The leaves lose Exact's `source` note, which would otherwise win over the
 * edited value when the import reads them.
 */
export function dragged(token: SystemToken, to: number): SystemToken {
  const d = dragOf(token);
  if (!d) return token;
  const turn = (leaf: DtcgLeaf | null): DtcgLeaf | null => {
    if (!leaf) return leaf;
    const v = { ...(leaf.$value as Record<string, unknown>) };
    if (d.what === "hue") {
      const c = [...(v.components as number[])];
      c[2] = (((c[2]! + (to - d.at)) % 360) + 360) % 360;
      v.components = c.map((n) => +n.toFixed(4));
      delete v.hex;
    } else v.value = to;
    return { $type: leaf.$type, $value: v };
  };
  const light = turn(token.light), dark = turn(token.dark);
  const css = token.kind === "color" ? `light-dark(${leafCss(light)}, ${leafCss(dark)})` : leafCss(light);
  return { ...token, light, dark, source: css };
}

// ---------------------------------------------------------------- the mapping

/** A target's token as its index lists it. */
export interface TargetToken { name: string; kind: string }

export interface MappingRow { from: string; kind: string; to: string | null; how: "same name" | "named by a person" | null; why: string | null }

export interface Mapping {
  rows: MappingRow[];
  /** The target's tokens no source token reaches: kept as they are. */
  untouched: string[];
}

/** The kind a DTCG leaf lands as, for comparing with a target token's Forma kind. */
const kindOf = (k: string) => (k === "color" ? "color" : k);

/**
 * **Which source token becomes which target token** — a target token of the
 * same name and kind, or the one a person named (`src=dst`); anything else is
 * unmatched, with why. Never a guess.
 */
export function mapTokens(system: readonly SystemToken[], target: readonly TargetToken[], named: Readonly<Record<string, string>> = {}): Mapping {
  const byName = new Map(target.map((t) => [t.name, t]));
  const used = new Set<string>();
  const rows: MappingRow[] = system.map((s) => {
    const pick = named[s.name];
    if (pick !== undefined) {
      const t = byName.get(pick);
      if (!pick) return { from: s.name, kind: s.kind, to: null, how: null, why: "left out by a person" };
      if (!t) return { from: s.name, kind: s.kind, to: null, how: null, why: `the target has no token ${pick}` };
      if (kindOf(t.kind) !== kindOf(s.kind)) return { from: s.name, kind: s.kind, to: null, how: null, why: `${pick} is a ${t.kind}, not a ${s.kind}` };
      if (used.has(t.name)) return { from: s.name, kind: s.kind, to: null, how: null, why: `${pick} is already reached by another token` };
      used.add(t.name);
      return { from: s.name, kind: s.kind, to: t.name, how: "named by a person", why: null };
    }
    const t = byName.get(s.name);
    if (t && kindOf(t.kind) === kindOf(s.kind) && !used.has(t.name) && !Object.values(named).includes(t.name)) {
      used.add(t.name);
      return { from: s.name, kind: s.kind, to: t.name, how: "same name", why: null };
    }
    if (t) return { from: s.name, kind: s.kind, to: null, how: null, why: `the target's ${s.name} is a ${t.kind}` };
    return { from: s.name, kind: s.kind, to: null, how: null, why: "no token of that name in the target; name one with src=dst" };
  });
  return { rows, untouched: target.map((t) => t.name).filter((n) => !used.has(n)) };
}

/** `--map brand.primary=brand.ink` (and `--map wash.sky=` to leave one out) as a map; a malformed one is a sentence. */
export function parseMaps(list: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const one of list) {
    const m = /^([A-Za-z_-][A-Za-z0-9_.-]*)=([A-Za-z_-][A-Za-z0-9_.-]*)?$/.exec(one.trim());
    if (!m) throw new Error(`--map takes source=target (a token of the system, a token of the app), not ${JSON.stringify(one)}`);
    out[m[1]!] = m[2] ?? "";
  }
  return out;
}

/**
 * **The DTCG file Apply hands to Exact's held import**: only the mapped
 * tokens, each under its target name, in the resolver form Exact's own export
 * writes — one set named `exact`, a `mode` modifier whose contexts are light
 * and dark — but without the export's header (whose digest would make it a
 * re-import, refused against another design's baseline). Measured 15 Nov 2026
 * (Exact a54f4234): in that shape the importer reads each name as written; a
 * set of any other name takes the generic resolver path, which puts the
 * `--prefix` before every name, and an empty one leaves a leading dot
 * (`.brand.ink`), mapping nothing.
 */
export function dtcgFor(system: SystemRecord, mapping: Mapping): string {
  const contexts: Record<"light" | "dark", Record<string, unknown>> = { light: {}, dark: {} };
  const put = (tree: Record<string, unknown>, name: string, leaf: DtcgLeaf) => {
    const segs = name.split(".");
    let t = tree;
    for (const s of segs.slice(0, -1)) t = (t[s] ??= {}) as Record<string, unknown>;
    t[segs.at(-1)!] = leaf;
  };
  const byName = new Map(system.tokens.map((t) => [t.name, t]));
  for (const row of mapping.rows) {
    if (!row.to) continue;
    const t = byName.get(row.from);
    if (!t) continue;
    for (const s of ["light", "dark"] as const) {
      const leaf = t[s] ?? t.light;
      if (leaf) put(contexts[s], row.to, leaf);
    }
  }
  const doc = {
    name: `${system.from.name} for the target`,
    version: "2025.10",
    sets: { exact: { sources: [{}] } },
    modifiers: { mode: { contexts: { light: [contexts.light], dark: [contexts.dark] }, default: "light" } },
    resolutionOrder: [{ $ref: "#/sets/exact" }, { $ref: "#/modifiers/mode" }],
  };
  return `${JSON.stringify(doc, null, 2)}\n`;
}

// ---------------------------------------------------------------- the ask, the card, the answer

/** `exact.apply` on a system item: apply it to the app with this bundle id, with a person's names for the rest. */
export interface ApplyAsk { seq: number; by: string | null; app: string; map: Record<string, string> }

/** `exact.applied`: the mapping card, the proposal item, the held import, what had no match, and what could not travel. */
export interface ApplyAnswer {
  seq: number; ok: boolean; app: string; card: string | null; itemId: string | null; proposal: string | null; class: "live" | "rebuild" | null;
  mapped: number; unmatched: string[]; reported: Array<{ name: string; why: string }>; styles: string[]; previews: number; ms: number; error?: string;
}

export function parseApplyAsk(text: string | undefined): ApplyAsk | null {
  if (!text) return null;
  try {
    const v = JSON.parse(text) as ApplyAsk;
    if (!Number.isFinite(v?.seq) || typeof v.app !== "string" || !v.app) return null;
    const map = v.map && typeof v.map === "object" ? Object.fromEntries(Object.entries(v.map).filter(([k, x]) => typeof k === "string" && typeof x === "string").slice(0, 64)) : {};
    return { seq: v.seq, by: typeof v.by === "string" ? v.by : null, app: v.app, map };
  } catch {
    return null;
  }
}

export function parseApplyAnswer(text: string | undefined): ApplyAnswer | null {
  if (!text) return null;
  try { const v = JSON.parse(text) as ApplyAnswer; return Number.isFinite(v?.seq) ? v : null; } catch { return null; }
}

/** The sentence every card and answer carries about named styles: Exact's held import takes tokens, so a style does not travel. */
export function stylesNote(styles: readonly SystemStyle[]): string | null {
  if (styles.length === 0) return null;
  return `Not carried: the named style${styles.length === 1 ? "" : "s"} ${styles.map((s) => s.name).join(", ")}. Exact's held import (\`forma import dtcg\`) holds tokens only, so a style's rows (a translucent background, a hairline border, a material) stay in ${styles[0]!.file} of the source app; nothing writes them into the target.`;
}

/** The mapping card: a Markdown table a person reads before anything is held (design §13). */
export function mappingMarkdown(system: SystemRecord, target: { id: string; name: string }, mapping: Mapping): string {
  const byName = new Map(system.tokens.map((t) => [t.name, t]));
  const rows = mapping.rows.map((r) => {
    const t = byName.get(r.from);
    const value = t ? (t.kind === "color" ? `${leafCss(t.light)} / ${leafCss(t.dark)}` : leafCss(t.light)) : "";
    return `| \`${r.from}\` | ${r.kind} | ${r.to ? `\`${r.to}\`` : "—"} | ${r.to ? r.how : `no match: ${r.why}`} | ${value} |`;
  });
  const mapped = mapping.rows.filter((r) => r.to).length;
  const note = stylesNote(system.styles);
  return [
    `# ${system.from.name} → ${target.name}`,
    "",
    `The design system extracted from ${system.from.name} (\`${system.from.id}\`, design digest \`${system.digest}\`), mapped onto ${target.name}'s tokens. ${mapped} of ${mapping.rows.length} tokens have a match; only those are sent, as Exact's held import, and arrive as a proposal. Nothing is written until a person keeps it.`,
    "",
    "| Source token | Kind | Becomes | How | Value (light / dark) |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
    "",
    mapping.untouched.length ? `Kept as they are in ${target.name} (no source token reaches them): ${mapping.untouched.map((n) => `\`${n}\``).join(", ")}.` : `Every token of ${target.name} is reached.`,
    ...(note ? ["", note] : []),
    "",
  ].join("\n");
}

/** The system item's DESIGN.md body table: the same row shape the token panel reads (`proposal.ts`'s `tokensOf`). */
export function systemRows(system: SystemRecord): string[] {
  return system.tokens.map((t) => `| \`${t.name}\` | ${t.kind} | ${leafCss(t.light) || t.source} | ${t.kind === "color" ? leafCss(t.dark) : ""} | ${system.edited?.[t.name] ? `edited by ${system.edited[t.name]!.by}` : "as extracted"} |`);
}
