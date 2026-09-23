import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  COMPONENTS, LINK_BACK, LINK_NONE, RECIPES, ROW_BLOCKS, applyPropsRound, applyStructure, assemblePrototype, decideFlow, flowRequest,
  flowScreen, hotspots, inferLinks, propsRequests, readOverrides, readResponse, renderFrame, renderWire, resolveSlot, screenEdges,
  startScreen, structureRequest, wireframe,
  type JevResponse, type PropDef, type Props, type WireLink, type WireScreen, type WireSpec,
} from "../src/core.ts";

/**
 * **Phase 3's rule tests** (`docs/projects/wireframes/phases.md`): each of the
 * five rules of design §7, their priority, a person's override (a screen,
 * and `none`), a missing target named, hotspot keys stable across renders,
 * and the assembler binding every hotspot that navigates. The flow is the
 * journey's, synthetic: Acme's courier app — sign in, home, a list of
 * deliveries, one delivery.
 */

const o = { request: "Acme couriers", flow: "flw_acme" };
const screen = (id: string, spec: WireSpec, title = spec.title): WireScreen => ({ id, title, spec });

/** The journey's four kept screens, each at its recipe's first options (home and list both draw a tab bar). */
function acme(): { signIn: WireScreen; home: WireScreen; list: WireScreen; detail: WireScreen; all: WireScreen[] } {
  const signIn = screen("it_signin", wireframe("sign-in", o));
  const home = screen("it_home", wireframe("home", o));
  const list = screen("it_list", wireframe("list", o), "Deliveries");
  const detail = screen("it_detail", wireframe("detail", o), "Delivery");
  return { signIn, home, list, detail, all: [signIn, home, list, detail] };
}

const linkOf = (links: WireLink[], from: string, key: string) => links.find((l) => l.from === from && l.key === key);

describe("the hotspots a spec draws", () => {
  it("names each present element, each row block's rows, and an app bar's chevron", () => {
    const { list } = acme();
    const keys = hotspots(list.spec).map((h) => h.key);
    expect(keys).toContain("header#leading");
    expect(keys).toContain("header#action-1");
    expect(keys).toContain("nav#tab-1");
    expect(keys).toContain("main.3#row");
  });

  it("stamps every hotspot as data-hot, and nothing else — over every component at every prop that adds or removes an element", () => {
    const misses: string[] = [];
    for (const r of RECIPES) {
      for (const section of r.sections) {
        for (const block of section.options) {
          for (const props of propSets(COMPONENTS.get(block)!.props)) {
            const base = wireframe(r.id, { ...o, platform: r.platforms[0]! });
            const slot = resolveSlot(r.id, section.slot, block, props);
            const spec: WireSpec = { ...base, slots: base.slots.some((s) => s.slot === section.slot) ? base.slots.map((s) => (s.slot === section.slot ? slot : s)) : base.slots };
            if (!spec.slots.some((s) => s.slot === section.slot)) continue;
            const want = new Set(hotspots(spec).map((h) => h.key));
            const drawn = new Set([...renderFrame(spec).matchAll(/ data-hot="([^"]+)"/g)].map((m) => m[1]!));
            for (const k of want) if (!drawn.has(k)) misses.push(`${r.id}/${block} ${JSON.stringify(props)}: ${k} not drawn`);
            for (const k of drawn) if (!want.has(k)) misses.push(`${r.id}/${block} ${JSON.stringify(props)}: ${k} drawn but not a hotspot`);
          }
        }
      }
    }
    expect(misses.slice(0, 10)).toEqual([]);
  });

  it("keeps its keys across re-renders, and across a change elsewhere on the screen", () => {
    const { detail } = acme();
    const keysOf = (html: string) => [...html.matchAll(/ data-hot="([^"]+)"/g)].map((m) => m[1]!);
    const once = keysOf(renderWire(detail.spec));
    expect(keysOf(renderWire(detail.spec))).toEqual(once);
    // Another block in another slot: the header's keys do not move.
    const changed: WireSpec = { ...detail.spec, slots: detail.spec.slots.map((s) => (s.slot === "main.2" ? resolveSlot("detail", "main.2", "long-form") : s)) };
    const header = (keys: string[]) => keys.filter((k) => k.startsWith("header#"));
    expect(header(keysOf(renderWire(changed)))).toEqual(header(once));
    expect(header(once).length).toBeGreaterThan(0);
  });
});

describe("rule 1 — an intent with a target", () => {
  it("sign in goes to the first post-auth screen, dissolving", () => {
    const { all } = acme();
    const l = linkOf(inferLinks(all), "it_signin", "main.3#submit")!;
    expect(l).toMatchObject({ to: "it_home", rule: "intent", transition: "dissolve", label: "Sign in" });
  });

  it("a jump intent goes to the first kept screen of its archetype", () => {
    const { signIn, home, list, detail } = acme();
    const settings = screen("it_settings", wireframe("settings", o));
    const profile = screen("it_profile", wireframe("profile", o));
    const links = inferLinks([signIn, home, list, detail, settings, profile]);
    // Profile's app bar says settings; the home tab bar's fourth tab says profile.
    const prof = { ...profile, spec: { ...profile.spec, slots: profile.spec.slots.map((s) => (s.slot === "header" ? resolveSlot("profile", "header", "app-bar", { actions: 1 }) : s)) } };
    expect(linkOf(inferLinks([home, prof, settings]), "it_profile", "header#action-1")).toMatchObject({ to: "it_settings", rule: "intent", transition: "push" });
    expect(linkOf(links, "it_home", "nav#tab-4")).toMatchObject({ to: "it_profile", rule: "intent", transition: "none" });
  });

  it("next goes to the next kept screen in reading order", () => {
    const form = screen("it_form", wireframe("form", o));
    const done = screen("it_done", wireframe("state", o));
    const links = inferLinks([form, done]);
    expect(linkOf(links, "it_form", "main#submit")).toMatchObject({ to: "it_done", rule: "intent", transition: "push" });
  });
});

describe("rule 2 — back", () => {
  it("an app bar's chevron and a back intent go to history, popping", () => {
    const { all } = acme();
    const links = inferLinks(all);
    expect(linkOf(links, "it_detail", "header#leading")).toMatchObject({ to: LINK_BACK, rule: "back", transition: "pop", label: "Back" });
  });

  it("on a confirm overlay, confirming and cancelling both return to the screen under it", () => {
    const confirm = screen("it_confirm", wireframe("confirm", o));
    const links = inferLinks([acme().detail, confirm]);
    expect(linkOf(links, "it_confirm", "overlay#confirm")).toMatchObject({ to: LINK_BACK, transition: "overlay" });
    expect(linkOf(links, "it_confirm", "overlay#cancel")).toMatchObject({ to: LINK_BACK, rule: "back" });
  });
});

describe("rule 3 — a row opens the detail", () => {
  it("goes to the first kept detail after it", () => {
    const { all } = acme();
    expect(linkOf(inferLinks(all), "it_list", "main.3#row")).toMatchObject({ to: "it_detail", rule: "row", transition: "push", label: "Row" });
  });

  it("prefers a detail after the list to one before it, and takes one before when none is after", () => {
    const { list, detail } = acme();
    const other = screen("it_detail0", wireframe("detail", o));
    expect(linkOf(inferLinks([other, list, detail]), "it_list", "main.3#row")!.to).toBe("it_detail");
    expect(linkOf(inferLinks([other, list]), "it_list", "main.3#row")!.to).toBe("it_detail0");
  });

  it("a row block's rows are one hotspot, however many rows it draws", () => {
    const home = wireframe("home", o);
    for (const block of ROW_BLOCKS.filter((b) => b !== "product-card-list")) {
      const spec: WireSpec = { ...home, slots: home.slots.map((s) => (s.slot === "main.3" ? resolveSlot("home", "main.3", block) : s)) };
      expect(hotspots(spec).filter((h) => h.kind === "row").map((h) => h.key), block).toEqual(["main.3#row"]);
      expect(renderFrame(spec).split(' data-hot="main.3#row"').length - 1, block).toBeGreaterThan(1);
    }
  });
});

describe("rule 4 — tab i goes to the i-th top-level screen", () => {
  it("a tab whose intent finds nothing takes a top-level screen no other tab reaches", () => {
    const { all } = acme();
    const links = inferLinks(all);
    // Home's tab bar: home, search, notifications, profile. Home and Deliveries are top-level (they draw it).
    expect(linkOf(links, "it_home", "nav#tab-1")).toMatchObject({ to: "it_home", rule: "intent", transition: "none" });
    expect(linkOf(links, "it_home", "nav#tab-2")).toMatchObject({ to: "it_list", rule: "tab", transition: "none" });
    expect(linkOf(links, "it_list", "nav#tab-2")).toMatchObject({ to: "it_list", rule: "tab" });
  });

  it("rule 1 outranks position: a tab that names a kept screen goes there, and the rest share out what is left", () => {
    const { signIn, home, list, detail } = acme();
    const swapped = { ...home, spec: { ...home.spec, slots: home.spec.slots.map((s) => (s.slot === "nav" ? { ...s, intents: { ...s.intents!, "tab-1": "search" as const, "tab-2": "home" as const } } : s)) } };
    const links = inferLinks([signIn, swapped, list, detail]);
    expect(linkOf(links, "it_home", "nav#tab-2")).toMatchObject({ to: "it_home", rule: "intent" });
    expect(linkOf(links, "it_home", "nav#tab-1")).toMatchObject({ to: "it_list", rule: "tab" });
  });
});

describe("rule 5 — a missing target is dashed and named", () => {
  it("names the archetype a tab needs once the top-level screens run out", () => {
    const { all } = acme();
    const links = inferLinks(all);
    expect(linkOf(links, "it_home", "nav#tab-3")).toMatchObject({ to: null, needs: "Notifications", rule: "missing" });
    expect(linkOf(links, "it_home", "nav#tab-4")).toMatchObject({ to: null, needs: "Profile", rule: "missing" });
  });

  it("names what an action needs — an archetype, an overlay, or a next screen", () => {
    const { all } = acme();
    const links = inferLinks(all);
    expect(linkOf(links, "it_detail", "header#action-1")).toMatchObject({ to: null, needs: "Sheet", rule: "missing" }); // share
    expect(linkOf(links, "it_home", "header#action-1")).toMatchObject({ to: null, needs: "Notifications" });
    const form = screen("it_form", wireframe("form", o));
    expect(linkOf(inferLinks([form]), "it_form", "main#submit")).toMatchObject({ to: null, needs: "a next screen" });
    expect(linkOf(inferLinks([acme().list]), "it_list", "main.3#row")).toMatchObject({ to: null, needs: "Detail" });
  });

  it("an in-place intent is no link at all", () => {
    const withRemember: WireSpec = { ...acme().signIn.spec, slots: acme().signIn.spec.slots.map((s) => (s.slot === "main.3" ? resolveSlot("sign-in", "main.3", "sign-in-form", { remember: true }) : s)) };
    const s = screen("it_signin", withRemember);
    expect(hotspots(withRemember).map((h) => h.key)).toContain("main.3#remember");
    expect(linkOf(inferLinks([s, acme().home]), "it_signin", "main.3#remember")).toBeUndefined();
  });
});

describe("a person's override", () => {
  it("sends one hotspot to a named kept screen, ahead of every rule", () => {
    const { signIn, home, list, detail } = acme();
    const settings = screen("it_settings", wireframe("settings", o));
    const overridden = { ...list, overrides: { "main.3#row": "it_settings" } };
    const links = inferLinks([signIn, home, overridden, detail, settings]);
    expect(linkOf(links, "it_list", "main.3#row")).toMatchObject({ to: "it_settings", rule: "override" });
    // The others on that screen still follow the rules.
    expect(linkOf(links, "it_list", "header#leading")).toMatchObject({ rule: "back" });
  });

  it("--none switches a hotspot off: no link, unless asked to show it", () => {
    const { signIn, home, list, detail } = acme();
    const off = { ...list, overrides: { "main.3#row": LINK_NONE } };
    expect(linkOf(inferLinks([signIn, home, off, detail]), "it_list", "main.3#row")).toBeUndefined();
    expect(linkOf(inferLinks([signIn, home, off, detail], { withNone: true }), "it_list", "main.3#row")).toMatchObject({ to: null, rule: "override" });
  });

  it("an override to a screen that is not kept is a missing link that says so", () => {
    const { all } = acme();
    const links = inferLinks([{ ...all[2]!, overrides: { "main.3#row": "it_gone" } }]);
    expect(linkOf(links, "it_list", "main.3#row")).toMatchObject({ to: null, rule: "override" });
    expect(linkOf(links, "it_list", "main.3#row")!.needs).toContain("it_gone");
  });

  it("reads the property as JSON and ignores what it cannot read", () => {
    expect(readOverrides('{"main.3#row":"it_x","nav#tab-2":"none"}')).toEqual({ "main.3#row": "it_x", "nav#tab-2": "none" });
    expect(readOverrides("not json")).toEqual({});
    expect(readOverrides(undefined)).toEqual({});
  });
});

describe("the prototype", () => {
  it("holds every kept screen and binds every hotspot that navigates", () => {
    const { all } = acme();
    const links = inferLinks(all);
    const html = assemblePrototype(all, links, { title: "Acme couriers" });
    for (const s of all) expect(html).toContain(`data-screen="${s.id}"`);
    for (const l of links) {
      const attr = l.to ? `data-hot="${l.key}" data-go="${l.to}" data-t="${l.transition}"` : `data-hot="${l.key}" data-needs="${l.needs}"`;
      const inScreen = html.split(`data-screen="${l.from}"`)[1]!.split("</section>\n")[0]!;
      expect(inScreen, `${l.from} ${l.key}`).toContain(attr);
    }
    // Self-contained: nothing fetched.
    expect(html).not.toMatch(/<link\b|<script\b[^>]*\bsrc=|@import|url\(\s*["']?https?:|fetch\(/i);
    expect(JSON.parse(/id="isocan-prototype">([\s\S]*?)<\/script>/.exec(html)![1]!).start).toBe("it_signin");
  });

  it("starts on the first kept sign-in, else the first kept screen", () => {
    const { home, list, signIn } = acme();
    expect(startScreen([home, list, signIn])).toBe("it_signin");
    expect(startScreen([list, home])).toBe("it_list");
  });

  it("refuses to assemble nothing", () => {
    expect(() => assemblePrototype([], [])).toThrow(/nothing is kept/);
  });

  it("draws the edges between two kept screens once per pair, never back or to itself", () => {
    const { all } = acme();
    const edges = screenEdges(inferLinks(all));
    expect(edges).toContainEqual({ from: "it_signin", to: "it_home" });
    expect(edges).toContainEqual({ from: "it_list", to: "it_detail" });
    expect(edges.filter((e) => e.from === e.to)).toEqual([]);
    expect(new Set(edges.map((e) => `${e.from}>${e.to}`)).size).toBe(edges.length);
  });
});

describe("on a real Jev flow (the phase-2 fixture, replayed)", () => {
  interface Fixture { request: string; round1: JevResponse; round2: JevResponse[]; round3: JevResponse[] }
  const fixture = JSON.parse(readFileSync(fileURLToPath(new URL("./fixtures/jev-acme-couriers.json", import.meta.url)), "utf8")) as Fixture;
  const req1 = flowRequest(fixture.request);
  const decision = decideFlow(req1, readResponse(req1, fixture.round1));
  let specs = decision.archetypes.map((a) => flowScreen(a.id, fixture.request, "flw_acme", decision));
  const titles = specs.map((s) => s.title);
  specs = specs.map((spec, i) => {
    const req = structureRequest(spec, titles);
    return applyStructure(spec, req, readResponse(req, fixture.round2[i]!));
  });
  const reqs = propsRequests(specs);
  specs = applyPropsRound(specs, reqs, reqs.map((req, i) => readResponse(req, fixture.round3[i]!)));
  const kept = specs.map((spec, i) => screen(`it_${i}_${spec.archetype}`, spec));

  it("gives every hotspot a destination or a name for what it needs, and binds each one", () => {
    const links = inferLinks(kept);
    expect(links.length).toBeGreaterThan(0);
    for (const l of links) expect(l.to !== null || Boolean(l.needs), `${l.from} ${l.key}`).toBe(true);
    const html = assemblePrototype(kept, links);
    for (const l of links) expect(html).toContain(`data-hot="${l.key}" ${l.to ? `data-go="${l.to}"` : `data-needs="${l.needs}"`}`);
  });
});

/** Prop sets that between them draw every element: defaults, everything on and at its most, and each choice value in turn. */
function propSets(defs: Record<string, PropDef>): Props[] {
  const most: Props = {};
  for (const [k, d] of Object.entries(defs)) most[k] = d.kind === "count" ? d.max : d.kind === "flag" ? true : d.kind === "index" ? 1 : d.default;
  const sets: Props[] = [{}, most];
  for (const [k, d] of Object.entries(defs)) if (d.kind === "choice") for (const v of d.values) sets.push({ ...most, [k]: v });
  for (const [k, d] of Object.entries(defs)) if (d.kind === "flag") sets.push({ ...most, [k]: false });
  return sets;
}
