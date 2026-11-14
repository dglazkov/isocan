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
import type { ActorRegistry } from "@isocan/core";
import { actorsFromDocument, actorsToDocument } from "../src/cloud-store.ts";

/**
 * The actors snapshot document, both ways, with no Firestore in the room.
 *
 * The bug this guards has happened here twice already — `marks` dropped by a
 * writer that listed its fields, `capability` dropped by a reader that did
 * (#88) — and `joined` (multi-identity phase 5) is the next field to arrive.
 * The conformance suite asserts the same round trip against the emulator when
 * one is present; this holds it on every run.
 */
describe("the actors document", () => {
  it("carries every registry field through, joined included", () => {
    const full: Required<ActorRegistry> = {
      names: { usr_ada: { name: "Ada", at: "2026-01-01T00:00:00.000Z" } },
      colors: { usr_ada: "#0f8a80" },
      marks: { usr_ada: "⚓" },
      joined: { usr_ada_2: "usr_ada" },
      harnesses: { usr_ada: "claude-code" },
    };
    const doc = actorsToDocument(full, 7);
    expect(doc["lastSeq"]).toBe(7);
    expect(doc["joined"]).toEqual({ usr_ada_2: "usr_ada" });
    expect(doc["harnesses"]).toEqual({ usr_ada: "claude-code" });
    expect(actorsFromDocument(doc)).toEqual({ registry: full, lastSeq: 7 });
  });

  it("reads a document written before the field as nobody having joined", () => {
    const { registry, lastSeq } = actorsFromDocument({
      lastSeq: 3,
      names: { usr_ada: { name: "Ada", at: "2026-01-01T00:00:00.000Z" } },
      colors: {},
    });
    expect(lastSeq).toBe(3);
    expect(registry.joined).toEqual({});
    expect(registry.marks).toEqual({});
  });

  it("reads an empty document as the empty registry", () => {
    expect(actorsFromDocument(undefined).lastSeq).toBe(0);
    expect(actorsFromDocument(undefined).registry.names).toEqual({});
  });
});
