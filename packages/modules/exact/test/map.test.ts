/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isDesignSystem, parseDesign, registerModule, toJsonCanvas, type CanvasContents, type Item } from "@isocan/core";
import {
  EXACT_ANATOMY_MIME,
  EXACT_INDEX_MIME,
  EXACT_PROPS,
  anatomyText,
  exactModule,
  indexSummary,
  indexText,
  mapEdges,
  parseAnatomy,
  parseIndex,
  screenProperties,
  type Readings,
} from "../src/core.ts";
import { buildIndex, captureKeyParts, designItemProperties, designMarkdown } from "../src/build.ts";
import * as record from "../src/core.ts";
import { bindCore } from "../src/core-ref.ts";

bindCore(record);
import { DEVICES, flowEdges, mapLayout, parseShots, routeCondition, rowOffset, screensAt, verbAt } from "../src/map.ts";

/**
 * The readings `scripts/exact-bridge.mjs read` printed for the grown Acme
 * Market (exact phase 1): a ShippingNote drawn on the places list and a
 * place's page only, a Browse button on the empty Saved tab whose action
 * pushes savedPlace, three Tamber tokens and the test file compiled.
 * Recorded 13 Nov 2026 against Exact cbe553f6.
 */
const fixture = JSON.parse(readFileSync(new URL("./fixtures/acme-market-map-2026-11-13.json", import.meta.url), "utf8")) as {
  recorded: string;
  exact: { commit: string };
  readings: Readings;
};
const readings = fixture.readings;
const index = buildIndex(readings);

describe("what contract symbols says about navigation (design §16 question 3)", () => {
  it("names a path()'s target route, at the route name's column, and not the verb or the action", () => {
    const refs = (readings.symbols as { references: Array<{ kind: string; name: string; line: number; col: number }> }).references;
    const targets = refs.filter((r) => r.kind === "route");
    expect(targets.map((r) => r.name).sort()).toEqual(["place", "savedPlace", "savedPlace"]);
    const source = readings.sources["app.contract"]!.split("\n");
    for (const r of targets) expect(source[r.line - 1]!.slice(r.col - 1, r.col - 1 + r.name.length + 2)).toBe(`"${r.name}"`);
    // No reference names push/select/back — they are builtins.
    expect(refs.some((r) => ["push", "select", "back", "replace"].includes(r.name))).toBe(false);
  });

  it("so the verb is read off the text left of the reference", () => {
    expect(verbAt(`    nav = push(nav, path("recipe", name))`, 26)).toBe("push");
    const both = `    nav = top(nav).name == "recipe" ? replace(nav, path("recipe", name)) : push(nav, path("recipe", name))`;
    expect(verbAt(both, both.indexOf('"recipe"', 50) + 1)).toBe("replace");
    expect(verbAt(both, both.lastIndexOf('"recipe"') + 1)).toBe("push");
    expect(verbAt(`  link href=path("place", p.id)`, 19)).toBe("link");
    expect(verbAt(`  state at = path("place", "1")`, 19)).toBe("path");
  });
});

describe("the flow map's arrows", () => {
  it("are every route the router can reach, from the screen it is drawn on", () => {
    expect(index.edges.map((e) => `${e.from} ${e.verb}${e.action ? `(${e.action})` : ""} ${e.to} ${e.via}`)).toEqual([
      "saved push(browse) savedPlace condition",
      "saved link savedPlace condition",
      "places link place condition",
      "place back places stack",
      "savedPlace back saved stack",
      "places select(pick) saved tabs",
      "saved select(pick) places tabs",
    ]);
    expect(index.unplaced).toEqual([expect.objectContaining({ verb: "go", action: "follow" })]);
  });

  it("read the screen from the source, never from the route names alone", () => {
    // Swap the ternary's test: the links now leave from the other tab — a
    // facade that paired targets with the nearest tab by name would not move.
    const swapped = readings.sources["app.contract"]!.replace('e.name == "saved" ? path("savedPlace", p.id) : path("place", p.id)', 'e.name == "places" ? path("savedPlace", p.id) : path("place", p.id)');
    expect(swapped).not.toBe(readings.sources["app.contract"]);
    const moved = flowEdges(readings.symbols, { "app.contract": swapped }, index.routes, index.router).edges.filter((e) => e.verb === "link");
    expect(moved.map((e) => `${e.from}→${e.to}`).sort()).toEqual(["places→savedPlace", "saved→place"]);
  });

  it("read if / else if / else chains, impure tests narrowing and pure ones excluding", () => {
    const src = [
      "component App",
      "  view",
      "    for e in stack(nav) key=e.id",
      '      if e.name == "saved" and empty',
      "        A",
      '      else if e.name == "a" or e.name == "saved"',
      "        B",
      "      else",
      "        C",
      '          D (e.name == "a" ? x : y)',
    ];
    const r = new Set(["a", "b", "saved"]);
    expect([...screensAt(src, 5, 9, r)!]).toEqual(["saved"]);
    expect([...screensAt(src, 7, 9, r)!].sort()).toEqual(["a", "saved"]);
    expect([...screensAt(src, 9, 9, r)!]).toEqual(["b"]);
    expect([...screensAt(src, 10, src[9]!.indexOf("x") + 1, r)!]).toEqual([]);
    expect([...screensAt(src, 10, src[9]!.indexOf("y") + 1, r)!]).toEqual(["b"]);
    expect(screensAt(src, 3, 5, r)).toBeNull();
    expect(routeCondition('(e.name == "a" or top(nav).name == "b")', r)).toEqual({ set: new Set(["a", "b"]), pure: true });
    expect(routeCondition('e.name == "zzz"', r)).toEqual({ set: null, pure: false });
  });

  it("place a push in an action by where the action is called, and fall back to the stack when nothing says", () => {
    const src = [
      "routes nav",
      '  recipes "/"',
      '    recipe "/recipe/:name"',
      "",
      "component App",
      "  action open(name: string)",
      '    nav = push(nav, path("recipe", name))',
      "  view",
      "    main",
      "      button press=open(\"Ramen\")",
    ].join("\n");
    const symbols = {
      definitions: [
        { name: "recipes", kind: "route", file: "app.contract", line: 2, col: 3 },
        { name: "recipe", kind: "route", file: "app.contract", line: 3, col: 5 },
        { name: "open", kind: "action", file: "app.contract", line: 6, col: 10, component: "App", writes: ["nav"] },
      ],
      references: [
        { name: "recipe", kind: "route", file: "app.contract", line: 7, col: 26 },
        { name: "open", kind: "action", file: "app.contract", line: 10, col: 20 },
      ],
    };
    const routesOf = [
      { name: "recipes", pattern: "/", tab: false, parent: null, inTab: null, params: [], file: "app.contract", line: 2 },
      { name: "recipe", pattern: "/recipe/:name", tab: false, parent: "recipes", inTab: null, params: ["name"], file: "app.contract", line: 3 },
    ];
    const { edges } = flowEdges(symbols, { "app.contract": src }, routesOf, "nav");
    expect(edges).toEqual([
      { from: "recipes", to: "recipe", verb: "push", action: "open", file: "app.contract", line: 7, via: "stack" },
      { from: "recipe", to: "recipes", verb: "back", action: null, file: "app.contract", line: 3, via: "stack" },
    ]);
  });
});

describe("the anatomy, per Contract file", () => {
  it("says what each component holds, draws and writes, and what each test file tests", () => {
    const app = index.anatomy.find((a) => a.file === "app.contract")!;
    expect(app.routes).toEqual(["places", "place", "saved", "savedPlace"]);
    expect(app.components.map((c) => c.name)).toEqual(["App", "ShippingNote"]);
    const App = app.components[0]!;
    expect(App.state).toEqual(["saved", "placesQuery", "savedQuery"]);
    expect(App.uses).toEqual(["ShippingNote"]);
    expect(App.actions).toContainEqual({ name: "browse", writes: ["nav"] });
    expect(app.shapes).toEqual([{ name: "Place", fields: ["id", "name", "area", "about"] }]);
    expect(app.sources).toEqual(["loadPlaces"]);
    const tests = index.anatomy.find((a) => a.file === "app.test.contract")!;
    expect(tests.tests.map((t) => t.name)).toEqual([
      "each tab keeps its own stack",
      "a saved place shows under Saved, and stays saved after a relaunch",
      "each tab's search filters its own list as you type",
    ]);
    expect(index.grants).toBe("");
    const card = parseAnatomy(anatomyText(index, app));
    expect(card.entry).toEqual(app);
    expect(card.app.id).toBe("dev.acme.market");
  });
});

describe("app.tamber as the canvas's design system", () => {
  it("is a DESIGN.md isocan reads, each token with its two values and where it is used", () => {
    const md = designMarkdown(index)!;
    const doc = parseDesign(md);
    expect(doc.problems).toEqual([]);
    expect(doc.tokens.colors).toEqual({ "brand.ink": "#1b4d3e", "note.ink": "#5b6b62" });
    expect(md).toContain("| `note.ink` | color | #5b6b62 | #a8b8ae | app.contract:110 (ShippingNote) |");
    expect(md).toContain("| `space.note` | number | 4 | 4 | not used |");
    const props = designItemProperties(index);
    expect(isDesignSystem({ properties: props } as unknown as Item)).toBe(true);
    expect(props[EXACT_PROPS.tamber]).toBe(readings.design!.ir.digest);
  });

  it("is absent for an app with no design", () => {
    expect(designMarkdown(buildIndex({ ...readings, design: null }))).toBeNull();
  });
});

describe("exact.shots", () => {
  it("is Exact's launch lines, a closed list", () => {
    expect(parseShots('at "/place/2"\nclock data\ntap places-2\n// a note\nfail fetch /api')).toEqual({ url: "/place/2", ops: ["clock data", "tap places-2", "fail fetch /api"] });
    expect(() => parseShots("tap x")).toThrow(/needs an `at/);
    expect(() => parseShots('at "/a"\nscreenshot /tmp/x.png')).toThrow(/not one of/);
    expect(() => parseShots('at "/a"\nprefer color-scheme dark')).toThrow(/colour scheme/);
    expect(() => parseShots('at "https://elsewhere.test/"')).toThrow(/own paths/);
    expect(() => parseShots('at "/../../etc"')).toThrow(/own paths/);
  });

  it("is checked by the same list in the bridge, where it reaches Exact", () => {
    const bridge = readFileSync(new URL("../../../../scripts/exact-bridge.mjs", import.meta.url), "utf8");
    const map = readFileSync(new URL("../src/map.ts", import.meta.url), "utf8");
    const list = (src: string, name: string) => new RegExp(`${name} = /\\^\\((.*?)\\)`).exec(src)?.[1];
    expect(list(bridge, "SHOT_OP")).toBe(list(map, "OP_LINE"));
    expect(bridge).toContain("color-scheme");
  });
});

describe("captures skip only when nothing they depend on moved", () => {
  it("keys on the app's inputs, the route, the device, the scheme and the shots", () => {
    const base = captureKeyParts(index, "places", "phone", "light", 'at "/"');
    expect(captureKeyParts(index, "places", "phone", "light", 'at "/"')).toBe(base);
    for (const other of [
      captureKeyParts({ ...index, inputs: "other" }, "places", "phone", "light", 'at "/"'),
      captureKeyParts(index, "place", "phone", "light", 'at "/"'),
      captureKeyParts(index, "places", "tablet", "light", 'at "/"'),
      captureKeyParts(index, "places", "phone", "dark", 'at "/"'),
      captureKeyParts(index, "places", "phone", "light", 'at "/saved"'),
    ]) expect(other).not.toBe(base);
  });
});

describe("the map on the canvas", () => {
  const item = (id: string, props: Record<string, string>, box: { x: number; y: number }, mime = "image/png"): Item => ({
    id, title: id, x: box.x, y: box.y, width: 195, height: 422, properties: props,
    versions: [{ id: `v_${id}`, blobHash: `h_${id}`, mimeType: mime, filename: `${id}.png`, size: 1 }], currentVersionId: `v_${id}`,
  } as unknown as Item);
  const canvasOf = (items: Item[]) => ({ items: Object.fromEntries(items.map((i) => [i.id, i])), threads: {} } as unknown as CanvasContents);
  const layout = mapLayout(index.routes);
  const screens = index.routes.map((r) => item(`s_${r.name}`, screenProperties(index, r, r.pattern), layout.get(r.name)!));
  const dark = item("s_places_dark", screenProperties(index, index.routes[0]!, "/", { scheme: "dark" }), { x: 0, y: 0 });

  it("lays tabs in a row and each push under the route it is declared under", () => {
    expect(layout.get("places")).toMatchObject({ x: 0, y: 0, depth: 0 });
    expect(layout.get("place")!.x).toBe(0);
    expect(layout.get("place")!.y).toBeGreaterThan(422);
    expect(layout.get("saved")!.y).toBe(0);
    expect(layout.get("saved")!.x).toBeGreaterThan(195 + rowOffset("desktop", "dark").x);
    expect(rowOffset("phone", "dark").y).toBeGreaterThan(rowOffset("phone", "light").y);
  });

  it("draws an arrow between phone screens for every edge, and none from the device row", () => {
    const edges = mapEdges(canvasOf([...screens, dark]));
    expect(edges.map((e) => `${e.from.id}>${e.to.id}:${e.verb}`).sort()).toEqual([
      "s_place>s_places:back",
      "s_places>s_place:link",
      "s_places>s_saved:select",
      "s_saved>s_places:select",
      "s_saved>s_savedPlace:link",
      "s_saved>s_savedPlace:push",
      "s_savedPlace>s_saved:back",
    ]);
    // A screen taken away takes its arrows with it.
    expect(mapEdges(canvasOf(screens.filter((s) => s.id !== "s_saved"))).map((e) => e.verb).sort()).toEqual(["back", "link"]);
  });

  it("exports the arrows as JSON Canvas edges", () => {
    registerModule(exactModule);
    const { file } = toJsonCanvas(canvasOf(screens));
    expect(file.edges.filter((e) => e.fromNode === "s_places" && e.toNode === "s_place")).toHaveLength(1);
    expect(file.edges.length).toBeGreaterThanOrEqual(6);
  });

  it("gives isocan context a row that answers what the app is", () => {
    const idx = item("idx", { [EXACT_PROPS.app]: JSON.stringify({ id: "dev.acme.market" }), [EXACT_PROPS.summary]: JSON.stringify(indexSummary(index)) }, { x: -500, y: 0 }, EXACT_INDEX_MIME);
    const rows = exactModule.contextPieces!(canvasOf([idx, ...screens]));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.name).toBe("Exact app: Acme Market");
    expect(rows[0]!.size).toContain("4 routes, 7 arrows, 4 screens");
    expect(rows[0]!.size).toContain("components App, ShippingNote");
    expect(rows[0]!.size).toContain("sources loadPlaces");
    expect(rows[0]!.size).toContain("3 design tokens");
    expect(rows[0]!.size).toContain("anatomy of app.contract, app.test.contract");
  });

  it("reads phase 0's index too, with the map's fields empty", () => {
    const old = JSON.parse(indexText(index)) as Record<string, unknown>;
    delete old.edges; delete old.anatomy; delete old.design;
    const read = parseIndex(JSON.stringify({ ...old, format: 1 }));
    expect(read.edges).toEqual([]);
    expect(read.anatomy).toEqual([]);
    expect(exactModule.kinds?.map((k) => k.mimes[0])).toEqual([EXACT_INDEX_MIME, EXACT_ANATOMY_MIME, record.EXACT_WALL_MIME, record.EXACT_STORY_MIME]);
    expect(Object.keys(DEVICES)).toEqual(["phone", "tablet", "desktop"]);
  });
});
