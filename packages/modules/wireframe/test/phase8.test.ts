import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  applyOperation, contrastRatio, registerModule, spotlit, unregisterModule,
  type CanvasContents, type CanvasState, type Item, type Operation,
} from "@isocan/core";
import {
  CAPTION_HEIGHT, DEFAULT_THEME, PLATFORM_SIZE, PROTOTYPE_PROP, addVariations, alreadyLooks, blueprint, keptFlowsOf,
  inferLinks, linkColor, readWire, renderWire, restyle, rowStartIn, startFlow, themeCss, wireSize, wireframe, wiresOn,
  writePrototype, FlowCanvas, applyPropsRound, applyStructure, decideFlow, flowRequest, flowScreen, propsRequests, readResponse, structureRequest,
  type JevResponse, type StyleResolver, type WirePort, type WireSpec, type WireStyle,
} from "../src/core.ts";
import { __WIRE_CSS } from "../src/render.ts";
import { rerender, rerenderSummary } from "../src/rerender.ts";
import { linkPatch, overridesOf, setLinkOverride } from "../src/link-override.ts";
import { chatRecordOp } from "../src/chat.ts";
import { modeOf } from "../src/dialog.tsx";
import { wireframeModule } from "../src/record.ts";

/**
 * **Wireframes phase 8, builder B** — just the screen, re-render, finding
 * prototypes, the Chat record, and Porchlight's findings
 * (`docs/projects/wireframes/phases.md`, phase 8 B–D). Every canvas here is
 * synthetic, in memory, with a content-addressed blob store (a blob is named
 * by its bytes, as the home names it), so "writes only where the bytes
 * change" is measurable.
 */

const o = { request: "Acme couriers", flow: "flw_acme" };

interface Canvas {
  port: WirePort;
  sent: Array<{ op: Operation; group: string }>;
  items: Record<string, Item>;
  blobs: Map<string, string>;
  canvas(): CanvasContents;
  html(id: string): string;
  put(id: string, spec: WireSpec, at: { x: number; y: number; width?: number; height?: number; containerId?: string; properties?: Record<string, string>; html?: string }): void;
}

function fakeCanvas(): Canvas {
  const items: Record<string, Item> = {};
  const blobs = new Map<string, string>();
  const sent: Array<{ op: Operation; group: string }> = [];
  const hash = (text: string) => `h${[...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(16)}-${text.length}`;
  const store = (text: string) => {
    const h = hash(text);
    blobs.set(h, text);
    return h;
  };
  const canvas = () => ({ items: structuredClone(items), threads: {}, trash: [] }) as unknown as CanvasContents;
  const apply = (op: Operation) => {
    if (op.type === "item.add") {
      const at = op.placement as { x: number; y: number };
      items[op.itemId] = {
        id: op.itemId, title: op.title ?? "", description: "", properties: { ...(op.properties ?? {}) }, x: at.x, y: at.y, width: op.width, height: op.height,
        ...(op.containerId ? { containerId: op.containerId } : {}), currentVersionId: op.version.id, versions: [{ ...op.version }],
      } as unknown as Item;
    } else if (op.type === "item.addVersion") {
      const item = items[op.itemId]!;
      item.versions = [...item.versions, { ...op.version } as never];
      item.currentVersionId = op.version.id;
    } else if (op.type === "item.update") {
      const item = items[op.itemId]!;
      item.properties = { ...item.properties, ...(op.patch.properties ?? {}) };
      for (const k of op.patch.removeProperties ?? []) delete item.properties[k];
    } else if (op.type === "item.resize") {
      Object.assign(items[op.itemId]!, { width: op.width, height: op.height });
    } else if (op.type !== "thread.create" && op.type !== "thread.reply") throw new Error(`unexpected op ${op.type}`);
  };
  const port: WirePort = {
    canvasId: "prj_acme",
    canvas: async () => canvas(),
    readText: async (h) => blobs.get(h)!,
    put: async (text) => ({ blobHash: store(text), size: text.length }),
    send: async (op, group) => {
      sent.push({ op, group });
      apply(op);
      if (op.type === "item.add") return { x: items[op.itemId]!.x, y: items[op.itemId]!.y };
    },
  };
  const put: Canvas["put"] = (id, spec, at) => {
    const h = store(at.html ?? renderWire(spec));
    const { width, height } = wireSize(spec);
    items[id] = {
      id, title: spec.title, description: "", x: at.x, y: at.y, width: at.width ?? width, height: at.height ?? height,
      properties: { fidelity: "wireframe", ...(at.properties ?? {}) }, ...(at.containerId ? { containerId: at.containerId } : {}),
      currentVersionId: `${id}-v1`, versions: [{ id: `${id}-v1`, blobHash: h, mimeType: "text/html", filename: `${id}.html`, size: 1 }],
    } as unknown as Item;
  };
  const html = (id: string) => blobs.get(items[id]!.versions.find((v) => v.id === items[id]!.currentVersionId)!.blobHash)!;
  return { port, sent, items, blobs, canvas, html, put };
}

/** Home from the recorded Jev answers (`fixtures/jev-acme-couriers.json`), replayed through the pure rounds. */
function recordedHome(): WireSpec {
  const fixture = JSON.parse(readFileSync(fileURLToPath(new URL("./fixtures/jev-acme-couriers.json", import.meta.url)), "utf8")) as { request: string; round1: JevResponse; round2: JevResponse[]; round3: JevResponse[] };
  const req1 = flowRequest(fixture.request);
  const decision = decideFlow(req1, readResponse(req1, fixture.round1));
  let specs = decision.archetypes.map((a) => flowScreen(a.id, fixture.request, "flw_acme", decision));
  const titles = specs.map((x) => x.title);
  specs = specs.map((spec, i) => { const req = structureRequest(spec, titles); return applyStructure(spec, req, readResponse(req, fixture.round2[i])); });
  const reqs = propsRequests(specs);
  return applyPropsRound(specs, reqs, reqs.map((req, i) => readResponse(req, fixture.round3[i])))[2]!;
}

/** A canvas group, as the writer leaves one: `kind=group`, a frame, no file. */
function groupItem(id: string, box: { x: number; y: number; width: number; height: number }): Item {
  return { id, title: "Wires", description: "", properties: { kind: "group" }, ...box, currentVersionId: "", versions: [] } as unknown as Item;
}

describe("B · just the screen", () => {
  const spec = wireframe("sign-in", o);
  const html = renderWire(spec);

  it("draws no name strip — the item's own title names the screen", () => {
    expect(html).not.toMatch(/class="cap/);
    expect(__WIRE_CSS).not.toMatch(/^\.cap\{/m);
    // The title survives where it belongs: the document's <title>, which no canvas draws.
    expect(html).toContain("<title>Sign in</title>");
    expect(html).toMatch(/<body class="screen"[^>]*>\n<div class="frame app"/);
  });

  it("draws no device outline: on a screen the frame has no border and no corners — the item's frame is the device", () => {
    expect(__WIRE_CSS).toContain("body.screen>.frame{border:0;border-radius:0}");
    // The prototype sets frames on a stage (no item frame around each), so it keeps its outlines.
    expect(__WIRE_CSS).toContain(".frame.app{border-radius:28px}");
  });

  it("keeps the chrome that belongs to the screen: its status bar is still drawn", () => {
    const home = renderWire(wireframe("home", o));
    expect(home).toContain('data-block="app-shell"');
    expect(home).toContain('<div class="chrome app">');
  });

  it("is exactly the platform's size — no 32 px strip on top", () => {
    expect(CAPTION_HEIGHT).toBe(0);
    for (const archetype of ["sign-in", "home", "list"]) {
      const s = wireframe(archetype, o);
      expect(wireSize(s)).toEqual(PLATFORM_SIZE[s.platform]);
    }
  });

  it("still says 'one way to draw this' where Jev was certain — as the screen's tooltip, not a strip", () => {
    const one = renderWire({ ...spec, varied: "none" });
    expect(one).toMatch(/<body class="screen"[^>]*data-varied="none" title="one way to draw this">/);
    expect(html).not.toContain("data-varied");
  });
});

describe("B · re-render every wire from its spec", () => {
  /** What the renderer drew before phase 8: the same screen with a name strip above it, 32 px taller. */
  const oldHtml = (spec: WireSpec) => renderWire(spec).replace('<body class="screen"', '<body').replace("<div class=\"frame", `<div class="cap"><span>${spec.title}<small>wireframe</small></span></div>\n<div class="frame`);

  it("versions every wire whose bytes move, resizes it to the screen alone, in ONE op group — and a rerun writes nothing", async () => {
    const c = fakeCanvas();
    const specs = [wireframe("sign-in", o), wireframe("home", o), wireframe("list", o)];
    specs.forEach((s, i) => c.put(`it_${i}`, s, { x: i * 500, y: 0, height: 876, html: oldHtml(s) }));
    // One already current: drawn by today's renderer at today's size.
    c.put("it_now", wireframe("detail", o), { x: 1500, y: 0 });
    const all = await wiresOn(c.port, c.canvas());
    const r = await rerender(c.port, c.canvas(), all, all);
    expect(r.changed.map((s) => s.item).sort()).toEqual(["it_0", "it_1", "it_2"]);
    expect(r.resized).toBe(3);
    expect(new Set(c.sent.map((s) => s.group))).toEqual(new Set([r.group]));
    expect(c.sent.filter((s) => s.op.type === "item.addVersion")).toHaveLength(3);
    expect(c.sent.filter((s) => s.op.type === "item.resize").map((s) => (s.op as { height: number }).height)).toEqual([844, 844, 844]);
    for (const id of ["it_0", "it_1", "it_2"]) expect(c.html(id)).not.toContain('class="cap"');
    expect(rerenderSummary(r)).toMatch(/^3 of 4 wires re-rendered · 1 unchanged · 3 resized to the screen alone — one op group/);

    const before = c.sent.length;
    const again = await rerender(c.port, c.canvas(), await wiresOn(c.port, c.canvas()), await wiresOn(c.port, c.canvas()));
    expect(again.changed).toEqual([]);
    expect(c.sent.length).toBe(before);
    expect(rerenderSummary(again)).toMatch(/nothing written$/);
  });
});

describe("C · the Chat record of a /wire act", () => {
  it("is a record in the Chat — a reply when the Chat exists, its first message when not — attached to what was made", () => {
    const empty = { items: {}, threads: {} } as unknown as CanvasContents;
    const first = chatRecordOp(empty, ["composed \"Acme couriers\": Sign in · Home.", "2 screens"], ["it_a", "it_b", "it_a"]);
    expect(first).toMatchObject({ type: "thread.create", main: true, anchorItemId: null, comment: { record: true, items: ["it_a", "it_b"] } });
    expect((first as { comment: { body: string } }).comment.body).toBe("**Wire builder** — composed \"Acme couriers\": Sign in · Home.\n\n2 screens");
    const chat = { items: {}, threads: { thr_1: { id: "thr_1", main: true, comments: [], x: 0, y: 0 } } } as unknown as CanvasContents;
    expect(chatRecordOp(chat, ["restyled"])).toMatchObject({ type: "thread.reply", threadId: "thr_1", comment: { record: true } });
  });

  it("the dialog knows /wire rerender and /wire prototypes", () => {
    expect(modeOf("rerender")).toEqual({ kind: "rerender" });
    expect(modeOf("prototypes")).toEqual({ kind: "prototypes" });
    expect(modeOf("prototype")).toEqual({ kind: "prototype" });
  });
});

describe("C · finding prototypes: the minimap's spotlight", () => {
  it("lights an item carrying wirePrototype while the module is loaded, and nothing without it", () => {
    const proto = { properties: { [PROTOTYPE_PROP]: "flw_acme" } } as unknown as Item;
    const screen = { properties: { fidelity: "wireframe" } } as unknown as Item;
    unregisterModule(wireframeModule.name);
    expect(spotlit(proto)).toBe(false);
    registerModule(wireframeModule);
    try {
      expect(spotlit(proto)).toBe(true);
      expect(spotlit(screen)).toBe(false);
    } finally {
      unregisterModule(wireframeModule.name);
    }
  });
});

describe("D1 · a second flow in a group is placed clear of the first (Porchlight #1)", () => {
  it("--in without --at starts the row under everything already in the group — not in the first gap its first screen fits", async () => {
    const c = fakeCanvas();
    c.items.grp_w = groupItem("grp_w", { x: 900, y: 100, width: 6000, height: 3000 });
    // Flow 1: a row, and variations under two of its screens — the gap beside them is where #1 landed.
    c.put("f1_a", wireframe("home", o), { x: 1024, y: 200, containerId: "grp_w" });
    c.put("f1_b", wireframe("list", o), { x: 1500, y: 200, containerId: "grp_w" });
    c.put("f1_v", wireframe("list", o), { x: 1500, y: 2112, containerId: "grp_w" });
    expect(rowStartIn(c.canvas(), "grp_w")).toEqual({ x: 1024, y: 2112 + 844 + 160, chosen: true });
    const { first, canvas } = await startFlow(c.port, "Acme lending side", { x: 948, y: 180, chosen: true, containerId: "grp_w", groupPlacement: "auto" });
    const add = c.sent[0]!.op as Extract<Operation, { type: "item.add" }>;
    expect(add).toMatchObject({ containerId: "grp_w", groupPlacement: "exact", placement: { x: 1024, y: 3116, chosen: true } });
    expect(first.containerId).toBe("grp_w");
    expect(canvas.into).toEqual({ containerId: "grp_w", groupPlacement: "exact" });
    // The rest of the row goes where the row computes it, in the group, exactly.
    await canvas.add(wireframe("detail", { ...o, flow: first.spec.flow }), { x: first.x + first.width + 80, y: first.y, chosen: true });
    expect(c.sent[1]!.op).toMatchObject({ containerId: "grp_w", groupPlacement: "exact", placement: { y: 3116 } });
  });

  it("--at inside a group is still exactly where it was asked", async () => {
    const c = fakeCanvas();
    c.items.grp_w = groupItem("grp_w", { x: 0, y: 0, width: 3000, height: 3000 });
    await startFlow(c.port, "Acme", { x: 40, y: 50, chosen: true, containerId: "grp_w", groupPlacement: "exact" });
    expect(c.sent[0]!.op).toMatchObject({ containerId: "grp_w", groupPlacement: "exact", placement: { x: 40, y: 50 } });
  });
});

describe("D2, D6 · variations and prototypes land inside the flow's group", () => {
  it("a screen's variations join its group (Porchlight #2)", async () => {
    const c = fakeCanvas();
    c.items.grp_w = groupItem("grp_w", { x: 0, y: 0, width: 3000, height: 3000 });
    // Home as Jev actually answered it (the recorded flow vary.test.ts replays): decisions with runners-up.
    const decided = recordedHome();
    c.put("it_home", decided, { x: 100, y: 100, containerId: "grp_w" });
    const [screen] = await wiresOn(c.port, c.canvas());
    expect(screen!.containerId).toBe("grp_w");
    // A plain FlowCanvas, as `wire vary` makes one: no group of its own — the screen's is used.
    const made = await addVariations(new FlowCanvas(c.port, "grp_vary"), screen!, [], 3);
    expect(made.length).toBeGreaterThan(0);
    for (const s of c.sent.filter((x) => x.op.type === "item.add")) expect(s.op).toMatchObject({ containerId: "grp_w", groupPlacement: "exact" });
    expect(made.every((v) => v.containerId === "grp_w")).toBe(true);
  });

  it("a flow's prototype joins the group its kept screens share (Porchlight #6), and none when they do not", async () => {
    const c = fakeCanvas();
    c.items.grp_w = groupItem("grp_w", { x: 0, y: 0, width: 3000, height: 3000 });
    c.put("it_a", wireframe("sign-in", o), { x: 0, y: 100, containerId: "grp_w", properties: { wireKeep: "yes" } });
    c.put("it_b", wireframe("home", o), { x: 500, y: 100, containerId: "grp_w", properties: { wireKeep: "yes" } });
    const flows = keptFlowsOf(c.canvas(), await wiresOn(c.port, c.canvas()));
    await writePrototype(c.port, c.canvas(), flows[0]!, "grp_proto");
    expect(c.sent[0]!.op).toMatchObject({ type: "item.add", containerId: "grp_w", groupPlacement: "exact", properties: { [PROTOTYPE_PROP]: "flw_acme" } });

    const d = fakeCanvas();
    d.put("it_a", wireframe("sign-in", o), { x: 0, y: 100, properties: { wireKeep: "yes" } });
    d.put("it_b", wireframe("home", o), { x: 500, y: 100, properties: { wireKeep: "yes" } });
    await writePrototype(d.port, d.canvas(), keptFlowsOf(d.canvas(), await wiresOn(d.port, d.canvas()))[0]!, "g");
    expect(d.sent[0]!.op).not.toHaveProperty("containerId");
  });
});

describe("D4 · two overrides on one screen at once both survive (Porchlight #4)", () => {
  const actor = { id: "usr_ada", name: "Ada" };
  let seq = 0;
  const run = (state: CanvasState | null, op: Operation): CanvasState =>
    applyOperation(state, { id: `op_${++seq}`, canvasId: state ? "prj_1" : null, actor, ts: "2026-09-23T00:00:00.000Z", op } as never)!;
  const base = (properties: Record<string, string> = {}): CanvasState => {
    const s = run(null, { type: "project.create", canvasId: "prj_1", title: "Acme" } as Operation);
    return run(s, {
      type: "item.add", itemId: "itm_home", version: { id: "ver_1", blobHash: "h", mimeType: "text/html", filename: "home.html", size: 1 },
      width: 390, height: 844, placement: { x: 0, y: 0 }, title: "Home", properties: { fidelity: "wireframe", ...properties },
    } as Operation);
  };
  const update = (itemId: string, patch: ReturnType<typeof linkPatch>) => ({ type: "item.update", itemId, patch }) as Operation;

  it("each writer read the SAME screen before either wrote; applied in either order, the reducer keeps both keys", () => {
    for (const order of [[0, 1], [1, 0]]) {
      const stale = base();
      const item = stale.canvas.items.itm_home!;
      const patches = [linkPatch(item, "app-bar#action", "back"), linkPatch(item, "main.3#submit", "back")];
      let s = stale;
      for (const i of order) s = run(s, update("itm_home", patches[i]!));
      expect(overridesOf(s.canvas.items.itm_home!.properties)).toEqual({ "app-bar#action": "back", "main.3#submit": "back" });
    }
  });

  it("a screen still carrying the old JSON is folded into per-hotspot keys by whoever writes first — and a racing second writer folds the same", () => {
    const legacy = base({ wireLinks: JSON.stringify({ "nav#tab-3": "itm_profile", "main.3#row": "none" }) });
    const item = legacy.canvas.items.itm_home!;
    let s = run(legacy, update("itm_home", linkPatch(item, "app-bar#action", "back")));
    s = run(s, update("itm_home", linkPatch(item, "main.3#row", null)));
    const props = s.canvas.items.itm_home!.properties;
    expect(props.wireLinks).toBeUndefined();
    expect(overridesOf(props)).toEqual({ "nav#tab-3": "itm_profile", "app-bar#action": "back" });
  });

  it("setLinkOverride sends one item.update, and nothing when the hotspot already says that", async () => {
    const sent: Operation[] = [];
    const port = { send: async (op: Operation) => void sent.push(op) };
    const item = { id: "itm_home", properties: { "wireLink:main.3#row": "none" } };
    expect(await setLinkOverride(port, item, "main.3#row", "none", "g")).toEqual({ overrides: { "main.3#row": "none" }, wrote: false });
    expect(sent).toEqual([]);
    expect((await setLinkOverride(port, item, "main.3#row", "itm_detail", "g")).wrote).toBe(true);
    expect(sent).toEqual([{ type: "item.update", itemId: "itm_home", patch: { properties: { "wireLink:main.3#row": "itm_detail" } } }]);
  });
});

describe("D5 · a link to a screen kept in another flow resolves (Porchlight #5)", () => {
  it("the other flow's screen joins this flow as a guest, so the link has somewhere to go", async () => {
    const c = fakeCanvas();
    c.put("it_home", wireframe("home", o), { x: 0, y: 0, properties: { wireKeep: "yes", "wireLink:nav#tab-3": "it_profile" } });
    c.put("it_list", wireframe("list", o), { x: 500, y: 0, properties: { wireKeep: "yes" } });
    c.put("it_profile", wireframe("profile", { request: "Acme lending", flow: "flw_lend" }), { x: 0, y: 2000, properties: { wireKeep: "yes" } });
    const flows = keptFlowsOf(c.canvas(), await wiresOn(c.port, c.canvas()));
    const acme = flows.find((f) => f.flow === "flw_acme")!;
    expect(acme.guests).toEqual(["it_profile"]);
    expect(inferLinks(acme.screens).find((l) => l.from === "it_home" && l.key === "nav#tab-3")).toMatchObject({ to: "it_profile", rule: "override" });
    // The other flow is its own, without guests.
    expect(flows.find((f) => f.flow === "flw_lend")!.guests).toEqual([]);
  });
});

describe("D8 · text links never read below 4.5:1 on the ground (Porchlight #8)", () => {
  it("a light primary on a light ground draws its words in the ink; a dark one keeps the primary", () => {
    // An amber on cream: the pair `design check` flags (~2:1).
    expect(contrastRatio("#f2a33a", "#fff8ec")!).toBeLessThan(4.5);
    expect(linkColor({ primary: "#f2a33a", ground: "#fff8ec", ink: "#2b2118" })).toBe("#2b2118");
    expect(linkColor({ primary: "#1f5fbf", ground: "#ffffff", ink: "#111111" })).toBe("#1f5fbf");
    expect(themeCss(undefined)).toContain(`--w-link:${DEFAULT_THEME.primary}`);
  });

  it("links, tertiary and secondary labels and the on-tab draw in the link role, never the raw primary", () => {
    for (const rule of [".lnk{color:var(--w-link)", ".btn.tertiary{background:transparent;border-color:transparent;color:var(--w-link)", ".btn.secondary{background:var(--w-ground);color:var(--w-link)}", ".tab.on{color:var(--w-link)}"]) {
      expect(__WIRE_CSS).toContain(rule);
    }
    const amber: WireStyle = { source: "design-system", itemId: "itm_design", versionId: "v1", roles: { primary: { token: "amber", value: "#f2a33a", why: "asked", p: 0.9 }, ground: { token: "cream", value: "#fff8ec", why: "asked", p: 0.9 }, ink: { token: "ink", value: "#2b2118", why: "asked", p: 0.9 } } };
    expect(themeCss(amber)).toContain("--w-link:#2b2118");
  });
});

describe("D9 · a restyle that changes nothing visible writes nothing (Porchlight #9)", () => {
  const roles = { primary: { token: "brand", value: "#d10a72", why: "asked" as const, p: 0.9 } };
  const v2: WireStyle = { source: "design-system", itemId: "itm_design", versionId: "ver_2", roles };
  const v3: WireStyle = { source: "design-system", itemId: "itm_design", versionId: "ver_3", roles: { primary: { ...roles.primary, p: 0.93 } } };

  it("a new version of the system that maps every role to the same value is the same look", () => {
    expect(alreadyLooks(v2, v3)).toBe(true);
    expect(alreadyLooks(v2, { ...v3, roles: { primary: { token: "brand", value: "#b0085f", why: "asked" } } })).toBe(false);
    // Another system with the same values is a different record, and is written.
    expect(alreadyLooks(v2, { ...v3, itemId: "itm_other" })).toBe(false);
    expect(alreadyLooks(undefined, { source: "default" })).toBe(true);
  });

  it("restyle over forty-eight wires drawn in v2, with v3 mapping the same: zero versions", async () => {
    const c = fakeCanvas();
    for (let i = 0; i < 48; i++) {
      const spec = { ...wireframe(i % 2 ? "home" : "list", o), style: v2 };
      c.put(`it_${i}`, spec, { x: i * 400, y: 0 });
    }
    const resolver = { styleFor: async () => v3 } as unknown as StyleResolver;
    const all = await wiresOn(c.port, c.canvas());
    const r = await restyle(c.port, c.canvas(), all, all, resolver);
    expect(r.changed).toEqual([]);
    expect(c.sent).toEqual([]);
  });
});

// D7 (a design system moved into a group says what it now governs) is the CLI's: packages/cli/test/design-scope-notes.test.ts.

describe("the blueprint is untouched by all of it", () => {
  it("a blueprint still reads back its spec and draws no strip", () => {
    const html = renderWire(blueprint("home", o));
    expect(readWire(html)!.archetype).toBe("home");
    expect(html).not.toMatch(/class="cap/);
  });
});
