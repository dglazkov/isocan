import { describe, expect, it } from "vitest";
import { parseDesign } from "@isocan/core";
import {
  COMPONENTS, DEFAULT_THEME, RECIPES, ROLES, applyMapping, assemblePrototype, blueprint, candidatesOf, guardContrast,
  inferLinks, mappingRequest, readWire, renderFrame, renderWire, sameStyle, stubAnswerer, themeCss, validateWire, wireframe,
  type JevRequest, type JevResponse, type PropDef, type WireSpec, type WireStyle,
} from "../src/core.ts";
import { __SKELETON_CSS, __WIRE_CSS } from "../src/render.ts";
import { ACME_NIGHT, ACME_WARM, PICKS } from "./fixtures/design-systems.ts";

/**
 * **Phase 4's proof, part 1** (`docs/projects/wireframes/phases.md`): the
 * wire look drawn from roles and nothing else, the blueprint untouched by a
 * theme, a style that round-trips in the spec, and a mapping that never
 * leaves the system's own tokens — unsure roles kept at the default, and an
 * unreadable on-primary raised for contrast.
 */

/** A colour written literally: a hex, a colour function, or a colour's name. */
const LITERAL = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(|(?<![-\w])(?:white|black|gr[ae]y|silver|red|blue|green)(?![-\w])/i;

function styleBlock(html: string): string {
  return /<style>([\s\S]*?)<\/style>/.exec(html)![1]!;
}

function bodyOf(html: string): string {
  return html.slice(html.indexOf("<body"));
}

const WARM: WireStyle = {
  source: "design-system",
  itemId: "item-acme-warm",
  versionId: "v-1",
  name: "Acme Warm",
  roles: {
    ground: { token: "background", value: "#efece4", p: 0.9, why: "asked" },
    primary: { token: "accent", value: "#d10a72", p: 0.93, why: "asked" },
    "on-primary": { token: "on-accent", value: "#ffffff", p: 0.88, why: "asked" },
    font: { token: "body", value: "Archivo, system-ui, sans-serif", why: "only" },
    radius: { token: "md", value: "14px", p: 0.61, why: "asked" },
  },
};

describe("the wire sheet reads roles and nothing else", () => {
  it("holds no literal colour, and every custom property it reads is a role", () => {
    expect(__WIRE_CSS).not.toMatch(LITERAL);
    const read = new Set([...__WIRE_CSS.matchAll(/var\(--w-([a-z-]+)\)/g)].map((m) => m[1]!));
    expect([...read].filter((r) => !(ROLES as readonly string[]).includes(r))).toEqual([]);
    // Every role is used by the sheet (font through body, radius and space through the controls).
    for (const role of ROLES) expect(read.has(role), role).toBe(true);
  });

  it("the default theme is the one place a wire's colour is literal — today's greys", () => {
    expect(DEFAULT_THEME).toMatchObject({ ground: "#ffffff", surface: "#ececec", line: "#c8c8c8", ink: "#222222", "ink-muted": "#555555", primary: "#222222", "on-primary": "#ffffff", radius: "8px", space: "8px" });
    const html = renderWire(wireframe("sign-in"));
    expect(styleBlock(html).startsWith(themeCss(undefined))).toBe(true);
    expect(themeCss(undefined)).toContain("--w-primary:#222222");
  });

  const cases = RECIPES.flatMap((r) => r.sections.flatMap((s) => s.options.map((option) => ({ r, s, option }))));
  const noSkeleton = (css: string) => css.replace(__SKELETON_CSS, "");

  it("every block and primitive draws only through the roles — no colour of its own in its markup", () => {
    for (const { r, s, option } of cases) {
      const spec = wireframe(r.id, {}, (section) => (section.slot === s.slot ? option : null));
      const html = renderWire(spec);
      const css = noSkeleton(styleBlock(html)).replace(themeCss(undefined), "");
      expect(css, `${r.id}.${s.slot} = ${option}: sheet`).not.toMatch(LITERAL);
      const slot = new RegExp(`<section class="slot w" data-slot="${s.slot.replace(".", "\\.")}"[\\s\\S]*?</section>`).exec(bodyOf(html))![0];
      expect(slot, `${r.id}.${s.slot} = ${option}: markup`).not.toMatch(LITERAL);
    }
  });

  it("every prop value of every component draws only through the roles too (the chart's kinds and series among them)", () => {
    const values = (def: PropDef) => (def.kind === "choice" ? [...def.values] : def.kind === "flag" ? [true, false] : def.kind === "count" ? [def.min, def.max] : [1, def.max]);
    const homes = new Map<string, { archetype: string; slot: string }>();
    for (const r of RECIPES) for (const s of r.sections) for (const o of s.options) if (!homes.has(o)) homes.set(o, { archetype: r.id, slot: s.slot });
    for (const [id, home] of homes) {
      for (const [key, def] of Object.entries(COMPONENTS.get(id)!.props)) {
        for (const value of values(def)) {
          const spec = wireframe(home.archetype);
          const slot = spec.slots.find((x) => x.slot === home.slot);
          if (!slot) continue;
          slot.block = id;
          slot.props = { [key]: value };
          delete slot.intents;
          expect(renderFrame(spec), `${id}.${key}=${String(value)}`).not.toMatch(LITERAL);
        }
      }
    }
  });
});

describe("a theme is applied to the same spec, never a different screen", () => {
  it("draws the same markup in any theme; only the roles' values change", () => {
    const spec = wireframe("list", { request: "Acme deliveries", flow: "acme" });
    const themed: WireSpec = { ...spec, style: WARM };
    expect(renderFrame(themed)).toBe(renderFrame(spec));
    const css = styleBlock(renderWire(themed));
    expect(css).toContain("--w-primary:#d10a72");
    expect(css).toContain("--w-font:Archivo, system-ui, sans-serif");
    expect(css).toContain("--w-radius:14px");
    // Roles the style does not name keep the default.
    expect(css).toContain(`--w-line:${DEFAULT_THEME.line}`);
  });

  it("a blueprint never takes a theme: blue means still being drawn, in every system", () => {
    const plain = blueprint("detail", { request: "Acme", flow: "acme" });
    const styled: WireSpec = { ...plain, style: WARM };
    expect(styleBlock(renderWire(styled))).toBe(styleBlock(renderWire(plain)));
    expect(styleBlock(renderWire(styled))).not.toContain("#d10a72");
    // A screen being drawn takes it: its chosen slots are wires.
    const half: WireSpec = { ...wireframe("detail", {}, (s, i) => (i === 0 ? s.options[0]! : null)), style: WARM };
    expect(styleBlock(renderWire(half))).toContain("--w-primary:#d10a72");
  });

  it("a prototype plays each screen in the theme that drew it", () => {
    const signIn: WireSpec = { ...wireframe("sign-in", { flow: "acme" }), style: WARM };
    const home = wireframe("home", { flow: "acme" });
    const kept = [{ id: "a", title: "Sign in", spec: signIn }, { id: "b", title: "Home", spec: home }];
    const html = assemblePrototype(kept, inferLinks(kept));
    expect(html).toMatch(/data-screen="a"[^>]*style="[^"]*--w-primary:#d10a72/);
    expect(html).toMatch(/data-screen="b"[^>]*style="[^"]*--w-primary:#222222/);
    const css = styleBlock(html).replace(/:root\{[^}]*\}/, "");
    expect(css).not.toMatch(LITERAL);
  });
});

describe("style in the spec", () => {
  it("round-trips through the file, and a default style is the same as none", () => {
    const spec: WireSpec = { ...wireframe("home", { request: "Acme", flow: "acme" }), style: WARM };
    expect(validateWire(spec)).toEqual([]);
    expect(readWire(renderWire(spec))).toStrictEqual(spec);
    expect(sameStyle(undefined, { source: "default" })).toBe(true);
    expect(sameStyle(WARM, JSON.parse(JSON.stringify(WARM)) as WireStyle)).toBe(true);
    expect(sameStyle(WARM, { ...WARM, versionId: "v-2" } as WireStyle)).toBe(false);
  });

  it("refuses a value a stylesheet should not hold, and a role that is not one", () => {
    const bad = (roles: Record<string, unknown>) => validateWire({ ...wireframe("home"), style: { ...WARM, roles } });
    expect(bad({ primary: { value: "red;}</style><script>", why: "asked" } })).toEqual([expect.stringContaining("style.roles.primary.value")]);
    expect(bad({ radius: { value: "8px;color:red", why: "asked" } })).toEqual([expect.stringContaining("style.roles.radius.value")]);
    expect(bad({ font: { value: "Acme</style>", why: "asked" } })).toEqual([expect.stringContaining("style.roles.font.value")]);
    expect(bad({ sparkle: { value: "#ffffff", why: "asked" } })).toEqual([expect.stringContaining('"sparkle" is not a role')]);
    expect(validateWire({ ...wireframe("home"), style: { source: "somewhere" } })).toEqual([expect.stringContaining("style.source")]);
  });
});

/** An answer that picks `picks[role]` at `p` and spreads the rest. */
function answering(request: JevRequest, picks: Record<string, string>, p = 0.9): JevResponse {
  const answers: JevResponse["answers"] = {};
  for (const [id, q] of Object.entries(request.questions)) {
    if (q.type !== "choice") throw new Error("the mapping asks choices only");
    const keys = Object.keys(q.criteria);
    const choice = picks[id] && keys.includes(picks[id]!) ? picks[id]! : keys[0]!;
    const rest = (1 - p) / Math.max(1, keys.length - 1);
    answers[id] = { type: "choice", choice, probabilities: Object.fromEntries(keys.map((k) => [k, k === choice ? p : rest])) };
  }
  return { answers, usage: { input_tokens: 1000, output_tokens: 0 } };
}

describe("the mapping — Jev's kind of question, over the system's own tokens", () => {
  const warm = parseDesign(ACME_WARM);
  const night = parseDesign(ACME_NIGHT);

  it("asks one choice per role over the system's token names, and nothing it can answer itself", () => {
    const c = candidatesOf(warm);
    const req = mappingRequest(warm, c);
    const colours = ["background", "platinum", "surface", "groove", "primary", "secondary", "accent", "on-accent"];
    for (const role of ["ground", "surface", "line", "ink", "ink-muted", "bar", "primary", "on-primary"]) {
      expect(req.questions[role]?.type).toBe("choice");
      expect(Object.keys((req.questions[role] as { criteria: object }).criteria)).toEqual(colours);
    }
    // One family across the type scale: taken directly, not asked.
    expect(req.questions.font).toBeUndefined();
    expect(Object.keys((req.questions.radius as { criteria: object }).criteria)).toEqual(["sm", "md", "pill"]);
    // The state carries each token's name, value and group, and how the components use them.
    const state = req.state as { tokens: Array<{ token: string; value: string; group: string }>; components: string[] };
    expect(state.tokens).toContainEqual({ token: "accent", value: "#d10a72", group: "colors" });
    expect(state.components.join("\n")).toContain("button-primary: backgroundColor {colors.accent}");
    // A system with one radius and two families asks the other way round.
    const n = mappingRequest(night);
    expect(n.questions.radius).toBeUndefined();
    expect(Object.keys((n.questions.font as { criteria: object }).criteria)).toEqual(["body", "mono"]);
  });

  it("takes the answer's argmax, and a single candidate directly", () => {
    const c = candidatesOf(warm);
    const req = mappingRequest(warm, c);
    const roles = applyMapping(req, answering(req, PICKS["Acme Warm"]!), c);
    expect(roles.primary).toEqual({ token: "accent", value: "#d10a72", p: 0.9, why: "asked" });
    expect(roles.ground).toMatchObject({ token: "background", value: "#efece4", why: "asked" });
    expect(roles.radius).toMatchObject({ token: "md", value: "14px" });
    expect(roles.font).toEqual({ token: "headline", value: "Archivo, system-ui, sans-serif", why: "only" });
  });

  it("keeps the default where the answer is under 0.5, and says what it leaned to", () => {
    const c = candidatesOf(warm);
    const req = mappingRequest(warm, c);
    const roles = applyMapping(req, answering(req, PICKS["Acme Warm"]!, 0.42), c);
    expect(roles.primary).toEqual({ value: DEFAULT_THEME.primary, p: 0.42, why: "unsure", leaned: "accent" });
    expect(roles.font?.why).toBe("only");
  });

  it("never lands on a value the system does not hold", async () => {
    const c = candidatesOf(night);
    const req = mappingRequest(night, c);
    // An answer naming a token it was never offered is refused, not applied.
    const forged = answering(req, PICKS["Acme Night"]!);
    (forged.answers.primary as { choice: string }).choice = "hot-pink";
    expect(() => applyMapping(req, forged, c)).toThrow(/does not offer/);
    // The stub's answers are flat: every asked role keeps the default, every value is the system's or the default's.
    for (const seed of [1, 2, 3, 4, 5]) {
      const { response } = await stubAnswerer(seed).answer(req);
      const roles = applyMapping(req, response, c);
      for (const role of ROLES) {
        const choice = roles[role]!;
        const offered = c[role].map((x) => x.value);
        expect([DEFAULT_THEME[role], ...offered], `${role} (seed ${seed})`).toContain(choice.value);
        if (req.questions[role]) expect(choice.why, role).toBe("unsure");
      }
    }
  });

  it("raises on-primary for contrast: under 4.5:1 it becomes the better of the system's ink and ground", () => {
    const roles = guardContrast({
      ground: { token: "background", value: "#08090a", p: 0.9, why: "asked" },
      ink: { token: "primary", value: "#f7f8f8", p: 0.9, why: "asked" },
      primary: { token: "accent", value: "#f2c94c", p: 0.8, why: "asked" },
      "on-primary": { token: "on-accent", value: "#ffffff", p: 0.7, why: "asked" },
    });
    expect(roles["on-primary"]).toEqual({ token: "background", value: "#08090a", p: 0.7, why: "contrast", leaned: "on-accent" });
    // A readable pair is left alone.
    const fine = guardContrast({ primary: { token: "accent", value: "#5e6ad2", why: "asked" }, "on-primary": { token: "on-accent", value: "#ffffff", why: "asked" } });
    expect(fine["on-primary"]?.why).toBe("asked");
  });
});
