import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  applyOperation, checkDesign, contrastRatio, designSurface, invertOperation, parseDesign,
  type CanvasState, type Item, type Operation,
} from "@isocan/core";
import {
  DEFAULT_THEME, HOUSE, NAMED_TOKENS, OWN_PRESETS, PACK_PRESETS, PRESET_NAMES, ROLES, StyleResolver, WIRE_SURFACES,
  applyMapping, applyPreset, blueprint, candidatesOf, composeFlow, mappingRequest, namedRoles, presetFile, renderWire, stubAnswerer,
  styleProblems, surfaceOf, wireframe, wiresOn, type WirePort, type WireSpec,
} from "../src/core.ts";
import { __SURFACE_CSS, __WIRE_CSS } from "../src/render.ts";
import { assemblePrototype } from "../src/prototype.ts";
import { PRESET_URLS } from "../src/preset-urls.ts";
import { styleMenu } from "../src/style-menu.ts";
import { presetText } from "../src/style-cli.ts";

/**
 * **The wire styles** (24 Sep 2026): named looks — Material, shadcn, glass,
 * iOS, Fluent, Carbon, brutalist — each a DESIGN.md the module ships, the
 * `surface:` token they draw with, and the one act that places a style
 * beside a flow, makes it the flow's system and restyles it (`presets.ts`).
 * Synthetic throughout: Acme's couriers.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const own = (id: string) => readFileSync(path.join(here, "..", presetFile(OWN_PRESETS.find((p) => p.id === id)!)), "utf8");

describe("each wire style is a DESIGN.md that holds up", () => {
  for (const preset of OWN_PRESETS) {
    const doc = parseDesign(own(preset.id));
    const colors = doc.tokens.colors!;

    it(`${preset.id}: parses, and \`design check\` finds nothing at all`, () => {
      expect(doc.problems).toEqual([]);
      expect(checkDesign(doc)).toEqual([]);
      expect(doc.tokens.name).toMatch(/— a wire style$/);
      // An homage says so; nothing is downloaded — the file names no font file, no URL, no @font-face.
      expect(own(preset.id)).not.toMatch(/url\(|@font-face|https?:\/\/[^\s)]*\.(woff2?|ttf|otf)/i);
    });

    it(`${preset.id}: names every role, so nothing is asked`, () => {
      expect(Object.keys(namedRoles(doc)).sort()).toEqual([...ROLES].sort());
      const candidates = candidatesOf(doc);
      const request = mappingRequest(doc, candidates);
      expect(request.questions).toEqual({});
      const roles = applyMapping(request, { answers: {} }, candidates);
      for (const role of ROLES) expect(roles[role], role).toMatchObject({ why: "named", token: NAMED_TOKENS[role].token });
      expect(styleProblems({ source: "design-system", itemId: "i", versionId: "v", roles })).toEqual([]);
    });

    it(`${preset.id}: every word it draws clears AA (4.5:1)`, () => {
      const c = (role: string) => colors[role]!.slice(0, 7);
      for (const [fg, bg] of [["ink", "ground"], ["ink", "surface"], ["ink-muted", "ground"], ["ink-muted", "surface"], ["on-primary", "primary"], ["primary", "ground"]] as const) {
        expect(contrastRatio(c(fg), c(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  it("the glass ground's deepest stop still carries every word", () => {
    const c = parseDesign(own("glass")).tokens.colors!;
    // The gradient's darkest corner is the primary at 45% over the ground (render.ts, SURFACE_CSS.glass).
    const mix = (a: string, b: string, t: number) => `#${[1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * t + parseInt(b.slice(i, i + 2), 16) * (1 - t)).toString(16).padStart(2, "0")).join("")}`;
    const deepest = mix(c.primary!, c.ground!, 0.45);
    expect(__SURFACE_CSS.glass).toContain("color-mix(in srgb,var(--w-primary) 45%,var(--w-ground))");
    expect(contrastRatio(c.ink!, deepest)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(c["ink-muted"]!, deepest)).toBeGreaterThanOrEqual(4.5);
  });

  it("each names the surface it is drawn on", () => {
    const surfaces = Object.fromEntries(OWN_PRESETS.map((p) => [p.id, designSurface(parseDesign(own(p.id)).tokens)]));
    expect(surfaces).toEqual({ material: "raised", shadcn: "flat", glass: "glass", ios: "flat", fluent: "raised", carbon: "flat", brutalist: "bold" });
  });

  it("the packs are the design competition's, every one — and both surfaces can reach every style", () => {
    const packs = path.join(here, "../../design-competition/assets/packs");
    expect(PACK_PRESETS.map((p) => p.id)).toEqual(readdirSync(packs).filter((d) => existsSync(path.join(packs, d, "DESIGN.md"))).sort());
    expect(PRESET_NAMES).toEqual([HOUSE, ...OWN_PRESETS.map((p) => p.id), ...PACK_PRESETS.map((p) => p.id)]);
    // The web fetches each by a literal URL; the terminal reads each file.
    expect(Object.keys(PRESET_URLS).sort()).toEqual(PRESET_NAMES.filter((n) => n !== HOUSE).sort());
    for (const p of [...OWN_PRESETS, ...PACK_PRESETS]) {
      expect(existsSync(fileURLToPath(PRESET_URLS[p.id]!())), p.id).toBe(true);
      expect(presetText(p).startsWith("---"), p.id).toBe(true);
    }
    // A pack is not written for wires, so it is asked — Linear's `primary` is its text colour.
    expect(namedRoles(parseDesign(presetText(PACK_PRESETS.find((p) => p.id === "linear")!)))).toEqual({});
  });
});

describe("the surface token", () => {
  const doc = (surface?: string) => parseDesign(`---\nname: Acme\n${surface === undefined ? "" : `surface: ${surface}\n`}colors:\n  primary: "#222222"\n  background: "#ffffff"\n---\n\n## Overview\n\nA.\n\n## Colors\n\nB.\n\n## Typography\n\nC.\n`);

  it("parses, and a file without it still parses — as flat", () => {
    expect(designSurface(doc("glass").tokens)).toBe("glass");
    expect(designSurface(doc("Raised").tokens)).toBe("raised");
    expect(doc().problems).toEqual([]);
    expect(designSurface(doc().tokens)).toBe("flat");
    expect(checkDesign(doc())).toEqual([]);
  });

  it("a value nobody draws is read as flat, and `design check` says so", () => {
    expect(designSurface(doc("neon").tokens)).toBe("flat");
    expect(checkDesign(doc("neon"))).toEqual([expect.objectContaining({ severity: "warning", where: "surface" })]);
  });

  it("rides the spec's style, and a style with an unknown one is refused", () => {
    expect(surfaceOf(undefined)).toBe("flat");
    expect(surfaceOf({ source: "design-system", itemId: "i", versionId: "v", roles: {}, surface: "glass" })).toBe("glass");
    expect(styleProblems({ source: "design-system", itemId: "i", versionId: "v", roles: {}, surface: "neon" })).toEqual([expect.stringContaining("style.surface")]);
  });
});

describe("the renderer draws each surface", () => {
  const styled = (surface?: "raised" | "glass" | "bold"): WireSpec => ({
    ...wireframe("list", { platform: "app" }),
    style: { source: "design-system", itemId: "i", versionId: "v", roles: {}, ...(surface ? { surface } : {}) },
  });
  const sheet = (html: string) => /<style>([\s\S]*?)<\/style>/.exec(html)![1]!;

  it("raised: elevation shadows on cards, bars and sheets", () => {
    const html = renderWire(styled("raised"));
    expect(html).toContain('class="frame app s-raised"');
    expect(sheet(html)).toMatch(/\.s-raised :is\(\.card,[^{]*\{[^}]*box-shadow:0 1px 2px/);
    expect(sheet(html)).toMatch(/\.s-raised :is\(\.appbar[^{]*\{[^}]*box-shadow/);
    expect(sheet(html)).toMatch(/\.s-raised :is\(\.sheet,\.dialog[^{]*\{[^}]*box-shadow/);
  });

  it("glass: a gradient ground and backdrop-blurred translucent panes", () => {
    const html = renderWire(styled("glass"));
    expect(html).toContain('class="frame app s-glass"');
    expect(sheet(html)).toMatch(/\.frame\.s-glass\{background:radial-gradient\(/);
    expect(sheet(html)).toMatch(/\.s-glass :is\(\.card,[^{]*\{background:color-mix\(in srgb,var\(--w-ground\) 58%,transparent\);-webkit-backdrop-filter:blur\(20px\)[^;]*;backdrop-filter:blur\(20px\)/);
  });

  it("bold: thick ink borders and hard offset shadows", () => {
    const css = sheet(renderWire(styled("bold")));
    expect(css).toContain("border:3px solid var(--w-ink)");
    expect(css).toContain("box-shadow:4px 4px 0 var(--w-ink)");
  });

  it("flat, the default and a blueprint carry no surface at all — byte for byte what they drew before", () => {
    for (const spec of [styled(), wireframe("list", { platform: "app" })]) {
      const html = renderWire(spec);
      expect(html).not.toMatch(/ s-(raised|glass|bold)/);
      expect(sheet(html)).not.toContain("backdrop-filter");
      expect(sheet(html)).not.toContain(".s-raised");
    }
    // A blueprint is blue in every system — no theme, so no surface either.
    expect(renderWire({ ...blueprint("list", { platform: "app" }), style: styled("glass").style })).not.toContain("s-glass");
  });

  it("each surface's sheet reads roles and nothing else — no literal colour", () => {
    const LITERAL = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(|(?<![-\w])(?:white|black|gr[ae]y|silver|red|blue|green)(?![-\w])/i;
    for (const surface of WIRE_SURFACES) {
      const css = __SURFACE_CSS[surface];
      expect(css, surface).not.toMatch(LITERAL);
      for (const [, role] of css.matchAll(/var\(--w-([a-z-]+)\)/g)) expect(ROLES as readonly string[], `${surface} reads --w-${role}`).toContain(role);
      // Every rule is scoped under its frame's class, so two surfaces never meet in one prototype.
      for (const rule of css.trim().split("\n")) expect(rule.startsWith(`.s-${surface} `) || rule.startsWith(`.frame.s-${surface}`), rule).toBe(true);
    }
    expect(__WIRE_CSS).not.toContain("backdrop-filter");
  });

  it("a prototype carries every surface its screens are drawn on", () => {
    const a = { id: "a", title: "Acme list", spec: styled("glass") };
    const b = { id: "b", title: "Acme detail", spec: { ...wireframe("detail", { platform: "app" }), style: styled("raised").style } };
    const html = assemblePrototype([a, b], []);
    expect(html).toContain(".frame.s-glass{");
    expect(html).toContain(".s-raised :is(");
    expect(html).toContain("s-glass");
    expect(html).toContain("s-raised");
  });
});

/** The real reducer, as the home runs it: every op applied, its inverse recorded — so undoing a group is exact. */
function reducerPort() {
  const actor = { id: "usr_acme", name: "Acme" };
  const canvasId = "prj_acme";
  let seq = 0;
  const apply = (s: CanvasState | null, op: Operation) => applyOperation(s, { id: `op_${++seq}`, canvasId, actor, ts: new Date(Date.UTC(2026, 8, 24, 0, 0, seq)).toISOString(), op })!;
  let state = apply(null, { type: "project.create", canvasId, title: "Acme" });
  const blobs = new Map<string, string>();
  const log: Array<{ op: Operation; inverse: Operation | null; group: string }> = [];
  const port: WirePort = {
    canvasId,
    actor,
    canvas: async () => state.canvas,
    readText: async (hash) => blobs.get(hash)!,
    put: async (text) => {
      const blobHash = `hash_${blobs.size + 1}`;
      blobs.set(blobHash, text);
      return { blobHash, size: text.length };
    },
    send: async (op, group) => {
      log.push({ op, inverse: invertOperation(state, op), group });
      state = apply(state, op);
      if (op.type !== "item.add") return;
      const it = state.canvas.items[op.itemId]!;
      return { x: it.x, y: it.y };
    },
  };
  const undo = (group: string) => {
    for (const { inverse } of log.filter((l) => l.group === group).reverse()) if (inverse) state = apply(state, inverse);
  };
  /** What a person could see of the canvas: every item's title, place, properties and the version it shows. */
  const look = () => Object.fromEntries(Object.values(state.canvas.items).map((i) => [i.id, { title: i.title, x: i.x, y: i.y, properties: i.properties, version: i.currentVersionId }]));
  return { port, log, undo, look };
}

async function styleIn(h: ReturnType<typeof reducerPort>, id: string) {
  const all = await wiresOn(h.port, await h.port.canvas());
  const preset = id === HOUSE ? HOUSE : [...OWN_PRESETS, ...PACK_PRESETS].find((p) => p.id === id)!;
  const resolver = new StyleResolver(h.port, stubAnswerer(1), async () => all.map((s) => s.spec));
  return applyPreset(h.port, all, all, preset, preset === HOUSE ? null : presetText(preset), resolver);
}

describe("a style is one act, and one undo takes it back", () => {
  it("`/wire style material`: the file, its role and every wire in one group — undone, the canvas is as it was", async () => {
    const h = reducerPort();
    await composeFlow(h.port, "a delivery app for Acme couriers — sign in, see today's deliveries", stubAnswerer(4));
    const before = h.look();
    const r = await styleIn(h, "material");
    expect(new Set(h.log.filter((l) => l.group === r.group).map((l) => l.group)).size).toBe(1);
    expect(h.log.filter((l) => l.group === r.group).length).toBe(2 + r.restyled.changed.length + r.restyled.prototypes.length);
    expect(r.placed).toEqual([{ itemId: expect.any(String), scope: null, what: "added" }]);
    expect(r.restyled.changed.length).toBeGreaterThan(3);
    expect(h.look()).not.toEqual(before);
    h.undo(r.group);
    expect(h.look()).toEqual(before);
  });

  it("house after a style: the file goes to the trash and the greys return — and one undo brings the style back", async () => {
    const h = reducerPort();
    await composeFlow(h.port, "a delivery app for Acme couriers — sign in, see today's deliveries", stubAnswerer(4));
    const styled = await styleIn(h, "glass");
    const inGlass = h.look();
    const r = await styleIn(h, "house");
    expect(r.placed).toEqual([{ itemId: styled.placed[0]!.itemId, scope: null, what: "removed" }]);
    expect(h.look()[styled.placed[0]!.itemId]).toBeUndefined();
    for (const s of await wiresOn(h.port, await h.port.canvas())) expect(s.spec.style).toEqual({ source: "default" });
    h.undo(r.group);
    expect(h.look()).toEqual(inGlass);
  });
});

describe("right-click a wire → Style ▸", () => {
  const wire = (id: string, props: Record<string, string> = {}) => ({ id, title: `Acme ${id}`, x: 0, y: 0, width: 390, height: 844, properties: { fidelity: "wireframe", ...props }, currentVersionId: "v", versions: [] }) as unknown as Item;
  const canvasOf = (...items: Item[]) => ({ items: Object.fromEntries(items.map((i) => [i.id, i])), threads: {} }) as never;
  const opened: Array<[string, string]> = [];
  const open = (dialog: string, args: string) => void opened.push([dialog, args]);

  it("is offered on a wire, and not on a non-wire or a prototype", () => {
    const [row] = styleMenu({ canvas: canvasOf(wire("a")), items: [wire("a")], open });
    expect(row).toMatchObject({ label: "Style", writes: true });
    const note = { ...wire("n"), properties: { kind: "text" } } as unknown as Item;
    expect(styleMenu({ canvas: canvasOf(note), items: [note], open })).toEqual([]);
    expect(styleMenu({ canvas: canvasOf(wire("a"), note), items: [wire("a"), note], open })).toEqual([]);
    expect(styleMenu({ canvas: canvasOf(wire("p", { wirePrototype: "flw" })), items: [wire("p", { wirePrototype: "flw" })], open })).toEqual([]);
  });

  it("lists every style — the packs under their own heading — with a tick on the one that governs", () => {
    const sub = (items: Item[], canvas: never) => (styleMenu({ canvas, items, open })[0] as { value: string; submenu: Array<{ label?: string; separator?: string; checked?: boolean }> });
    const plain = sub([wire("a")], canvasOf(wire("a")));
    expect(plain.submenu.map((r) => r.label ?? `— ${r.separator}`)).toEqual(["House", ...OWN_PRESETS.map((p) => p.name), "— Design packs", ...PACK_PRESETS.map((p) => p.name)]);
    expect(plain.submenu.filter((r) => r.checked).map((r) => r.label)).toEqual(["House"]);
    expect(plain.value).toBe("House");
    // Governed by a wire style: that one is ticked, and named beside Style.
    const file = { ...wire("f"), title: "Glass — DESIGN.md", properties: { role: "design-system", wirePreset: "glass" } } as unknown as Item;
    const glass = sub([wire("a")], canvasOf(wire("a"), file));
    expect(glass.submenu.filter((r) => r.checked).map((r) => r.label)).toEqual(["Glass"]);
    expect(glass.value).toBe("Glass");
    // Governed by a DESIGN.md somebody wrote: no style is current.
    const mine = { ...file, properties: { role: "design-system" } } as unknown as Item;
    expect(sub([wire("a")], canvasOf(wire("a"), mine)).submenu.some((r) => r.checked)).toBe(false);
  });

  it("a pick opens the Wireframes dialog with `style <name>` — what `/wire style <name>` does", () => {
    const [row] = styleMenu({ canvas: canvasOf(wire("a")), items: [wire("a")], open });
    const material = (row as { submenu: Array<{ label?: string; run?: () => void }> }).submenu.find((r) => r.label === "Material")!;
    opened.length = 0;
    material.run!();
    expect(opened).toEqual([["wire", "style material"]]);
  });
});

describe("the default theme is untouched by all this", () => {
  it("house is the greys", () => {
    expect(DEFAULT_THEME.primary).toBe("#222222");
    expect(renderWire(wireframe("home"))).toContain("--w-primary:#222222");
  });
});
