import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  HELD_OUT_SHARE, factsOf, fixtureProblems, foldCorpus, readWireFacts, shapeOf, splitOf, wireItems,
  type Pair, type WireFacts,
} from "../src/core.ts";
import { CANVAS, COLLABORATOR, PERSON, SyntheticCanvas, acmeCanvas, wireHtml } from "./synthetic.ts";

/**
 * **The proof of judge phase 1, over a synthetic canvas's oplog.**
 *
 * The Acme canvas (`acmeCanvas` in `synthetic.ts`) is written the way the
 * wireframe flow writes one, and every case the phase names is on it: a maybe the
 * person then keeps; a flow-kept screen the person then unkeeps; an
 * untouched screen; a keep by the answerer; a collaborator's keep. Beside
 * them, the cases a fold that only handled those would get wrong: a swap to
 * a variation, a deletion, a keep taken back by undo, a whole flow undone, a
 * screen from before `need`, a screen rendered by hand, and a maybe whose
 * `wireMaybe` property says something its spec does not.
 */

async function fold(c: SyntheticCanvas, entries = c.entries, me = PERSON.id) {
  const facts = new Map<string, WireFacts>();
  for (const item of wireItems(entries)) {
    const found = await factsOf(item, async (hash) => readWireFacts(c.readText(hash)));
    if (found) facts.set(item.itemId, found);
  }
  return foldCorpus({ canvasId: CANVAS, entries, facts, me });
}

const byItem = (pairs: Pair[]) => Object.fromEntries(pairs.map((p) => [p.itemId, p]));

describe("the fold, over a synthetic canvas", () => {
  it("folds a maybe then the person's keep into kept, at the P its spec carries", async () => {
    const { pairs } = await fold(acmeCanvas());
    expect(byItem(pairs).itm_acme_detail).toMatchObject({ verdict: "kept", p: 0.41, band: "maybe", flowPut: false, answerer: "jev", model: "jev-1.13.0" });
  });

  it("folds a flow-kept screen then the person's unkeep into taken out", async () => {
    const { pairs } = await fold(acmeCanvas());
    expect(byItem(pairs).itm_acme_list).toMatchObject({ verdict: "taken-out", p: 0.82, band: "sure", flowPut: true });
  });

  it("folds an untouched screen, a keep by the answerer and a collaborator's keep into no label", async () => {
    const rows = byItem((await fold(acmeCanvas())).pairs);
    expect(rows.itm_acme_settings).toMatchObject({ verdict: "none", band: "maybe", flowPut: false });
    expect(rows.itm_acme_home).toMatchObject({ verdict: "none", band: "sure", flowPut: true });
    expect(rows.itm_acme_search).toMatchObject({ verdict: "none", flowPut: false });
    expect(rows.itm_acme_profile).toMatchObject({ verdict: "none", flowPut: true });
    expect(rows.itm_acme_home!.decidedAt).toBeUndefined();
  });

  it("reads a deletion of a flow-kept screen as taken out, and a swap to its variation as no label", async () => {
    const rows = byItem((await fold(acmeCanvas())).pairs);
    expect(rows.itm_acme_cart).toMatchObject({ verdict: "taken-out", p: 0.55 });
    expect(rows.itm_acme_form).toMatchObject({ verdict: "none", flowPut: true });
    // The variation is not a row of its own: one P, one row.
    expect(rows.itm_acme_form_v).toBeUndefined();
  });

  it("reads a keep the person took back with undo as no label", async () => {
    const rows = byItem((await fold(acmeCanvas())).pairs);
    expect(rows.itm_acme_about).toMatchObject({ verdict: "none", band: "maybe" });
    expect(rows.itm_acme_about!.decidedAt).toBeDefined();
  });

  it("leaves out a flow before need, a flow undone whole, and a spec rendered by hand — and says so", async () => {
    const { pairs, excluded } = await fold(acmeCanvas());
    const ids = pairs.map((p) => p.itemId);
    expect(ids).not.toContain("itm_acme_old");
    expect(ids).not.toContain("itm_acme_gone");
    expect(ids).not.toContain("itm_acme_hand");
    expect(excluded).toEqual({ noNeed: 1, notDrawnHere: 1, withdrawn: 1 });
  });

  it("keeps a sure screen from a basic flow the person used, with the answerer it cannot name", async () => {
    const rows = byItem((await fold(acmeCanvas())).pairs);
    expect(rows.itm_acme_basic).toMatchObject({ verdict: "kept", p: 0.77, band: "sure", flowPut: false, answerer: "unknown" });
  });

  it("counts only the reader's own acts: the same log read as the collaborator labels differently", async () => {
    const rows = byItem((await fold(acmeCanvas(), undefined, COLLABORATOR.id)).pairs);
    expect(rows.itm_acme_search).toMatchObject({ verdict: "kept" });
    expect(rows.itm_acme_detail).toMatchObject({ verdict: "none" });
    expect(rows.itm_acme_list).toMatchObject({ verdict: "none" });
  });

  it("says which flows the person worked through", async () => {
    const rows = byItem((await fold(acmeCanvas())).pairs);
    expect(rows.itm_acme_settings!.engaged).toBe(true);
    expect(rows.itm_acme_basic!.engaged).toBe(true);
    expect(rows.itm_acme_quiet).toMatchObject({ verdict: "none", engaged: false, flowPut: true, answerer: "stub" });
    expect(rows.itm_acme_quieter).toMatchObject({ verdict: "none", engaged: false, flowPut: false, band: "maybe" });
  });

  it("does not depend on the order the log arrives in, or on archived entries repeating live ones", async () => {
    const c = acmeCanvas();
    const shuffled = [...c.entries].reverse();
    const doubled = [...c.entries.slice(0, 20), ...c.entries];
    expect((await fold(c, shuffled)).pairs).toEqual((await fold(c)).pairs);
    expect((await fold(c, doubled)).pairs).toEqual((await fold(c)).pairs);
  });
});

describe("P comes from need, never from a property only maybes carry", () => {
  it("reads need and by off the spec, and nothing off wireMaybe", () => {
    const html = wireHtml({ request: "An Acme app", flow: "grp_acme", archetype: "list", title: "Acme", need: 0.62, by: { answerer: "stub", model: "stub (seed 1)" } });
    expect(readWireFacts(html)).toMatchObject({ need: 0.62, by: { answerer: "stub", model: "stub (seed 1)" } });
    expect(readWireFacts("<html>not a wire</html>")).toBeNull();
  });

  it("gives every sure screen a P too — a reader of wireMaybe would have none for them", async () => {
    const { pairs } = await fold(acmeCanvas());
    const sure = pairs.filter((p) => p.band === "sure");
    expect(sure.length).toBeGreaterThan(0);
    for (const p of sure) expect(p.p).toBeGreaterThanOrEqual(0.5);
  });

  it("the fold's source never names the maybe property", () => {
    const source = readFileSync(new URL("../src/corpus.ts", import.meta.url), "utf8") + readFileSync(new URL("../src/wire-format.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/wireMaybe/);
  });
});

describe("the held-out split", () => {
  const keys = Array.from({ length: 2000 }, (_, i) => ({ canvas: `prj_acme_${i % 7}`, item: `itm_acme_${i}` }));

  it("is stable: the same screen lands on the same side on every run", async () => {
    const first = keys.map((k) => splitOf(k.canvas, k.item));
    const again = [...keys].reverse().map((k) => splitOf(k.canvas, k.item)).reverse();
    expect(again).toEqual(first);
    // And the fold agrees with itself across runs.
    const a = (await fold(acmeCanvas())).pairs.map((p) => [p.itemId, p.split]);
    const b = (await fold(acmeCanvas())).pairs.map((p) => [p.itemId, p.split]);
    expect(b).toEqual(a);
  });

  it("is disjoint, and near the share it names", () => {
    const held = keys.filter((k) => splitOf(k.canvas, k.item) === "held-out");
    const tune = keys.filter((k) => splitOf(k.canvas, k.item) === "tune");
    expect(held.length + tune.length).toBe(keys.length);
    expect(held.some((h) => tune.includes(h))).toBe(false);
    expect(Math.abs(held.length / keys.length - HELD_OUT_SHARE)).toBeLessThan(0.04);
  });

  it("depends on the canvas as well as the item", () => {
    const sides = new Set(Array.from({ length: 40 }, (_, i) => splitOf(`prj_acme_${i}`, "itm_acme_same")));
    expect(sides.size).toBe(2);
  });
});

describe("the committed fixture", () => {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/corpus-shape.json", import.meta.url), "utf8")) as unknown;

  it("is the shape of the synthetic canvas's fold — regenerated here, so it cannot drift from the fold", async () => {
    expect(fixture).toEqual(shapeOf((await fold(acmeCanvas())).pairs));
  });

  it("holds labels of every kind, so a harness built on it can see each", () => {
    const pairs = (fixture as { pairs: Array<{ verdict: string; band: string; split: string }> }).pairs;
    expect(new Set(pairs.map((p) => p.verdict))).toEqual(new Set(["kept", "taken-out", "none"]));
    expect(new Set(pairs.map((p) => p.band))).toEqual(new Set(["sure", "maybe"]));
    expect(new Set(pairs.map((p) => p.split))).toEqual(new Set(["tune", "held-out"]));
  });

  it("contains no string outside the synthetic grammar — no request, no screen title, no canvas name", () => {
    expect(fixtureProblems(fixture)).toEqual([]);
  });

  it("the grammar check fails on the strings it exists to keep out", () => {
    const leaked = JSON.parse(JSON.stringify(fixture)) as { pairs: Array<Record<string, unknown>> };
    leaked.pairs[0]!.title = "Acme List";
    leaked.pairs[1]!.verdict = "An Acme app for booking a desk";
    (leaked as Record<string, unknown>).canvas = "prj_acme";
    const problems = fixtureProblems(leaked);
    expect(problems.join("\n")).toContain('key "title"');
    expect(problems.join("\n")).toContain('"Acme List"');
    expect(problems.join("\n")).toContain('"An Acme app for booking a desk"');
    expect(problems.join("\n")).toContain('key "canvas"');
  });

  it("the shape of a real fold carries none of its strings", async () => {
    const { pairs } = await fold(acmeCanvas());
    const text = JSON.stringify(shapeOf(pairs));
    for (const p of pairs) {
      for (const s of [p.request, p.title, p.canvasId, p.itemId, p.flow]) expect(text).not.toContain(s);
    }
  });
});
