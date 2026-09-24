import { describe, expect, it } from "vitest";
import {
  COMPONENTS, FILLERS, PACKS, PACK_IDS, PICTOGRAM_IDS, PACK_FLOOR, RECIPES, applyCopy, assemblePrototype, barsSpec, blueprint, copyOf,
  fleshSpec, hasPictogram, inferLinks, packOf, packRequest, readPackChoice, readWire, refill, renderFrame, renderWire,
  stubAnswerer, validateWire, variations, wireframe, wordsOf, choosePack,
  type JevResponse, type Pack, type WireSpec, type WireStyle,
} from "../src/core.ts";
import { singular } from "../src/content/fill.ts";

/**
 * **Phase 7's proof, the pure half** (design §10): packs hold their shape and
 * no brand; every block draws with content and without; a fleshed spec
 * round-trips; the same seed fills the same words; a restyle, a variation
 * and the prototype keep them; the look is still roles only.
 */

const DELIVERIES = packOf("deliveries");

/** Every string in a pack, templates and all. */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

/**
 * Brands a synthetic pack must never name — whole words, case-insensitive.
 * Ambiguous everyday words (apple, target, delta) are left out on purpose:
 * a recipe may want an apple.
 */
const BRANDS = [
  "amazon", "ups", "fedex", "dhl", "usps", "uber", "lyft", "airbnb", "netflix", "spotify", "google", "microsoft", "iphone", "ipad",
  "nike", "adidas", "starbucks", "ikea", "walmart", "costco", "tesla", "facebook", "instagram", "twitter", "tiktok", "whatsapp",
  "peloton", "fitbit", "strava", "zillow", "etsy", "ebay", "shopify", "stripe", "paypal", "venmo", "visa", "mastercard", "coca-cola",
  "pepsi", "mcdonald's", "mcdonalds", "samsung", "sony", "disney", "linkedin", "indeed", "slack", "zoom", "duolingo", "coursera",
  "toyota", "honda", "bmw", "ford", "marriott", "hilton", "expedia", "tripadvisor", "doordash", "grubhub", "deliveroo", "instacart",
  "zendesk", "jira", "trello", "asana", "notion", "figma", "salesforce", "hubspot", "reddit", "youtube", "pinterest", "snapchat",
  "chewy", "petco", "rover", "yelp", "opentable", "ticketmaster", "eventbrite", "lime", "bird", "northwind",
];

const cases = RECIPES.flatMap((r) => r.sections.flatMap((s) => s.options.map((option) => ({ r, s, option }))));

function fleshed(r: string, pick: (i: number) => number = () => 0, pack: Pack = DELIVERIES, key = "item-acme-1"): { spec: WireSpec; out: WireSpec } {
  const spec = wireframe(r, { request: "Acme couriers", flow: "flow-acme" }, (s) => s.options[Math.min(pick(0), s.options.length - 1)]!);
  return { spec, out: fleshSpec(spec, key, pack, { p: 0.8123, by: "jev-test" }) };
}

describe("content packs", () => {
  it("24 packs, generic among them, each whole: 20+ titles, 4+ metrics, 6+ fields, 4–8 motifs that exist", () => {
    expect(PACKS).toHaveLength(24);
    expect(PACK_IDS).toContain("generic");
    expect(new Set(PACK_IDS).size).toBe(PACKS.length);
    for (const p of PACKS) {
      expect(new Set(p.titles).size, p.id).toBeGreaterThanOrEqual(20);
      expect(p.metrics.length, p.id).toBeGreaterThanOrEqual(4);
      expect(p.fields.length, p.id).toBeGreaterThanOrEqual(6);
      expect(p.details.length, p.id).toBeGreaterThanOrEqual(4);
      expect(p.lines.length, p.id).toBeGreaterThanOrEqual(6);
      expect(p.remarks.length, p.id).toBeGreaterThanOrEqual(6);
      expect(p.statuses.length, p.id).toBeGreaterThanOrEqual(4);
      expect(p.categories.length, p.id).toBeGreaterThanOrEqual(4);
      expect(p.columns, p.id).toHaveLength(8);
      expect(p.motifs.length, p.id).toBeGreaterThanOrEqual(4);
      expect(p.motifs.length, p.id).toBeLessThanOrEqual(8);
      for (const m of p.motifs) expect(hasPictogram(m), `${p.id}: ${m}`).toBe(true);
    }
  });

  it("holds no real brand — every string of every pack against the denylist", () => {
    const words = new RegExp(`(?<![\\w-])(?:${BRANDS.map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![\\w-])`, "i");
    for (const p of PACKS) for (const s of strings(p)) expect(s, `${p.id}: "${s}"`).not.toMatch(words);
  });

  it("holds no markup, and every template token is one the filler knows", () => {
    for (const p of PACKS) {
      for (const s of strings(p)) {
        expect(s, p.id).not.toMatch(/[<>]/);
        for (const [, token] of s.matchAll(/\{([^}]+)\}/g)) expect(token, `${p.id}: ${s}`).toMatch(/^(#\d+-\d+|[A-Z]-[A-Z]|name|first|lower|time|day|date|ago)$/);
      }
    }
  });

  it("pictograms: about forty, each in currentColor with no colour of its own", () => {
    expect(PICTOGRAM_IDS.length).toBeGreaterThanOrEqual(36);
    expect(PICTOGRAM_IDS.length).toBeLessThanOrEqual(46);
  });

  it("a drawn 1 takes the singular", () => {
    expect(singular("1 items · 3 kg")).toBe("1 item · 3 kg");
    expect(singular("1 replies")).toBe("1 reply");
    expect(singular("11 items, 21 items")).toBe("11 items, 21 items");
    expect(singular("Stop 1 of 24")).toBe("Stop 1 of 24");
  });
});

describe("filling", () => {
  it("every component that draws a bar has a filler — and fleshed, draws fewer bars and its own words", () => {
    const seen = new Set<string>();
    for (const { r, s, option } of cases) {
      if (seen.has(option)) continue;
      seen.add(option);
      const spec = wireframe(r.id, { request: "Acme couriers", flow: "flow-acme" }, (section) => (section.slot === s.slot ? option : null));
      const bars = renderFrame(spec);
      const slotHtml = (html: string) => new RegExp(`<section class="slot w" data-slot="${s.slot.replace(".", "\\.")}"[\\s\\S]*?</section>`).exec(html)![0];
      const before = (slotHtml(bars).match(/class="bar/g) ?? []).length;
      // Nothing but intents and a title under its defaults (a button, a tab bar, an action sheet): nothing to fill.
      if (before === 0) continue;
      expect(FILLERS[option], `${option} draws ${before} bars and has no filler`).toBeDefined();
      const out = fleshSpec(spec, "item-acme-1", DELIVERIES);
      const html = slotHtml(renderFrame(out));
      const after = (html.match(/class="bar/g) ?? []).length;
      expect(after, `${option}: ${after} bars fleshed, ${before} before`).toBeLessThan(before);
      const words = Object.values(wordsOf(out.slots.find((x) => x.slot === s.slot)!.fill));
      const drawn = words.filter((w) => html.includes(w.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;")));
      expect(drawn.length, `${option} draws none of its words`).toBeGreaterThan(0);
    }
    // And the table covers only components that exist.
    for (const id of Object.keys(FILLERS)) expect(COMPONENTS.has(id), id).toBe(true);
  });

  it("every block draws, with content and without, under every recipe option of every pack", () => {
    for (const pack of PACKS) {
      for (const r of RECIPES) {
        for (const pick of [0, 1, 2, 3]) {
          const spec = wireframe(r.id, { request: "x", flow: "f", platform: r.platforms[pick % r.platforms.length]! }, (s) => s.options[Math.min(pick, s.options.length - 1)]!);
          expect(() => renderWire(spec)).not.toThrow();
          const out = fleshSpec(spec, `item-${pick}`, pack);
          expect(validateWire(out), `${pack.id} ${r.id} ${pick}`).toEqual([]);
          expect(() => renderWire(out)).not.toThrow();
        }
      }
    }
  });

  it("every prop value of every component draws fleshed — and the bars it drew become words wherever the fill has them", () => {
    const homes = new Map<string, { archetype: string; slot: string }>();
    for (const r of RECIPES) for (const s of r.sections) for (const o of s.options) if (!homes.has(o)) homes.set(o, { archetype: r.id, slot: s.slot });
    for (const [id, home] of homes) {
      for (const [key, def] of Object.entries(COMPONENTS.get(id)!.props)) {
        const values = def.kind === "choice" ? [...def.values] : def.kind === "flag" ? [true, false] : def.kind === "count" ? [def.min, def.max] : [1, def.max];
        for (const value of values) {
          const spec = wireframe(home.archetype, { flow: "f" });
          const slot = spec.slots.find((x) => x.slot === home.slot);
          if (!slot) continue;
          slot.block = id;
          slot.props = { [key]: value };
          delete slot.intents;
          const out = fleshSpec(spec, "k", DELIVERIES);
          expect(validateWire(out), `${id}.${key}=${String(value)}`).toEqual([]);
          expect(() => renderWire(out), `${id}.${key}=${String(value)}`).not.toThrow();
        }
      }
    }
  });

  it("a fleshed spec round-trips through its file, and re-renders to the same bytes", () => {
    const { out } = fleshed("list");
    const html = renderWire(out);
    const back = readWire(html)!;
    expect(back).toStrictEqual(out);
    expect(renderWire(back)).toBe(html);
    expect(out.content).toEqual({ source: "pack", pack: "deliveries", p: 0.812, by: "jev-test", title: "Deliveries" });
    expect(html).toContain(">Deliveries<");
  });

  it("the same seed gives the same content; another screen or slot another pick of the same flow's things", () => {
    const a = fleshed("list").out;
    expect(fleshed("list").out).toStrictEqual(a);
    const b = fleshed("list", () => 0, DELIVERIES, "item-acme-2").out;
    expect(JSON.stringify(b.slots)).not.toBe(JSON.stringify(a.slots));
    // Entities belong to the flow: the detail's heading is the first row of the list's lead slot.
    const detail = fleshed("detail").out;
    const rows = a.slots.find((s) => s.block === "stacked-list")!.fill!.items!;
    expect(rows[0]!.title).toBe(detail.content!.title);
    // Another flow is another set of the same kinds of things.
    const other = fleshSpec(wireframe("list", { request: "x", flow: "flow-other" }), "item-acme-1", DELIVERIES);
    expect(JSON.stringify(other.slots)).not.toBe(JSON.stringify(a.slots));
  });

  it("a blueprint takes no content; an undecided slot keeps none; bars take it all off", () => {
    const blue = blueprint("list", { flow: "f" });
    expect(fleshSpec(blue, "k", DELIVERIES)).toStrictEqual(blue);
    const half = wireframe("list", { flow: "f" }, (s, i) => (i % 2 === 0 ? s.options[0]! : null));
    const out = fleshSpec(half, "k", DELIVERIES);
    for (const s of out.slots) if (s.block === null) expect(s.fill).toBeUndefined();
    expect(validateWire(out)).toEqual([]);
    const bars = barsSpec(fleshed("home").out);
    expect(bars).toStrictEqual(fleshed("home").spec);
  });

  it("a fill that is not plain words is refused, and words are escaped when drawn", () => {
    const { out } = fleshed("list");
    const bad = structuredClone(out);
    bad.slots.find((s) => s.fill)!.fill = { items: [{ title: 42 as never }] };
    expect(validateWire(bad).join("\n")).toMatch(/needs a title/);
    const sly = structuredClone(out);
    sly.slots.find((s) => s.block === "stacked-list")!.fill!.items![0]!.title = "<script>alert(1)</script>";
    expect(renderWire(sly)).not.toContain("<script>alert(1)");
    expect(renderWire(sly)).toContain("&lt;script&gt;");
  });

  it("the fleshed look is roles only: no literal colour in the sheet or in any fleshed slot's markup", () => {
    const LITERAL = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(|(?<![-\w])(?:white|black|gr[ae]y|silver|red|blue|green)(?![-\w])/i;
    for (const r of RECIPES) {
      for (const pick of [0, 1, 2]) {
        const { out } = fleshed(r.id, () => pick);
        const html = renderWire(out);
        const body = html.slice(html.indexOf("<body"));
        expect(body, `${r.id} ${pick}`).not.toMatch(LITERAL);
      }
    }
  });
});

describe("content survives", () => {
  const WARM: WireStyle = { source: "design-system", itemId: "ds", versionId: "v1", roles: { primary: { token: "accent", value: "#d10a72", p: 0.9, why: "asked" } } };

  it("a restyle: same fill, new roles", () => {
    const { out } = fleshed("home");
    const styled = { ...out, style: WARM };
    const html = renderWire(styled);
    expect(readWire(html)!.slots).toStrictEqual(out.slots);
    expect(html).toContain("--w-primary:#d10a72");
    expect(html).toContain(">Today&#39;s route<");
  });

  it("a variation: the same pack and seed, the flipped slot filled anew", () => {
    const spec = wireframe("list", { request: "Acme couriers", flow: "flow-acme" });
    const main = spec.slots.find((s) => s.slot === "main.3")!;
    main.p = 0.55;
    main.alternatives = [{ block: "data-table", p: 0.3 }];
    const out = fleshSpec(spec, "item-screen", DELIVERIES, { p: 0.7, by: "jev" });
    const [v] = variations(out, "item-screen", 1);
    expect(v!.content).toEqual(out.content);
    const flipped = v!.slots.find((s) => s.slot === "main.3")!;
    expect(flipped.block).toBe("data-table");
    expect(flipped.fill!.items![0]!.cells![0]).toBe(out.slots.find((s) => s.slot === "main.3")!.fill!.items![0]!.title);
    for (const s of v!.slots.filter((x) => x.slot !== "main.3")) expect(s.fill).toStrictEqual(out.slots.find((x) => x.slot === s.slot)!.fill);
    // And fleshing the variation again changes nothing: its seed is its screen's.
    expect(fleshSpec(v!, v!.variantOf!, DELIVERIES, { p: 0.7, by: "jev" })).toStrictEqual(v);
    expect(refill(barsSpec(v!), "x", ["main.3"])).toStrictEqual(barsSpec(v!));
  });

  it("the prototype: every kept screen plays its content", () => {
    const list = fleshed("list").out;
    const detail = fleshed("detail").out;
    const kept = [{ id: "a", title: "List", spec: list }, { id: "b", title: "Detail", spec: detail }];
    const html = assemblePrototype(kept, inferLinks(kept));
    expect(html).toContain(">Deliveries<");
    expect(html).toContain(`>${detail.content!.title!.replace(/&/g, "&amp;")}<`);
  });
});

describe("exact copy", () => {
  it("prints words by path and writes them back as copy — never a new shape", () => {
    const { out } = fleshed("list");
    const printed = copyOf(out);
    const list = printed.slots.find((s) => s.block === "stacked-list")!;
    expect(list.words["items.0.title"]).toBeDefined();
    const next = applyCopy(out, { title: "Your parcels", slots: { [list.slot]: { "items.0.title": "Parcel 4471" } } }, "agent-acme");
    expect(next.content).toEqual({ source: "copy", by: "agent-acme", pack: "deliveries", title: "Your parcels" });
    expect(renderWire(next)).toContain("Parcel 4471");
    expect(validateWire(next)).toEqual([]);
    expect(() => applyCopy(out, { slots: { [list.slot]: { "items.99.title": "x" } } }, "a")).toThrow(/no word at "items.99.title"/);
    expect(() => applyCopy(out, { slots: { nope: {} } }, "a")).toThrow(/no slot "nope"/);
    expect(() => applyCopy(fleshed("list").spec, { slots: {} }, "a")).toThrow(/draws bars/);
    // In print order, as a list.
    const inOrder = applyCopy(out, { slots: { [list.slot]: ["First words"] } }, "a");
    expect(Object.values(wordsOf(inOrder.slots.find((s) => s.slot === list.slot)!.fill))[0]).toBe("First words");
  });
});

describe("choosing the pack", () => {
  it("one choice question over every pack id, with the request as its state", () => {
    const req = packRequest("a courier app");
    expect(req.state).toEqual({ request: "a courier app" });
    expect(Object.keys(req.questions)).toEqual(["pack"]);
    const q = req.questions.pack!;
    expect(q.type).toBe("choice");
    expect(Object.keys((q as { criteria: Record<string, string> }).criteria)).toEqual([...PACK_IDS]);
  });

  it("argmax with p recorded; under the floor the generic pack fills and the lean is kept", () => {
    const req = packRequest("x");
    const answer = (choice: string, p: number): JevResponse => ({
      answers: { pack: { type: "choice", choice, probabilities: Object.fromEntries(PACK_IDS.map((id) => [id, id === choice ? p : (1 - p) / (PACK_IDS.length - 1)])) } },
      usage: { input_tokens: 900, output_tokens: 0 },
    });
    expect(readPackChoice(req, answer("deliveries", 0.8), "jev")).toMatchObject({ pack: "deliveries", leaned: "deliveries", p: 0.8, how: "asked", inputTokens: 900 });
    expect(readPackChoice(req, answer("pets", PACK_FLOOR - 0.01), "jev")).toMatchObject({ pack: "generic", leaned: "pets" });
  });

  it("the stub's flat answer is always under the floor — generic, said so", async () => {
    const c = await choosePack(stubAnswerer(3), "a courier app");
    expect(c.pack).toBe("generic");
    expect(c.p).toBeCloseTo(1 / PACKS.length);
  });
});
