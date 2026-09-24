import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FIDELITY_PROP, type CanvasContents, type Item } from "@isocan/core";
import { KEEP_EMOJI as RECORD_KEEP_EMOJI, KEEP_PROP as RECORD_KEEP_PROP, MAYBE_PROP as RECORD_MAYBE_PROP } from "../src/record.ts";
import {
  KEEP_EMOJI, KEEP_MARK, KEEP_PROP, LEAVE_OUT, MAYBE_PROP, VARIATION_FLOOR, applyPropsRound, applyStructure, decideFlow, decisions, flipWords, flowRequest, flowScreen,
  honestFlips, isKept, keepPatch, keepable, kept, oneWay, propsRequests, readResponse, renderWire, structureRequest,
  validateWire, variations, vary, wireTitle, type JevResponse, type WireSpec,
} from "../src/core.ts";

/**
 * **Variation selection on a real Jev answer** (design §5).
 *
 * `fixtures/jev-acme-couriers.json` is what Jev actually answered, on 23 Sep
 * 2026, to a synthetic request run through `isocan wire --save`: the three
 * rounds' responses only. Each test replays them through the composer's own
 * pure rounds — the requests are rebuilt from the catalog and every response
 * is checked against its question — so these are the probabilities a person
 * would see on the canvas, not ones written to make a test pass.
 */

interface Fixture {
  request: string;
  round1: JevResponse;
  round2: JevResponse[];
  round3: JevResponse[];
}
const fixture = JSON.parse(readFileSync(fileURLToPath(new URL("./fixtures/jev-acme-couriers.json", import.meta.url)), "utf8")) as Fixture;

function replay(): WireSpec[] {
  const req1 = flowRequest(fixture.request);
  const decision = decideFlow(req1, readResponse(req1, fixture.round1));
  // Rounds 2 and 3 were recorded for the screens round 1 admitted at the old 0.5 cut; its maybe screens (welcome 0.42, confirm 0.36) were never asked.
  let specs = decision.archetypes.filter((a) => !a.maybe).map((a) => flowScreen(a.id, fixture.request, "flw_acme", decision));
  const titles = specs.map((s) => s.title);
  specs = specs.map((spec, i) => {
    const req = structureRequest(spec, titles);
    return applyStructure(spec, req, readResponse(req, fixture.round2[i]));
  });
  const reqs = propsRequests(specs);
  return applyPropsRound(specs, reqs, reqs.map((req, i) => readResponse(req, fixture.round3[i])));
}

const specs = replay();
const byTitle = (title: string) => specs.find((s) => s.title === title)!;

describe("the recorded flow", () => {
  it("is the flow the live run drew: seven screens, every one valid", () => {
    expect(specs.map((s) => s.title)).toEqual(["Sign in", "Verify", "Home", "List", "Detail", "Form", "Status"]);
    for (const spec of specs) expect(validateWire(spec)).toEqual([]);
  });

  it("keeps the include decision's probability — on the screen as LEAVE_OUT, off it in `declined`", () => {
    // Detail's footer: Jev said include 0.57, so leave-out 0.43 rides with it.
    const footer = byTitle("Detail").slots.find((s) => s.slot === "footer")!;
    expect(footer.alternatives).toContainEqual({ block: LEAVE_OUT, p: expect.closeTo(0.43, 5) });
    // Home's first main section: include 0.26, so it is absent — and recorded, with the block that would fill it.
    const home = byTitle("Home");
    expect(home.slots.some((s) => s.slot === "main.1")).toBe(false);
    expect(home.declined).toContainEqual({ slot: "main.1", p: expect.closeTo(0.74, 5), block: "stats-row" });
  });
});

describe("which decisions a variation flips", () => {
  it("spends variations where the runner-up holds the most probability", () => {
    // Home: main.1 back in (0.26) beats card grid for stacked list (0.25) beats aside (0.13) and main.2 (0.11).
    const flips = honestFlips(byTitle("Home"));
    expect(flips.map((d) => [d.slot, d.to, d.runnerUp.toFixed(2)])).toEqual([
      ["main.1", "stats-row", "0.26"],
      ["main.3", "card-grid", "0.25"],
      ["aside", "stacked-list", "0.13"],
      ["main.2", expect.any(String), "0.11"],
    ]);
    for (let i = 1; i < flips.length; i++) expect(flips[i - 1]!.runnerUp).toBeGreaterThanOrEqual(flips[i]!.runnerUp);
  });

  it("offers nothing under the 0.10 floor — and the floor itself is honest", () => {
    // Status: empty-state at exactly 0.10 is offered; error-state at 0.01 is not.
    expect(honestFlips(byTitle("Status")).map((d) => d.to)).toEqual(["empty-state"]);
    // Form: wizard at 0.02 is not; a single button at 0.25 is.
    expect(honestFlips(byTitle("Form")).map((d) => d.to)).toEqual(["button"]);
    for (const spec of specs) for (const d of honestFlips(spec)) expect(d.runnerUp).toBeGreaterThanOrEqual(VARIATION_FLOOR);
    // List's card grid at 0.04 is the runner-up of a decision, but not an honest variation.
    expect(decisions(byTitle("List")).some((d) => d.to === "card-grid" && d.runnerUp < VARIATION_FLOOR)).toBe(true);
    expect(honestFlips(byTitle("List")).some((d) => d.to === "card-grid")).toBe(false);
  });

  it("says one way to draw this where Jev was certain, and nowhere else", () => {
    // Verify: verify-code at 1.00, no optional section — nothing to flip.
    expect(specs.filter(oneWay).map((s) => s.title)).toEqual(["Verify"]);
    expect(variations(byTitle("Verify"), "itm_verify")).toEqual([]);
  });

  it("never varies the chrome the flow fixed once for every screen", () => {
    // The flow's header and nav carry runners-up (nav tab-bar 0.79), and still no screen flips them.
    const chrome = specs.flatMap((spec) => spec.slots.filter((s) => (s.slot === "nav" || s.slot === "header") && (s.alternatives?.length ?? 0) > 0));
    expect(chrome.length).toBeGreaterThan(0);
    for (const spec of specs) for (const d of decisions(spec)) expect(["header", "nav"]).not.toContain(d.slot);
  });
});

describe("a variation", () => {
  it("is the screen with ONE decision flipped, titled with what flipped, pointing at its screen", () => {
    const [first, second] = variations(byTitle("Home"), "itm_home");
    expect(wireTitle(first!)).toBe("Home · with stats row");
    // The heading inside the frame stays the screen's: a variation is the same screen.
    expect(first!.title).toBe("Home");
    expect(wireTitle(second!)).toBe("Home · card grid instead of stacked list");
    expect(second!.variantOf).toBe("itm_home");
    expect(second!.flip).toEqual({ slot: "main.3", from: "stacked-list", to: "card-grid" });
    const differs = second!.slots.filter((s, i) => JSON.stringify(s) !== JSON.stringify(byTitle("Home").slots[i]));
    expect(differs.map((s) => s.slot)).toEqual(["main.3"]);
    for (const v of [first!, second!]) expect(validateWire(v)).toEqual([]);
  });

  it("flips include ↔ leave out both ways, and remembers what it was chosen over", () => {
    // Out: Detail without its footer — the section is gone and recorded as declined.
    const detail = byTitle("Detail");
    const out = vary(detail, honestFlips(detail).find((d) => d.to === LEAVE_OUT)!, "itm_detail");
    expect(wireTitle(out)).toBe("Detail · without button group");
    expect(out.slots.some((s) => s.slot === "footer")).toBe(false);
    expect(out.declined).toContainEqual({ slot: "footer", p: expect.closeTo(0.43, 5), block: "button-group" });
    // In: Sign in with an image — the section returns in recipe order, LEAVE_OUT its runner-up.
    const signIn = byTitle("Sign in");
    const back = vary(signIn, honestFlips(signIn)[0]!, "itm_sign_in");
    const at = back.slots.findIndex((s) => s.slot === back.flip!.slot);
    expect(back.slots[at]!.alternatives).toEqual([{ block: LEAVE_OUT, p: expect.any(Number) }]);
    expect(back.declined?.some((d) => d.slot === back.flip!.slot) ?? false).toBe(false);
    for (const v of [out, back]) expect(validateWire(v)).toEqual([]);
    expect(flipWords({ slot: "x", from: LEAVE_OUT, to: "search-field" })).toBe("with search field");
  });

  it("is not made twice: a flip a sibling already shows is skipped, and count is how many in all", () => {
    const home = byTitle("Home");
    const two = variations(home, "itm_home", 2);
    const third = variations(home, "itm_home", 3, two.map((v) => v.flip!));
    expect(third.map((v) => v.flip!.slot)).toEqual(["aside"]);
    expect(variations(home, "itm_home", 2, two.map((v) => v.flip!))).toEqual([]);
  });

  it("draws: the screen says one way to draw this, a variation carries its flip in its file", () => {
    const html = renderWire({ ...byTitle("Verify"), varied: "none" });
    expect(html).toContain("one way to draw this");
    expect(renderWire(byTitle("Home"))).not.toContain("one way to draw this");
  });
});

describe("the keep mark", () => {
  const item = (id: string, x: number, y: number, properties: Record<string, string> = {}): Item =>
    ({ id, x, y, width: 390, height: 876, title: id, properties: { fidelity: "wireframe", ...properties }, versions: [], currentVersionId: "" }) as unknown as Item;

  it("is a property: set and removed by patch, readable by anyone", () => {
    expect(keepPatch(true)).toEqual({ properties: { wireKeep: "yes" } });
    expect(keepPatch(false)).toEqual({ removeProperties: ["wireKeep"] });
    expect(isKept(item("a", 0, 0, { wireKeep: "yes" }))).toBe(true);
  });

  it("is offered by the property core's design gate reads (spelled out in the record to keep it out of first paint)", () => {
    expect(KEEP_MARK.offeredOn).toEqual({ [FIDELITY_PROP]: "wireframe" });
  });

  it("the lazy half's property names are the record's — read off it, or spelled out and held equal here", () => {
    // `MAYBE_PROP` is written twice so the entry chunk exports nothing new to the lazy half.
    expect(MAYBE_PROP).toBe(RECORD_MAYBE_PROP);
    expect(KEEP_PROP).toBe(RECORD_KEEP_PROP);
    expect(KEEP_EMOJI).toBe(RECORD_KEEP_EMOJI);
  });

  it("is offered on wireframe screens, and on anything already wearing it so it can come off", () => {
    expect(keepable(item("a", 0, 0))).toBe(true);
    const plain = { ...item("b", 0, 0), properties: {} } as Item;
    expect(keepable(plain)).toBe(false);
    expect(keepable({ ...plain, properties: { wireKeep: "yes" } } as Item)).toBe(true);
  });

  it("lists kept screens in reading order — the row left to right, then what is under it", () => {
    const canvas = {
      items: {
        c: item("c", 940, 0, { wireKeep: "yes" }),
        a: item("a", 0, 0, { wireKeep: "yes" }),
        under: item("under", 0, 960, { wireKeep: "yes" }),
        b: item("b", 470, 0),
      },
    } as unknown as CanvasContents;
    expect(kept(canvas).map((i) => i.id)).toEqual(["a", "c", "under"]);
  });
});
