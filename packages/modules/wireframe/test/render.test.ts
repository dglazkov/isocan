import { describe, expect, it } from "vitest";
import {
  COMPONENTS, PLATFORMS, RECIPES, SKELETON_COLORS, WIRE_MARKER, blueprint, readWire, renderWire, validateWire, wireframe,
  type PropDef, type WireSpec,
} from "../src/core.ts";
import { __SKELETON_CSS, __WIRE_CSS } from "../src/render.ts";

/**
 * **Phase 0's proof, part 1** (`docs/projects/wireframes/phases.md`): every
 * archetype drawn three ways — blueprint, half resolved, fully resolved at
 * each block's defaults — with the spec surviving the trip through the file,
 * every block and primitive a recipe names drawing, and the skeleton's blue
 * appearing exactly where a slot is undecided.
 */

const BLUE = new RegExp(SKELETON_COLORS.join("|"), "i");

/** The markup of one slot, found by its data-slot attribute. Sections never nest. */
function slotHtml(html: string, slot: string): string {
  const m = new RegExp(`<section class="([^"]*)" data-slot="${slot.replace(".", "\\.")}"[^>]*>([\\s\\S]*?)</section>`).exec(html);
  if (!m) throw new Error(`no slot ${slot} in the rendered screen`);
  return m[0];
}

function classesOf(html: string, slot: string): string[] {
  return /class="([^"]*)"/.exec(slotHtml(html, slot))![1]!.split(/\s+/);
}

/** Every class token in a fragment. */
function allClasses(fragment: string): string[] {
  return [...fragment.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1]!.split(/\s+/)).filter(Boolean);
}

/** CSS rules as [selector, body] pairs — the sheets here are flat, no at-rules. */
function rules(css: string): Array<[string, string]> {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1]!.trim(), m[2]!]);
}

function styleOf(html: string): string {
  return /<style>([\s\S]*?)<\/style>/.exec(html)![1]!;
}

const three = (id: string, platform?: WireSpec["platform"]) => {
  const o = { request: "Acme stock receiving", flow: "acme-flow", ...(platform ? { platform } : {}) };
  return {
    blueprint: blueprint(id, o),
    half: wireframe(id, o, (s, i) => (i % 2 === 0 ? s.options[0]! : null)),
    full: wireframe(id, o),
  };
};

describe("the renderer, over all 18 archetypes", () => {
  it("has the 18 wave-1 archetypes to draw", () => {
    expect(RECIPES.map((r) => r.id)).toHaveLength(18);
  });

  for (const r of RECIPES) {
    describe(r.id, () => {
      const specs = three(r.id);

      for (const [state, spec] of Object.entries(specs)) {
        it(`${state}: is valid, draws, and round-trips its spec`, () => {
          expect(validateWire(spec)).toEqual([]);
          const html = renderWire(spec);
          expect(html.startsWith("<!doctype html>")).toBe(true);
          expect(html).toContain(WIRE_MARKER);
          expect(readWire(html)).toStrictEqual(spec);
          // Nothing leaked from a draw function that should not have.
          expect(html).not.toMatch(/undefined|NaN|\[object Object\]/);
          expect(html.toLowerCase()).not.toContain("lorem");
          // Self-contained: nothing fetched.
          expect(html).not.toMatch(/<link\b|<script\b[^>]*\bsrc=|@import|url\(\s*["']?https?:/i);
        });
      }

      it("blueprint: every slot is a skeleton, drawn in the skeleton palette", () => {
        const html = renderWire(specs.blueprint);
        expect(html).toMatch(BLUE);
        for (const s of specs.blueprint.slots) {
          const classes = classesOf(html, s.slot);
          expect(classes).toContain("sk");
          expect(slotHtml(html, s.slot)).toContain('data-state="skeleton"');
        }
      });

      it("half: undecided slots are skeleton, chosen slots carry no skeleton class and no skeleton colour", () => {
        const spec = specs.half;
        const html = renderWire(spec);
        // A one-slot recipe (confirm, state) has no half: its "half" is resolved, and still
        // has to pass the per-slot half of this. Every other recipe is really mixed.
        if (spec.slots.length > 1) {
          expect(spec.slots.some((s) => s.block === null)).toBe(true);
          expect(spec.slots.some((s) => s.block !== null)).toBe(true);
        }
        for (const s of spec.slots) {
          const fragment = slotHtml(html, s.slot);
          if (s.block === null) {
            expect(classesOf(html, s.slot)).toContain("sk");
          } else {
            expect(allClasses(fragment).filter((c) => c === "sk" || c.startsWith("sk-"))).toEqual([]);
            expect(fragment).not.toMatch(BLUE);
            expect(fragment).toContain(`data-block="${s.block}"`);
          }
        }
        // And the blue in the sheet only reaches `.sk` elements: every rule
        // that names a skeleton colour selects through a `.sk…` class.
        for (const [selector, body] of rules(styleOf(html))) {
          if (!BLUE.test(body)) continue;
          for (const one of selector.split(",")) expect(one.trim(), `${selector} paints blue`).toMatch(/^\.sk/);
        }
      });

      it("full: no skeleton colour anywhere in the file, and every slot draws its chosen block", () => {
        const html = renderWire(specs.full);
        expect(html).not.toMatch(BLUE);
        expect(allClasses(html).filter((c) => c === "sk" || c.startsWith("sk-"))).toEqual([]);
        for (const s of specs.full.slots) {
          const fragment = slotHtml(html, s.slot);
          expect(fragment).toContain(`data-block="${s.block}"`);
          expect(fragment).toContain('data-state="wire"');
          // A drawn block is more than its empty wrapper.
          expect(fragment.replace(/<section[^>]*>|<\/section>/g, "").length).toBeGreaterThan(20);
        }
      });

      it("draws on every platform the recipe names", () => {
        for (const p of r.platforms) {
          for (const spec of Object.values(three(r.id, p))) {
            const html = renderWire(spec);
            expect(readWire(html)).toStrictEqual(spec);
            expect(html).toContain(`class="frame ${p}`);
          }
        }
      });
    });
  }
});

describe("every block and primitive a recipe names", () => {
  const cases = RECIPES.flatMap((r) => r.sections.flatMap((s) => s.options.map((option) => ({ r, s, option }))));

  it("covers all 50 components the recipes name (28 blocks, 22 primitives)", () => {
    expect(new Set(cases.map((c) => c.option)).size).toBe(50);
  });

  for (const { r, s, option } of cases) {
    it(`${r.id}.${s.slot} draws ${option}`, () => {
      const spec = wireframe(r.id, {}, (section) => (section.slot === s.slot ? option : null));
      const html = renderWire(spec);
      const fragment = slotHtml(html, s.slot);
      expect(fragment).toContain(`data-block="${option}"`);
      expect(fragment).not.toMatch(BLUE);
      expect(fragment).not.toMatch(/undefined|NaN/);
      expect(readWire(html)).toStrictEqual(spec);
    });
  }
});

describe("every prop value draws", () => {
  function values(def: PropDef): Array<string | number | boolean> {
    switch (def.kind) {
      case "choice": return [...def.values];
      case "flag": return [true, false];
      case "count": return [def.min, def.max];
      case "index": return [1, def.max];
    }
  }
  const homes = new Map<string, { archetype: string; slot: string }>();
  for (const r of RECIPES) for (const s of r.sections) for (const o of s.options) if (!homes.has(o)) homes.set(o, { archetype: r.id, slot: s.slot });

  for (const [id, home] of homes) {
    const c = COMPONENTS.get(id)!;
    it(`${id}: each value of each prop, on each platform`, () => {
      for (const [key, def] of Object.entries(c.props)) {
        for (const value of values(def)) {
          for (const platform of PLATFORMS) {
            const spec = wireframe(home.archetype, { platform }, (s) => (s.slot === home.slot ? id : null));
            const slot = spec.slots.find((s) => s.slot === home.slot)!;
            slot.props = { ...slot.props, [key]: value };
            delete slot.intents; // the defaults fill whatever this prop value makes present
            const html = renderWire(spec);
            expect(slotHtml(html, home.slot), `${id}.${key}=${String(value)} on ${platform}`).not.toMatch(/undefined|NaN|\[object Object\]/);
          }
        }
      }
    });
  }
});

describe("labels are intents, and a spec says so", () => {
  it("a button's label is its intent's label", () => {
    const spec = wireframe("sign-in");
    const html = renderWire(spec);
    expect(slotHtml(html, "main.3")).toContain(">Sign in<");
    const form = spec.slots.find((s) => s.slot === "main.3")!;
    form.intents = { ...form.intents, submit: "continue" };
    expect(slotHtml(renderWire(spec), "main.3")).toContain(">Continue<");
  });

  it("a spec cannot put an intent on an element that cannot take it, or a free label anywhere", () => {
    const spec = wireframe("sign-in");
    const form = spec.slots.find((s) => s.slot === "main.3")!;
    form.intents = { ...form.intents, submit: "delete" };
    expect(validateWire(spec).join("\n")).toContain(`cannot take "delete"`);
    form.intents = { ...form.intents, submit: "Log me in please" as never };
    expect(validateWire(spec).join("\n")).toContain("is not an intent");
    expect(() => renderWire(spec)).toThrow(/not a drawable wireframe spec/);
  });

  it("refuses a block a slot does not offer, a missing required slot, and a prop out of range", () => {
    const spec = wireframe("list");
    const body = spec.slots.find((s) => s.slot === "main.3")!;
    body.block = "sign-in-form";
    expect(validateWire(spec).join("\n")).toContain("block must be null or one of stacked-list, card-grid, data-table");
    const noHeader = wireframe("list");
    noHeader.slots = noHeader.slots.filter((s) => s.slot !== "header");
    expect(validateWire(noHeader)).toContain(`slot "header" is required by list`);
    const tooMany = wireframe("list");
    tooMany.slots.find((s) => s.slot === "main.3")!.props.rows = 99;
    expect(validateWire(tooMany).join("\n")).toContain("stacked-list.rows must be a whole number 3–12");
  });

  it("a declined optional slot is simply absent, and draws as nothing", () => {
    const spec = wireframe("sign-in", {}, (s) => (s.optional ? "omit" : s.options[0]!));
    expect(validateWire(spec)).toEqual([]);
    const html = renderWire(spec);
    expect(html).not.toContain('data-slot="header"');
    expect(readWire(html)).toStrictEqual(spec);
  });
});

describe("the embedded spec", () => {
  it("survives words that would close a script element", () => {
    const spec = blueprint("detail", { request: `Acme </script><script>alert(1)</script> & "quotes"`, title: "Acme <Detail>" });
    const html = renderWire(spec);
    expect(html.match(/<\/script>/g)).toHaveLength(1);
    expect(readWire(html)).toStrictEqual(spec);
    expect(html).toContain("<title>Acme &lt;Detail&gt;</title>");
  });

  it("reads nothing from a file that is not a wireframe", () => {
    expect(readWire("<!doctype html><p>Acme</p>")).toBeNull();
  });
});

describe("the two sheets", () => {
  it("the greyscale sheet holds no skeleton colour; the skeleton sheet paints only .sk", () => {
    expect(__WIRE_CSS).not.toMatch(BLUE);
    for (const [selector] of rules(__SKELETON_CSS)) {
      for (const one of selector.split(",")) expect(one.trim()).toMatch(/^\.sk/);
    }
    expect(__SKELETON_CSS).toMatch(BLUE);
  });
});
