import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { describe, expect, it, vi } from "vitest";
import { FIDELITY_PROP, itemUrl, type CanvasContents, type Item, type Operation } from "@isocan/core";
import type { CliHost } from "@isocan/cli/modulehost";
import wireframeCli from "../src/cli.ts";
import { flowLinks, keptArrows } from "../src/arrows.tsx";
import { modeOf } from "../src/dialog.tsx";
import { linkPatch, linkProp, overridesOf, overrideValue, type ArrowWrite } from "../src/link-override.ts";
import { linkRows, pickedWrite } from "../src/links-panel.tsx";
import { GAP, crossings, drawnLinks, estimatedHot, labelNeed, labelRect, labelShown, placeLabels, roundedPath, routeFlow, type FlowArrow, type HotRect, type RouteBox } from "../src/route.ts";
import type { WireLink } from "../src/links.ts";
import {
  KEEP_PROP, LINKS_PROP, PROTOTYPE_PROP, playAnchor, LINK_BACK, LINK_NONE, applyPropsRound, applyStructure, assemblePrototype, decideFlow, flowRequest, flowScreen,
  inferLinks, keptFlowsOf, propsRequests, readResponse, readWire, renderWire, structureRequest, wireframe,
  type JevResponse, type WireScreen, type WireSpec,
} from "../src/core.ts";

/**
 * **Phase 8, part A — flow arrows that are arrows** (research *Flow arrows*,
 * `docs/research/2026-09-23-flow-arrows.md`). Held here: the routes on the
 * recorded Jev flow cross nothing; one arrow per hotspot, leaving at the
 * hotspot; the head stops short; tabs, back and loose ends are not drawn at
 * rest; the canvas draws per kept flow, so it never draws a link the
 * prototype does not play; every writing action on an arrow is exactly the
 * op `isocan wire link` sends; `/wire links` is a mode; and the prototype
 * opens at the screen its fragment names.
 *
 * Synthetic throughout: Acme's couriers.
 */

interface Fixture { request: string; round1: JevResponse; round2: JevResponse[]; round3: JevResponse[] }
interface Rects { screens: Array<RouteBox & { unkept: boolean }>; hot: Record<string, Record<string, HotRect>> }
const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/** The recorded Jev flow, replayed as `docs/research/flow-arrows/gen.mts` does: seven kept screens in a row, one unkept variation under the list. */
function jev() {
  const fixture = JSON.parse(readFileSync(here("./fixtures/jev-acme-couriers.json"), "utf8")) as Fixture;
  const rects = JSON.parse(readFileSync(here("./fixtures/jev-hotspot-rects.json"), "utf8")) as Rects;
  const req1 = flowRequest(fixture.request);
  const decision = decideFlow(req1, readResponse(req1, fixture.round1));
  // Rounds 2 and 3 were recorded for the screens round 1 admitted at the old 0.5 cut; its maybe screens (welcome 0.42, confirm 0.36) were never asked.
  let specs = decision.archetypes.filter((a) => !a.maybe).map((a) => flowScreen(a.id, fixture.request, "flw_acme", decision));
  const titles = specs.map((s) => s.title);
  specs = specs.map((spec, i) => {
    const req = structureRequest(spec, titles);
    return applyStructure(spec, req, readResponse(req, fixture.round2[i]!));
  });
  const reqs = propsRequests(specs);
  specs = applyPropsRound(specs, reqs, reqs.map((req, i) => readResponse(req, fixture.round3[i]!)));
  const screens: WireScreen[] = specs.map((spec, i) => ({ id: `s${i}_${spec.archetype}`, title: spec.title, spec }));
  const boxes = rects.screens.filter((s) => !s.unkept).map(({ id, x, y, w, h }) => ({ id, x, y, w, h }));
  const obstacles = rects.screens.filter((s) => s.unkept).map(({ id, x, y, w, h }) => ({ id, x, y, w, h }));
  expect(boxes.map((b) => b.id)).toEqual(screens.map((s) => s.id));
  const hot = (id: string, key: string) => rects.hot[id]?.[key] ?? null;
  return { screens, boxes, obstacles, hot, links: inferLinks(screens) };
}

describe("the routes, on the recorded Jev flow", () => {
  it("cross nothing: the jumps' legs are ordered on each top edge (1 crossing without the ordering, research §1)", () => {
    const f = jev();
    const { arrows } = routeFlow({ screens: f.boxes, obstacles: f.obstacles, links: f.links, hot: f.hot });
    expect(arrows.filter((a) => a.shape === "jump").length).toBeGreaterThan(1);
    expect(crossings(arrows)).toBe(0);
    // Pointing at any screen adds its tabs; still nothing crosses what was drawn at rest.
    for (const b of f.boxes) {
      const { arrows: withTabs } = routeFlow({ screens: f.boxes, obstacles: f.obstacles, links: f.links, hot: f.hot, pointed: b.id });
      expect(crossings(withTabs.filter((a) => !a.chrome)), b.id).toBe(0);
    }
  });

  it("cross nothing when a person sends a jump over a screen that has a jump of its own (found on the merged walk)", () => {
    const f = jev();
    const done = f.links.find((l) => l.from === "s4_detail" && l.label === "Done")!;
    // Detail's Done sent past Form, to Status — as `wire link` would record it.
    const screens = f.screens.map((s) => (s.id === "s4_detail" ? { ...s, overrides: { [done.key]: "s6_state" } } : s));
    const links = inferLinks(screens);
    const { arrows } = routeFlow({ screens: f.boxes, obstacles: f.obstacles, links, hot: f.hot });
    const over = arrows.find((x) => x.link.from === "s4_detail" && x.link.to === "s6_state")!;
    expect(over.shape).toBe("jump");
    expect(crossings(arrows)).toBe(0);
  });

  it("are one per hotspot, not one per pair of screens: Done and Confirm on the detail are two arrows", () => {
    const f = jev();
    const { arrows } = routeFlow({ screens: f.boxes, obstacles: f.obstacles, links: f.links, hot: f.hot });
    const { rest } = drawnLinks(f.links);
    expect(arrows.map((a) => a.id).sort()).toEqual(rest.map((l) => `${l.from}|${l.key}`).sort());
    expect(new Set(arrows.map((a) => a.id)).size).toBe(arrows.length);
    const detail = arrows.filter((a) => a.link.from === "s4_detail" && a.link.to === "s5_form");
    expect(detail.map((a) => a.link.label).sort()).toEqual(["Confirm", "Done"]);
    // Two ports at their own heights, not one line.
    expect(new Set(detail.map((a) => a.pts[0]![1])).size).toBe(2);
  });

  it("leave from the hotspot: a step at the hotspot's height, a jump from its column; every head stops GAP short", () => {
    const f = jev();
    const { arrows } = routeFlow({ screens: f.boxes, obstacles: f.obstacles, links: f.links, hot: f.hot });
    const box = (id: string) => f.boxes.find((b) => b.id === id)!;
    const signIn = arrows.find((a) => a.link.from === "s0_sign-in" && a.link.label === "Sign in")!;
    const r = f.hot("s0_sign-in", signIn.link.key)!;
    expect(signIn.shape).toBe("jump");
    expect(signIn.pts[0]).toEqual([box("s0_sign-in").x + r.x + r.w / 2, box("s0_sign-in").y]);
    for (const a of arrows) {
      const b = box(a.link.to);
      const tip = a.pts[a.pts.length - 1]!;
      if (a.shape === "jump") expect(tip[1]).toBe(b.y - GAP);
      if (a.shape === "step") {
        const src = box(a.link.from);
        const h = f.hot(a.link.from, a.link.key)!;
        expect(Math.abs(a.pts[0]![1] - (src.y + h.y + h.h / 2))).toBeLessThanOrEqual(16);
        expect(tip[0]).toBe(b.x > src.x ? b.x - GAP : b.x + b.w + GAP);
      }
      // Orthogonal: every run is horizontal or vertical.
      for (let i = 1; i < a.pts.length; i++) expect(a.pts[i]![0] === a.pts[i - 1]![0] || a.pts[i]![1] === a.pts[i - 1]![1]).toBe(true);
    }
    expect(roundedPath(signIn.pts)).toMatch(/^M [\d.]+ [\d.-]+ L .* Q .* L [\d.]+ [\d.-]+$/);
  });

  it("draw tabs only while their screen is pointed at, back never, and a loose end as a mark on its hotspot", () => {
    const f = jev();
    const rest = routeFlow({ screens: f.boxes, obstacles: f.obstacles, links: f.links, hot: f.hot });
    expect(rest.arrows.some((a) => a.link.nav && a.link.rule !== "override")).toBe(false);
    expect(rest.arrows.some((a) => a.link.to === LINK_BACK)).toBe(false);
    expect(rest.needs).toEqual([]);
    const home = routeFlow({ screens: f.boxes, obstacles: f.obstacles, links: f.links, hot: f.hot, pointed: "s2_home" });
    const tabs = home.arrows.filter((a) => a.chrome);
    expect(tabs.length).toBeGreaterThan(0);
    expect(tabs.every((a) => a.link.from === "s2_home" && a.kind === "nav")).toBe(true);
    expect(home.needs.every((n) => n.link.from === "s2_home" && n.link.to === null)).toBe(true);
    expect(home.needs.length).toBe(f.links.filter((l) => l.from === "s2_home" && l.to === null && l.needs).length);
  });

  it("a nav hotspot is marked nav on its link, placed by any rule", () => {
    const f = jev();
    const tabs = f.links.filter((l) => l.key.startsWith("nav#"));
    expect(tabs.length).toBeGreaterThan(0);
    expect(tabs.every((l) => l.nav === true)).toBe(true);
    expect(f.links.filter((l) => !l.key.startsWith("nav#")).some((l) => l.nav)).toBe(false);
  });
});

describe("the routes, off the recorded flow", () => {
  const o = { request: "Acme couriers", flow: "flw_acme" };
  const box = (id: string, x: number, y = 0): RouteBox => ({ id, x, y, w: 390, h: 876 });
  const hotAt = (id: string, key: string) => estimatedHot(key, { w: 390, h: 876 });

  it("a kept variation below its original is reached by a Z through the gutter", () => {
    const signIn: WireScreen = { id: "it_signin", title: "Sign in", spec: wireframe("sign-in", o) };
    const home: WireScreen = { id: "it_home", title: "Home", spec: wireframe("home", o) };
    const { arrows } = routeFlow({ screens: [box("it_signin", 0), box("it_home", 0, 1000)], links: inferLinks([signIn, home]), hot: hotAt });
    const a = arrows.find((x) => x.link.from === "it_signin" && x.link.to === "it_home")!;
    expect(a.shape).toBe("cross");
    expect(a.pts).toHaveLength(4);
    expect(a.pts[3]![0]).toBe(390 + GAP);
  });

  it("an unkept screen standing between two kept neighbours makes the step a jump over it", () => {
    const signIn: WireScreen = { id: "it_signin", title: "Sign in", spec: wireframe("sign-in", o) };
    const home: WireScreen = { id: "it_home", title: "Home", spec: wireframe("home", o) };
    const links = inferLinks([signIn, home]);
    const clear = routeFlow({ screens: [box("it_signin", 0), box("it_home", 470)], links, hot: hotAt });
    expect(clear.arrows[0]!.shape).toBe("step");
    const blocked = routeFlow({ screens: [box("it_signin", 0), box("it_home", 940)], obstacles: [{ id: "unkept", x: 470, y: -80, w: 390, h: 956 }], links, hot: hotAt });
    expect(blocked.arrows[0]!.shape).toBe("jump");
    // Its lane clears the taller unkept screen too.
    expect(blocked.arrows[0]!.pts[1]![1]).toBeLessThan(-80);
  });
});

/** Every pair of labels drawn at rest at this zoom whose pills overlap on screen. */
function labelClashes(arrows: readonly FlowArrow[], scale: number): string[] {
  const shown = arrows.filter((a) => labelShown(a, scale));
  const out: string[] = [];
  for (let i = 0; i < shown.length; i++) {
    for (let j = i + 1; j < shown.length; j++) {
      const p = labelRect(shown[i]!, scale);
      const q = labelRect(shown[j]!, scale);
      if (p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h) out.push(`${shown[i]!.link.label}×${shown[j]!.link.label}@${scale}`);
    }
  }
  return out;
}
const ZOOMS = [0.1, 0.16, 0.2, 0.26, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.5, 2, 3, 4];

describe("arrow labels never sit on each other (the isocan.io walk: Home over Row)", () => {
  const box = (id: string, x: number): RouteBox => ({ id, x, y: 0, w: 390, h: 844 });
  const link = (from: string, to: string, key: string, label: string): WireLink => ({ from, to, key, label, transition: "push", rule: "intent" });
  // Two jumps whose spans nest, so they ride adjacent lanes 26 units apart, their labels both near the middle screen.
  const stacked = () => ({
    screens: ["it_a", "it_b", "it_c", "it_d", "it_e"].map((id, i) => box(id, i * 470)),
    links: [link("it_b", "it_d", "main.3#row", "Row"), link("it_a", "it_e", "header#action-1", "Home")],
    hot: (_id: string, key: string) => estimatedHot(key, { w: 390, h: 844 }),
  });

  it("two stacked jumps: both labels still show at the overview zoom, slid apart along their runs", () => {
    const { arrows } = routeFlow(stacked());
    const row = arrows.find((a) => a.link.label === "Row")!;
    const home = arrows.find((a) => a.link.label === "Home")!;
    expect([row.shape, home.shape]).toEqual(["jump", "jump"]);
    expect(Math.abs(row.lane! - home.lane!)).toBe(1);
    for (const z of ZOOMS) expect(labelClashes(arrows, z)).toEqual([]);
    // Sliding kept both: at 0.3 each run holds its pill and they clear each other.
    expect(labelShown(row, 0.3) && labelShown(home, 0.3)).toBe(true);
    // And a label never leaves its run: it sits on the lane, between the legs, with room for its pill at the zoom it shows from.
    for (const a of [row, home]) {
      const [x0, x1] = [Math.min(a.pts[1]![0], a.pts[2]![0]), Math.max(a.pts[1]![0], a.pts[2]![0])];
      expect(a.label.y).toBe(a.pts[1]![1]);
      const half = labelNeed(a.link.label) / a.label.show / 2;
      expect(a.label.x - half).toBeGreaterThanOrEqual(x0 - 1e-6);
      expect(a.label.x + half).toBeLessThanOrEqual(x1 + 1e-6);
    }
  });

  it("the routes are untouched by the labels: still no crossings", () => {
    expect(crossings(routeFlow(stacked()).arrows)).toBe(0);
  });

  it("on the recorded Jev flow: no two labels overlap at any zoom, at rest or with any screen pointed at", () => {
    const f = jev();
    for (const pointed of [null, ...f.boxes.map((b) => b.id)]) {
      const { arrows } = routeFlow({ screens: f.boxes, obstacles: f.obstacles, links: f.links, hot: f.hot, pointed });
      for (const z of ZOOMS) expect(labelClashes(arrows, z), `${pointed}`).toEqual([]);
    }
    const { arrows } = routeFlow({ screens: f.boxes, obstacles: f.obstacles, links: f.links, hot: f.hot });
    // The recorded flow has the walk's shape too: Home's Row jump rides between the two Sign in lanes, 26 units from each.
    const row = arrows.find((a) => a.link.from === "s2_home" && a.shape === "jump")!;
    expect(row.link.label).toBe("Row");
    expect(row.label.show).toBeGreaterThan(labelNeed("Row") / row.label.run);
    // And at the overview zoom nothing is lost: every label whose run holds it is still drawn.
    for (const a of arrows) if (0.3 >= labelNeed(a.link.label) / a.label.run) expect(labelShown(a, 0.3), a.id).toBe(true);
    // Pointing at a screen never moves a label already there: tabs are placed after the flow's own labels.
    const pointedHome = routeFlow({ screens: f.boxes, obstacles: f.obstacles, links: f.links, hot: f.hot, pointed: "s2_home" }).arrows.filter((a) => !a.chrome);
    expect(pointedHome.map((a) => a.label)).toEqual(arrows.map((a) => a.label));
  });

  it("where two cannot both fit, the longer run keeps its label and the other waits (hover still shows it)", () => {
    const arrow = (id: string, label: string, x: number, y: number, run: number): FlowArrow => ({
      id,
      link: { from: id, to: "it_x", key: "main#k", label, transition: "push", rule: "intent" },
      kind: "screen",
      shape: "jump",
      pts: [[x - run / 2, y + 100], [x - run / 2, y], [x + run / 2, y], [x + run / 2, y + 100]],
      label: { x, y, run, show: 0 },
      chrome: false,
    });
    // Short first in the input: order is by run, not by arrival.
    const [short, long] = placeLabels([arrow("it_short", "Row", 500, -110, 120), arrow("it_long", "Home", 500, -100, 200)]);
    expect(long!.label).toMatchObject({ x: 500, y: -100, show: labelNeed("Home") / 200 });
    expect(labelShown(long!, 0.5)).toBe(true);
    // 120 units of run cannot slide Row clear of Home at 0.5: it is dropped there, and shown again once zoom separates the lanes.
    expect(labelShown(short!, 0.5)).toBe(false);
    expect(short!.label.show).toBeLessThan(3);
    expect(labelClashes([short!, long!], 0.5)).toEqual([]);
    expect(labelClashes([short!, long!], short!.label.show)).toEqual([]);
  });
});

describe("the canvas draws per kept flow", () => {
  // research §"The flow bug, reproduced" — docs/research/flow-arrows/two-flows.mts
  it("so flow B's sign in never points at flow A's home", () => {
    const a = { request: "Acme couriers", flow: "flw_a" };
    const b = { request: "Test recipes", flow: "flw_b" };
    const specs: Record<string, WireSpec> = { a_signin: wireframe("sign-in", a), a_home: wireframe("home", a), b_signin: wireframe("sign-in", b) };
    const place: Record<string, [number, number]> = { b_signin: [0, 0], a_signin: [0, 1200], a_home: [470, 1200] };
    const blobs = new Map<string, string>();
    const items: Record<string, Item> = {};
    for (const [id, [x, y]] of Object.entries(place)) {
      blobs.set(`h-${id}`, renderWire(specs[id]!));
      items[id] = { id, title: specs[id]!.title, x, y, width: 390, height: 876, properties: { fidelity: "wireframe", [KEEP_PROP]: "yes" }, currentVersionId: `v-${id}`, versions: [{ id: `v-${id}`, blobHash: `h-${id}`, mimeType: "text/html" }] } as unknown as Item;
    }
    const canvas = { items } as unknown as CanvasContents;
    const read = (h: string) => (blobs.has(h) ? readWire(blobs.get(h)!) : undefined);
    expect(keptArrows(canvas, read)).toEqual([{ from: "a_signin", to: "a_home" }]);
    // And what the canvas draws is what the prototype plays, flow by flow.
    const drawn = flowLinks(canvas, read);
    const played = keptFlowsOf(canvas, Object.keys(place).map((id) => ({ item: id, spec: specs[id]! })));
    expect(drawn.map((f) => f.flow)).toEqual(["flw_a"]);
    expect(drawn[0]!.links).toEqual(inferLinks(played.find((f) => f.flow === "flw_a")!.screens));
    // A per-hotspot override (what `wire link` now writes) is read by the canvas: switch Sign in off and its arrow goes.
    const key = drawn[0]!.links.find((l) => l.from === "a_signin" && l.to === "a_home")!.key;
    (items["a_signin"]!.properties as Record<string, string>)[linkProp(key)] = LINK_NONE;
    expect(keptArrows(canvas, read)).toEqual([]);
    // A person links B's sign in to A's home on purpose (a guest, Porchlight #5): drawn once, from B, and A's home is not drawn twice.
    (items["b_signin"]!.properties as Record<string, string>)[linkProp(key)] = "a_home";
    const withGuest = flowLinks(canvas, read);
    expect(keptArrows(canvas, read)).toEqual([{ from: "b_signin", to: "a_home" }]);
    const ids = withGuest.flatMap((f) => f.links.map((l) => `${l.from}|${l.key}`));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

/** A canvas in memory the CLI writes to — the `wire link` half of the comparison. */
function cliHarness() {
  const o = { request: "Acme couriers", flow: "flw_acme" };
  const program = new Command().exitOverride().option("--json");
  const sent: Operation[] = [];
  const blobs = new Map<string, string>();
  const items = new Map<string, Item>();
  const put = (id: string, title: string, spec: WireSpec, x: number) => {
    const hash = `h-${id}`;
    blobs.set(hash, renderWire(spec));
    items.set(id, { id, title, x, y: 0, width: 390, height: 876, properties: { [FIDELITY_PROP]: "wireframe", wireKeep: "yes" }, currentVersionId: `v-${id}`, versions: [{ id: `v-${id}`, blobHash: hash, mimeType: "text/html" }] } as unknown as Item);
  };
  put("it_signin", "Sign in", wireframe("sign-in", o), 0);
  put("it_home", "Home", wireframe("home", o), 470);
  put("it_list", "Deliveries", wireframe("list", o), 940);
  put("it_detail", "Delivery", wireframe("detail", o), 1410);
  const ctx = {
    json: false,
    homeOf: async () => null,
    client: {
      base: "http://127.0.0.1:4441",
      snapshot: async () => ({ canvas: { items: structuredClone(Object.fromEntries(items)) }, project: {} }),
      downloadBlob: async (_c: string, hash: string) => Buffer.from(blobs.get(hash)!, "utf8"),
    },
  };
  const apply = (op: Operation) => {
    if (op.type !== "item.update") throw new Error(op.type);
    const item = items.get(op.itemId)!;
    const patch = op.patch as { properties?: Record<string, string>; removeProperties?: string[] };
    const properties = { ...item.properties, ...(patch.properties ?? {}) };
    for (const k of patch.removeProperties ?? []) delete properties[k];
    items.set(op.itemId, { ...item, properties } as Item);
  };
  const host = {
    program,
    ctxOf: async () => ctx,
    resolveCanvas: async () => ({ id: "canvas-acme", name: "Acme" }),
    resolveItem: (snapshot: { canvas: { items: Record<string, Item> } }, ref: string) => {
      const found = snapshot.canvas.items[ref];
      if (!found) throw new Error(`no item ${ref}`);
      return found;
    },
    sendOp: async (_ctx: unknown, _canvas: string, op: Operation) => {
      sent.push(op);
      apply(op);
      return { envelope: { op } };
    },
    printJson: () => undefined,
    run: (fn: (...args: unknown[]) => Promise<void>) => async (...args: unknown[]) => {
      await fn(...args);
    },
  } as unknown as CliHost;
  wireframeCli.register(host);
  const cli = async (...args: string[]) => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      await program.parseAsync(["node", "isocan", ...args]);
      return log.mock.calls.flat().join("\n");
    } finally {
      log.mockRestore();
    }
  };
  const prototype = () => blobs.set("h-proto", "<!doctype html><p>not a wire</p>") && items.set("it_proto", { id: "it_proto", title: "Prototype · Acme couriers", x: 2000, y: 0, width: 406, height: 900, properties: { [FIDELITY_PROP]: "wireframe", [PROTOTYPE_PROP]: "flw_acme" }, currentVersionId: "v-p", versions: [{ id: "v-p", blobHash: "h-proto", mimeType: "text/html" }] } as unknown as Item);
  return { sent, items, cli, prototype };
}

describe("an arrow's menu is `wire link`", () => {
  it("each writing action sends exactly the op the CLI sends for the same decision", async () => {
    const h = cliHarness();
    const cases: Array<{ write: ArrowWrite; args: string[] }> = [
      { write: { kind: "retarget", to: "it_signin" }, args: ["it_signin"] },
      { write: { kind: "back" }, args: ["--back"] },
      { write: { kind: "remove" }, args: ["--none"] },
      { write: { kind: "reset" }, args: ["--clear"] },
    ];
    for (const c of cases) {
      const before = structuredClone(h.items.get("it_list")!);
      await h.cli("wire", "link", "it_list", "main.3#row", ...c.args);
      const fromCli = h.sent.at(-1)!;
      // What the arrow menu sends: `linkPatch` on the screen as it stands — the op the CLI sent.
      expect({ type: "item.update", itemId: before.id, patch: linkPatch(before, "main.3#row", overrideValue(c.write)) }, c.write.kind).toEqual(fromCli);
    }
    expect(h.sent).toHaveLength(cases.length);
  });

  it("a write keeps a person's other decisions on the same screen — and the canvas reads what it wrote", () => {
    // A screen still carrying the older JSON: the first write folds it into per-hotspot keys.
    const legacy = { id: "it_list", properties: { [LINKS_PROP]: JSON.stringify({ "header#leading": LINK_NONE }) } } as unknown as Item;
    const patch = linkPatch(legacy, "main.3#row", "it_home");
    expect(patch).toEqual({ properties: { [linkProp("header#leading")]: LINK_NONE, [linkProp("main.3#row")]: "it_home" }, removeProperties: [LINKS_PROP] });
    const after = { ...legacy.properties, ...patch.properties } as Record<string, string>;
    for (const k of patch.removeProperties ?? []) delete after[k];
    expect(overridesOf(after)).toEqual({ "header#leading": LINK_NONE, "main.3#row": "it_home" });
    // Reset touches only its own hotspot's key.
    expect(linkPatch({ properties: after }, "main.3#row", null)).toEqual({ removeProperties: [linkProp("main.3#row")] });
  });
});

describe("/wire links", () => {
  it("is a mode of the Wireframes dialog", () => {
    expect(modeOf("links")).toEqual({ kind: "links" });
    expect(modeOf("links for the home screen")).toEqual({ kind: "compose", request: "links for the home screen" });
  });

  it("lists every hotspot with what the rules say and what a person decided, and its pickers are `wire link`", () => {
    const o = { request: "Acme couriers", flow: "flw_acme" };
    const screens: WireScreen[] = [
      { id: "it_signin", title: "Sign in", spec: wireframe("sign-in", o) },
      { id: "it_home", title: "Home", spec: wireframe("home", o) },
      { id: "it_list", title: "Deliveries", spec: wireframe("list", o), overrides: { "main.3#row": "it_home" } },
      { id: "it_detail", title: "Delivery", spec: wireframe("detail", o) },
    ];
    const flow = { flow: "flw_acme", request: o.request, screens, items: [], guests: [] };
    const rows = linkRows([flow]);
    expect(rows.map((r) => `${r.link.from}|${r.link.key}`)).toEqual(inferLinks(screens, { withNone: true }).map((l) => `${l.from}|${l.key}`));
    const row = rows.find((r) => r.link.from === "it_list" && r.link.key === "main.3#row")!;
    expect(row).toMatchObject({ value: "it_home", rules: "Delivery" });
    expect(rows.find((r) => r.link.from === "it_signin")!.value).toBe("");
    expect(linkRows([flow], new Set(["it_home"])).every((r) => r.link.from === "it_home")).toBe(true);
    expect(pickedWrite("")).toEqual({ kind: "reset" });
    expect(pickedWrite(LINK_BACK)).toEqual({ kind: "back" });
    expect(pickedWrite(LINK_NONE)).toEqual({ kind: "remove" });
    expect(pickedWrite("it_detail")).toEqual({ kind: "retarget", to: "it_detail" });
  });
});

describe("the prototype opens where its fragment says", () => {
  it("reads #screen= and #hot= — Play from here", async () => {
    // jsdom ships no types here; the specifier is a variable so the type checker leaves it be.
    const lib = "jsdom";
    const { JSDOM } = (await import(lib)) as { JSDOM: new (html: string, opts: object) => { window: Window & typeof globalThis } };
    const o = { request: "Acme couriers", flow: "flw_acme" };
    const screens: WireScreen[] = [
      { id: "it_signin", title: "Sign in", spec: wireframe("sign-in", o) },
      { id: "it_home", title: "Home", spec: wireframe("home", o) },
      { id: "it_list", title: "Deliveries", spec: wireframe("list", o) },
    ];
    const html = assemblePrototype(screens, inferLinks(screens), { title: "Acme" });
    const open = (hash: string) => new JSDOM(html, { runScripts: "dangerously", url: `https://proto.test/p.html${hash}`, pretendToBeVisual: true });
    const shown = (dom: { window: Window & typeof globalThis }) => [...dom.window.document.querySelectorAll(".pscreen")].filter((s) => !(s as HTMLElement).hidden).map((s) => s.getAttribute("data-screen"));
    expect(shown(open(""))).toEqual(["it_signin"]);
    const dom = open("#screen=it_list&hot=main.3%23row");
    expect(shown(dom)).toEqual(["it_list"]);
    expect(dom.window.document.body.getAttribute("data-at")).toBe("it_list");
    expect(dom.window.document.querySelector('[data-screen="it_list"] [data-hot="main.3#row"]')!.classList.contains("pflash")).toBe(true);
    // A screen it does not have opens at the start, as before.
    expect(shown(open("#screen=it_gone"))).toEqual(["it_signin"]);
  });
});

describe("isocan wire play", () => {
  it("prints the address the arrow's Play from here opens — and writes nothing", async () => {
    const h = cliHarness();
    await expect(h.cli("wire", "play", "it_list")).rejects.toThrow(/no prototype yet/);
    h.prototype();
    const printed = await h.cli("wire", "play", "it_list", "row");
    const url = printed.split("\n")[0]!;
    expect(url).toBe(`${itemUrl("http://127.0.0.1:4441", "canvas-acme", "it_proto")}?at=${encodeURIComponent(playAnchor("it_list", "main.3#row"))}`);
    expect(new URLSearchParams(new URL(url).search).get("at")).toBe("screen=it_list&hot=main.3%23row");
    expect(h.sent).toEqual([]);
  });
});
