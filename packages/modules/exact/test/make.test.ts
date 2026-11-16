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
import { COLOUR_LITERAL, parseFlow, scaffold } from "../src/make.ts";

/**
 * Exact phase 9: Make it Exact. The flow is a recorded `isocan wire links
 * --json` (three wireframes: a list, a detail, a confirm, 15 Nov 2026); the
 * app is Acme Market's own text. That the scaffold builds and its test passes
 * on web and iOS is the walk's (`scratchpad/p9`); here, that it is the same
 * bytes every time, names no colour, wires what the arrows say, and refuses
 * an app it cannot wire rather than guessing.
 */

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const flow = parseFlow(fixture("wishlist-flow-2026-11-15.json"));
const target = { contract: fixture("acme-market-app-2026-11-15.contract.txt"), ts: fixture("acme-market-app-2026-11-15.ts.txt"), tokens: [{ name: "brand.ink", kind: "color" }, { name: "note.ink", kind: "color" }, { name: "space.note", kind: "number" }, { name: "radius.card", kind: "length" }] };

describe("Make it Exact (journey Scene 8)", () => {
  it("makes a route, a component and a test step per screen and arrow, the same bytes every time", () => {
    const a = scaffold(flow, target), b = scaffold(flow, target);
    expect(a).toEqual(b);
    expect(a.branch).toBe("exact/make-wishlist");
    expect(a.routes.map((r) => [r.name, r.pattern, r.tab])).toEqual([["wishlist", "/wishlist", true], ["wishedItem", "/wished-item/:id", false], ["addedToYourWishlist", "/added-to-your-wishlist", false]]);
    expect(a.arrows).toEqual(["Wishlist → Wished item (wishlist-1)", "Wished item → Added to your wishlist (wishlist-submit)"]);
    expect(Object.keys(a.files).sort()).toEqual(["app.contract", "app.ts", "wishlist.contract", "wishlist.test.contract"]);
  });

  it("draws with the app's tokens and roles, and names no colour of its own", () => {
    const own = scaffold(flow, target).files["wishlist.contract"]!;
    expect(COLOUR_LITERAL.test(own)).toBe(false);
    expect(own).toContain('color="brand.ink"');
    expect(own).toContain('border-radius="radius.card"');
    expect(own).toMatch(/^shape WishlistItem$/m);
    expect(COLOUR_LITERAL.test('background-color="#ff0000"')).toBe(true);
    expect(COLOUR_LITERAL.test('color="oklch(0.5 0.1 20)"')).toBe(true);
  });

  it("writes a test that taps each arrow's control and checks the stub's own row, so a scaffold that is not wired fails it", () => {
    const test = scaffold(flow, target).files["wishlist.test.contract"]!;
    expect(test.split("\n").filter((l) => l.startsWith("  tap "))).toEqual(['  tap "tab-wishlist"', '  tap "wishlist-1"', '  tap "wishlist-submit"']);
    expect(test).toContain('expect text "wishlist-name" == "Wishlist one"');
    expect(scaffold(flow, target).files["app.ts"]).toContain("name: 'Wishlist one'");
  });

  it("wires the routes into the stack's chain and the tab bar, leaving the rest of the app as it was", () => {
    const app = scaffold(flow, target).files["app.contract"]!;
    expect(app).toMatch(/^ {16}if e\.name == "wishlist"\n {18}WishlistScreen\(items=wishlistItems\)$/m);
    expect(app).toContain('                else if e.name == "cart"');
    expect(app).toContain('testId="tab-wishlist"');
    const added = app.split("\n").length - target.contract.split("\n").length;
    expect(added).toBe(1 + 3 + 2 + 6 + 4);
  });

  it("refuses an app it cannot wire, naming what is missing", () => {
    expect(() => scaffold(flow, { ...target, contract: "component App\n  view\n    text \"x\"\n" })).toThrow(/no `routes <name>` block/);
    expect(() => scaffold({ ...flow, links: [] }, target)).toThrow(/no arrow/);
  });
});
