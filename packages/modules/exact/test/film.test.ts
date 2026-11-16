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

import { deflateSync, inflateSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CanvasContents, LogEntry, ModuleCommentFacts } from "@isocan/core";
import * as record from "../src/core.ts";
import { bindCore } from "../src/core-ref.ts";

bindCore(record);
import { pendingFilms, pendingInspects } from "../src/drives.ts";
import { landFilm, parseFilmAsk, type FilmReport } from "../src/film.ts";
import { axRows, changedKeys, clampMoment, commentAt, filmKeyText, frameAt, momentOf, packFrames, parseFilm, parseFrames, splitApng, unpackFrames, type FrameState } from "../src/film.ts";
import { filmCommentRows, scrubbedAt } from "../src/scrub.ts";

/** A PNG chunk, as Exact's `png.mjs` writes one. */
function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "latin1");
  const crc = Buffer.alloc(4);
  let c = 0xffffffff;
  for (const b of Buffer.concat([head.subarray(4), data])) { c ^= b; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; }
  crc.writeUInt32BE((c ^ 0xffffffff) >>> 0, 0);
  return Buffer.concat([head, data, crc]);
}

/** An animated PNG of 2×1 RGBA frames, in `encodeApng`'s shape (Exact `scripts/png.mjs`): whole frames, the first as IDAT, the rest as fdAT. */
function apng(frames: number[][]): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(2, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 6;
  const actl = Buffer.alloc(8);
  actl.writeUInt32BE(frames.length, 0);
  const parts = [Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("acTL", actl)];
  let seq = 0;
  frames.forEach((px, i) => {
    const fctl = Buffer.alloc(26);
    fctl.writeUInt32BE(seq++, 0); fctl.writeUInt32BE(2, 4); fctl.writeUInt32BE(1, 8); fctl.writeUInt16BE(16, 20); fctl.writeUInt16BE(1000, 22);
    parts.push(chunk("fcTL", fctl));
    const data = deflateSync(Buffer.from([0, ...px]));
    if (i === 0) parts.push(chunk("IDAT", data));
    else { const f = Buffer.alloc(4 + data.length); f.writeUInt32BE(seq++, 0); data.copy(f, 4); parts.push(chunk("fdAT", f)); }
  });
  parts.push(chunk("IEND", Buffer.alloc(0)));
  return Buffer.concat(parts);
}

/** A still PNG's pixels, read back. */
function pixels(png: Uint8Array): number[] {
  const b = Buffer.from(png);
  expect([...b.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  const idat: Buffer[] = [];
  const types: string[] = [];
  for (let p = 8; p < b.length;) {
    const len = b.readUInt32BE(p);
    const type = b.toString("latin1", p + 4, p + 8);
    types.push(type);
    if (type === "IDAT") idat.push(b.subarray(p + 8, p + 8 + len));
    p += 12 + len;
  }
  expect(types).toEqual(["IHDR", "IDAT", "IEND"]);
  return [...inflateSync(Buffer.concat(idat)).subarray(1)];
}

const film = { from: 0, every: 16, steps: 38, over: 600, at: Array.from({ length: 38 }, (_, i) => i * 16), key: "k", route: "place", host: "web", device: "phone", scheme: "light", shots: 'at "/place/2"', ops: ["tap add-to-cart"], watch: "cart-sheet", screen: "itm_s" };

describe("a film", () => {
  it("splits an animated PNG into one still PNG per frame, each its own pixels", () => {
    const red = [255, 0, 0, 255, 255, 0, 0, 255], green = [0, 255, 0, 255, 0, 255, 0, 255], blue = [0, 0, 255, 255, 0, 0, 255, 255];
    const frames = splitApng(apng([red, green, blue]));
    expect(frames).toHaveLength(3);
    expect(frames!.map(pixels)).toEqual([red, green, blue]);
    // Not an animated PNG, or a frame that is not whole: nothing to scrub, so null (the strip then plays).
    expect(splitApng(new Uint8Array([1, 2, 3]))).toBeNull();
    const partial = apng([red, green]);
    const at = partial.indexOf(Buffer.from("fcTL"), 40) + 4;
    partial.writeUInt32BE(1, at + 4);
    expect(splitApng(partial)).toBeNull();
  });

  it("shows the frame drawn at or before a moment: 180 ms at 16 ms a frame is the one drawn at 176", () => {
    const f = parseFilm(JSON.stringify(film))!;
    expect(frameAt(f, 180)).toBe(11);
    expect(f.at[frameAt(f, 180)]).toBe(176);
    expect(frameAt(f, 0)).toBe(0);
    expect(frameAt(f, 10_000)).toBe(37);
    expect(clampMoment(f, -5)).toBe(0);
    expect(clampMoment(f, 900)).toBe(592);
    // A comment's moment is core's `at`, in seconds, as a motion's is.
    expect(commentAt(180)).toBe(0.18);
    expect(momentOf(0.18)).toBe(180);
    expect(parseFilm('{"every":16}')).toBeNull();
    expect(parseFilm(JSON.stringify({ every: 16, steps: 3 }))!.at).toEqual([0, 16, 32]);
  });

  it("keys a film on what it depends on, so the same film is versioned on one item", () => {
    const parts = { app: "a", route: "place", host: "web", device: "phone", scheme: "light", shots: 'at "/place/2"', ops: ["tap add-to-cart"], over: 600, every: 16, watch: null };
    expect(filmKeyText(parts)).toBe(filmKeyText({ ...parts }));
    expect(filmKeyText(parts)).not.toBe(filmKeyText({ ...parts, every: 8 }));
    expect(filmKeyText(parts)).not.toBe(filmKeyText({ ...parts, ops: ["tap add-to-cart", "back"] }));
  });
});

describe("state per frame", () => {
  const states: FrameState[] = [
    { at: 0, slots: { sheetOpen: false, cart: [] }, derives: { cartTotal: 0 }, watch: { testId: "cart-sheet", box: null, style: { translate: "0px 360px" } } },
    { at: 16, slots: { sheetOpen: true, cart: ["2"] }, derives: { cartTotal: 18 }, watch: { testId: "cart-sheet", box: null, style: { translate: "0px 347.655px" } } },
    { at: 32, slots: { sheetOpen: true, cart: ["2"] }, derives: { cartTotal: 18 }, watch: { testId: "cart-sheet", box: null, style: { translate: "0px 316.668px" } } },
  ];

  it("keeps the first frame whole and each later one's changes, and gives every frame back whole", () => {
    const packed = packFrames(states)!;
    expect(packed.steps[1]).toEqual({ at: 32, watch: states[2]!.watch });
    expect(packed.steps[0]!.slots).toEqual({ sheetOpen: true, cart: ["2"] });
    expect(unpackFrames(packed)).toEqual(states);
    expect(parseFrames(JSON.stringify(packed))).toEqual(states);
    expect(parseFrames("{}")).toBeNull();
    expect(packFrames([])).toBeNull();
  });

  it("names what moved between two frames", () => {
    expect(changedKeys(states[0], states[1])).toEqual(["sheetOpen", "cart", "derive cartTotal"]);
    expect(changedKeys(states[1], states[2])).toEqual([]);
  });
});

describe("a comment at a moment", () => {
  const filmItem = { id: "itm_f", properties: { "exact.app": JSON.stringify({ id: "dev.acme.market" }), "exact.film": JSON.stringify(film) } };
  const canvas = { items: { itm_f: filmItem }, threads: {} } as unknown as CanvasContents;
  const facts = (at: number | undefined, anchor = "itm_f") => ({ canvas, thread: { id: "thr_1", anchorItemId: anchor, comments: [] }, comment: { id: "cmt_1", body: "overshoots", ...(at !== undefined ? { at } : {}) }, open: () => {} }) as unknown as ModuleCommentFacts;

  it("scrubs its film back to the comment's moment when the comment is shown, and offers to again", async () => {
    const rows = filmCommentRows(facts(0.18));
    expect(rows.map((r) => ("label" in r ? r.label : ""))).toEqual(["Scrub to 180 ms"]);
    await Promise.resolve();
    expect(scrubbedAt("itm_f")).toBe(180);
    // A comment with no moment, or on something that is not a film, asks nothing.
    expect(filmCommentRows(facts(undefined))).toEqual([]);
    expect(filmCommentRows(facts(0.18, "itm_other"))).toEqual([]);
  });
});

describe("the inspector", () => {
  const screen = (props: Record<string, string>) => ({ id: "s", title: "place", properties: { "exact.app": JSON.stringify({ id: "dev.acme.market" }), "exact.route": "place", ...props } });
  const wrote = (seq: number, properties: Record<string, string>) => ({ seq, envelope: { op: { type: "item.update", itemId: "s", patch: { properties } } } }) as unknown as LogEntry;
  const request = JSON.stringify({ seq: 7, by: "Sam", host: "web", size: "390x844", scheme: "light", shots: 'at "/place/2"' });

  it("answers the inspection a screen holds, once, from the op log", () => {
    const canvas = { items: { s: screen({ "exact.inspect": request }) } } as unknown as CanvasContents;
    expect(pendingInspects([wrote(1, { "exact.inspect": request })], canvas, "dev.acme.market").map((p) => p.request)).toEqual([{ seq: 7, by: "Sam", host: "web", size: "390x844", scheme: "light", shots: 'at "/place/2"' }]);
    const answered = { items: { s: screen({ "exact.inspect": request, "exact.inspected": JSON.stringify({ seq: 7, ok: true, blobHash: "h", ms: 1 }) }) } } as unknown as CanvasContents;
    expect(pendingInspects([wrote(1, { "exact.inspect": request })], answered, "dev.acme.market")).toEqual([]);
    expect(pendingInspects([wrote(2, { "exact.inspected": "{}" })], canvas, "dev.acme.market")).toEqual([]);
    expect(pendingInspects([wrote(1, { "exact.inspect": request })], canvas, "dev.other")).toEqual([]);
  });

  it("draws the driver's tree --ax as indented rows, in its own order", () => {
    // Recorded 14 Nov 2026 against Exact cbe553f6: `tree --ax` of Acme Market's /place/2 on the web.
    const ax = JSON.parse(readFileSync(new URL("./fixtures/acme-market-ax-2026-11-14.json", import.meta.url), "utf8")) as { ax: { elements: Parameters<typeof axRows>[0] } };
    const rows = axRows(ax.ax.elements);
    expect(rows).toHaveLength(ax.ax.elements.length);
    expect(rows[0]!.depth).toBe(0);
    expect(rows.find((r) => r.testId === "add-to-cart")).toMatchObject({ role: "button", interactive: true });
    for (const [i, e] of ax.ax.elements.entries()) if (e.parent !== null) expect(rows[i]!.depth).toBe(rows[ax.ax.elements.findIndex((x) => x.i === e.parent)]!.depth + 1);
  });
});

describe("a film asked for on the canvas", () => {
  const keys = { app: "exact.app", film: "exact.film", frames: "exact.frames" };
  const appProp = JSON.stringify({ id: "dev.acme.market" });
  const screen = { id: "s", title: "place", x: 440, y: 602, width: 86, height: 172, properties: { "exact.app": appProp, "exact.route": "place" } };
  const job = { host: "web", size: "390x844", scheme: "light" as const, shots: 'at "/place/1"', ops: ["tap add-to-cart"], over: 600, every: 16, watch: "cart-sheet" };
  const report: FilmReport = { ok: true, sha256: "x", bytes: 1, png: { width: 390, height: 844 }, steps: 3, at: [0, 16, 32], states: [{ at: 0, slots: { a: 1 }, derives: null }], ms: { film: 1, state: 1 } };

  it("answers the film a screen holds, once, from the op log", () => {
    const ask = JSON.stringify({ seq: 9, by: "Maya", ...job });
    const wrote = (props: Record<string, string>) => ({ seq: 1, envelope: { op: { type: "item.update", itemId: "s", patch: { properties: props } } } }) as unknown as LogEntry;
    const canvas = { items: { s: { ...screen, properties: { ...screen.properties, "exact.filmAsk": ask } } } } as unknown as CanvasContents;
    expect(pendingFilms([wrote({ "exact.filmAsk": ask })], canvas, "dev.acme.market").map((p) => p.request)).toEqual([{ seq: 9, by: "Maya", ...job }]);
    const answered = { items: { s: { ...screen, properties: { ...screen.properties, "exact.filmAsk": ask, "exact.filmed": JSON.stringify({ seq: 9, ok: true }) } } } } as unknown as CanvasContents;
    expect(pendingFilms([wrote({ "exact.filmAsk": ask })], answered, "dev.acme.market")).toEqual([]);
    expect(parseFilmAsk(JSON.stringify({ ...job, seq: 1, every: 0 }))).toBeNull();
  });

  it("lands beside the map, and again on the item that holds its key", () => {
    const first = landFilm([screen], keys, { id: "dev.acme.market" }, screen, { route: "place", device: "phone" }, job, report, "k1");
    expect(first.existing).toBeNull();
    expect(first.at).toEqual({ x: 440 + 86 + 160, y: 602 });
    expect(JSON.parse(first.properties["exact.film"]!)).toMatchObject({ key: "k1", at: [0, 16, 32], ops: ["tap add-to-cart"], screen: "s" });
    const filmItem = { id: "f", x: first.at.x, y: first.at.y, width: first.width, height: first.height, properties: first.properties };
    expect(landFilm([screen, filmItem], keys, { id: "dev.acme.market" }, screen, { route: "place", device: "phone" }, job, report, "k1").existing?.id).toBe("f");
    expect(landFilm([screen, filmItem], keys, { id: "dev.acme.market" }, screen, { route: "place", device: "phone" }, job, report, "k2").existing).toBeNull();
  });
});
