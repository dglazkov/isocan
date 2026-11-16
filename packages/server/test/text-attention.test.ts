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

import { describe, it, expect, vi } from "vitest";
import { textAttention, TEXT_ATTENTION_MS } from "@isocan/core";
import { PresenceHub } from "../src/presence.ts";

describe("text attention is ephemeral, not an ordinary session heartbeat", () => {
  const range = { itemId: "item", versionId: "version", blobHash: "blob", textSpace: "markdown-hast-v1" as const,
    flavor: "document" as const, start: 1, end: 7, expiresAt: 2000 };
  it("rejects malformed ranges and bounds future expiry", () => {
    expect(textAttention({ ...range, end: 0 }, 1000)).toBeNull();
    expect(textAttention({ ...range, start: 1.5 }, 1000)).toBeNull();
    expect(textAttention({ ...range, flavor: "html" }, 1000)).toBeNull();
    expect(textAttention(range, 2000)).toBeNull();
    expect(textAttention({ ...range, expiresAt: 1e12 }, 1000)?.expiresAt).toBe(1000 + TEXT_ATTENTION_MS);
  });
  it("survives a relay, clears explicitly and expires despite heartbeat traffic", () => {
    vi.useFakeTimers(); vi.setSystemTime(1000);
    const local = new PresenceHub(10000); const home = new PresenceHub(10000);
    try {
      const s = local.createSession("canvas", { id: "reader", name: "Taylor" }, "web");
      local.touch("canvas", s.sessionId, { textSelection: range });
      home.mirror("canvas", "replica", local.localRoster("canvas"));
      expect(home.roster("canvas")[0]?.textSelection).toEqual(range);
      vi.setSystemTime(2500); local.touch("canvas", s.sessionId, { cursor: { x: 2, y: 3 } });
      expect(local.roster("canvas")[0]?.textSelection).toBeNull();
      expect(home.roster("canvas")[0]?.textSelection).toBeNull();
      local.touch("canvas", s.sessionId, { textSelection: { ...range, expiresAt: 5000 } });
      local.touch("canvas", s.sessionId, { textSelection: null });
      expect(local.roster("canvas")[0]?.textSelection).toBeNull();
    } finally { local.close(); home.close(); vi.useRealTimers(); }
  });
});
