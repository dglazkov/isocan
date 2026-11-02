import { chosenOption, entropyBits, type JevRequest, type JevResponse } from "./answerer.ts";
import type { DensityLevel, Platform, TemplateId } from "./catalog/index.ts";
import type { WireDeclined, WireSpec } from "./spec.ts";

/**
 * **Decision Q&A (`wire why` / `/wire why`)** (design §13).
 *
 * Reads a screen's embedded `WireSpec` (`decisions`, `need`, `maybe`, `by`,
 * `pinned`, per-slot `p` and `alternatives`, `declined`, `template`, `density`,
 * `style`, and `content`) and explains why each flow and screen decision was
 * chosen, citing the recorded probabilities and runner-up alternatives — with
 * zero `.session.json` sidecar files on disk.
 */

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Extract compact top-3 probability distributions (rounded to 2 decimal places)
 * for every answered question in `req`/`res`.
 */
export function compactDecisions(
  req: JevRequest,
  res: JevResponse,
): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const [id, q] of Object.entries(req.questions)) {
    const a = res.answers[id];
    if (!a) continue;
    const { distribution } = chosenOption(q, a);
    const top3 = Object.entries(distribution)
      .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
      .slice(0, 3)
      .map(([k, p]) => [k, round2(p)] as const);
    out[id] = Object.fromEntries(top3);
  }
  return out;
}

/**
 * Merge compact top-3 decision distributions from `req`/`res` onto `spec.decisions`.
 */
export function recordDecisions(
  spec: WireSpec,
  req: JevRequest,
  res: JevResponse,
): WireSpec {
  const added = compactDecisions(req, res);
  if (Object.keys(added).length === 0) return spec;
  return {
    ...spec,
    decisions: { ...(spec.decisions ?? {}), ...added },
  };
}

/** Structured explanation returned by `explainWireDecision` (`wire why`). */
export interface DecisionExplanation {
  /** Screen title. */
  screenTitle: string;
  /** Screen archetype id. */
  archetype: string;
  /** Target platform (`app`, `web`, `site`). */
  platform: Platform;
  /** Answerer attribution (`jev`, `stub`, `agent`, or model id). */
  by: string;
  /** Round 1's P(yes) for including this archetype. */
  need?: number;
  /** True when the screen landed in the maybe band (`0.30 <= need < 0.50`). */
  maybe?: boolean;
  /** Multi-region layout template (`single`, `dashboard`, `sidebar-detail`, etc.). */
  template?: TemplateId;
  /** Spacing density (`compact`, `default`, `spacious`). */
  density?: DensityLevel;
  /** Pinned root/screen decisions. */
  pinned?: Record<string, string>;
  /** Per-slot chosen blocks, probabilities, runner-up alternatives, and entropy. */
  slots: Array<{
    slot: string;
    block: string | null;
    p?: number;
    entropy?: number;
    alternatives: Array<{ block: string; p: number }>;
    region?: string;
  }>;
  /** Optional sections declined during Round 2. */
  declined: WireDeclined[];
  /** Compact per-question probability distributions. */
  decisions: Record<string, Record<string, number>>;
  /** Formatted human-readable lines explaining the decisions. */
  lines: string[];
}

function pct(p: number): string {
  return `${Math.round(p * 100)}%`;
}

/**
 * Explain why a wireframe screen's archetype, platform, layout template,
 * density, and slot blocks were chosen, reading directly from `spec`. When
 * `question` is given, filters or highlights matching slots/keys first.
 */
export function explainWireDecision(
  spec: WireSpec,
  question?: string,
): DecisionExplanation {
  const by = spec.by?.model ?? spec.by?.answerer ?? "hand-drawn";
  const lines: string[] = [];
  const needPart = spec.need !== undefined ? ` · need P(yes)=${pct(spec.need)}${spec.maybe ? " (maybe)" : ""}` : "";
  const tplPart = spec.template ? ` · template=${spec.template}` : "";
  const denPart = spec.density ? ` · density=${spec.density}` : "";
  lines.push(
    `${spec.title} (${spec.archetype}, ${spec.platform}) — answered by ${by}${needPart}${tplPart}${denPart}`,
  );

  if (spec.pinned && Object.keys(spec.pinned).length > 0) {
    const pins = Object.entries(spec.pinned)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ");
    lines.push(`  pinned: ${pins}`);
  }

  const slotRows = spec.slots.map((s) => {
    const alts = s.alternatives ?? [];
    const dist: Record<string, number> = {};
    if (s.block && s.p !== undefined) dist[s.block] = s.p;
    for (const a of alts) dist[a.block] = a.p;
    const entropy = Object.keys(dist).length > 0 ? round2(entropyBits(dist)) : undefined;
    return {
      slot: s.slot,
      block: s.block,
      ...(s.p !== undefined ? { p: s.p } : {}),
      ...(entropy !== undefined ? { entropy } : {}),
      alternatives: alts,
      ...(s.region ? { region: s.region } : {}),
    };
  });

  const qLower = question?.trim().toLowerCase();
  const matchesFilter = (key: string, text: string): boolean => {
    if (!qLower) return true;
    return key.toLowerCase().includes(qLower) || text.toLowerCase().includes(qLower);
  };

  for (const row of slotRows) {
    const pStr = row.p !== undefined ? ` (${pct(row.p)})` : "";
    const regStr = row.region ? ` [${row.region}]` : "";
    const altStr = row.alternatives.length > 0
      ? ` — runners-up: ${row.alternatives.map((a) => `${a.block} ${pct(a.p)}`).join(", ")}`
      : "";
    const line = `  ${row.slot}: ${row.block ?? "blueprint"}${pStr}${regStr}${altStr}`;
    if (matchesFilter(row.slot, line)) lines.push(line);
  }

  const declined = spec.declined ?? [];
  if (declined.length > 0) {
    const decLine = `  declined optional slots: ${declined.map((d) => `${d.slot} (${d.block}, P(omit)=${pct(d.p)})`).join(", ")}`;
    if (matchesFilter("declined", decLine)) lines.push(decLine);
  }

  const decisions = spec.decisions ?? {};
  for (const [qId, dist] of Object.entries(decisions)) {
    const formatted = Object.entries(dist)
      .map(([k, p]) => `${k} ${pct(p)}`)
      .join(", ");
    const ent = round2(entropyBits(dist));
    const line = `  decision ${qId}: ${formatted} [entropy ${ent.toFixed(2)} bits]`;
    if (matchesFilter(qId, line)) lines.push(line);
  }

  if (lines.length === 1 && qLower) {
    // Nothing matched the specific filter; include all slots so the caller always gets an answer.
    for (const row of slotRows) {
      const pStr = row.p !== undefined ? ` (${pct(row.p)})` : "";
      const altStr = row.alternatives.length > 0
        ? ` — runners-up: ${row.alternatives.map((a) => `${a.block} ${pct(a.p)}`).join(", ")}`
        : "";
      lines.push(`  ${row.slot}: ${row.block ?? "blueprint"}${pStr}${altStr}`);
    }
  }

  return {
    screenTitle: spec.title,
    archetype: spec.archetype,
    platform: spec.platform,
    by,
    ...(spec.need !== undefined ? { need: spec.need } : {}),
    ...(spec.maybe ? { maybe: true } : {}),
    ...(spec.template ? { template: spec.template } : {}),
    ...(spec.density ? { density: spec.density } : {}),
    ...(spec.pinned ? { pinned: spec.pinned } : {}),
    slots: slotRows,
    declined,
    decisions,
    lines,
  };
}
