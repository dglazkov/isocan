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
  HOUSE_HANDLE,
  HOUSE_ROLE,
  HOUSE_SESSION_KEY,
  encodeHouseMeta,
  instantAck,
  parseHouseMeta,
  type HouseCommentMeta,
} from "../src/house-agent.ts";

describe("house-agent core contract", () => {
  it("exports canonical house constants", () => {
    expect(HOUSE_HANDLE).toBe("house");
    expect(HOUSE_ROLE).toBe("house");
    expect(HOUSE_SESSION_KEY).toBe("agent:house");
  });

  it("produces deterministic first-person future-tense instantAck and never says Thinking", () => {
    const prompts = [
      "",
      "Add a login card to the canvas",
      "Fix the header copy",
      "Arrange these sticky notes",
      "Delete the old draft",
      "Summarize the architecture",
      "hello there",
    ];
    for (const prompt of prompts) {
      const ack = instantAck(prompt);
      expect(ack.startsWith("I'll ")).toBe(true);
      expect(ack.toLowerCase()).not.toContain("thinking");
      expect(instantAck(prompt)).toBe(ack);
    }
  });

  it("round-trips HouseCommentMeta cleanly through encodeHouseMeta and parseHouseMeta", () => {
    const meta: HouseCommentMeta = {
      ack: "I'll read the canvas and create that for you.",
      thoughtTrace: [
        "Read 4 items in context graph",
        "Picked free region at (120, 80)",
      ],
      plan: {
        title: "Add hero card",
        steps: [
          { id: "s1", label: "Read context graph", state: "done" },
          { id: "s2", label: "Create markdown card", state: "done" },
          { id: "s3", label: "Post receipt", state: "active" },
        ],
      },
      goal: { state: "running", wave: 2 },
    };

    const encoded = encodeHouseMeta("I added \"Hero Card\".", meta);
    const parsed = parseHouseMeta(encoded);
    expect(parsed.body).toBe("I added \"Hero Card\".");
    expect(parsed.meta).toEqual(meta);
  });

  it("handles comments without metadata or with malformed metadata safely", () => {
    expect(parseHouseMeta("Plain comment")).toEqual({
      body: "Plain comment",
      meta: null,
    });
    expect(parseHouseMeta("Hello\n\n<!-- isocan:house-meta:{bad json -->")).toEqual({
      body: "Hello",
      meta: null,
    });
  });
});
