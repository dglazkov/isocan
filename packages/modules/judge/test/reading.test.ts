import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  FLOOR, bucketOf, curveOf, factsOf, firstLine, foldCorpus, labelOf, randomP, readWireFacts, readingOf, renderPage, rowsOf, shapeOf, wilson, wireItems,
  type ReadingRow, type WireFacts,
} from "../src/core.ts";
import { CALIBRATION_DIR, FIXTURE, run } from "../scripts/calibrate.ts";
import { CANVAS, PERSON, acmeCanvas, judgedRows } from "./synthetic.ts";

/**
 * **The proof of judge phase 2: a harness that can report a bad judge.**
 *
 * Every row here is made up. A calibrated judge read against a person who
 * corrects what it gets wrong must come out on the diagonal; the same rows
 * with P drawn at random must come out flat; a judge the flow acted on at
 * random, read against a person who rarely overrides it, must come out flat
 * too — although its curve steps at 0.5, because agreement labels are the
 * flow's own band. And the page must say in its first line whether it can
 * conclude, and never carry a request, a title or a canvas name.
 */

const DAY = "2026-09-24";
const pointsOf = (rows: readonly ReadingRow[]) => rows.flatMap((r) => (labelOf(r) ? [{ p: r.p, band: r.band, label: labelOf(r)! }] : []));

describe("what counts as right", () => {
  it("kept is needed and taken out is not, whatever the flow did", () => {
    expect(labelOf({ verdict: "kept", engaged: true, flowPut: false })).toEqual({ needed: true, source: "explicit" });
    expect(labelOf({ verdict: "taken-out", engaged: true, flowPut: true })).toEqual({ needed: false, source: "explicit" });
  });

  it("an untouched row in a flow the person worked on agrees with the flow", () => {
    expect(labelOf({ verdict: "none", engaged: true, flowPut: true })).toEqual({ needed: true, source: "agreement" });
    expect(labelOf({ verdict: "none", engaged: true, flowPut: false })).toEqual({ needed: false, source: "agreement" });
  });

  it("a flow the person never touched says nothing", () => {
    expect(labelOf({ verdict: "none", engaged: false, flowPut: true })).toBeNull();
    expect(labelOf({ verdict: "none", engaged: false, flowPut: false })).toBeNull();
  });
});

describe("the statistics", () => {
  it("buckets 0.1 wide, with each edge in the bucket above it", () => {
    expect([0, 0.09, 0.1, 0.3, 0.49, 0.5, 0.7, 0.99, 1].map(bucketOf)).toEqual([0, 0, 1, 3, 4, 5, 7, 9, 9]);
  });

  it("Wilson's interval: everything at n 0, symmetric at a half, never past 0 or 1", () => {
    expect(wilson(0, 0)).toEqual([0, 1]);
    const [lo, hi] = wilson(10, 20);
    expect(lo + hi).toBeCloseTo(1, 10);
    expect(lo).toBeCloseTo(0.2993, 3);
    expect(wilson(20, 20)[1]).toBe(1);
    expect(wilson(0, 20)[0]).toBe(0);
    expect(wilson(20, 20)[0]).toBeGreaterThan(0.8);
  });
});

describe("the harness against judges whose worth is known", () => {
  const calibrated = judgedRows({ n: 10_000, seed: 11 });

  it("reads a calibrated judge on the diagonal, and concludes", () => {
    const r = readingOf(calibrated);
    expect(r.concludes).toBe(true);
    expect(r.headline.ece).toBeLessThan(0.04);
    expect(r.headline.flat).toBe(false);
    // A calibrated judge's slope is 1; ten seeds of 2,400 labels read 0.85 to 1.07.
    expect(Math.abs(r.headline.slope!.b - 1)).toBeLessThan(0.25);
    expect(r.headline.slope!.lo).toBeGreaterThan(0.5);
    for (const b of r.headline.buckets) expect(Math.abs(b.share - b.meanP)).toBeLessThan(0.08);
    expect(firstLine(r, DAY)).toMatch(/^# Concludes: P carries information/);
  });

  it("reads the same rows with random P flat: every bucket near the base rate, the slope's interval over zero", () => {
    const r = readingOf(calibrated, { seed: 3 });
    const bl = r.baseline.curve;
    expect(bl.n).toBe(r.headline.n);
    expect(bl.flat).toBe(true);
    expect(bl.slope!.lo).toBeLessThan(0);
    expect(bl.slope!.hi).toBeGreaterThan(0);
    // Random P fills every bucket, the ones the flow never draws included.
    expect(bl.buckets).toHaveLength(10);
    for (const b of bl.buckets) expect(Math.abs(b.share - bl.baseRate)).toBeLessThan(0.12);
    // And the page says so, beside a headline that is not flat.
    expect(renderPage(r, { day: DAY })).toContain("It must read flat, and reads **flat**");
    expect(bl.ece).toBeGreaterThan(r.headline.ece * 3);
  });

  it("the baseline is the seed's, not the run's: the same seed reads the same, another reads otherwise", () => {
    expect(randomP(calibrated, 5)).toEqual(randomP(calibrated, 5));
    expect(randomP(calibrated, 5)).not.toEqual(randomP(calibrated, 6));
    expect(randomP(calibrated, 5).map(({ p: _p, ...rest }) => rest)).toEqual(calibrated.map(({ p: _p, ...rest }) => rest));
  });

  it("reads a random judge the flow acted on as flat, though agreement labels make its curve step at 0.5", () => {
    // P knows nothing (the truth is a coin); the person corrects a tenth of what the flow got wrong.
    const rows = judgedRows({ n: 10_000, seed: 12, truthOf: (_p, d) => d() < 0.5, corrects: 0.1 });
    const r = readingOf(rows);
    const below = r.headline.buckets.filter((b) => b.hi <= 0.5);
    const above = r.headline.buckets.filter((b) => b.lo >= 0.5);
    // The staircase the routing makes: needed is rare under 0.5 and common over it.
    for (const b of below) expect(b.share).toBeLessThan(0.2);
    for (const b of above) expect(b.share).toBeGreaterThan(0.8);
    // And the number that decides flat is not fooled by it.
    expect(r.concludes).toBe(true);
    expect(r.headline.flat).toBe(true);
    expect(firstLine(r, DAY)).toMatch(/^# Concludes: the curve is flat/);
  });

  it("counts explicit and agreement labels apart, bucket by bucket, and they add up", () => {
    const rows = judgedRows({ n: 4000, seed: 13, corrects: 0.5 });
    const c = curveOf(pointsOf(rows));
    for (const b of c.buckets) expect(b.explicit.needed + b.explicit.notNeeded + b.agreement.needed + b.agreement.notNeeded).toBe(b.n);
    // Explicit labels are disagreements: under 0.5 only keeps, over it only take-outs.
    for (const b of c.buckets.filter((b) => b.hi <= 0.5)) expect(b.explicit.notNeeded).toBe(0);
    for (const b of c.buckets.filter((b) => b.lo >= 0.5)) expect(b.explicit.needed).toBe(0);
    expect(c.explicit.needed + c.explicit.notNeeded).toBeGreaterThan(0);
    expect(c.agreement.needed + c.agreement.notNeeded).toBeGreaterThan(0);
  });
});

describe("the floor", () => {
  /** `k` labelled held-out Jev rows in each of the given buckets. */
  const rowsIn = (perBucket: Record<number, number>): ReadingRow[] =>
    Object.entries(perBucket).flatMap(([bucket, k]) =>
      Array.from({ length: k }, (_, i): ReadingRow => {
        const p = Number(bucket) / 10 + 0.01 + (i % 8) / 100;
        return { p, band: p >= 0.5 ? "sure" : "maybe", split: "held-out", answerer: "jev", verdict: i % 3 === 0 ? (p >= 0.5 ? "taken-out" : "kept") : "none", engaged: true, flowPut: p >= 0.5 };
      }),
    );

  it("does not conclude with one bucket at nineteen, and says so in the first line", () => {
    const r = readingOf(rowsIn({ 3: 40, 4: 40, 5: 19, 8: 60 }));
    expect(r.concludes).toBe(false);
    expect(r.headline.belowFloor).toBe(1);
    const page = renderPage(r, { day: DAY });
    expect(page.split("\n")[0]).toBe(`# Cannot conclude yet — round 1's need, read against the person, ${DAY}`);
    expect(page).toContain("1 of 4 buckets it reports holds fewer than 20 labels");
    expect(page).toContain(`under (19 of ${FLOOR})`);
    // Below the floor it still prints what it has, with intervals.
    expect(page).toMatch(/\| 0\.5–0\.6 \| 19 \| .*% \(\d+\.\d%–\d+\.\d%\)/);
  });

  it("concludes with every reported bucket at twenty — an empty bucket is not reported, so it does not block", () => {
    const r = readingOf(rowsIn({ 3: 20, 4: 20, 5: 20, 8: 20 }));
    expect(r.concludes).toBe(true);
    expect(r.headline.buckets.map((b) => b.lo)).toEqual([0.3, 0.4, 0.5, 0.8]);
    expect(firstLine(r, DAY)).toMatch(/^# Concludes/);
  });

  it("does not conclude with no labels at all", () => {
    const r = readingOf([]);
    expect(r.concludes).toBe(false);
    expect(renderPage(r, { day: DAY })).toContain("There are no labelled Jev-answered rows on the held-out side");
  });
});

describe("what the headline reads, and what it leaves alone", () => {
  const rows = judgedRows({ n: 3000, seed: 21, corrects: 0.7 });

  it("reads only the held-out side: rewriting every tune row's verdict changes nothing on the page", () => {
    const flipped = rows.map((r): ReadingRow => (r.split === "tune" ? { ...r, verdict: r.verdict === "none" ? "kept" : "none", engaged: !r.engaged } : r));
    expect(renderPage(readingOf(flipped), { day: DAY })).toBe(renderPage(readingOf(rows), { day: DAY }));
  });

  it("reads the stub and unknown answerers apart: adding their rows leaves the headline where it was", () => {
    const others = [...judgedRows({ n: 800, seed: 22, answerer: "stub", truthOf: (_p, d) => d() < 0.5 }), ...judgedRows({ n: 300, seed: 23, answerer: "unknown" })];
    const alone = readingOf(rows);
    const mixed = readingOf([...rows, ...others]);
    expect(mixed.headline).toEqual(alone.headline);
    expect(mixed.baseline).toEqual(alone.baseline);
    expect(mixed.others.map((o) => o.answerer)).toEqual(["stub", "unknown"]);
    expect(mixed.byAnswerer.stub.rows).toBe(800);
    const page = renderPage(mixed, { day: DAY });
    expect(page).toContain("read apart: stub 800, unknown 300");
    expect(page).toMatch(/\| stub \| 800 \|/);
    expect(page).toMatch(/\| unknown \| 300 \|/);
  });
});

describe("reading the files the corpus verb writes", () => {
  it("reads a v2 shape, and refuses a v1 shape with the way out", () => {
    const shape = JSON.parse(readFileSync(FIXTURE, "utf8")) as { v: number; pairs: Array<Record<string, unknown>> };
    expect(shape.v).toBe(2);
    expect(rowsOf(shape).from).toBe("shape");
    const v1 = { v: 1, pairs: shape.pairs.map(({ flowPut: _f, ...rest }) => rest) };
    expect(() => rowsOf(v1)).toThrow(/no flowPut.*shape \(v1\).*isocan judge corpus --out/);
  });

  it("keeps the closed fields and the model id, and drops every string anybody typed", async () => {
    const pairs = await acmePairs();
    const labelled = { v: 1, readAt: "2026-09-24T12:00:00.000Z", by: { id: PERSON.id, name: PERSON.name }, counts: {}, pairs: pairs.map((p) => ({ ...p, canvasTitle: "Acme Desks" })) };
    const { rows, from } = rowsOf(labelled);
    expect(from).toBe("labelled");
    expect(rows).toHaveLength(pairs.length);
    for (const r of rows) expect(Object.keys(r).sort()).toEqual(expect.arrayContaining(["answerer", "band", "engaged", "flowPut", "p", "split", "verdict"]));
    expect(new Set(rows.flatMap((r) => (r.model ? [r.model] : [])))).toEqual(new Set(["jev-1.13.0", "stub (seed 2)"]));
    // A model id that is a sentence is withheld, not printed.
    const odd = rowsOf({ ...labelled, pairs: [{ ...labelled.pairs[0], model: "An Acme app for booking a desk, as a model id, which it is not; it goes on" }] });
    expect(odd.rows[0]!.model).toBe("(withheld: not a model id)");
  });

  it("refuses a row that is not a row", () => {
    expect(() => rowsOf({ pairs: [{ p: 2, band: "sure", split: "tune", answerer: "jev", verdict: "none", engaged: true, flowPut: true }] })).toThrow(/not a probability/);
    expect(() => rowsOf({ pairs: [{ p: 0.5, band: "sure", split: "tune", answerer: "Acme", verdict: "none", engaged: true, flowPut: true }] })).toThrow(/"Acme" is not one of/);
    expect(() => rowsOf({ nope: [] })).toThrow(/not a corpus/);
  });
});

async function acmePairs() {
  const c = acmeCanvas();
  const facts = new Map<string, WireFacts>();
  for (const item of wireItems(c.entries)) {
    const found = await factsOf(item, async (hash) => readWireFacts(c.readText(hash)));
    if (found) facts.set(item.itemId, found);
  }
  return foldCorpus({ canvasId: CANVAS, entries: c.entries, facts, me: PERSON.id }).pairs;
}

describe("the harness, dry and real", () => {
  const scratch = () => mkdtempSync(path.join(tmpdir(), "judge-reading-"));

  it("dry: reads the committed fixture and writes the page, whose first line says it cannot conclude", () => {
    const page = path.join(scratch(), "dry.md");
    const { page: text, wrote } = run(["--dry", "--page", page, "--day", DAY]);
    expect(wrote).toBe(page);
    expect(readFileSync(page, "utf8")).toBe(text);
    const lines = text.split("\n");
    expect(lines[0]).toBe(`# Cannot conclude yet — round 1's need, read against the person, ${DAY}`);
    expect(text).toContain("**Dry run.**");
    // The page carries each thing the proof names.
    for (const needle of ["rows read: **12**", "held out (Jev):", "floor of 20 per bucket", "explicit**", "by agreement**", "accuracy (P ≥ 0.5", "ECE, buckets 0.1 wide", "slope of needed on P inside the bands", "model ids: none recorded — a shape carries none", "## The curve — Jev, held out", "## The bad judge — seeded random P (seed 1)", "## Read apart — other answerers", "| stub |", "| unknown |"]) {
      expect(text).toContain(needle);
    }
  });

  it("dry, with no --page, writes nothing and hands the page back", () => {
    const { page, wrote } = run(["--dry", "--day", DAY]);
    expect(wrote).toBeUndefined();
    expect(page.split("\n")[0]).toMatch(/^# Cannot conclude yet/);
  });

  it("dry refuses docs/calibration — a page of made-up rows is never a record — and refuses --rows beside it", () => {
    const target = path.join(CALIBRATION_DIR, `${DAY}-dry-test.md`);
    expect(() => run(["--dry", "--page", target])).toThrow(/holds readings/);
    expect(existsSync(target)).toBe(false);
    expect(() => run(["--dry", "--rows", scratch()])).toThrow(/no --rows as well/);
    expect(() => run([])).toThrow(/usage/);
  });

  it("real: reads the directory --out wrote, prefers labelled.json for its model ids, and will not overwrite a page", async () => {
    const dir = scratch();
    const pairs = await acmePairs();
    writeFileSync(path.join(dir, "labelled.json"), JSON.stringify({ v: 1, readAt: "2026-09-24T12:00:00.000Z", by: { id: PERSON.id, name: PERSON.name }, counts: {}, pairs: pairs.map((p) => ({ ...p, canvasTitle: "Acme Desks" })) }));
    writeFileSync(path.join(dir, "shape.json"), JSON.stringify(shapeOf(pairs)));
    const page = path.join(scratch(), "out", "reading.md");
    const { page: text } = run(["--rows", dir, "--page", page, "--day", DAY]);
    expect(text).toContain("model ids: jev: jev-1.13.0; stub: stub (seed 2)");
    expect(text).not.toContain("**Dry run.**");
    expect(() => run(["--rows", dir, "--page", page, "--day", DAY])).toThrow(/exists — a reading is a record/);
    expect(() => run(["--rows", dir, "--page", page, "--day", DAY, "--force"])).not.toThrow();
    // The shape alone reads the same numbers, without the model ids.
    const shapeOnly = scratch();
    writeFileSync(path.join(shapeOnly, "shape.json"), JSON.stringify(shapeOf(pairs)));
    const fromShape = run(["--rows", shapeOnly, "--page", path.join(scratch(), "s.md"), "--day", DAY]).page;
    expect(fromShape.replace(/- model ids: .*\n/, "")).toBe(text.replace(/- model ids: .*\n/, ""));
  });

  it("the page carries no request, no screen title, no canvas name and no id — from labelled.json, which has them all", async () => {
    const dir = scratch();
    const pairs = await acmePairs();
    writeFileSync(path.join(dir, "labelled.json"), JSON.stringify({ v: 1, readAt: "2026-09-24T12:00:00.000Z", by: { id: PERSON.id, name: PERSON.name }, counts: {}, pairs: pairs.map((p) => ({ ...p, canvasTitle: "Acme Desks" })) }));
    const { page } = run(["--rows", dir, "--page", path.join(scratch(), "p.md"), "--day", DAY]);
    const strings = new Set(["Acme Desks", PERSON.id, PERSON.name, ...pairs.flatMap((p) => [p.request, p.title, p.canvasId, p.itemId, p.flow])]);
    for (const s of strings) expect(page).not.toContain(s);
    expect(page).not.toMatch(/Acme|prj_|itm_|grp_|act_/);
  });
});

describe("the committed fixture carries what agreement labels need", () => {
  it("every row says whether the flow put it in", () => {
    const shape = JSON.parse(readFileSync(FIXTURE, "utf8")) as { pairs: Array<{ flowPut?: unknown }> };
    for (const p of shape.pairs) expect(typeof p.flowPut).toBe("boolean");
  });
});
