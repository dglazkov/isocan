import { BANDS, PAIR_ANSWERERS, SPLITS, VERDICTS, type Band, type PairAnswerer, type Split, type Verdict } from "./corpus.ts";

/**
 * **The reading: is round 1's P worth routing on?** (judge phase 2.)
 *
 * The probabilities were recorded when each flow ran, so the curve is the
 * recorded P against what the person then did — no judge is asked anything
 * here, and nothing is re-asked: a second call would measure a different
 * judgment from the one the flow acted on. Pure: rows in, numbers and a page
 * out. `scripts/calibrate.ts` is the harness that feeds it.
 *
 * **What counts as right** (phases.md, decided 24 Sep 2026) — a row is
 * *needed* or *not needed*:
 *
 * - **explicitly**: *kept* is needed, *taken out* is not;
 * - **by agreement**: a row the person left as the flow set it, in a flow
 *   they acted on at least once (`engaged`), is needed exactly when the flow
 *   put it in the prototype;
 * - **not at all**: every row of a flow the person never touched.
 *
 * The two kinds are counted apart everywhere they appear, so the assumption
 * sits on the page rather than under it.
 *
 * **Why the within-band slope is the number that decides flat.** An agreement
 * label is `flowPut`, and `flowPut` is P's band — so agreement labels make
 * any curve step at the band's edge, whatever P is worth: a random judge the
 * flow acted on, read against a person who rarely overrides it, would look
 * like a staircase. The step is the routing's, not the probability's. What
 * only an informative P can produce is a rise *inside* a band — more maybes
 * kept at 0.45 than at 0.35, fewer sure rows taken out at 0.95 than at 0.55.
 * So "flat" is read off the slope of needed on P with each band's own level
 * taken out (a fixed-effects regression), not off the curve's overall shape.
 */

/** One row as the reading sees it: numbers and closed vocabularies, and a model id at most. */
export interface ReadingRow {
  p: number;
  band: Band;
  split: Split;
  answerer: PairAnswerer;
  verdict: Verdict;
  engaged: boolean;
  flowPut: boolean;
  /** The answerer's model id, when the rows came from `labelled.json`; a shape carries none. */
  model?: string;
}

export type LabelSource = "explicit" | "agreement";
export interface Label {
  needed: boolean;
  source: LabelSource;
}

/** The label a row carries, by the rules above — or null: a flow the person never touched says nothing. */
export function labelOf(row: Pick<ReadingRow, "verdict" | "engaged" | "flowPut">): Label | null {
  if (row.verdict === "kept") return { needed: true, source: "explicit" };
  if (row.verdict === "taken-out") return { needed: false, source: "explicit" };
  if (row.engaged) return { needed: row.flowPut, source: "agreement" };
  return null;
}

// ---------- reading rows in, and nothing else

/**
 * What a model id may look like on a page: a vendor's name for a model, not
 * a sentence. Anything else is shown as withheld rather than printed.
 */
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9 ._:()/+@-]{0,63}$/;

function oneOf<T extends string>(words: readonly T[], value: unknown, at: string): T {
  if (typeof value === "string" && (words as readonly string[]).includes(value)) return value as T;
  throw new Error(`${at}: ${JSON.stringify(value)} is not one of ${words.join(", ")}`);
}

/**
 * **Rows from what `isocan judge corpus --out` wrote** — `labelled.json` or
 * `shape.json`, told apart by what they carry. Only the closed fields are
 * copied: the request, the screen title, the canvas and every id are left
 * behind here, so nothing downstream can print them. A shape from before
 * phase 2 has no `flowPut` and cannot be read for agreement labels; that is
 * refused with the way out, not read as if every row were left out.
 */
export function rowsOf(input: unknown): { rows: ReadingRow[]; from: "labelled" | "shape" } {
  const doc = input as { v?: unknown; readAt?: unknown; pairs?: unknown };
  if (!doc || typeof doc !== "object" || !Array.isArray(doc.pairs)) throw new Error("not a corpus: expected an object with a pairs array (labelled.json or shape.json)");
  const from = typeof doc.readAt === "string" ? "labelled" : "shape";
  const rows = doc.pairs.map((raw, i): ReadingRow => {
    const at = `pairs[${i}]`;
    const r = raw as Record<string, unknown>;
    if (typeof r.p !== "number" || !(r.p >= 0 && r.p <= 1)) throw new Error(`${at}: p ${JSON.stringify(r.p)} is not a probability`);
    if (typeof r.flowPut !== "boolean") {
      throw new Error(
        `${at}: no flowPut — this ${from === "shape" ? `shape (v${String(doc.v)})` : "file"} was written before judge phase 2, ` +
          "and an untouched row cannot be read as agreement without it. Read labelled.json, or run `isocan judge corpus --out` again.",
      );
    }
    if (typeof r.engaged !== "boolean") throw new Error(`${at}: engaged ${JSON.stringify(r.engaged)} is not a boolean`);
    const model = typeof r.model === "string" ? (MODEL_ID.test(r.model) ? r.model : "(withheld: not a model id)") : undefined;
    return {
      p: r.p,
      band: oneOf(BANDS, r.band, `${at}.band`),
      split: oneOf(SPLITS, r.split, `${at}.split`),
      answerer: oneOf(PAIR_ANSWERERS, r.answerer, `${at}.answerer`),
      verdict: oneOf(VERDICTS, r.verdict, `${at}.verdict`),
      engaged: r.engaged,
      flowPut: r.flowPut,
      ...(model !== undefined ? { model } : {}),
    };
  });
  return { rows, from };
}

// ---------- the statistics

/** Buckets 0.1 wide: phase 0 measured the same request moving P by ±0.035, so nothing finer means anything. */
export const BUCKETS = 10;
/** Labels a bucket needs before the page may conclude from it. */
export const FLOOR = 20;
/** Where a probability is a yes: the verdict accuracy is scored on, and round 1's `NEEDS_YES`. */
export const YES_AT = 0.5;
const Z95 = 1.959964;

export function bucketOf(p: number): number {
  // The epsilon keeps 0.3 in the 0.3 bucket although 0.3 * 10 is 2.9999999999999996 in floating point.
  return Math.min(BUCKETS - 1, Math.max(0, Math.floor(p * BUCKETS + 1e-9)));
}

/** The Wilson score interval for k of n at 95% — honest at small n and near 0 or 1, where the normal one is not. */
export function wilson(k: number, n: number, z = Z95): [number, number] {
  if (n === 0) return [0, 1];
  const phat = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (phat + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((phat * (1 - phat)) / n + z2 / (4 * n * n))) / denom;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

/** A seeded uniform draw on [0, 1) — mulberry32: small, and the same sequence on every machine. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Point {
  p: number;
  band: Band;
  label: Label;
}

export interface SourceCounts {
  needed: number;
  notNeeded: number;
}

export interface Bucket {
  lo: number;
  hi: number;
  n: number;
  meanP: number;
  explicit: SourceCounts;
  agreement: SourceCounts;
  /** The share of the bucket that was needed: the curve. A calibrated judge's is its mean P. */
  share: number;
  /** 95% Wilson interval on `share`. */
  interval: [number, number];
  /** The share whose verdict at `YES_AT` matched the label. */
  right: number;
}

/** The slope of needed on P with each band's level taken out, and its 95% interval (normal approximation). */
export interface Slope {
  b: number;
  lo: number;
  hi: number;
}

export interface Curve {
  n: number;
  explicit: SourceCounts;
  agreement: SourceCounts;
  /** Only the buckets that hold a label: the curve is censored below the maybe floor, and an empty bucket reports nothing. */
  buckets: Bucket[];
  ece: number;
  accuracy: number;
  baseRate: number;
  slope: Slope | null;
  /** Reported buckets under `FLOOR`. */
  belowFloor: number;
  /** Every reported bucket at or over the floor, and at least one reported. */
  floorMet: boolean;
  /** The slope's interval does not sit wholly above zero: P says no more inside a band than the band did. */
  flat: boolean;
}

const tally = (points: readonly Point[], source: LabelSource): SourceCounts => ({
  needed: points.filter((pt) => pt.label.source === source && pt.label.needed).length,
  notNeeded: points.filter((pt) => pt.label.source === source && !pt.label.needed).length,
});

function withinBandSlope(points: readonly Point[]): Slope | null {
  const groups = new Map<Band, Point[]>();
  for (const pt of points) groups.set(pt.band, [...(groups.get(pt.band) ?? []), pt]);
  let sxx = 0;
  let sxy = 0;
  const centred: Array<{ dx: number; dy: number }> = [];
  for (const g of groups.values()) {
    const mp = g.reduce((s, pt) => s + pt.p, 0) / g.length;
    const my = g.reduce((s, pt) => s + Number(pt.label.needed), 0) / g.length;
    for (const pt of g) {
      const dx = pt.p - mp;
      const dy = Number(pt.label.needed) - my;
      sxx += dx * dx;
      sxy += dx * dy;
      centred.push({ dx, dy });
    }
  }
  const df = points.length - groups.size - 1;
  if (sxx <= 1e-12 || df <= 0) return null;
  const b = sxy / sxx;
  const ssr = centred.reduce((s, c) => s + (c.dy - b * c.dx) ** 2, 0);
  const se = Math.sqrt(ssr / df / sxx);
  return { b, lo: b - Z95 * se, hi: b + Z95 * se };
}

/** The reliability curve of a set of labelled judgments, with everything the page puts beside it. */
export function curveOf(points: readonly Point[]): Curve {
  const acc = Array.from({ length: BUCKETS }, () => [] as Point[]);
  for (const pt of points) acc[bucketOf(pt.p)]!.push(pt);
  const buckets: Bucket[] = [];
  acc.forEach((pts, i) => {
    if (pts.length === 0) return;
    const needed = pts.filter((pt) => pt.label.needed).length;
    buckets.push({
      lo: i / BUCKETS,
      hi: (i + 1) / BUCKETS,
      n: pts.length,
      meanP: pts.reduce((s, pt) => s + pt.p, 0) / pts.length,
      explicit: tally(pts, "explicit"),
      agreement: tally(pts, "agreement"),
      share: needed / pts.length,
      interval: wilson(needed, pts.length),
      right: pts.filter((pt) => pt.p >= YES_AT === pt.label.needed).length / pts.length,
    });
  });
  const n = points.length;
  const ece = n ? buckets.reduce((s, b) => s + (b.n / n) * Math.abs(b.share - b.meanP), 0) : 0;
  const slope = withinBandSlope(points);
  const belowFloor = buckets.filter((b) => b.n < FLOOR).length;
  return {
    n,
    explicit: tally(points, "explicit"),
    agreement: tally(points, "agreement"),
    buckets,
    ece,
    accuracy: n ? points.filter((pt) => pt.p >= YES_AT === pt.label.needed).length / n : 0,
    baseRate: n ? points.filter((pt) => pt.label.needed).length / n : 0,
    slope,
    belowFloor,
    floorMet: buckets.length > 0 && belowFloor === 0,
    flat: slope === null || slope.lo <= 0,
  };
}

// ---------- the reading

export interface AnswererCounts {
  rows: number;
  heldOut: number;
  tune: number;
  explicit: number;
  agreement: number;
  unlabelled: number;
}

export interface Reading {
  rows: number;
  from: "labelled" | "shape";
  byAnswerer: Record<PairAnswerer, AnswererCounts>;
  /** Jev-answered, held-out, labelled: the only rows the headline reads. */
  headline: Curve;
  /** Jev-answered held-out rows, labelled or not. */
  heldOut: number;
  /** Jev-answered held-out rows with no label: a flow the person never touched. */
  unlabelled: number;
  /** Jev-answered tune rows: counted, reserved for phase 3's cut-fitting, and read by nothing here. */
  tune: number;
  /** The same labelled rows with P replaced by a seeded uniform draw: the bad judge, through the same code. */
  baseline: { seed: number; curve: Curve };
  /** Every other answerer's held-out rows, read apart from Jev's. */
  others: Array<{ answerer: PairAnswerer; curve: Curve }>;
  /** Model ids seen, per answerer. Empty for a shape. */
  models: Partial<Record<PairAnswerer, string[]>>;
  /** The floor is met: the page may conclude. */
  concludes: boolean;
}

const pointsOf = (rows: readonly ReadingRow[]): Point[] =>
  rows.flatMap((r) => {
    const label = labelOf(r);
    return label ? [{ p: r.p, band: r.band, label }] : [];
  });

/** The seeded random-P baseline: every row as it was, but for a P that knows nothing. */
export function randomP(rows: readonly ReadingRow[], seed: number): ReadingRow[] {
  const draw = seeded(seed);
  return rows.map((r) => ({ ...r, p: draw() }));
}

export function readingOf(rows: readonly ReadingRow[], opts: { from?: "labelled" | "shape"; seed?: number } = {}): Reading {
  const seed = opts.seed ?? 1;
  const byAnswerer = Object.fromEntries(
    PAIR_ANSWERERS.map((a) => {
      const mine = rows.filter((r) => r.answerer === a);
      const labels = mine.map(labelOf);
      return [
        a,
        {
          rows: mine.length,
          heldOut: mine.filter((r) => r.split === "held-out").length,
          tune: mine.filter((r) => r.split === "tune").length,
          explicit: labels.filter((l) => l?.source === "explicit").length,
          agreement: labels.filter((l) => l?.source === "agreement").length,
          unlabelled: labels.filter((l) => l === null).length,
        },
      ];
    }),
  ) as Record<PairAnswerer, AnswererCounts>;

  const jevHeld = rows.filter((r) => r.answerer === "jev" && r.split === "held-out");
  const labelledHeld = jevHeld.filter((r) => labelOf(r) !== null);
  const headline = curveOf(pointsOf(labelledHeld));
  const models: Partial<Record<PairAnswerer, string[]>> = {};
  for (const r of rows) if (r.model) models[r.answerer] = [...new Set([...(models[r.answerer] ?? []), r.model])].sort();

  return {
    rows: rows.length,
    from: opts.from ?? "shape",
    byAnswerer,
    headline,
    heldOut: jevHeld.length,
    unlabelled: jevHeld.length - labelledHeld.length,
    tune: rows.filter((r) => r.answerer === "jev" && r.split === "tune").length,
    baseline: { seed, curve: curveOf(pointsOf(randomP(labelledHeld, seed))) },
    others: PAIR_ANSWERERS.filter((a) => a !== "jev" && byAnswerer[a].rows > 0).map((answerer) => ({
      answerer,
      curve: curveOf(pointsOf(rows.filter((r) => r.answerer === answerer && r.split === "held-out"))),
    })),
    models,
    concludes: headline.floorMet,
  };
}

// ---------- the page

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const range = ([lo, hi]: [number, number]) => `${pct(lo)}–${pct(hi)}`;
const slopeText = (s: Slope | null) => (s ? `${s.b.toFixed(2)} (95% ${s.lo.toFixed(2)} to ${s.hi.toFixed(2)})` : "undefined (no spread of P inside a band)");
const counts = (c: SourceCounts) => `${c.needed} / ${c.notNeeded}`;

/** The first line: whether the page can conclude, and if it can, what. */
export function firstLine(reading: Reading, day: string): string {
  const what = "round 1's need, read against the person";
  if (!reading.concludes) return `# Cannot conclude yet — ${what}, ${day}`;
  return reading.headline.flat
    ? `# Concludes: the curve is flat — ${what}, ${day}`
    : `# Concludes: P carries information inside the bands — ${what}, ${day}`;
}

function curveTable(c: Curve, floor: boolean): string[] {
  const head = floor
    ? ["| P | n | mean P | explicit needed / not | agreement needed / not | share needed (95% Wilson) | right at 0.5 | floor |", "|---|---|---|---|---|---|---|---|"]
    : ["| P | n | mean P | explicit needed / not | agreement needed / not | share needed (95% Wilson) | right at 0.5 |", "|---|---|---|---|---|---|---|"];
  if (c.buckets.length === 0) return [...head, floor ? "| — | 0 | — | — | — | — | — | — |" : "| — | 0 | — | — | — | — | — |"];
  return [
    ...head,
    ...c.buckets.map((b) => {
      const cells = [
        `${b.lo.toFixed(1)}–${b.hi.toFixed(1)}`,
        String(b.n),
        b.meanP.toFixed(3),
        counts(b.explicit),
        counts(b.agreement),
        `${pct(b.share)} (${range(b.interval)})`,
        pct(b.right),
      ];
      if (floor) cells.push(b.n >= FLOOR ? "met" : `under (${b.n} of ${FLOOR})`);
      return `| ${cells.join(" | ")} |`;
    }),
  ];
}

/**
 * **The page** — counts, rates, the curve and model ids; never a request, a
 * title or a canvas name, which `ReadingRow` cannot carry in the first place.
 * The first line says whether it can conclude.
 */
export function renderPage(reading: Reading, meta: { day: string; dry?: boolean; source?: string }): string {
  const h = reading.headline;
  const lines: string[] = [firstLine(reading, meta.day), ""];

  if (!reading.concludes) {
    lines.push(
      h.buckets.length === 0
        ? `**Cannot conclude yet.** There are no labelled Jev-answered rows on the held-out side. The floor is ${FLOOR} labels in every bucket reported, buckets 0.1 wide.`
        : `**Cannot conclude yet.** ${h.belowFloor} of ${h.buckets.length} bucket${h.buckets.length === 1 ? "" : "s"} it reports hold${h.belowFloor === 1 ? "s" : ""} fewer than ${FLOOR} labels — the floor is ${FLOOR} in every bucket reported, buckets 0.1 wide (phase 0 measured P moving ±0.035 run to run). What it has is below, each rate with its 95% Wilson interval; none of it is a finding.`,
    );
  } else if (h.flat) {
    lines.push(
      `**Concludes: flat.** Every bucket reported holds at least ${FLOOR} labels, and inside the bands the share needed does not rise with P — slope ${slopeText(h.slope)}. P says no more than which band the flow drew a row in. phases.md allows this result, and it is one: the corpus stays worth having.`,
    );
  } else {
    lines.push(
      `**Concludes: P carries information.** Every bucket reported holds at least ${FLOOR} labels, and inside the bands the share needed rises with P — slope ${slopeText(h.slope)}, where 1 is a judge whose P is the rate and 0 is a coin. ECE ${h.ece.toFixed(3)} beside accuracy ${pct(h.accuracy)} says how far the curve sits from the diagonal: that distance is phase 3's to move.`,
    );
  }
  lines.push("");
  if (meta.dry) {
    lines.push(`**Dry run.** Read from ${meta.source ?? "the committed synthetic fixture"} — every row made up. This page shows the harness writes a page; it is not a reading of any judge.`, "");
  }

  const models = Object.entries(reading.models).map(([a, ids]) => `${a}: ${ids!.join(", ")}`);
  const others = PAIR_ANSWERERS.filter((a) => a !== "jev" && reading.byAnswerer[a].rows > 0).map((a) => `${a} ${reading.byAnswerer[a].rows}`);
  lines.push("## The numbers", "");
  lines.push(`- rows read: **${reading.rows}** — Jev ${reading.byAnswerer.jev.rows}${others.length ? `; read apart: ${others.join(", ")}` : ""}`);
  lines.push(`- held out (Jev): **${reading.heldOut}** row${reading.heldOut === 1 ? "" : "s"}; **${h.n}** labelled against the floor of ${FLOOR} per bucket × ${h.buckets.length} bucket${h.buckets.length === 1 ? "" : "s"} reported; ${reading.unlabelled} unlabelled (a flow the person never touched)`);
  lines.push(`- labels, held out: **${h.explicit.needed + h.explicit.notNeeded} explicit** (${h.explicit.needed} kept, ${h.explicit.notNeeded} taken out) · **${h.agreement.needed + h.agreement.notNeeded} by agreement** (${h.agreement.needed} left in, ${h.agreement.notNeeded} left out)`);
  lines.push(`- tune (Jev): ${reading.tune} rows — reserved for phase 3's cuts, and read by nothing on this page`);
  lines.push(`- accuracy (P ≥ ${YES_AT} as yes, against the label): **${h.n ? pct(h.accuracy) : "—"}**${h.n ? ` (95% ${range(wilson(Math.round(h.accuracy * h.n), h.n))})` : ""}; base rate needed ${h.n ? pct(h.baseRate) : "—"}`);
  lines.push(`- ECE, buckets 0.1 wide: **${h.n ? h.ece.toFixed(3) : "—"}** — beside accuracy, never alone: a judge that says the base rate about everything scores near 0 and is useless`);
  lines.push(`- slope of needed on P inside the bands: **${h.n ? slopeText(h.slope) : "—"}** — the number that decides flat`);
  lines.push(`- model ids: ${models.length ? models.join("; ") : reading.from === "shape" ? "none recorded — a shape carries none" : "none recorded"}`);
  lines.push("");

  lines.push("## The curve — Jev, held out", "");
  lines.push(...curveTable(h, true), "");
  lines.push(
    "A calibrated judge's share needed is its mean P. The explicit and agreement columns are needed / not needed: explicit labels are the person's acts, agreement labels are the assumption that an untouched row in a flow they worked on was let stand.",
    "",
  );

  const bl = reading.baseline.curve;
  lines.push(`## The bad judge — seeded random P (seed ${reading.baseline.seed})`, "");
  lines.push(
    `The same ${bl.n} labelled rows with P drawn uniformly, so P knows nothing about them. It must read flat, and reads **${bl.slope === null ? "nothing yet (too few rows to have a slope)" : bl.flat ? "flat" : "not flat"}**: slope ${bl.n ? slopeText(bl.slope) : "—"}, ECE ${bl.n ? bl.ece.toFixed(3) : "—"}, accuracy ${bl.n ? pct(bl.accuracy) : "—"}, against a base rate of ${bl.n ? pct(bl.baseRate) : "—"}.`,
    "",
  );
  lines.push(...curveTable(bl, false), "");

  lines.push("## Read apart — other answerers", "");
  if (reading.others.length === 0) lines.push("None: every row was Jev's.", "");
  else {
    lines.push("| answerer | rows | held out | explicit | agreement | unlabelled | held-out labelled | accuracy | ECE | slope inside the bands |", "|---|---|---|---|---|---|---|---|---|---|");
    for (const o of reading.others) {
      const a = reading.byAnswerer[o.answerer];
      const c = o.curve;
      lines.push(`| ${o.answerer} | ${a.rows} | ${a.heldOut} | ${a.explicit} | ${a.agreement} | ${a.unlabelled} | ${c.n} | ${c.n ? pct(c.accuracy) : "—"} | ${c.n ? c.ece.toFixed(3) : "—"} | ${c.n ? slopeText(c.slope) : "—"} |`);
    }
    lines.push("", "The stub answers from a seed, not the request; *unknown* is a flow drawn between `need` landing and `by` landing (24 Sep 2026). Neither is Jev, and neither moves the headline.", "");
  }

  lines.push("## How it reads", "");
  lines.push(
    "Each row is a screen and its variations, with the P(yes) round 1 recorded when the flow ran — nothing is re-asked. A row is labelled **explicitly** when the person kept it (needed) or took it out (not needed); **by agreement** when they left it as the flow set it in a flow they acted on at least once (needed exactly when the flow put it in the prototype); and not at all when they never touched the flow. The headline reads only Jev-answered rows on the held-out side; the tune side is phase 3's.",
    "",
    `Rows below the maybe floor are never drawn, so the curve is censored there and empty buckets are not reported. Agreement labels are the flow's own band, so they make any curve step at ${YES_AT} whether or not P means anything; the slope inside the bands is the number that cannot be manufactured that way, and it is what decides flat.`,
    "",
  );
  return `${lines.join("\n")}`;
}
