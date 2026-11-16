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
import { dragOf, dragged, dtcgFor, leafCss, mapTokens, mappingMarkdown, parseApplyAsk, parseMaps, stylesNote, type SystemRecord } from "../src/system.ts";

/**
 * Exact phase 9: a design system taken from one app and applied to another.
 * The extract is a recorded reading (Exact a54f4234, the synthetic Acme Glass:
 * `forma ir`, `forma export dtcg`, `contract symbols`); the target is Acme
 * Market's four tokens. The held import itself is the walk's
 * (`scratchpad/p9`), against Acme Market's real dev loop.
 */

const read = JSON.parse(readFileSync(new URL("./fixtures/acme-glass-system-2026-11-15.json", import.meta.url), "utf8")) as Omit<SystemRecord, "at">;
const system: SystemRecord = { ...read, at: "2026-11-15T00:00:00Z" };
const ACME = [{ name: "brand.ink", kind: "color" }, { name: "note.ink", kind: "color" }, { name: "space.note", kind: "number" }, { name: "radius.card", kind: "length" }];

describe("the extract (design §13)", () => {
  it("carries every token's value per scheme, as Exact's export wrote it, and the named styles", () => {
    expect(system.from).toMatchObject({ id: "dev.acme.glass", name: "Acme Glass" });
    expect(system.tokens.map((t) => t.name)).toContain("surface.glass");
    const glass = system.tokens.find((t) => t.name === "surface.glass")!;
    expect(leafCss(glass.light)).toBe("oklch(1 0 0 / 0.55)");
    expect(leafCss(glass.dark)).toBe("oklch(0.32 0.02 260 / 0.45)");
    expect(leafCss(system.tokens.find((t) => t.name === "ink")!.light)).toBe("oklch(0.22 0.03 260)");
    expect(leafCss(system.tokens.find((t) => t.name === "shadow.glass")!.light)).toBe("a shadow of 2 layers");
    expect(system.styles.map((s) => s.name)).toEqual(["Price", "Glass"]);
    expect(system.styles[1]!.rows).toContainEqual({ row: "backgroundMaterial", value: "ultra-thin" });
  });
});

describe("the mapping, shown before anything is held", () => {
  it("matches a name of the same kind, takes a person's names, and names every token left unmatched", () => {
    const m = mapTokens(system.tokens, ACME, { "brand.primary": "brand.ink", "ink.muted": "note.ink" });
    const to = Object.fromEntries(m.rows.map((r) => [r.from, r.to]));
    expect(to).toMatchObject({ "brand.primary": "brand.ink", "ink.muted": "note.ink", "radius.card": "radius.card", "space.note": "space.note" });
    expect(m.rows.find((r) => r.from === "radius.card")!.how).toBe("same name");
    expect(m.rows.find((r) => r.from === "brand.primary")!.how).toBe("named by a person");
    const unmatched = m.rows.filter((r) => !r.to);
    expect(unmatched.map((r) => r.from)).toEqual(expect.arrayContaining(["surface.page", "surface.glass", "shadow.glass", "wash.sky"]));
    expect(unmatched.every((r) => r.why)).toBe(true);
    expect(m.untouched).toEqual([]);
  });

  it("guesses nothing: with no names given, only the same-named tokens match", () => {
    const m = mapTokens(system.tokens, ACME);
    expect(m.rows.filter((r) => r.to).map((r) => r.from).sort()).toEqual(["radius.card", "space.note"]);
    expect(m.untouched.sort()).toEqual(["brand.ink", "note.ink"]);
  });

  it("refuses a name of another kind, or one the target lacks, with why", () => {
    const m = mapTokens(system.tokens, ACME, { "radius.card": "brand.ink", "wash.sky": "nope" });
    expect(m.rows.find((r) => r.from === "radius.card")).toMatchObject({ to: null, why: "brand.ink is a color, not a length" });
    expect(m.rows.find((r) => r.from === "wash.sky")).toMatchObject({ to: null, why: "the target has no token nope" });
    expect(() => parseMaps(["brand.primary"])).toThrow(/source=target/);
    expect(parseMaps(["wash.sky="])).toEqual({ "wash.sky": "" });
  });

  it("writes a card that names every row, and says the styles do not travel", () => {
    const m = mapTokens(system.tokens, ACME, { "brand.primary": "brand.ink" });
    const md = mappingMarkdown(system, { id: "dev.acme.market", name: "Acme Market" }, m);
    for (const t of system.tokens) expect(md).toContain(`\`${t.name}\``);
    expect(md).toContain("no match:");
    expect(md).toContain(stylesNote(system.styles)!);
    expect(stylesNote(system.styles)).toMatch(/holds tokens only/);
  });
});

describe("the DTCG Apply hands to Exact's held import", () => {
  it("holds only the mapped tokens, under the target's names, light and dark, with no export header", () => {
    const m = mapTokens(system.tokens, ACME, { "brand.primary": "brand.ink" });
    const doc = JSON.parse(dtcgFor(system, m));
    expect(doc.sets.exact.sources).toEqual([{}]);
    expect(JSON.stringify(doc)).not.toContain("surface.glass");
    const light = doc.modifiers.mode.contexts.light[0];
    expect(light.brand.ink.$value.components).toEqual([0.55, 0.17, 255]);
    expect(doc.modifiers.mode.contexts.dark[0].brand.ink.$value.components).toEqual([0.72, 0.14, 250]);
    expect(light.radius.card.$value).toEqual({ unit: "px", value: 16 });
    expect(doc.resolutionOrder).toEqual([{ $ref: "#/sets/exact" }, { $ref: "#/modifiers/mode" }]);
  });
});

describe("a chip's drag", () => {
  it("turns an oklch colour's hue on both schemes and drops Exact's source note, so the edit wins", () => {
    const accent = system.tokens.find((t) => t.name === "brand.accent")!;
    expect(dragOf(accent)).toEqual({ what: "hue", at: 35 });
    const warmer = dragged(accent, 25);
    expect(leafCss(warmer.light)).toBe("oklch(0.7 0.15 25)");
    expect(leafCss(warmer.dark)).toBe("oklch(0.78 0.13 30)");
    expect(warmer.light!.$extensions).toBeUndefined();
    expect(warmer.source).toBe("light-dark(oklch(0.7 0.15 25), oklch(0.78 0.13 30))");
  });

  it("sets a px length, and leaves a shadow undraggable", () => {
    const radius = system.tokens.find((t) => t.name === "radius.card")!;
    expect(leafCss(dragged(radius, 20).light)).toBe("20px");
    expect(dragOf(system.tokens.find((t) => t.name === "shadow.glass")!)).toBeNull();
  });
});

describe("the ask", () => {
  it("reads an apply ask leniently, and refuses one with no app", () => {
    expect(parseApplyAsk(JSON.stringify({ seq: 1, by: "Dion", app: "dev.acme.market", map: { a: "b", n: 3 } }))).toEqual({ seq: 1, by: "Dion", app: "dev.acme.market", map: { a: "b" } });
    expect(parseApplyAsk(JSON.stringify({ seq: 1, app: "" }))).toBeNull();
  });
});
