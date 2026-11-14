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
import type { CanvasSnapshotResponse, Item, LogEntry, Operation } from "@isocan/core";
import * as record from "../src/core.ts";
import { bindCore } from "../src/core-ref.ts";

bindCore(record);
import { opProblem, opsFromFlags, parseProposeAsk, previewRows, proposalTitle, scopeFor, tokensOf, type PreviewCell, type ProposalRecord } from "../src/proposal.ts";
import { pendingProposes, settleKept } from "../src/proposals.ts";
import type { Kit } from "../src/stories.ts";

/**
 * Exact phase 6: agents propose. The pure half (scopes, the closed list of
 * Tamber operations, the preview grid, the design system's tokens) and the
 * acting half's two log readers: which asks wait, and what a Keep or a Delete
 * of a proposal sends to the wire. The wire itself is exercised by the walk
 * (`scratchpad/p6/walk.mjs`), against Acme Market's real dev loop.
 */

const APP = JSON.stringify({ id: "dev.acme.market" });

describe("scopes from isocan's roles (design §10)", () => {
  it("gives an enrolled agent propose, never write, and a person who may edit write", () => {
    expect(scopeFor(true)).toBe("propose");
    expect(scopeFor(false)).toBe("write");
  });
});

describe("the operations a proposal may carry", () => {
  it("reads --token, --row and --op as Tamber spells them", () => {
    expect(opsFromFlags(["radius.card=12px"], ["Price.background-color=-exact-tertiary-background", "Price.opacity=0.9"], ['{"op":"set-state","style":"Price","state":"hover","row":"color","value":"brand.ink"}'])).toEqual([
      { op: "set-token", name: "radius.card", value: "12px" },
      { op: "set-row", style: "Price", row: "background-color", value: "-exact-tertiary-background" },
      { op: "set-row", style: "Price", row: "opacity", value: 0.9 },
      { op: "set-state", style: "Price", state: "hover", row: "color", value: "brand.ink" },
    ]);
  });

  it("refuses anything outside the closed list, with a sentence", () => {
    expect(() => opsFromFlags([], [], [])).toThrow(/says what it changes/);
    expect(() => opsFromFlags(["radius.card"], [], [])).toThrow(/name=value/);
    expect(() => opsFromFlags([], ["price.color=red"], [])).toThrow(/Style\.row=value/);
    expect(() => opsFromFlags([], [], ['{"op":"transaction"}'])).toThrow(/set-token, set-row or set-state/);
    expect(opProblem({ op: "set-row", row: "color", value: "red", file: "../etc/passwd", at: { line: 1, col: 1 }, sha256: "0".repeat(64) })).toMatch(/app's file/);
    expect(opProblem({ op: "set-row", row: "color", value: "red", file: "app.contract", at: { line: 3, col: 5 } })).toMatch(/sha256/);
    expect(opProblem({ op: "set-token", name: "brand.ink", value: "a\nb" })).toMatch(/one short line/);
  });

  it("parses an ask only when every operation is one a proposal may carry", () => {
    const ok = { seq: 1, by: "Ada", ops: [{ op: "set-token", name: "radius.card", value: "20px" }], why: "Softer cards read as premium.", cites: [{ kind: "comment", ref: "c1" }], in: null };
    expect(parseProposeAsk(JSON.stringify(ok))).toEqual(ok);
    expect(parseProposeAsk(JSON.stringify({ ...ok, ops: [{ op: "transaction" }] }))).toBeNull();
    expect(parseProposeAsk(JSON.stringify({ ...ok, why: "" }))).toBeNull();
    expect(proposalTitle("Ada", ok.ops as never)).toBe("Proposed by Ada: radius.card → 20px");
  });
});

describe("the preview grid", () => {
  it("is a row per host and device — the web's phone, tablet, desktop, then iOS — each light and dark", () => {
    const c = (host: string, device: string, scheme: "light" | "dark"): PreviewCell => ({ host, device, scheme, before: `b-${host}-${device}-${scheme}`, after: `a-${host}-${device}-${scheme}`, restored: true });
    const rows = previewRows([c("ios", "phone", "dark"), c("web", "desktop", "light"), c("web", "phone", "light"), c("ios", "phone", "light"), c("web", "phone", "dark"), c("web", "tablet", "light")]);
    expect(rows.map((r) => `${r.host}/${r.device}`)).toEqual(["web/phone", "web/tablet", "web/desktop", "ios/phone"]);
    expect(rows[0]!.dark?.after).toBe("a-web-phone-dark");
    expect(rows[1]!.dark).toBeNull();
  });
});

describe("the design system's tokens, as the token panel reads them", () => {
  it("reads each row of the table this module writes", () => {
    const md = readFileSync(new URL("./fixtures/acme-market-design-2026-11-14.md", import.meta.url), "utf8");
    expect(tokensOf(md)).toEqual([
      { name: "brand.ink", kind: "color", light: "#1b4d3e", dark: "#8fd3b6" },
      { name: "note.ink", kind: "color", light: "#5b6b62", dark: "#a8b8ae" },
      { name: "space.note", kind: "number", light: "4", dark: "4" },
      { name: "radius.card", kind: "length", light: "8px", dark: "8px" },
    ]);
  });
});

// ---------------------------------------------------------------- the log readers

const screen = (over: Partial<Item> = {}): Item => ({
  id: "s_place", title: "Acme Market · place", x: 0, y: 0, width: 195, height: 422,
  properties: { "exact.app": APP, "exact.route": "place", "exact.host": "web", "exact.device": "phone", "exact.scheme": "light", "exact.url": "/place/1" },
  versions: [{ id: "v_cap", blobHash: "h_cap", mimeType: "image/png", filename: "place.png", size: 1, createdAt: "", createdBy: { id: "p", name: "P" } }],
  currentVersionId: "v_cap",
  ...over,
} as Item);

const recordOf = (): ProposalRecord => ({
  seq: 1, route: "place", asker: { id: "agent_1", name: "Lead", kind: "agent" }, scope: "propose", client: "remote:isocan-Lead#1", proposal: "prop-1",
  class: "live", how: "scrub", ops: [{ op: "set-token", name: "radius.card", value: "20px" }], files: { "app.tamber": "a".repeat(64) }, changed: [], previews: [], at: "",
});

const proposalItem = (): Item => ({
  id: "itm_prop", title: "Proposed by Lead: radius.card → 20px", x: 0, y: 500, width: 1080, height: 1420,
  properties: { proposal: "sure", parent: "s_place", proposalCites: "[]", proposalWhy: "Softer.", "exact.app": APP, "exact.proposal": JSON.stringify(recordOf()) },
  versions: [{ id: "v_after", blobHash: "h_after", mimeType: "image/png", filename: "after.png", size: 1, createdAt: "", createdBy: { id: "p", name: "P" } }],
  currentVersionId: "v_after",
} as unknown as Item);

const snap = (items: Item[], trash: Item[], agents: Record<string, unknown> = {}): CanvasSnapshotResponse => ({
  project: { id: "c", groupMode: "legacy" }, canvas: { items: Object.fromEntries(items.map((i) => [i.id, i])), threads: {}, trash: trash.map((item) => ({ item })), agents }, lastSeq: 9, colors: {}, names: {},
} as unknown as CanvasSnapshotResponse);

const entry = (seq: number, actor: { id: string; name: string }, op: Operation): LogEntry => ({ seq, envelope: { id: `o${seq}`, canvasId: "c", actor, ts: "", op }, inverse: null } as LogEntry);

function fakes(answer: Record<string, unknown>) {
  const calls: Array<{ verb: string; job: unknown }> = [];
  const sent: Operation[] = [];
  const kit = {
    bridge: async (_h: unknown, verb: string, args: string[]) => {
      const job = JSON.parse(readFileSync(args[args.indexOf("--job") + 1]!, "utf8"));
      calls.push({ verb, job });
      return answer;
    },
  } as unknown as Kit;
  const host = { sendOp: async (_c: unknown, _id: unknown, op: Operation) => { sent.push(op); return { envelope: { op } }; } } as never;
  return { kit, host, calls, sent };
}

describe("which asks wait", () => {
  it("reads an ask off the log with the actor that wrote it, until it is answered", () => {
    const ask = { seq: 5, by: "Lead", ops: [{ op: "set-token", name: "radius.card", value: "20px" }], why: "Softer.", cites: [], in: null };
    const s = screen({ properties: { ...screen().properties, "exact.propose": JSON.stringify(ask) } });
    const e = entry(7, { id: "agent_1", name: "Lead" }, { type: "item.update", itemId: s.id, patch: { properties: { "exact.propose": JSON.stringify(ask) } } });
    const waiting = pendingProposes([e], snap([s], []), "dev.acme.market");
    expect(waiting).toHaveLength(1);
    expect(waiting[0]!.actor.id).toBe("agent_1");
    expect(waiting[0]!.seq).toBe(7);
    const answered = screen({ properties: { ...s.properties, "exact.proposed": JSON.stringify({ seq: 5, ok: true }) } });
    expect(pendingProposes([e], snap([answered], []), "dev.acme.market")).toHaveLength(0);
  });
});

describe("a Keep, and only a person's, reaches the wire", () => {
  const prev = process.env.ISOCAN_EXACT_LOOP;
  const withLoop = async (fn: () => Promise<void>) => { process.env.ISOCAN_EXACT_LOOP = "http://127.0.0.1:47911"; try { await fn(); } finally { if (prev === undefined) delete process.env.ISOCAN_EXACT_LOOP; else process.env.ISOCAN_EXACT_LOOP = prev; } };
  // core's choose: the proposal's current version onto the screen, then the proposal to the trash.
  const kept = screen({ versions: [...screen().versions, { id: "v_after", blobHash: "h_after", mimeType: "image/png", filename: "after.png", size: 1, createdAt: "", createdBy: { id: "p", name: "P" } }], currentVersionId: "v_after" } as Partial<Item>);
  const del = (actor: { id: string; name: string }) => entry(12, actor, { type: "item.delete", itemId: "itm_prop" });

  it("accepts on the wire when a person keeps it, and says so on the screen", () => withLoop(async () => {
    const f = fakes({ ok: true, written: ["app.tamber"], heldAgain: null });
    await settleKept(f.kit, f.host, {} as never, "c", "/app", "dev.acme.market", [del({ id: "person_1", name: "Maya" })], snap([kept], [proposalItem()]), () => {});
    expect(f.calls).toEqual([{ verb: "accept", job: { proposal: "prop-1", ops: recordOf().ops, files: recordOf().files, name: "Maya" } }]);
    const update = f.sent.find((o) => o.type === "item.update") as Extract<Operation, { type: "item.update" }>;
    expect(JSON.parse(update.patch.properties!["exact.accepted"] as string)).toMatchObject({ item: "itm_prop", version: "v_after", ok: true, written: ["app.tamber"], by: "Maya" });
  }));

  it("reads a Keep on a canvas with groups, where the delete is a group.change (a proposal in a competition lane)", () => withLoop(async () => {
    const f = fakes({ ok: true, written: ["app.tamber"] });
    const change = entry(13, { id: "person_1", name: "Maya" }, { type: "group.change", action: { kind: "apply", change: { intent: "delete", expected: [{ itemId: "itm_prop" }] } } } as unknown as Operation);
    await settleKept(f.kit, f.host, {} as never, "c", "/app", "dev.acme.market", [change], snap([kept], [proposalItem()]), () => {});
    expect(f.calls.map((c) => c.verb)).toEqual(["accept"]);
  }));

  it("refuses an agent's choose: nothing reaches the wire, and the screen's picture is put back", () => withLoop(async () => {
    const f = fakes({ ok: true });
    await settleKept(f.kit, f.host, {} as never, "c", "/app", "dev.acme.market", [del({ id: "agent_1", name: "Lead" })], snap([kept], [proposalItem()], { agent_1: { actor: { id: "agent_1", name: "Lead" } } }), () => {});
    expect(f.calls).toEqual([]);
    expect(f.sent[0]).toMatchObject({ type: "item.setCurrentVersion", itemId: "s_place", versionId: "v_cap" });
    expect(JSON.parse((f.sent[1] as Extract<Operation, { type: "item.update" }>).patch.properties!["exact.accepted"] as string)).toMatchObject({ ok: false, error: expect.stringMatching(/only by a person's Keep/) });
  }));

  it("drops it on the wire when it is deleted without a Keep", () => withLoop(async () => {
    const f = fakes({ ok: true, dropped: "prop-1" });
    await settleKept(f.kit, f.host, {} as never, "c", "/app", "dev.acme.market", [del({ id: "person_1", name: "Maya" })], snap([screen()], [proposalItem()]), () => {});
    expect(f.calls).toEqual([{ verb: "drop", job: { proposal: "prop-1" } }]);
    expect(f.sent).toEqual([]);
  }));

  it("puts the screen back when the wire will not write it", () => withLoop(async () => {
    const f = fakes({ ok: false, error: "accept: stale" });
    await settleKept(f.kit, f.host, {} as never, "c", "/app", "dev.acme.market", [del({ id: "person_1", name: "Maya" })], snap([kept], [proposalItem()]), () => {});
    expect(f.sent[0]).toMatchObject({ type: "item.setCurrentVersion", versionId: "v_cap" });
  }));
});

describe("what the module never does", () => {
  it("never releases a scrub or writes a file itself: the bridge cancels, and only accept writes", () => {
    const live = readFileSync(new URL("../../../../scripts/exact-live.mjs", import.meta.url), "utf8");
    const bridge = readFileSync(new URL("../../../../scripts/exact-bridge.mjs", import.meta.url), "utf8");
    expect(live).not.toMatch(/"scrub-release"/);
    expect(bridge).not.toMatch(/"scrub-release"|method: "transaction"/);
    // An agent's proposal goes out on a client the wire paired at propose scope.
    expect(bridge).toMatch(/method: "pair-code", scope: "propose"/);
  });
});

describe("a branch's screens, beside the current", async () => {
  const { branchPlacement, parseBranchMark } = await import("../src/branch.ts");
  it("puts a matched screen at its current place moved right past the map, and a new route in a row under it", () => {
    const current = [{ x: 0, y: 0, width: 195, height: 422 }, { x: 300, y: 0, width: 195, height: 422 }];
    const places = branchPlacement(current, [
      { key: "place/web/phone/light", beside: current[1]!, size: { width: 195, height: 422 } },
      { key: "about/web/phone/light", beside: null, size: { width: 195, height: 422 } },
    ]);
    expect(places.get("place/web/phone/light")).toEqual({ x: 300 + 495 + 400, y: 0, width: 195, height: 422 });
    expect(places.get("about/web/phone/light")).toEqual({ x: 895, y: 422 + 240, width: 195, height: 422 });
    expect(parseBranchMark(JSON.stringify({ ref: "about-tab", commit: null, route: "about", host: "web", device: "phone", scheme: "light", beside: null, sha256: "x" }))?.route).toBe("about");
    expect(parseBranchMark("{")).toBeNull();
  });
});
