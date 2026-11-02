/**
 * **The house rule for turning a judge's probability into "act" or "don't"**
 * — measured, never chosen. Two callers, so it lives here: the voice fast
 * path's shadow report (`talk/src/fastpath-report.ts`, voice-agent phase 6,
 * where it was born) and the local judge's route comparison (local-judge
 * phase 1, `scripts/local-judge/harness.mjs`).
 *
 * The rule is the fast path's (`fast-path.md`, *The threshold is measured*):
 * the lowest cut at which what is kept agrees with the truth at least
 * `target` of the time on at least `minN` cases. Cuts are tried only at
 * observed values, so a threshold is always a number that occurred. No cut
 * qualifies → null, and the act stays with the slower path.
 *
 * Pure, no Node: a browser may import it.
 */

/** One bin of a reliability curve: its p range, how many fell in it, their mean p and how often they were right. */
export interface Bin { lo: number; hi: number; n: number; meanP: number; accuracy: number }

/** Ten equal-width bins of `p` against how often it was right, and the count-weighted gap (ECE). */
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
 * ≥ `minN` cases.** Cuts are tried at every observed p, so the answer is a p
 * that occurred; null when no cut qualifies.
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

/** A two-part cut: the winning probability AND its margin over the runner-up must both clear it. */
export interface MarginCut {
  /** Winning probability at or above this. */
  p: number;
  /** Winner minus runner-up at or above this. */
  margin: number;
  /** Cases kept at this cut, and how often they were right. */
  n: number;
  accuracy: number;
}

/**
 * **The same rule over two numbers** — the winning probability and its
 * margin over the runner-up (local-judge `design.md`, *The policy layer*).
 * Every observed margin is tried as the margin cut, and under each the
 * lowest qualifying p cut is found exactly as `thresholdFor` finds it; of
 * the pairs that qualify, the one that keeps the most cases wins (ties: the
 * lower p cut, then the lower margin cut — the least strict). Null when no
 * pair qualifies.
 */
export function thresholdWithMargin(points: Array<{ p: number; margin: number; right: boolean }>, target = 0.95, minN = 30): MarginCut | null {
  const margins = [...new Set(points.map((x) => x.margin))].sort((a, b) => a - b);
  let best: MarginCut | null = null;
  for (const margin of margins) {
    const under = points.filter((x) => x.margin >= margin);
    if (under.length < minN) break; // margins only rise from here; fewer cases each time
    const found = thresholdFor(under, target, minN);
    if (!found) continue;
    const pick = { p: found.cut, margin, n: found.n, accuracy: found.accuracy };
    if (!best || pick.n > best.n) best = pick;
  }
  return best;
}

/** Does a case clear the cut? Null cut: nothing is accepted. */
export function accepts(cut: Pick<MarginCut, "p" | "margin"> | null, x: { p: number; margin: number }): boolean {
  return cut !== null && x.p >= cut.p && x.margin >= cut.margin;
}

/**
 * **Wilson's 95% interval for k right out of n** — the interval a proportion
 * from a few dozen cases needs, because the normal one runs past 0 and 1
 * exactly where these numbers live. `[0, 1]` for n = 0.
 */
export function wilson(k: number, n: number, z = 1.96): { lo: number; hi: number } {
  if (n === 0) return { lo: 0, hi: 1 };
  const p = k / n;
  const d = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / d;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return { lo: Math.max(0, centre - half), hi: Math.min(1, centre + half) };
}
