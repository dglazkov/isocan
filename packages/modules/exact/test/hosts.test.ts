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
import type { CanvasContents, Item, LogEntry } from "@isocan/core";
import * as record from "../src/core.ts";
import { bindCore } from "../src/core-ref.ts";

bindCore(record);
import { planFindings } from "../src/findings.ts";
import { parseDriveRequest, pendingDrives } from "../src/drives.ts";
import { compareFindings, driveLine, driveTarget, inversions, nativeOffset, nativeSize, parseHosts, parseWall, typesInto, wallCells, wallText, type CompareReport } from "../src/hosts.ts";
import { mapLayout, rowOffset } from "../src/map.ts";

/**
 * What the bridge printed for Acme Market grown for exact phase 3 — a cart
 * with one item, whose Total row the native hosts draw ABOVE the items and
 * the web below (the planted difference: `app.ts`'s `whichEngine` answers
 * "hermes" under Hermes) — recorded 14 Nov 2026 against Exact cbe553f6: the
 * iOS (simulator, iPhone 17 Pro, iOS 26.0) and macOS captures' points, and
 * `compare`'s report for each.
 */
const fixture = JSON.parse(readFileSync(new URL("./fixtures/acme-market-hosts-2026-11-14.json", import.meta.url), "utf8")) as {
  compare: CompareReport;
  natives: Array<{ route: string; host: "ios" | "macos"; points: record.CapturePoints }>;
  sources: Record<string, string>;
};

describe("hosts", () => {
  it("takes web, ios and macos, and refuses anything else by name", () => {
    expect(parseHosts(undefined)).toEqual(["web"]);
    expect(parseHosts("web,ios,macos,ios")).toEqual(["web", "ios", "macos"]);
    expect(() => parseHosts("web,android")).toThrow(/android/);
  });

  it("finds a screen by its host, the web's by default", () => {
    const item = (id: string, host?: string) => ({ id, properties: { "exact.app": JSON.stringify({ id: "a" }), "exact.route": "cart", ...(host ? { "exact.host": host } : {}) } });
    const canvas = { items: { w: item("w"), i: item("i", "ios") } } as unknown as CanvasContents;
    expect(record.screenItemOf(canvas, "a", "cart")?.id).toBe("w");
    expect(record.screenItemOf(canvas, "a", "cart", "phone", "light", "ios")?.id).toBe("i");
    expect(record.screenItemOf(canvas, "a", "cart", "phone", "light", "macos")).toBeNull();
  });

  it("widens a map's cells only when it carries native columns", () => {
    const routes = [{ name: "a", parent: null }, { name: "b", parent: null }] as unknown as Parameters<typeof mapLayout>[0];
    expect(mapLayout(routes).get("b")!.x).toBeLessThan(mapLayout(routes, 200).get("b")!.x);
    expect(mapLayout(routes, 0).get("b")).toEqual(mapLayout(routes).get("b"));
  });

  it("puts the native column past the web's device row, light above dark", () => {
    const desktopDark = rowOffset("desktop", "dark");
    const ios = nativeOffset("ios", "light");
    const mac = nativeOffset("macos", "dark");
    expect(ios.x).toBeGreaterThan(desktopDark.x);
    expect(mac.x).toBeGreaterThan(ios.x + nativeSize("ios", null).width);
    expect(mac.y).toBe(desktopDark.y);
    expect(nativeSize("ios", { width: 402, height: 874 })).toEqual({ width: 74, height: 160 });
  });
});

describe("a difference between hosts", () => {
  it("is the app's own order, not the platform's bars", () => {
    for (const c of fixture.compare.compares) {
      // Pixels always differ: a status bar, UIKit's bars, a window's.
      expect(c.compare!.match).toBeLessThan(1);
      expect(c.compare!.regions.length).toBeGreaterThan(0);
    }
    const ios = fixture.natives.find((n) => n.host === "ios" && n.route === "cart")!;
    const web = fixture.compare.compares.find((c) => c.host === "ios" && c.route === "cart")!.web!;
    const found = inversions(web, ios.points);
    expect(found.map((v) => [v.above.testId, v.below.testId])).toEqual([["cart-total", "cart-2"]]);
    // The same screen against itself is no difference at all.
    expect(inversions(ios.points, ios.points)).toEqual([]);
  });

  it("becomes one finding per moved node on each native host, at the line that draws it", () => {
    const findings = compareFindings(fixture.compare, fixture.natives, fixture.sources);
    expect(findings.map((f) => f.key).sort()).toEqual(["compare:cart:ios:cart-total", "compare:cart:macos:cart-total"]);
    // Without the source, the tab bar — UIKit's on iOS, a strip on macOS, placed by width on the web — reads as moved.
    expect(compareFindings(fixture.compare, fixture.natives).some((f) => /tab-places/.test(f.body))).toBe(true);
    const ios = findings.find((f) => f.key === "compare:cart:ios:cart-total")!;
    expect(ios.body).toMatch(/^iOS and the web lay out cart differently, beyond each platform's own bars: `cart-total` is above `cart-2` on iOS, and below it on the web\./);
    expect(ios.body).toContain("`screenshot compare`");
    const src = record.parseSource(ios.body)!;
    expect(src.file).toBe("app.contract");
    expect(record.diagnosticKey(ios.body)).toBe("compare:cart:ios:cart-total");
    expect(ios.anchor).toMatchObject({ host: "ios", device: "phone" });
  });

  it("is pinned to the native screen, and goes when the hosts agree", () => {
    const findings = compareFindings(fixture.compare, fixture.natives, fixture.sources);
    const screen = (id: string, host: string, device: string): Item => ({
      id, title: id, x: 0, y: 0, width: 74, height: 160, currentVersionId: "v", versions: [{ id: "v", blobHash: "h", mimeType: "image/png" }],
      properties: { "exact.app": JSON.stringify({ id: "dev.acme.market" }), "exact.route": "cart", "exact.host": host, "exact.device": device, "exact.scheme": "light" },
    }) as unknown as Item;
    const canvas = { items: { a: screen("a", "web", "phone"), b: screen("b", "ios", "phone"), c: screen("c", "macos", "desktop") }, threads: {} } as unknown as CanvasContents;
    const plan = planFindings(canvas, { app: { id: "dev.acme.market", name: "Acme Market" } }, findings, () => true);
    expect(plan.create.map((c) => c.item.id).sort()).toEqual(["b", "c"]);
    const thread = { id: "thr", anchorItemId: "b", comments: [{ id: "c1", body: findings.find((f) => f.key.includes(":ios:"))!.body }] };
    const after = { ...canvas, threads: { thr: thread } } as unknown as CanvasContents;
    const agreed = planFindings(after, { app: { id: "dev.acme.market", name: "Acme Market" } }, [], (k) => k.startsWith("compare:cart:ios:"));
    expect(agreed.remove.map((r) => r.key)).toEqual(["compare:cart:ios:cart-total"]);
  });
});

describe("Drive mode", () => {
  it("sends a closed list: tap and type by testId, and back", () => {
    expect(driveLine({ op: "tap", testId: "add-to-cart" })).toBe("tap add-to-cart");
    expect(driveLine({ op: "type", testId: "buyer-name", text: "Sam \"S\"" })).toBe('type buyer-name "Sam \\"S\\""');
    expect(driveLine({ op: "back" })).toBe("back");
    expect(() => driveLine({ op: "tap", testId: "a b" })).toThrow(/testId/);
    expect(() => driveLine({ op: "tap", testId: "x\nscreenshot /etc/passwd" })).toThrow();
    expect(() => driveLine({ op: "type", testId: "buyer-name", text: "two\nlines" })).toThrow(/one line/);
  });

  it("presses the smallest named node under the press, as a finger would", () => {
    const ios = fixture.natives.find((n) => n.host === "ios" && n.route === "cart")!.points;
    const checkout = ios.nodes.find((n) => n.testId === "checkout")!;
    const hit = driveTarget(ios, checkout.x + checkout.w / 2, checkout.y + checkout.h / 2);
    expect(hit?.testId).toBe("checkout");
    // The router's root is everywhere, so it is never what a press means.
    expect(driveTarget({ files: {}, nodes: [{ x: 0, y: 0, w: 400, h: 800, type: "View", testId: "app", file: "app.contract", line: 1, col: 1, component: null, chain: [] }] }, 10, 10)).toBeNull();
    expect(typesInto({ type: "TextField" })).toBe(true);
    expect(typesInto({ type: "Control" })).toBe(false);
  });
});

describe("the device wall", () => {
  it("gathers one route on every host and device, web first, and reads back as a file", () => {
    const png = (id: string, host: string, device: string, scheme = "light"): Item => ({
      id, title: id, x: 0, y: 0, width: 10, height: 10, currentVersionId: "v", versions: [{ id: "v", blobHash: `h-${id}`, mimeType: "image/png" }],
      properties: { "exact.app": JSON.stringify({ id: "dev.acme.market" }), "exact.route": "cart", "exact.host": host, "exact.device": device, "exact.scheme": scheme, "exact.url": "/place/2", "exact.reached": 'at "/place/2"\ntap add-to-cart\ntap open-cart' },
    }) as unknown as Item;
    const canvas = { items: { m: png("m", "macos", "desktop"), i: png("i", "ios", "phone"), d: png("d", "web", "desktop"), p: png("p", "web", "phone"), t: png("t", "web", "tablet"), x: png("x", "web", "phone", "dark") } } as unknown as CanvasContents;
    const cells = wallCells(canvas, "dev.acme.market", "cart");
    expect(cells.map((c) => `${c.host}-${c.device}`)).toEqual(["web-phone", "web-tablet", "web-desktop", "ios-phone", "macos-desktop"]);
    expect(cells[3]!.shots).toContain("tap open-cart");
    const wall = { format: 1 as const, app: { id: "dev.acme.market", name: "Acme Market" }, route: "cart", scheme: "light" as const, cells };
    expect(parseWall(wallText(wall))).toEqual(wall);
    expect(() => parseWall("{}")).toThrow(/device wall/);
  });
});

describe("Drive mode over the canvas", () => {
  const screen = (props: Record<string, string>): Item => ({ id: "s", title: "s", properties: { "exact.app": JSON.stringify({ id: "dev.acme.market" }), ...props } }) as unknown as Item;
  const wrote = (seq: number, props: Record<string, unknown>) => ({ seq, envelope: { op: { type: "item.update", itemId: "s", patch: { properties: props } } } }) as unknown as LogEntry;
  const request = JSON.stringify({ seq: 5, by: "Sam", host: "ios", size: "390x844", scheme: "light", shots: 'at "/place/1"', ops: ["tap add-to-cart"] });

  it("answers the drive a screen holds, once, from the op log", () => {
    const canvas = { items: { s: screen({ "exact.drive": request }) } } as unknown as CanvasContents;
    const pending = pendingDrives([wrote(1, { "exact.drive": request })], canvas, "dev.acme.market");
    expect(pending.map((p) => p.request)).toEqual([{ seq: 5, by: "Sam", host: "ios", size: "390x844", scheme: "light", shots: 'at "/place/1"', ops: ["tap add-to-cart"] }]);
    const answered = { items: { s: screen({ "exact.drive": request, "exact.driven": JSON.stringify({ seq: 5, ok: true }) }) } } as unknown as CanvasContents;
    expect(pendingDrives([wrote(1, { "exact.drive": request })], answered, "dev.acme.market")).toEqual([]);
    // Its own answer is not a request; another app's screen is not ours.
    expect(pendingDrives([wrote(2, { "exact.driven": "{}" })], canvas, "dev.acme.market")).toEqual([]);
    expect(pendingDrives([wrote(1, { "exact.drive": request })], canvas, "dev.other")).toEqual([]);
    expect(parseDriveRequest('{"seq":1,"host":"ios","shots":"x","ops":[1]}')).toBeNull();
  });
});
