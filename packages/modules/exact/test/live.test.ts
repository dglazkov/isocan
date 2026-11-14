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
import type { CanvasContents, CommentThread, Item } from "@isocan/core";
import * as record from "../src/core.ts";
import { bindCore } from "../src/core-ref.ts";

bindCore(record);
import { buildFindings, checkFindings, movedComments, planFindings, routesDrawing, testIdPlace, type CheckReport, type DiagnoseReport } from "../src/findings.ts";

const { contractRoutes, diagnosticKey, parseSource, screenProperties, selectionSummary, sourceLine } = record;

/**
 * What `scripts/exact-bridge.mjs diagnose` and `check` printed for Acme
 * Market grown for exact phase 2 — a PriceTag styled through `class=Price`
 * on a place's page — clean, with `paddng` typed into ShippingNote, and with
 * the note's colour too faint to read. Recorded 14 Nov 2026 against Exact
 * cbe553f6.
 */
const fixture = JSON.parse(readFileSync(new URL("./fixtures/acme-market-findings-2026-11-14.json", import.meta.url), "utf8")) as {
  clean: DiagnoseReport;
  typo: DiagnoseReport;
  check: CheckReport;
};
const routes = contractRoutes(fixture.clean.symbols!, fixture.clean.sources).routes;
const lineOf = (text: string, needle: string) => text.split("\n").findIndex((l) => l.includes(needle)) + 1;
const SRC = fixture.clean.sources["app.contract"]!;

describe("exact.source: a comment pointing at a line (design §6)", () => {
  it("rides in the body as one line both surfaces and an agent read", () => {
    const src = { file: "app.contract", line: 110, col: 5, sha256: "a".repeat(64) };
    const body = `Too faint.\n\n${sourceLine(src)}`;
    expect(parseSource(body)).toEqual(src);
    expect(parseSource("no source here")).toBeNull();
    expect(parseSource(`exact.source = {"file":"../etc/passwd","line":1,"col":1,"sha256":"${"a".repeat(64)}"}`)).toBeNull();
    expect(parseSource(`exact.source = {"file":"/abs.contract","line":1,"col":1,"sha256":"${"a".repeat(64)}"}`)).toBeNull();
  });

  it("names the style a row came from, so a node styled through a class says so", () => {
    expect(selectionSummary({ source: { file: "app.contract", line: 126, col: 5, component: "PriceTag" }, rows: [{ origin: "class:Price" }, { origin: "own" }, { origin: null }] }))
      .toBe("app.contract:126:5 · in PriceTag · class Price");
    expect(selectionSummary({ source: { file: "app.contract", line: 110, col: 5, component: "ShippingNote" }, rows: [{ origin: "own" }] }))
      .toBe("app.contract:110:5 · in ShippingNote");
  });
});

describe("which screens a line draws (design §6: a finding on the right screen)", () => {
  it("follows a component to where it is drawn, and the routed view's conditions to its routes", () => {
    expect(routesDrawing(fixture.clean.symbols, fixture.clean.sources, routes, "app.contract", lineOf(SRC, 'text "Free shipping'))).toEqual(["places", "place"]);
    expect(routesDrawing(fixture.clean.symbols, fixture.clean.sources, routes, "app.contract", lineOf(SRC, 'text "From $12"'))).toEqual(["place", "savedPlace"]);
    expect(routesDrawing(fixture.clean.symbols, fixture.clean.sources, routes, "app.contract", lineOf(SRC, 'title="No Saved Places"'))).toEqual(["saved"]);
    // Nothing to narrow it: every route.
    expect(routesDrawing(null, {}, routes, "app.contract", 3)).toEqual(routes.map((r) => r.name));
  });

  it("finds a testId's line, so an agent check finding carries a source too", () => {
    expect(testIdPlace(fixture.clean.symbols, "shipping-note")?.line).toBe(lineOf(SRC, 'testId="shipping-note"'));
  });
});

describe("findings as comments", () => {
  const item = (id: string, props: Record<string, string>): Item => ({
    id, title: id, x: 0, y: 0, width: 195, height: 422, properties: props,
    versions: [{ id: `v_${id}`, blobHash: `h_${id}`, mimeType: "image/png", filename: `${id}.png`, size: 1 }], currentVersionId: `v_${id}`,
  } as unknown as Item);
  const index = { app: { id: "dev.acme.market", name: "Acme Market" } } as Parameters<typeof screenProperties>[0];
  const screens = routes.map((r) => item(`s_${r.name}`, screenProperties({ ...index, plan: null, edges: [] } as unknown as Parameters<typeof screenProperties>[0], r, r.pattern)));
  const canvasOf = (threads: CommentThread[] = []) => ({ items: Object.fromEntries(screens.map((i) => [i.id, i])), threads: Object.fromEntries(threads.map((t) => [t.id, t])) } as unknown as CanvasContents);

  it("a typo becomes one comment on the screen its line draws, with exact.source, and leaves when fixed", () => {
    const found = buildFindings(fixture.typo, routes);
    expect(found).toHaveLength(1);
    const [f] = found;
    expect(f!.routes).toEqual(["places", "place"]);
    expect(f!.body).toMatch(/Compile error at app\.contract:\d+:7 — `text` has no attribute `paddng`/);
    expect(parseSource(f!.body)).toMatchObject({ file: "app.contract", line: fixture.typo.diagnostics[0]!.line, col: 7, sha256: fixture.typo.digests["app.contract"] });
    const plan = planFindings(canvasOf(), index, found, () => true);
    expect(plan.create.map((c) => c.item.id)).toEqual(["s_places"]);

    // Posted, then fixed: the next pass's clean build takes the thread away.
    const thread = { id: "thr_1", x: 0, y: 0, anchorItemId: "s_places", comments: [{ id: "c1", body: f!.body }] } as unknown as CommentThread;
    expect(diagnosticKey(thread.comments[0]!.body)).toBe(f!.key);
    const fixed = planFindings(canvasOf([thread]), index, buildFindings(fixture.clean, routes), (k) => k.startsWith("build:"));
    expect(fixed.remove.map((r) => r.thread.id)).toEqual(["thr_1"]);
    expect(fixed.create).toEqual([]);
    // Still broken: nothing new, nothing removed.
    const again = planFindings(canvasOf([thread]), index, found, () => true);
    expect([again.create.length, again.update.length, again.remove.length]).toEqual([0, 0, 0]);
  });

  it("agent check findings land on the route and scheme they were found in, at their box, and only checked routes resolve", () => {
    const found = checkFindings(fixture.check, fixture.clean, [{ route: "places", url: "/" }, { route: "place", url: "/place/1" }]);
    expect(found.map((f) => f.key).sort()).toEqual([
      "check:place:dark:contrast:shipping-note", "check:place:light:contrast:shipping-note",
      "check:places:dark:contrast:shipping-note", "check:places:light:contrast:shipping-note",
    ]);
    expect(parseSource(found[0]!.body)?.line).toBe(lineOf(SRC, 'testId="shipping-note"'));
    const plan = planFindings(canvasOf(), index, found.filter((f) => f.scheme === "light"), () => true);
    expect(plan.create[0]!.y).toBeGreaterThan(12);
    // A check thread for a route this pass did not check stays.
    const thread = { id: "thr_c", x: 0, y: 0, anchorItemId: "s_saved", comments: [{ id: "c1", body: "x\nexact.diagnostic = check:saved:light:contrast:foo" }] } as unknown as CommentThread;
    const scoped = planFindings(canvasOf([thread]), index, [], (k) => k.startsWith("check:places:"));
    expect(scoped.remove).toEqual([]);
  });

  it("says moved, once, when a comment's file no longer hashes to its digest", () => {
    const old = "b".repeat(64);
    const thread = { id: "thr_m", x: 0, y: 0, anchorItemId: "s_place", comments: [{ id: "c1", body: `Make it bigger.\n${sourceLine({ file: "app.contract", line: 126, col: 5, sha256: old })}` }] } as unknown as CommentThread;
    const now = fixture.clean.digests["app.contract"]!;
    expect(movedComments(canvasOf([thread]), "dev.acme.market", { "app.contract": now }).map((m) => m.now)).toEqual([now]);
    expect(movedComments(canvasOf([thread]), "dev.acme.market", { "app.contract": old })).toEqual([]);
    const said = { ...thread, comments: [...thread.comments, { id: "c2", body: `Moved.\nexact.moved = ${now}` }] } as unknown as CommentThread;
    expect(movedComments(canvasOf([said]), "dev.acme.market", { "app.contract": now })).toEqual([]);
  });
});

describe("the browser half reaches the machine only through the shell's door", () => {
  const live = readFileSync(new URL("../src/live.tsx", import.meta.url), "utf8");
  it("never fetches or frames a loopback address of its own", () => {
    expect(live).not.toMatch(/(?<![.\w])fetch\(/);
    expect(live).not.toMatch(/127\.0\.0\.1|localhost/);
    expect(live).toMatch(/door\.frameUrl\(/);
    expect(live).toMatch(/door\.fetch\(/);
  });
  it("names each frame exact-copy-<n>, so three frames in one tab are three builds", () => {
    expect(live).toMatch(/name=\{`exact-copy-\$\{n\}`\}/);
  });
});

describe("pointing on a capture, with live frames off (design §5)", () => {
  const { parsePoints, pointAt } = record;
  // What `exact-bridge.mjs capture` recorded for /place/1 at the phone size, trimmed to three nodes (14 Nov 2026, Exact cbe553f6).
  const points = parsePoints(JSON.stringify({
    files: { "app.contract": "c".repeat(64) },
    nodes: [
      { x: 0, y: 0, w: 390, h: 844, type: "View", file: "app.contract", line: 46, col: 5, component: "App", chain: [] },
      { x: 0, y: 53, w: 390, h: 23, type: "Text", testId: "shipping-note", file: "app.contract", line: 112, col: 5, component: "ShippingNote", chain: [{ file: "app.contract", line: 66, col: 19, component: "App" }] },
      { x: 0, y: 76, w: 390, h: 26, type: "Text", testId: "price", file: "app.contract", line: 118, col: 5, component: "PriceTag", chain: [{ file: "app.contract", line: 68, col: 19, component: "App" }], classes: ["Price"] },
    ],
  }))!;
  it("lands on the innermost box under the press, as a page's own hit test does", () => {
    expect(pointAt(points, 40, 60)?.component).toBe("ShippingNote");
    expect(pointAt(points, 40, 90)).toMatchObject({ line: 118, classes: ["Price"] });
    expect(pointAt(points, 40, 500)?.component).toBe("App");
    expect(pointAt(points, 500, 10)).toBeNull();
    expect(parsePoints("not json")).toBeNull();
  });
  it("reads the same summary a live selection does", () => {
    const hit = pointAt(points, 40, 90)!;
    expect(selectionSummary({ source: hit, rows: (hit.classes ?? []).map((c) => ({ origin: `class:${c}` })) })).toBe("app.contract:118:5 · in PriceTag · class Price");
  });
  it("is recorded beside every capture: tree and layout run in the same driver as the screenshot", () => {
    const bridge = readFileSync(new URL("../../../../scripts/exact-bridge.mjs", import.meta.url), "utf8");
    expect(bridge).toMatch(/`screenshot \$\{file\}`, "tree", "layout"/);
    expect(readFileSync(new URL("../src/live.tsx", import.meta.url), "utf8")).toMatch(/pointAt\(points/);
  });
});

describe("Moved is said once per move, not once per save", () => {
  const item = { id: "s_place", title: "s_place", x: 0, y: 0, width: 195, height: 422, properties: { "exact.app": JSON.stringify({ id: "dev.acme.market" }), "exact.route": "place" }, versions: [], currentVersionId: "v" } as unknown as Item;
  const canvasOf = (thread: CommentThread) => ({ items: { s_place: item }, threads: { [thread.id]: thread } } as unknown as CanvasContents);
  const made = "d".repeat(64);
  const base = { id: "thr_m", x: 0, y: 0, anchorItemId: "s_place", comments: [{ id: "c1", body: `Bigger.\n${sourceLine({ file: "app.contract", line: 118, col: 5, sha256: made })}` }] } as unknown as CommentThread;

  it("posts one Moved reply across two passes with the same changed digest, and none on a further save", async () => {
    const { movedBody } = await import("../src/findings.ts");
    const changed = "e".repeat(64);
    // Pass 1: the file moved — one reply.
    const first = movedComments(canvasOf(base), "dev.acme.market", { "app.contract": changed });
    expect(first).toHaveLength(1);
    const replied = { ...base, comments: [...base.comments, { id: "c2", body: movedBody(first[0]!.source, first[0]!.now) }] } as unknown as CommentThread;
    // Pass 2, same digest: nothing.
    expect(movedComments(canvasOf(replied), "dev.acme.market", { "app.contract": changed })).toEqual([]);
    // A later save to yet another digest is the same move: still nothing.
    expect(movedComments(canvasOf(replied), "dev.acme.market", { "app.contract": "f".repeat(64) })).toEqual([]);
    // Back at the comment's own digest: nothing to say either.
    expect(movedComments(canvasOf(replied), "dev.acme.market", { "app.contract": made })).toEqual([]);
  });

  it("a fresh comment with a new exact.source starts the count again", () => {
    const now = "e".repeat(64);
    const thread = { ...base, comments: [...base.comments, { id: "c2", body: `Moved.\nexact.moved = ${now}` }, { id: "c3", body: `Still wrong.\n${sourceLine({ file: "app.contract", line: 120, col: 5, sha256: now })}` }] } as unknown as CommentThread;
    expect(movedComments(canvasOf(thread), "dev.acme.market", { "app.contract": now })).toEqual([]);
    expect(movedComments(canvasOf(thread), "dev.acme.market", { "app.contract": "1".repeat(64) })).toHaveLength(1);
  });
});
