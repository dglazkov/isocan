import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  approxTokens,
  baselineRoute,
  CATEGORY_ROUTE,
  disposition,
  DISPOSITIONS,
  isRoute,
  ROUTE_ABOUT,
  ROUTE_QUESTION,
  routeOfCategory,
  routeRequest,
  ROUTES,
  routeStateText,
  scenarioOf,
  scoreRoutes,
  winnerOf,
  splitOf,
  STATE_TOKEN_CAP,
  type Disposition,
  type Route,
  type RouteState,
} from "../src/intent-route.ts";
import { jevToChoice } from "../src/local-judge.ts";

interface Case { id: string; scenario: string; text: string; state: RouteState; intent: Route; disposition: Disposition; pair?: string; tags?: string[] }
const fixture = JSON.parse(readFileSync(new URL("./fixtures/local-judge-routes.json", import.meta.url), "utf8")) as { seed: string; cases: Case[] };

describe("the seven routes", () => {
  it("each has a description, and the routing question offers exactly them", () => {
    expect(ROUTES).toHaveLength(7);
    for (const r of ROUTES) expect(ROUTE_ABOUT[r].length).toBeGreaterThan(20);
    expect(Object.keys(ROUTE_QUESTION.criteria).sort()).toEqual([...ROUTES].sort());
    // The same question reaches the local judge unchanged.
    expect(Object.keys(jevToChoice(ROUTE_QUESTION).criteria).sort()).toEqual([...ROUTES].sort());
    expect(routeRequest("x").questions.route).toBe(ROUTE_QUESTION);
    expect(isRoute("find")).toBe(true);
    expect(isRoute("create")).toBe(false);
  });
});

describe("categoriseAsk's fifteen categories, mapped", () => {
  it("maps every category to a route, and says why where the map loses something", () => {
    const entries = Object.entries(CATEGORY_ROUTE);
    expect(entries).toHaveLength(15);
    for (const [, m] of entries) {
      expect(isRoute(m.route)).toBe(true);
      if (!m.clean) expect(m.why).toBeTruthy();
    }
  });

  it("reaches neither find nor clarify — no category the asks produced is either", () => {
    const reached = new Set(Object.values(CATEGORY_ROUTE).map((m) => m.route));
    expect(reached.has("find")).toBe(false);
    expect(reached.has("clarify")).toBe(false);
  });

  it("is approach A: the regex's category, then the map", () => {
    expect(routeOfCategory("variation")).toBe("variation");
    expect(baselineRoute("/variation 3 bolder")).toBe("variation");
    expect(baselineRoute("Thanks, looks great!")).toBe("just-a-comment");
    expect(baselineRoute("Change this button to green")).toBe("edit-selection");
    expect(baselineRoute("Create a signup screen for the Acme app")).toBe("wire");
    expect(baselineRoute("How does the version stack work?")).toBe("ask-agent");
  });
});

describe("the state a judge reads", () => {
  it("leads with the structured state and keeps a short ask whole", () => {
    const r = routeStateText("Make it bigger", { selected: 1, role: "viewer", modules: ["wireframe"] });
    expect(r.text).toBe("[1 item selected; read-only; modules: wireframe]\nMake it bigger");
    expect(r.truncated).toBe(false);
    expect(routeStateText("x", { selected: 0, role: "editor" }).text).toBe("[nothing selected; can edit]\nx");
  });

  it("cuts a long ask to the cap at a word, and says it did", () => {
    const long = Array.from({ length: 400 }, (_, i) => `word${i}`).join(" ");
    const r = routeStateText(long, { selected: 2, role: "editor" });
    expect(r.truncated).toBe(true);
    expect(r.tokens).toBeLessThanOrEqual(STATE_TOKEN_CAP);
    expect(r.text.endsWith("…")).toBe(true);
    expect(r.text).toMatch(/^\[2 items selected; can edit\]\nword0 word1/);
    expect(approxTokens("abcd")).toBe(1);
  });
});

describe("the policy layer", () => {
  const editor: RouteState = { selected: 1, role: "editor", modules: ["wireframe"] };
  it("refuses an edit on a read-only canvas without changing the intent", () => {
    expect(disposition("edit-selection", { ...editor, role: "viewer" })).toBe("refuse");
    expect(disposition("find", { ...editor, role: "viewer" })).toBe("suggest");
  });
  it("asks for a selection, says a missing module is missing, and clarifies under the cut", () => {
    expect(disposition("variation", { ...editor, selected: 0 })).toBe("select-first");
    expect(disposition("wire", { ...editor, modules: [] })).toBe("unavailable");
    expect(disposition("wire", { selected: 0, role: "editor" })).toBe("suggest"); // modules unknown: not refused for it
    expect(disposition("edit-selection", editor, false)).toBe("clarify");
    expect(disposition("just-a-comment", editor)).toBe("nothing");
    expect(disposition("clarify", editor)).toBe("clarify");
  });
});

describe("the splits", () => {
  it("are deterministic from the seed, and move with it", () => {
    expect(splitOf("acme", "s1")).toBe(splitOf("acme", "s1"));
    const scenarios = Array.from({ length: 400 }, (_, i) => `scenario ${i}`);
    const counts = { dev: 0, calibration: 0, locked: 0 };
    for (const s of scenarios) counts[splitOf(s, "s1")]++;
    expect(counts.dev).toBeGreaterThan(160);
    expect(counts.calibration).toBeGreaterThan(70);
    expect(counts.locked).toBeGreaterThan(70);
    expect(scenarios.some((s) => splitOf(s, "s1") !== splitOf(s, "s2"))).toBe(true);
  });
  it("treat the same real ask, mentions and punctuation aside, as one scenario", () => {
    expect(scenarioOf("@Kai Make it POP!")).toBe(scenarioOf("@Lena make it pop"));
  });
});

describe("the synthetic fixture", () => {
  it("covers all seven routes and every disposition a pair exercises", () => {
    expect(new Set(fixture.cases.map((c) => c.intent))).toEqual(new Set(ROUTES));
    for (const c of fixture.cases) expect(DISPOSITIONS).toContain(c.disposition);
    for (const pair of ["negation", "selection", "quoted", "find-vs-create", "permission"]) {
      expect(fixture.cases.filter((c) => c.pair === pair).length).toBeGreaterThanOrEqual(8);
    }
    expect(fixture.cases.some((c) => c.tags?.includes("unrelated"))).toBe(true);
  });

  it("carries the disposition the policy gives each intent in its state", () => {
    for (const c of fixture.cases) expect({ id: c.id, d: disposition(c.intent, c.state) }).toEqual({ id: c.id, d: c.disposition });
  });

  it("keeps both halves of a pair in one scenario, so one split", () => {
    const byScenario = new Map<string, Case[]>();
    for (const c of fixture.cases) byScenario.set(c.scenario, [...(byScenario.get(c.scenario) ?? []), c]);
    for (const [, cs] of byScenario) expect(new Set(cs.map((c) => splitOf(c.scenario, fixture.seed))).size).toBe(1);
    // A permission pair: same words, same intent, a different disposition.
    const perm = byScenario.get("perm-edit")!;
    expect(new Set(perm.map((c) => c.intent)).size).toBe(1);
    expect(new Set(perm.map((c) => c.disposition))).toEqual(new Set(["suggest", "refuse"]));
    // A negation pair: a different intent.
    expect(new Set(byScenario.get("neg-header")!.map((c) => c.intent))).toEqual(new Set(["edit-selection", "just-a-comment"]));
    expect(new Set(fixture.cases.map((c) => c.id)).size).toBe(fixture.cases.length);
  });
});

describe("scoring a judge", () => {
  const s: RouteState = { selected: 1, role: "editor" };
  const rows = [
    { id: "a", truth: "edit-selection" as const, predicted: "edit-selection" as const, p: 0.9, margin: 0.8, state: s, truthDisposition: "suggest" as const },
    { id: "b", truth: "just-a-comment" as const, predicted: "edit-selection" as const, p: 0.9, margin: 0.7, state: s, tags: ["unrelated"], truthDisposition: "nothing" as const },
    { id: "c", truth: "find" as const, predicted: "find" as const, p: 0.4, margin: 0.1, state: s, truthDisposition: "suggest" as const },
  ];
  it("reads a distribution as winner, probability and margin", () => {
    expect(winnerOf({ find: 0.6, wire: 0.3, clarify: 0.1 })).toEqual({ route: "find", p: 0.6, margin: expect.closeTo(0.3) });
  });
  it("counts accuracy among accepted, coverage and confident errors where acting is worst", () => {
    const all = scoreRoutes(rows, "all");
    expect(all.accuracy.k).toBe(2);
    expect(all.coverage.rate).toBe(1);
    expect(all.confidentErrors.noAction.k).toBe(1);
    expect(all.confidentErrors.unrelated.k).toBe(1);
    const cut = scoreRoutes(rows, { p: 0.5, margin: 0.75 });
    expect(cut.coverage.k).toBe(1);
    expect(cut.accuracy.rate).toBe(1);
    expect(cut.confidentErrors.noAction.k).toBe(0);
    // Under the cut, c abstains: clarify, not the suggest it expected.
    expect(cut.disposition?.k).toBe(1);
    expect(scoreRoutes(rows, null).coverage.k).toBe(0);
    expect(cut.perRoute.find((r) => r.route === "find")).toMatchObject({ n: 1, accepted: 0 });
  });
});
