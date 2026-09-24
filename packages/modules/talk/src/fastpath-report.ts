/**
 * **The shadow record, read** (voice-agent phase 6): per action, how often
 * Jev's proposal agreed with the act that was meant; the reliability curve of
 * its least certain answer; and the threshold at which agreement reaches 95%
 * on at least 30 commands — the number fast-path.md says phase 7 may act on,
 * and the only way a threshold enters this project.
 *
 * Two sources feed it the same rows: the scripted command set (the meant act
 * is written down) and a person's exported shadow record (the meant act is
 * the model's, when nobody took it back). Pure — the script does the I/O.
 */
import { JEV_INPUT_PRICE } from "@isocan/core/jev";
import { FAST_ACT_NAMES, sameAct, type ActKind, type CanonicalAct, type FastAct } from "./fastpath.ts";
import type { ShadowTurn } from "./shadow.ts";

export interface EvalRow {
  id: string;
  utterance: string;
  /** The act meant — `{act: "escalate"}` for "this is the model's". */
  truth: CanonicalAct;
  /** An act known to be WRONG (a model act somebody undid): agreeing with it is wrong, anything else is unscored. */
  wrong?: CanonicalAct;
  /** Tagged complex in the command set: must escalate. */
  complex: boolean;
  /** Held out: written after a live run had scored the rest. */
  hard?: boolean;
  proposed: CanonicalAct;
  action: FastAct | "none";
  /** The least certain answer the proposal relied on; null when Jev was not asked. */
  p: number | null;
  reasons: string[];
  ms: number;
  tokens: number;
  by: string;
  error?: string;
}

/** Is this row's proposal right? `null` when there is nothing to score it against. */
export function scored(row: EvalRow): boolean | null {
  if (row.wrong) return sameAct(row.proposed, row.wrong) ? false : null;
  return sameAct(row.proposed, row.truth);
}

/** Which fast-path act a canonical act is — the action a threshold belongs to. */
export function actionOf(kind: ActKind): FastAct | "none" {
  if (kind === "move-by" || kind === "move-beside") return "move";
  if (kind === "escalate") return "none";
  return kind;
}

export interface Bin { lo: number; hi: number; n: number; meanP: number; accuracy: number }

/** Ten equal-width bins of `p` against how often it was right, and the count-weighted gap (ECE) — calibrate.ts's reading, over this question. */
export function reliability(points: Array<{ p: number; right: boolean }>, bins = 10): { bins: Bin[]; ece: number } {
  const acc = Array.from({ length: bins }, (_, i) => ({ lo: i / bins, hi: (i + 1) / bins, n: 0, sumP: 0, right: 0 }));
  for (const pt of points) {
    const b = acc[Math.min(bins - 1, Math.max(0, Math.floor(pt.p * bins)))]!;
    b.n++;
    b.sumP += pt.p;
    if (pt.right) b.right++;
  }
  const out = acc.map((b) => ({ lo: b.lo, hi: b.hi, n: b.n, meanP: b.n ? b.sumP / b.n : 0, accuracy: b.n ? b.right / b.n : 0 }));
  const total = points.length || 1;
  return { bins: out, ece: out.reduce((s, b) => s + (b.n / total) * Math.abs(b.accuracy - b.meanP), 0) };
}

/**
 * **The lowest cut at which what is kept agrees ≥ `target` of the time on
 * ≥ `minN` commands** (fast-path.md, *The threshold is measured*). Cuts are
 * tried at every observed p, so the answer is a p that occurred; null when no
 * cut qualifies — the action stays with the model.
 */
export function thresholdFor(points: Array<{ p: number; right: boolean }>, target = 0.95, minN = 30): { cut: number; n: number; accuracy: number } | null {
  const ps = [...new Set(points.map((x) => x.p))].sort((a, b) => a - b);
  for (const cut of ps) {
    const kept = points.filter((x) => x.p >= cut);
    const accuracy = kept.filter((x) => x.right).length / kept.length;
    if (kept.length >= minN && accuracy >= target) return { cut, n: kept.length, accuracy };
  }
  return null;
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

function quantile(xs: number[], f: number): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(f * s.length))] ?? 0;
}

export interface ReportNumbers {
  n: number;
  agreement: number;
  perTruth: Array<{ kind: ActKind; n: number; right: number; escalated: number; meanP: number | null }>;
  perAction: Array<{ action: FastAct; proposed: number; right: number; threshold: ReturnType<typeof thresholdFor> }>;
  pooledThreshold: ReturnType<typeof thresholdFor>;
  complex: { n: number; escalated: number };
  hard: { n: number; right: number };
  /** Everything not held out, scored the same way — the number the hard set is compared with. */
  rest: { n: number; right: number };
  escalation: { precision: number; recall: number; jevEscalated: number; truthEscalate: number };
  curve: ReturnType<typeof reliability>;
  latency: { p50: number; p90: number; max: number };
  tokens: number;
  cost: number;
  errors: number;
}

/** The numbers, before words — what a test asserts and the markdown prints. */
export function numbers(rows: readonly EvalRow[]): ReportNumbers {
  const live = rows.filter((r) => !r.error);
  const scoredRows = live.map((r) => ({ r, s: scored(r) })).filter((x): x is { r: EvalRow; s: boolean } => x.s !== null);
  const kinds: ActKind[] = ["move-by", "move-beside", "grow", "shrink", "delete", "undo", "select", "show", "escalate"];
  const perTruth = kinds.map((kind) => {
    const rs = live.filter((r) => !r.wrong && r.truth.act === kind);
    const ps = rs.map((r) => r.p).filter((p): p is number => p !== null);
    return {
      kind,
      n: rs.length,
      right: rs.filter((r) => sameAct(r.proposed, r.truth)).length,
      escalated: rs.filter((r) => r.proposed.act === "escalate").length,
      meanP: ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : null,
    };
  }).filter((t) => t.n > 0);
  // A threshold is set on proposals that NAMED an act: an escalation is never acted on, so it cannot be wrong in the way a threshold guards.
  const actPoints = (filter: (r: EvalRow) => boolean) =>
    scoredRows.filter(({ r }) => r.proposed.act !== "escalate" && r.p !== null && filter(r)).map(({ r, s }) => ({ p: r.p!, right: s }));
  const perAction = FAST_ACT_NAMES.map((action) => {
    const pts = actPoints((r) => r.action === action);
    return { action, proposed: pts.length, right: pts.filter((x) => x.right).length, threshold: thresholdFor(pts) };
  });
  const truthEscalate = live.filter((r) => !r.wrong && r.truth.act === "escalate");
  const jevEscalated = live.filter((r) => !r.wrong && r.proposed.act === "escalate");
  const complex = live.filter((r) => r.complex);
  const ms = live.filter((r) => r.p !== null).map((r) => r.ms);
  const tokens = rows.reduce((s, r) => s + r.tokens, 0);
  return {
    n: rows.length,
    agreement: scoredRows.length ? scoredRows.filter((x) => x.s).length / scoredRows.length : 0,
    perTruth,
    perAction,
    pooledThreshold: thresholdFor(actPoints(() => true)),
    complex: { n: complex.length, escalated: complex.filter((r) => r.proposed.act === "escalate").length },
    hard: { n: scoredRows.filter(({ r }) => r.hard).length, right: scoredRows.filter(({ r, s }) => r.hard && s).length },
    rest: { n: scoredRows.filter(({ r }) => !r.hard).length, right: scoredRows.filter(({ r, s }) => !r.hard && s).length },
    escalation: {
      precision: jevEscalated.length ? jevEscalated.filter((r) => r.truth.act === "escalate").length / jevEscalated.length : 0,
      recall: truthEscalate.length ? truthEscalate.filter((r) => r.proposed.act === "escalate").length / truthEscalate.length : 0,
      jevEscalated: jevEscalated.length,
      truthEscalate: truthEscalate.length,
    },
    curve: reliability(actPoints(() => true)),
    latency: { p50: quantile(ms, 0.5), p90: quantile(ms, 0.9), max: ms.length ? Math.max(...ms) : 0 },
    tokens,
    cost: tokens * JEV_INPUT_PRICE,
    errors: rows.length - live.length,
  };
}

function describe(a: CanonicalAct, titles: Record<string, string>): string {
  const t = (id: string) => titles[id] ?? id;
  switch (a.act) {
    case "move-by":
      return `move ${t(a.subject)} ${a.direction}`;
    case "move-beside":
      return `move ${t(a.subject)} ${a.side} ${t(a.target)}`;
    case "undo":
    case "escalate":
      return a.act;
    default:
      return `${a.act} ${t(a.subject)}`;
  }
}

/** The report, as markdown. `titles` names ids for the confusion list. */
export function report(rows: readonly EvalRow[], meta: { title: string; answerer: string; titles?: Record<string, string>; wallMs?: number }): string {
  const x = numbers(rows);
  const titles = meta.titles ?? {};
  const lines: string[] = [];
  lines.push(`# ${meta.title}`, "");
  lines.push(`Answerer: ${meta.answerer}; model(s): ${[...new Set(rows.map((r) => r.by).filter(Boolean))].join(", ") || "—"}`, "");
  lines.push(`- commands: **${x.n}** (asked: ${rows.filter((r) => r.p !== null).length}; errors: ${x.errors})`);
  lines.push(`- agreement with the meant act, at argmax, no threshold: **${pct(x.agreement)}**`);
  if (x.hard.n) lines.push(`- held-out hard set (written after the first run was scored): **${x.hard.right} of ${x.hard.n}** agreed (${pct(x.hard.right / x.hard.n)}); the rest: ${x.rest.right} of ${x.rest.n} (${pct(x.rest.n ? x.rest.right / x.rest.n : 0)})`);
  lines.push(`- complex set (must escalate): **${x.complex.escalated} of ${x.complex.n}** escalated (${pct(x.complex.n ? x.complex.escalated / x.complex.n : 0)})`);
  lines.push(`- escalation over every command: precision **${pct(x.escalation.precision)}** (${x.escalation.jevEscalated} escalated), recall **${pct(x.escalation.recall)}** (${x.escalation.truthEscalate} meant for the model)`);
  lines.push(`- ECE of p (the least certain answer an act relied on), 10 bins: **${x.curve.ece.toFixed(3)}**`);
  lines.push(`- pooled threshold (every action, ≥95% on ≥30): ${x.pooledThreshold ? `**p ≥ ${x.pooledThreshold.cut.toFixed(3)}** (${x.pooledThreshold.n} kept, ${pct(x.pooledThreshold.accuracy)})` : "**none yet**"}`);
  lines.push(`- latency p50 **${x.latency.p50} ms**, p90 **${x.latency.p90} ms**, max ${x.latency.max} ms${meta.wallMs ? `; wall ${(meta.wallMs / 1000).toFixed(1)} s` : ""}`);
  lines.push(`- tokens ${x.tokens.toLocaleString("en-US")} input; cost **$${x.cost.toFixed(4)}** (${x.n ? `$${(x.cost / x.n).toFixed(6)} a command` : "—"})`, "");

  lines.push("## Per meant act", "", "| meant | n | Jev agreed | Jev escalated | mean p |", "|---|---|---|---|---|");
  for (const t of x.perTruth) lines.push(`| ${t.kind} | ${t.n} | ${t.right} (${pct(t.right / t.n)}) | ${t.escalated} | ${t.meanP === null ? "—" : t.meanP.toFixed(2)} |`);

  lines.push("", "## Per action Jev proposed — and its threshold", "", "| action | proposals | agreed | precision | threshold (≥95% on ≥30) |", "|---|---|---|---|---|");
  for (const a of x.perAction) {
    lines.push(`| ${a.action} | ${a.proposed} | ${a.right} | ${a.proposed ? pct(a.right / a.proposed) : "—"} | ${a.threshold ? `p ≥ ${a.threshold.cut.toFixed(3)} (${a.threshold.n}, ${pct(a.threshold.accuracy)})` : a.proposed < 30 ? `none yet (n ${a.proposed} < 30)` : "none yet"} |`);
  }

  lines.push("", "## Reliability (proposals that named an act)", "", "| p | n | mean p | agreed |", "|---|---|---|---|");
  for (const b of x.curve.bins) lines.push(`| ${b.lo.toFixed(1)}–${b.hi.toFixed(1)} | ${b.n} | ${b.n ? b.meanP.toFixed(3) : "—"} | ${b.n ? pct(b.accuracy) : "—"} |`);

  const wrong = rows.filter((r) => !r.error && scored(r) === false);
  lines.push("", `## Disagreements (${wrong.length})`, "", "| utterance | meant | Jev | p | why |", "|---|---|---|---|---|");
  for (const r of wrong) {
    lines.push(`| ${r.utterance.replace(/\|/g, "/")} | ${describe(r.wrong ?? r.truth, titles)}${r.wrong ? " (undone)" : ""} | ${describe(r.proposed, titles)} | ${r.p === null ? "—" : r.p.toFixed(2)} | ${r.reasons.join("; ") || "—"} |`);
  }
  const errs = rows.filter((r) => r.error);
  if (errs.length) {
    lines.push("", `## Errors (${errs.length})`, "");
    for (const r of errs) lines.push(`- ${r.id}: ${r.error}`);
  }
  lines.push("");
  return lines.join("\n");
}

/**
 * **A person's shadow record, as rows.** The meant act is the model's when
 * nobody took it back; when somebody did, the model's act is known WRONG and
 * the right one unknown — so agreeing with it scores wrong and anything else
 * is left unscored. A turn whose window was cut short (`undone: null`) is
 * scored as not undone and says so in its reasons.
 */
export function rowsFromRecord(turns: readonly ShadowTurn[]): { rows: EvalRow[]; titles: Record<string, string> } {
  const titles: Record<string, string> = {};
  const rows = turns.map((t, i): EvalRow => {
    Object.assign(titles, t.titles);
    const action = (t.answers?.action.value ?? actionOf(t.proposed.act)) as FastAct | "none";
    return {
      id: `${t.at}#${i}`,
      utterance: t.utterance,
      truth: t.undone ? { act: "escalate" } : t.model.act,
      ...(t.undone ? { wrong: t.model.act } : {}),
      complex: false,
      proposed: t.proposed,
      action,
      p: t.p ?? null,
      reasons: [...t.reasons, ...(t.undone === null ? ["undo window cut short"] : [])],
      ms: t.ms ?? 0,
      tokens: t.tokens ?? 0,
      by: t.by ?? "",
      ...(t.error ? { error: t.error } : {}),
    };
  });
  return { rows, titles };
}
