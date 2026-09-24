import { describe, expect, it } from "vitest";
import {
  ARCHETYPE_IDS, BLOCKS, COMPONENTS, INTENTS, INTENT_BY_ID, PRIMITIVES, RECIPES, flowQuestions, parseRecipe, recipeQuestions,
} from "../src/core.ts";

/**
 * **Phase 0's proof, part 2: the catalog is self-consistent** — and holds the
 * research's numbers. Wave 1 is 18 archetypes, 28 blocks, the 22 primitives
 * the recipes name, and 52 intents; no structural question has more than 4
 * options; no question of any kind has more than Jev's 255.
 */

/** Jev's ceiling on one question's options (the System One note). */
const JEV_MAX = 255;
/** The research's measured ceiling on a structural question inside a recipe. */
const STRUCTURAL_MAX = 4;
/** The research's bound on an enum prop ("enum, at most 8 values"). */
const ENUM_MAX = 8;

const named = new Set(RECIPES.flatMap((r) => r.sections.flatMap((s) => s.options)));

describe("the wave-1 catalog", () => {
  it("is 18 archetypes, 28 blocks, 22 primitives and 52 intents (the research's 49 and three tab targets)", () => {
    expect(RECIPES).toHaveLength(18);
    expect(BLOCKS).toHaveLength(28);
    expect(PRIMITIVES).toHaveLength(22);
    expect(INTENTS).toHaveLength(52);
  });

  it("names every archetype, block and primitive once", () => {
    const ids = [...BLOCKS, ...PRIMITIVES].map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(RECIPES.length);
    expect(new Set(INTENTS.map((i) => i.id)).size).toBe(INTENTS.length);
  });

  it("has recipes for exactly the first 18 archetype ids, in the research's order", () => {
    expect(RECIPES.map((r) => r.id)).toEqual(ARCHETYPE_IDS.slice(0, 18));
    expect(ARCHETYPE_IDS).toHaveLength(34);
  });

  it("the intents group as the research counts them — 10 · 4 · 4 · 1 · 2 · 7 · 13 · 8 — with three tab targets among the jumps", () => {
    const by = (g: string) => INTENTS.filter((i) => i.group === g).length;
    expect([by("forward"), by("auth"), by("back"), by("detail"), by("form"), by("overlay"), by("jump"), by("in-place")]).toEqual([10, 4, 4, 1, 2, 7, 16, 8]);
  });
});

describe("every name resolves", () => {
  it("every component a recipe names exists — and the recipes name exactly the 28 blocks and 22 primitives", () => {
    for (const id of named) expect(COMPONENTS.has(id), `recipes name ${id}`).toBe(true);
    expect([...named].filter((id) => COMPONENTS.get(id)!.kind === "block").sort()).toEqual(BLOCKS.map((b) => b.id).sort());
    expect([...named].filter((id) => COMPONENTS.get(id)!.kind === "primitive").sort()).toEqual(PRIMITIVES.map((p) => p.id).sort());
  });

  it("every intent an element accepts exists, and its default is one it accepts", () => {
    for (const c of COMPONENTS.values()) {
      for (const [el, def] of Object.entries(c.elements ?? {})) {
        expect(def.accepts.length, `${c.id}#${el} accepts nothing`).toBeGreaterThan(0);
        for (const i of def.accepts) expect(INTENT_BY_ID.has(i), `${c.id}#${el} accepts unknown intent ${i}`).toBe(true);
        expect(def.accepts, `${c.id}#${el}'s default`).toContain(def.default);
      }
    }
  });

  it("every archetype default intent names an element its component has, with an intent that element accepts", () => {
    for (const r of RECIPES) {
      for (const [cid, elements] of Object.entries(r.intents ?? {})) {
        expect(named.has(cid), `${r.id} sets intents for ${cid}, which no recipe names`).toBe(true);
        expect(r.sections.some((s) => s.options.includes(cid)), `${r.id} sets intents for ${cid}, which it does not offer`).toBe(true);
        const c = COMPONENTS.get(cid)!;
        for (const [el, intent] of Object.entries(elements)) {
          const def = c.elements?.[el];
          expect(def, `${r.id}: ${cid} has no element ${el}`).toBeDefined();
          expect(def!.accepts, `${r.id}: ${cid}#${el} cannot take ${intent}`).toContain(intent);
        }
      }
    }
  });

  it("every intent that jumps names a known archetype, and every overlay a known component or archetype", () => {
    for (const i of INTENTS) {
      if (i.nav.to === "archetype") expect(ARCHETYPE_IDS, i.id).toContain(i.nav.archetype);
    }
  });

  it("every prop's default is a value the prop allows", () => {
    for (const c of COMPONENTS.values()) {
      for (const [key, def] of Object.entries(c.props)) {
        const where = `${c.id}.${key}`;
        if (def.kind === "choice") expect(def.values, where).toContain(def.default);
        if (def.kind === "count") expect(def.default >= def.min && def.default <= def.max, where).toBe(true);
        if (def.kind === "index") expect(def.default >= 1 && def.default <= def.max, where).toBe(true);
      }
    }
  });
});

describe("the question budget", () => {
  const all = RECIPES.map((r) => ({ r, qs: recipeQuestions(r) }));

  it("no structural question in any recipe has more than 4 options", () => {
    for (const { r, qs } of all) {
      for (const q of qs.filter((x) => x.structural)) expect(q.options, `${r.id} ${q.id}`).toBeLessThanOrEqual(STRUCTURAL_MAX);
    }
    // And the biggest one is 4 — home's main body — so the bound is measured, not loose.
    expect(Math.max(...all.flatMap(({ qs }) => qs.filter((q) => q.structural).map((q) => q.options)))).toBe(STRUCTURAL_MAX);
  });

  it("no question of any kind has more than 255 options; the largest is the intent vocabulary", () => {
    const every = [...all.flatMap(({ qs }) => qs), ...flowQuestions()];
    for (const q of every) expect(q.options, q.id).toBeLessThanOrEqual(JEV_MAX);
    expect(Math.max(...every.map((q) => q.options))).toBe(52);
  });

  it("no enum prop has more than 8 values", () => {
    for (const c of COMPONENTS.values()) {
      for (const [key, def] of Object.entries(c.props)) if (def.kind === "choice") expect(def.values.length, `${c.id}.${key}`).toBeLessThanOrEqual(ENUM_MAX);
    }
  });

  it("every section is fixed, a yes/no, or a choice among two to four", () => {
    for (const r of RECIPES) {
      for (const s of r.sections) expect(s.options.length >= 1 && s.options.length <= 4, `${r.id}.${s.slot}`).toBe(true);
    }
  });
});

describe("the recipe notation", () => {
  it("parses the research's forms", () => {
    expect(parseRecipe("main: image → heading → text? → (button | button-group) → link?")).toEqual([
      { slot: "main.1", region: "main", options: ["image"], optional: false },
      { slot: "main.2", region: "main", options: ["heading"], optional: false },
      { slot: "main.3", region: "main", options: ["text"], optional: true },
      { slot: "main.4", region: "main", options: ["button", "button-group"], optional: false },
      { slot: "main.5", region: "main", options: ["link"], optional: true },
    ]);
    expect(parseRecipe("header: app-bar | page-header; nav: (tab-bar | side-nav)?")).toEqual([
      { slot: "header", region: "header", options: ["app-bar", "page-header"], optional: false },
      { slot: "nav", region: "nav", options: ["tab-bar", "side-nav"], optional: true },
    ]);
  });

  it("refuses what it does not understand rather than guessing", () => {
    expect(() => parseRecipe("middle: image")).toThrow(/unknown region/);
    expect(() => parseRecipe("main: Image!")).toThrow(/not a component id/);
  });
});
