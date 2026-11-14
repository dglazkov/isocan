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
import {
  CAPTURE_AT,
  EXACT_INDEX_MIME,
  EXACT_PROPS,
  buildIndex,
  checkRoutes,
  contractRoutes,
  exactModule,
  indexText,
  parseIndex,
  parseParams,
  routeLocation,
  screenItemOf,
  screenProperties,
  type Readings,
} from "../src/core.ts";

/**
 * The readings `scripts/exact-bridge.mjs read` printed for a synthetic Acme
 * Market (`exact new` + `exact pattern tabs`), recorded 13 Nov 2026 against
 * Exact cbe553f6 (design §14: every interface read has a dated fixture).
 */
const fixture = JSON.parse(readFileSync(new URL("./fixtures/acme-market-2026-11-13.json", import.meta.url), "utf8")) as {
  recorded: string;
  exact: { commit: string };
  readings: Readings;
};
const readings = fixture.readings;

describe("the index, from Contract", () => {
  it("is stamped with the Exact commit it was read from", () => {
    expect(fixture.recorded).toBe("2026-11-13");
    expect(fixture.exact.commit).toMatch(/^cbe553f6/);
    expect(buildIndex(readings).exact.commit).toBe(fixture.exact.commit);
  });

  it("reads each route's pattern, tab and parent from the declaration symbols points at", () => {
    const { router, routes } = contractRoutes(readings.symbols, readings.sources);
    expect(router).toBe("nav");
    expect(routes.map((r) => [r.name, r.pattern, r.tab, r.parent, r.inTab, r.params])).toEqual([
      ["places", "/", true, null, "places", []],
      ["place", "/place/:id", false, "places", "places", ["id"]],
      ["saved", "/saved", true, null, "saved", []],
      ["savedPlace", "/saved/:id", false, "saved", "saved", ["id"]],
    ]);
  });

  it("agrees with routes.json — which it is checked against, never copied from", () => {
    const index = buildIndex(readings);
    expect(index.routesJson).toEqual({ equal: true, onlyContract: [], onlyRoutesJson: [] });
    // The proof would be a facade if the routes came from routes.json: with
    // routes.json emptied, the index still has every route, and says the two disagree.
    const blind = buildIndex({ ...readings, routesJson: { routes: [] } });
    expect(blind.routes.map((r) => r.name)).toEqual(["places", "place", "saved", "savedPlace"]);
    expect(blind.routesJson.equal).toBe(false);
    expect(blind.routesJson.onlyContract).toHaveLength(4);
  });

  it("names what only one side has", () => {
    const { routes } = contractRoutes(readings.symbols, readings.sources);
    const check = checkRoutes(routes, { routes: [...readings.routesJson.routes.filter((r) => r.name !== "saved"), { name: "cart", pattern: "/cart" }] });
    expect(check.equal).toBe(false);
    expect(check.onlyContract).toEqual([{ name: "saved", pattern: "/saved" }]);
    expect(check.onlyRoutesJson).toEqual([{ name: "cart", pattern: "/cart" }]);
  });

  it("refuses a declaration line that does not read as a route, rather than guessing", () => {
    const moved = { "app.contract": readings.sources["app.contract"]!.replace('  tab saved "/saved"', "  // saved moved") };
    expect(() => contractRoutes(readings.symbols, moved)).toThrow(/app\.contract:11 should declare route saved/);
  });

  it("carries the app's own components, actions and sources, not a package's", () => {
    const index = buildIndex(readings);
    expect(index.components).toEqual(["App"]);
    expect(index.actions.map((a) => a.name)).toEqual(["pick", "follow", "search", "toggle"]);
    expect(index.actions.find((a) => a.name === "pick")?.writes).toEqual(["nav"]);
    expect(index.sources).toEqual(["loadPlaces"]);
  });

  it("is the same bytes for the same readings, so a second open posts no new version", () => {
    expect(indexText(buildIndex(readings))).toBe(indexText(buildIndex(JSON.parse(JSON.stringify(readings)) as Readings)));
    expect(parseIndex(indexText(buildIndex(readings))).routes).toHaveLength(4);
    expect(() => parseIndex('{"format": 99, "routes": []}')).toThrow(/not an Exact index/);
  });
});

describe("screens", () => {
  it("open a route with its parameters filled, 1 unless named", () => {
    expect(routeLocation({ pattern: "/place/:id", params: ["id"] })).toBe("/place/1");
    expect(routeLocation({ pattern: "/place/:id", params: ["id"] }, { id: "2" })).toBe("/place/2");
    expect(routeLocation({ pattern: "/a/:x/b/:y", params: ["x", "y"] }, { y: "a b" })).toBe("/a/1/b/a%20b");
    expect(parseParams(["id=2", "slug=x=y"])).toEqual({ id: "2", slug: "x=y" });
    expect(() => parseParams(["id"])).toThrow(/name=value/);
  });

  it("wear the facts they were captured under, namespaced", () => {
    const index = buildIndex(readings);
    const props = screenProperties(index, index.routes[1]!, "/place/1");
    expect(props).toEqual({
      "exact.app": JSON.stringify({ id: "dev.acme.market" }),
      "exact.route": "place",
      "exact.host": "web",
      "exact.device": "phone",
      "exact.scheme": "light",
      "exact.plan": index.plan,
      "exact.at": JSON.stringify(CAPTURE_AT),
      "exact.url": "/place/1",
    });
    for (const key of Object.keys(props)) expect(exactModule.propertyKeys).toContain(key);
    const item = { id: "itm_1", properties: props } as unknown as Parameters<typeof screenItemOf>[0]["items"][string];
    expect(screenItemOf({ items: { itm_1: item } } as unknown as Parameters<typeof screenItemOf>[0], "dev.acme.market", "place")?.id).toBe("itm_1");
    expect(screenItemOf({ items: { itm_1: item } } as unknown as Parameters<typeof screenItemOf>[0], "dev.acme.market", "places")).toBeNull();
  });

  it("the module owns its index kind and every key it writes", () => {
    expect(exactModule.kinds?.[0]?.mimes).toEqual([EXACT_INDEX_MIME]);
    expect(Object.values(EXACT_PROPS).every((k) => k.startsWith("exact."))).toBe(true);
  });
});

describe("the module never spawns", () => {
  it("leaves running Exact to the package script, as motion does", () => {
    for (const file of ["core.ts", "cli.ts", "web.tsx"]) {
      const src = readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");
      expect(src, file).not.toMatch(/node:child_process|node:worker_threads|node:vm|\beval\(/);
    }
    expect(readFileSync(new URL("../src/cli.ts", import.meta.url), "utf8")).toContain('runPackageScript("scripts/exact-bridge.mjs"');
  });
});
