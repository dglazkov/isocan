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

import { describe, expect, it } from "vitest";
import {
  AGENT_ACTION_VERBS,
  AGENT_STATION_DESCRIPTION_MAX,
  AGENT_TRACE_MAX_LINES,
  HANDLE_PALETTE_OKLCH,
  HANDLE_POOL,
  MAX_AGENT_MENTION_HOPS,
  OpValidationError,
  PreconditionConflictError,
  appendTraceLines,
  applyOperation,
  buildContextGraph,
  capTraceLines,
  colorForHandle,
  computeSuggestedFreeRegions,
  describeFailure,
  describeStation,
  dispatchReason,
  evaluateMentionBreaker,
  formatAgentPill,
  formatFailureForCli,
  formatFailureForGraph,
  formatPeerMessages,
  formatProposalLine,
  formatReceiptLine,
  formatStationChecklist,
  handleForActor,
  isAgentActionVerb,
  isAgentStation,
  isAgentTrace,
  makeCommentReceipt,
  namesFor,
  normalizeHandle,
  readCommentProposal,
  readCommentReceipt,
  readStationMeta,
  renderContextGraph,
  scrubSecrets,
  stationProperties,
  stationTitle,
  summarizeOp,
  traceProperties,
} from "../src/index.ts";
import { apply, bob, envelope, nv, seedState } from "./helpers.ts";

describe("plain-language failures (ADR 0017)", () => {
  it("maps conflicts, rate limits, auth errors, and timeouts into actionable objects", () => {
    const conflict = describeFailure({ status: 409, code: "precondition-conflict" });
    expect(conflict.headline).toBe("Edit conflict");
    expect(conflict.retryable).toBe(true);
    expect(conflict.actions.length).toBeGreaterThan(0);

    const rateLimit = describeFailure({ status: 429, provider: "gemini", model: "gemini-2.5-pro" });
    expect(rateLimit.headline).toContain("gemini");
    expect(rateLimit.retryable).toBe(true);
    expect(rateLimit.actions.some((a) => a.id === "switch-model")).toBe(true);

    const auth = describeFailure({ status: 401, provider: "openai" });
    expect(auth.retryable).toBe(false);
    expect(auth.actions.some((a) => a.command?.includes("isocan keys"))).toBe(true);

    const timeout = describeFailure({ kind: "timeout" });
    expect(timeout.retryable).toBe(true);
    expect(formatFailureForGraph(conflict)).toMatch(/^\(FAILED: Edit conflict — .+\)$/);
    expect(formatFailureForCli(auth)).toContain("next:");
  });

  it("scrubs raw API keys and bearer tokens before surfacing messages", () => {
    const fakeKey = ["sk", "acme", "1234567890abcdef1234"].join("-");
    const fakeBearer = ["Bearer", "eyJhbGciOiJIUzI1NiJ9.acmetokenpayload"].join(" ");
    const fakeQuery = "https://acme.example/v1?api_key=supersecretvalue999";

    const scrubbed = scrubSecrets(`auth failed with ${fakeKey} and ${fakeBearer} at ${fakeQuery}`);
    expect(scrubbed).not.toContain(fakeKey);
    expect(scrubbed).not.toContain("acmetokenpayload");
    expect(scrubbed).not.toContain("supersecretvalue999");
    expect(scrubbed).toContain("[redacted]");

    const failure = describeFailure({ status: 401, message: `bad token ${fakeKey}` });
    expect(failure.why).not.toContain(fakeKey);
    expect(failure.why).toContain("[redacted]");
  });
});

describe("handles, action verbs, and OKLCH palette (ADR 0272/0273)", () => {
  it("validates the 9 honest presence verbs and formats pills", () => {
    expect(AGENT_ACTION_VERBS).toEqual([
      "thinking",
      "reading",
      "writing",
      "generating",
      "coding",
      "verifying",
      "coordinating",
      "idle",
      "done",
    ]);
    expect(isAgentActionVerb("writing")).toBe(true);
    expect(isAgentActionVerb("wandering")).toBe(false);
    expect(formatAgentPill("@Ada", "coding")).toBe("@ada · coding");
  });

  it("assigns deterministic handles from the pool, avoids collisions, and reserves @all", () => {
    expect(HANDLE_POOL).toHaveLength(16);
    expect(normalizeHandle("@All")).toBeNull();
    expect(normalizeHandle("all")).toBeNull();
    expect(normalizeHandle("  @Ada Lovelace!!!  ")).toBe("ada-lovelace");
    expect(normalizeHandle("a".repeat(40))!.length).toBeLessThanOrEqual(24);

    const h1 = handleForActor("usr_acme_1");
    expect(handleForActor("usr_acme_1")).toBe(h1);
    expect(HANDLE_POOL).toContain(h1 as (typeof HANDLE_POOL)[number]);

    const h2 = handleForActor("usr_acme_1", [h1]);
    expect(h2).not.toBe(h1);

    // Exhaust the entire 16-handle pool to verify numbered fallback
    const overflow = handleForActor("usr_acme_1", HANDLE_POOL);
    expect(overflow).toBe(`${h1}-2`);
  });

  it("picks deterministic OKLCH colours from the 8-colour palette", () => {
    expect(HANDLE_PALETTE_OKLCH).toHaveLength(8);
    const c1 = colorForHandle("ada");
    expect(colorForHandle("@ADA")).toBe(c1);
    expect(HANDLE_PALETTE_OKLCH).toContain(c1 as (typeof HANDLE_PALETTE_OKLCH)[number]);
  });
});

describe("agent station helpers (ADR 0273 §3)", () => {
  it("encodes/reads station properties, caps traces to 40 lines, and bounds describeStation to <=160 chars", () => {
    const props = stationProperties({
      handle: "ada",
      role: "builder",
      phase: "working",
      goal: "Build the Acme landing page hero section with responsive layout and verified visual contrast across desktop and mobile viewports",
      summary: "Drafting responsive hero card and checking visual hierarchy across desktop, tablet, and mobile breakpoints with contrast verification and spacing polish",
      artifacts: ["itm_1", "itm_2"],
    });
    const fakeItem = { id: "itm_station", title: stationTitle("ada", "builder"), properties: props };
    expect(fakeItem.title).toBe("@ada · builder");
    expect(isAgentStation(fakeItem)).toBe(true);
    expect(isAgentTrace(fakeItem)).toBe(false);

    const parsed = readStationMeta(fakeItem);
    expect(parsed).toMatchObject({ handle: "ada", role: "builder", phase: "working", artifacts: ["itm_1", "itm_2"] });

    const desc = describeStation(fakeItem);
    expect(desc.startsWith("@ada · builder [working]:")).toBe(true);
    expect(desc.length).toBeLessThanOrEqual(AGENT_STATION_DESCRIPTION_MAX);

    const traceProps = traceProperties("itm_station", "ada");
    expect(isAgentTrace({ properties: traceProps })).toBe(true);

    const manyLines = Array.from({ length: 65 }, (_, i) => `step ${i + 1}`);
    const capped = capTraceLines(manyLines);
    expect(capped).toHaveLength(AGENT_TRACE_MAX_LINES);
    expect(capped[0]).toBe("step 26");
    expect(capped[39]).toBe("step 65");

    const appended = appendTraceLines("line 1\nline 2", ["line 3"], 2);
    expect(appended).toBe("line 2\nline 3");

    expect(formatStationChecklist([{ label: "Audit", done: true }, { label: "Ship", done: false }])).toBe(
      "- [x] Audit\n- [ ] Ship",
    );
    expect(formatPeerMessages([{ from: "@newton", body: "Ready for review" }])).toBe(
      "@newton: Ready for review",
    );
  });
});

describe("work-visible summaries (ADR 0018)", () => {
  it("produces one first-person past-tense sentence per op", () => {
    const state = seedState();
    expect(summarizeOp({ type: "item.move", itemId: "itm_1", x: 120, y: 80 }, { canvas: state.canvas })).toBe(
      'I moved "One" to (120, 80).',
    );
    expect(summarizeOp({ type: "item.resize", itemId: "itm_1", width: 500, height: 300 }, { canvas: state.canvas })).toBe(
      'I resized "One" to 500×300.',
    );
    expect(summarizeOp({ type: "item.delete", itemId: "itm_1" }, { canvas: state.canvas })).toBe(
      'I moved "One" to the trash.',
    );
    expect(summarizeOp({ type: "thread.reply", threadId: "thr_1", comment: { id: "cmt_x", body: "ok" } })).toBe(
      "I replied in thread thr_1.",
    );
  });
});

describe("expect preconditions on item ops (op change #1)", () => {
  it("accepts matching versionId, contentHash, and updatedAt preconditions", () => {
    const s = seedState();
    const item = s.canvas.items["itm_1"]!;
    const current = item.versions.find((v) => v.id === item.currentVersionId)!;

    const moved = apply(s, {
      type: "item.move",
      itemId: "itm_1",
      x: 50,
      y: 60,
      expect: { versionId: item.currentVersionId, contentHash: current.blobHash, updatedAt: item.updatedAt },
    })!;
    expect(moved.canvas.items["itm_1"]!.x).toBe(50);

    const resized = apply(moved, {
      type: "item.resize",
      itemId: "itm_1",
      width: 400,
      height: 300,
      expect: { versionId: item.currentVersionId },
    })!;
    expect(resized.canvas.items["itm_1"]!.width).toBe(400);

    const updated = apply(resized, {
      type: "item.update",
      itemId: "itm_1",
      patch: { title: "Acme Renamed" },
      expect: { contentHash: current.blobHash },
    })!;
    expect(updated.canvas.items["itm_1"]!.title).toBe("Acme Renamed");

    const versioned = apply(updated, {
      type: "item.addVersion",
      itemId: "itm_1",
      version: nv("ver_next"),
      expect: { versionId: item.currentVersionId },
    })!;
    expect(versioned.canvas.items["itm_1"]!.currentVersionId).toBe("ver_next");

    const deleted = apply(versioned, {
      type: "item.delete",
      itemId: "itm_1",
      expect: { versionId: "ver_next" },
    })!;
    expect(deleted.canvas.items["itm_1"]).toBeUndefined();
  });

  it("rejects mismatched preconditions with PreconditionConflictError across all 5 item ops", () => {
    const s = seedState();
    const cases = [
      { type: "item.move" as const, itemId: "itm_1", x: 1, y: 2, expect: { versionId: "ver_stale" } },
      { type: "item.resize" as const, itemId: "itm_1", width: 100, height: 100, expect: { contentHash: "deadbeef" } },
      { type: "item.update" as const, itemId: "itm_1", patch: { title: "No" }, expect: { updatedAt: "2020-01-01T00:00:00.000Z" } },
      { type: "item.addVersion" as const, itemId: "itm_1", version: nv("ver_bad"), expect: { versionId: "ver_1" } },
      { type: "item.delete" as const, itemId: "itm_1", expect: { versionId: "ver_1" } },
    ];
    for (const op of cases) {
      let caught: unknown;
      try {
        applyOperation(s, envelope(op, bob));
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(PreconditionConflictError);
      expect((caught as PreconditionConflictError).code).toBe("precondition-conflict");
    }
  });
});

describe("4-hop agent mention circuit breaker (ADR 0274)", () => {
  const agents = new Set(["usr_ada", "usr_newton"]);
  const isAgent = (id: string) => agents.has(id);

  it("allows up to 3 consecutive agent hops, trips at 4, and resets after a human reply", () => {
    const msg = (id: string) => ({ author: { id, name: id }, mentions: ["usr_newton"] });
    expect(evaluateMentionBreaker([msg("usr_ada"), msg("usr_newton"), msg("usr_ada")], isAgent)).toMatchObject({
      allowed: true,
      consecutiveAgentHops: 3,
      limit: MAX_AGENT_MENTION_HOPS,
    });

    const tripped = evaluateMentionBreaker(
      [msg("usr_ada"), msg("usr_newton"), msg("usr_ada"), msg("usr_newton")],
      isAgent,
    );
    expect(tripped.allowed).toBe(false);
    expect(tripped.consecutiveAgentHops).toBe(4);
    expect(tripped.reason).toContain("4-hop");

    const afterHuman = evaluateMentionBreaker(
      [msg("usr_ada"), msg("usr_newton"), msg("usr_ada"), msg("usr_newton"), msg("usr_human"), msg("usr_ada")],
      isAgent,
    );
    expect(afterHuman.allowed).toBe(true);
    expect(afterHuman.consecutiveAgentHops).toBe(1);
  });

  it("blocks dispatchReason once a thread reaches 4 consecutive agent replies", () => {
    let s = seedState();
    const ada = { id: "usr_ada", name: "Ada" };
    const newton = { id: "usr_newton", name: "Newton" };
    // Seed 3 consecutive agent comments in thr_1
    s = apply(s, { type: "thread.reply", threadId: "thr_1", comment: { id: "c_a1", body: "@Newton hi", mentions: ["usr_newton"] } }, ada)!;
    s = apply(s, { type: "thread.reply", threadId: "thr_1", comment: { id: "c_n1", body: "@Ada reply", mentions: ["usr_ada"] } }, newton)!;
    s = apply(s, { type: "thread.reply", threadId: "thr_1", comment: { id: "c_a2", body: "@Newton ping", mentions: ["usr_newton"] } }, ada)!;

    // 4th consecutive agent message trips the circuit breaker
    const fourthOp = {
      type: "thread.reply" as const,
      threadId: "thr_1",
      comment: { id: "c_n2", body: "@Ada pong", mentions: ["usr_ada"] },
    };
    expect(
      dispatchReason(fourthOp, newton.id, { actorId: ada.id, names: namesFor(ada), isAgent }, s.canvas),
    ).toBeNull();

    // Without breaker predicate (or after a human message), it wakes normally
    s = apply(s, { type: "thread.reply", threadId: "thr_1", comment: { id: "c_h1", body: "keep going" } }, { id: "usr_human", name: "Human" })!;
    expect(
      dispatchReason(fourthOp, newton.id, { actorId: ada.id, names: namesFor(ada), isAgent }, s.canvas),
    ).toBe("mentioned");
  });
});

describe("comment receipts and proposals (ADR 0301)", () => {
  it("stores validated receipts and proposals on thread replies and rejects malformed ones", () => {
    const s = seedState();
    const item = s.canvas.items["itm_1"]!;
    const receipt = makeCommentReceipt(item, "Tightened headline copy.");
    expect(receipt).toEqual({
      itemId: "itm_1",
      fromVersionId: "ver_1",
      toVersionId: "ver_1b",
      summary: "Tightened headline copy.",
    });
    expect(formatReceiptLine(receipt)).toContain("ver_1 → ver_1b");

    const proposal = {
      itemId: "itm_1",
      kind: "markdown_replace" as const,
      patch: "# Acme Updated",
      summary: "Replace title",
    };
    expect(formatProposalLine(proposal)).toContain("markdown_replace");

    const next = apply(s, {
      type: "thread.reply",
      threadId: "thr_1",
      comment: { id: "cmt_rcpt", body: "Done.", receipt, proposal },
    })!;
    const saved = next.canvas.threads["thr_1"]!.comments.find((c) => c.id === "cmt_rcpt")!;
    expect(readCommentReceipt(saved)).toEqual(receipt);
    expect(readCommentProposal(saved)).toEqual(proposal);

    expect(() =>
      applyOperation(
        s,
        envelope({
          type: "thread.reply",
          threadId: "thr_1",
          comment: {
            id: "cmt_bad",
            body: "Bad",
            receipt: { itemId: "", toVersionId: "ver_1", summary: "x" },
          },
        }),
      ),
    ).toThrow(OpValidationError);
  });
});

describe("context graph serializer (full + nav + Follow-Me + free regions)", () => {
  it("serializes items, failures, provenance edges, Follow-Me view, stations without raw trace, leases, and free regions", () => {
    let s = seedState();
    // Add description + edge + failed job on itm_1, and an agent station + raw trace item
    s = apply(s, {
      type: "item.update",
      itemId: "itm_1",
      patch: {
        properties: {
          agentDescription: "Acme product specification",
          "edge:next": "itm_2",
          "edge:next:label": "feeds",
        },
      },
    })!;
    s = apply(s, {
      type: "item.update",
      itemId: "itm_2",
      patch: {
        properties: {
          "derived-from": "itm_1",
          "job.status": "failed",
          "job.error": "Request timed out",
          "job.provider": "gemini",
        },
      },
    })!;
    s = apply(s, {
      type: "item.add",
      itemId: "itm_station",
      title: stationTitle("ada", "builder"),
      width: 360,
      height: 240,
      placement: { x: 900, y: 0, chosen: true },
      properties: stationProperties({
        handle: "ada",
        role: "builder",
        phase: "working",
        summary: "Drafting Acme spec",
        artifacts: ["itm_1"],
      }),
      version: nv("ver_st"),
    })!;
    s = apply(s, {
      type: "item.add",
      itemId: "itm_trace",
      title: "@ada trace",
      width: 300,
      height: 150,
      placement: { x: 920, y: 40, chosen: true },
      properties: traceProperties("itm_station", "ada"),
      version: nv("ver_tr"),
    })!;

    const graph = buildContextGraph(s, {
      mode: "full",
      leases: [{ itemId: "itm_1", handle: "ada", expiresAt: "2026-11-20T01:00:00.000Z" }],
      viewport: { x: -50, y: -50, width: 450, height: 350, zoom: 1 },
      selection: ["itm_1"],
    });

    expect(graph.items.some((i) => i.id === "itm_trace")).toBe(false);
    expect(graph.stations).toHaveLength(1);
    expect(graph.stations[0]!.summary).toContain("@ada · builder [working]");
    expect(graph.stations[0]!.summary.length).toBeLessThanOrEqual(160);

    const node1 = graph.items.find((i) => i.id === "itm_1")!;
    expect(node1.agentDescription).toBe("Acme product specification");
    expect(node1.leasedByHandle).toBe("ada");

    const node2 = graph.items.find((i) => i.id === "itm_2")!;
    expect(node2.failure).toMatch(/^\(FAILED: .+ — .+\)$/);

    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: "itm_1", to: "itm_2", relation: "edge:next", label: "feeds" }),
        expect.objectContaining({ from: "itm_1", to: "itm_2", relation: "derived-from" }),
      ]),
    );

    expect(graph.view?.fullyVisibleIds).toContain("itm_1");
    expect(graph.view?.offscreenIds).toContain("itm_station");
    expect(graph.suggestedFreeRegions.length).toBeGreaterThanOrEqual(2);
    expect(graph.suggestedFreeRegions[0]!.x).toBeGreaterThan(1260);

    const renderedFull = renderContextGraph(graph);
    expect(renderedFull).toContain("# CONTEXT GRAPH:");
    expect(renderedFull).toContain("Acme product specification");
    expect(renderedFull).toContain("[leased:@ada]");
    expect(renderedFull).toContain("(FAILED:");
    expect(renderedFull).not.toContain("itm_trace");

    const navGraph = buildContextGraph(s, { mode: "nav" });
    const renderedNav = renderContextGraph(navGraph);
    expect(renderedNav).toContain("# NAV INDEX:");
    expect(renderedNav).not.toContain("Acme product specification");
    expect(computeSuggestedFreeRegions([])).toEqual([
      { label: "origin", x: 0, y: 0, width: 480, height: 360 },
    ]);
  });
});
