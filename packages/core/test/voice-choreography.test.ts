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
  DEFAULT_AGENT_DISPOSITION,
  PendingCallGate,
  SpeechBudget,
  detectFollowMeIntent,
  dispositionToPromptHint,
  normalizeAgentDisposition,
  parseMediaControlCommand,
} from "../src/voice-choreography.ts";

describe("PendingCallGate", () => {
  it("holds function response until paint ack resolves, then releases with summary", async () => {
    let now = 1000;
    const gate = new PendingCallGate({ timeoutMs: 5000, now: () => now });

    let resolved = false;
    const promise = gate
      .hold({
        callId: "call-1",
        name: "add_item",
        seq: 42,
        summary: 'I added "Acme Card".',
        response: { ok: true, itemId: "item-1" },
      })
      .then((rel) => {
        resolved = true;
        return rel;
      });

    expect(gate.pendingCount()).toBe(1);
    expect(gate.isPending("call-1")).toBe(true);
    expect(resolved).toBe(false);

    // Earlier seq does not release seq 42
    expect(gate.ackPaint(41)).toBe(0);
    expect(gate.isPending("call-1")).toBe(true);

    now = 1045;
    expect(gate.ackPaint(42)).toBe(1);
    const release = await promise;

    expect(resolved).toBe(true);
    expect(gate.pendingCount()).toBe(0);
    expect(release.visible).toBe(true);
    expect(release.reason).toBe("paint_ack");
    expect(release.waitedMs).toBe(45);
    expect(release.summary).toBe('I added "Acme Card".');
    expect(release.response).toEqual({
      ok: true,
      itemId: "item-1",
      visible: true,
      summary: 'I added "Acme Card".',
    });
  });

  it("supports markVisible, cancel, and timeout fallback", async () => {
    const gate = new PendingCallGate({ timeoutMs: 25 });

    const pVisible = gate.hold({ callId: "c-vis", name: "move_item", response: { ok: true } });
    expect(gate.markVisible("c-vis")).toBe(true);
    const rVis = await pVisible;
    expect(rVis.visible).toBe(true);
    expect(rVis.reason).toBe("visible");

    const pCancel = gate.hold({ callId: "c-can", name: "delete_item", response: { ok: true } });
    expect(gate.cancel("c-can")).toBe(true);
    const rCan = await pCancel;
    expect(rCan.visible).toBe(false);
    expect(rCan.reason).toBe("cancelled");

    const rTimeout = await gate.hold({ callId: "c-to", name: "resize_item", response: { ok: true } });
    expect(rTimeout.visible).toBe(false);
    expect(rTimeout.reason).toBe("timeout");
  });
});

describe("SpeechBudget", () => {
  it("blocks duplicate narration by normalized text or receipt/op key within window", () => {
    let now = 10_000;
    const budget = new SpeechBudget({ windowMs: 5_000, now: () => now });

    expect(budget.claim('I moved "Acme Card" to (10, 20).', "op:10")).toEqual({ allowed: true });
    // Same key, different phrasing -> blocked
    expect(budget.claim("Moved Acme Card.", "op:10")).toEqual({
      allowed: false,
      reason: "duplicate_key",
    });
    // Different key, equivalent normalized text -> blocked
    expect(budget.claim('  i moved "acme card" to (10, 20)  ', "op:11")).toEqual({
      allowed: false,
      reason: "duplicate_text",
    });
    // Empty text -> blocked
    expect(budget.canSpeak("   ")).toBe(false);

    // Advance past window -> allowed again
    now = 16_000;
    expect(budget.record('I moved "Acme Card" to (10, 20).', "op:10")).toBe(true);
    expect(budget.recent()).toHaveLength(1);
  });
});

describe("detectFollowMeIntent", () => {
  it("detects follow-me phrases and ignores unrelated speech", () => {
    expect(detectFollowMeIntent("Hey, follow me over here")).toBe(true);
    expect(detectFollowMeIntent("Look at this layout!")).toBe(true);
    expect(detectFollowMeIntent("Come look at the header")).toBe(true);
    expect(detectFollowMeIntent("Check this out")).toBe(true);
    expect(detectFollowMeIntent("Can you see what I'm looking at?")).toBe(true);

    expect(detectFollowMeIntent("")).toBe(false);
    expect(detectFollowMeIntent("Add a sticky note called Test")).toBe(false);
    expect(detectFollowMeIntent("Play the demo video")).toBe(false);
  });
});

describe("AgentDisposition", () => {
  it("defaults to 0.5 on all 5 axes and formats concise Live prompt hints", () => {
    expect(DEFAULT_AGENT_DISPOSITION).toEqual({
      initiative: 0.5,
      curiosity: 0.5,
      divergence: 0.5,
      depth: 0.5,
      partnering: 0.5,
    });
    expect(dispositionToPromptHint(DEFAULT_AGENT_DISPOSITION)).toBe("");

    const clamped = normalizeAgentDisposition({
      initiative: 1.5,
      curiosity: -0.2,
      depth: 0.1,
    });
    expect(clamped).toEqual({
      initiative: 1,
      curiosity: 0,
      divergence: 0.5,
      depth: 0.1,
      partnering: 0.5,
    });

    const hint = dispositionToPromptHint(clamped);
    expect(hint).toContain("[disposition]");
    expect(hint).toContain("act at once on plausible intent");
    expect(hint).toContain("pick sensible defaults without asking");
    expect(hint).toContain("keep spoken replies to 1 short sentence");
  });
});

describe("MediaControlCommand", () => {
  it("parses valid ephemeral commands and rejects incomplete ones", () => {
    expect(parseMediaControlCommand({ action: "play", itemId: "vid-1" })).toEqual({
      action: "play",
      itemId: "vid-1",
    });
    expect(parseMediaControlCommand({ action: "seek", itemId: "vid-1", timeSec: 42.5 })).toEqual({
      action: "seek",
      itemId: "vid-1",
      timeSec: 42.5,
    });
    expect(parseMediaControlCommand({ action: "find_by_transcript", query: "pricing" })).toEqual({
      action: "find_by_transcript",
      query: "pricing",
    });
    expect(parseMediaControlCommand({ action: "seek", itemId: "vid-1" })).toBeNull();
    expect(parseMediaControlCommand({ action: "find_by_transcript" })).toBeNull();
    expect(parseMediaControlCommand({ action: "bogus" })).toBeNull();
  });
});
