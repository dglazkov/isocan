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
  CONTEXT_BUDGETS,
  MEMORY_FACETS,
  REFLECTION_SECTIONS,
  estimateTokens,
  packMemoryContext,
  parseReflectionDoc,
  renderReflectionDoc,
} from "../src/context-budget.ts";
import {
  POINTER_MIME,
  encodePointer,
  isPointerOwner,
  parsePointer,
} from "../src/pointer.ts";

describe("core/context-budget", () => {
  it("defines strict context budgets, facets, and reflection sections", () => {
    expect(CONTEXT_BUDGETS).toEqual({ project: 1800, personal: 1200, history: 1200 });
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
    expect(MEMORY_FACETS).toHaveLength(5);
    expect(REFLECTION_SECTIONS[0]).toBe("Your project guidance");
    expect(REFLECTION_SECTIONS).toHaveLength(8);
  });

  it("round-trips reflection markdown with guidance and Updated stamp", () => {
    const md = renderReflectionDoc({
      title: "Acme Workspace — Reflection",
      updatedAt: "2026-11-20T00:00:00.000Z",
      sections: {
        "Your project guidance": "- Always cite item ids.",
        "Current intent": "Drafting the launch brief for #item-1.",
        "Open threads": "- comment:t1: Verify contrast.",
      },
    });
    expect(md).toContain("_Updated: 2026-11-20T00:00:00.000Z_");
    const parsed = parseReflectionDoc(md);
    expect(parsed.title).toBe("Acme Workspace — Reflection");
    expect(parsed.updatedAt).toBe("2026-11-20T00:00:00.000Z");
    expect(parsed.sections["Your project guidance"]).toBe("- Always cite item ids.");
    expect(parsed.sections["Current intent"]).toBe("Drafting the launch brief for #item-1.");
    expect(parsed.sections["Open threads"]).toBe("- comment:t1: Verify contrast.");
  });

  it("packs explicit project guidance first and enforces per-tier budgets", () => {
    const longBody = "word ".repeat(1500);
    const packed = packMemoryContext({
      projectGuidance: "- Keep buttons high contrast.",
      reflection: {
        sections: {
          "Current intent": "Short intent",
          "Canvas state": longBody,
        },
      },
      personalObservations: [
        { facet: "quality_and_taste_bar", text: "Prefers crisp 1px borders.", confidence: 0.9, proofs: 3 },
        { facet: "identity_and_domains", text: "Low confidence note.", confidence: 0.3, proofs: 1 },
        { facet: "workflow_and_modality_patterns", text: longBody, confidence: 0.5, proofs: 1 },
      ],
      historyPassages: [
        { canvasId: "c1", itemId: "i1", title: "Acme Spec", text: "Relevant passage." },
        { canvasId: "c2", itemId: "i2", title: "Huge", text: longBody },
      ],
    });

    expect(packed.project.startsWith("## Your project guidance")).toBe(true);
    expect(packed.project).toContain("Keep buttons high contrast.");
    expect(packed.project).toContain("Short intent");
    expect(packed.tokens.project).toBeLessThanOrEqual(CONTEXT_BUDGETS.project);
    expect(packed.tokens.personal).toBeLessThanOrEqual(CONTEXT_BUDGETS.personal);
    expect(packed.tokens.history).toBeLessThanOrEqual(CONTEXT_BUDGETS.history);
    expect(packed.truncated).toEqual({ project: true, personal: true, history: true });
    expect(packed.personal.indexOf("Prefers crisp 1px borders.")).toBeLessThan(
      packed.personal.indexOf("Low confidence note."),
    );
  });
});

describe("core/pointer", () => {
  it("strips extra private fields when encoding a pointer", () => {
    expect(POINTER_MIME).toBe("application/vnd.isocan.pointer+json");
    const dirty = {
      ref: "about-alice:obs-1",
      ownerId: "actor-alice",
      facet: "quality_and_taste_bar",
      label: "Design taste",
      secretText: "NEVER_LEAK_THIS_PRIVATE_OBSERVATION",
    } as Parameters<typeof encodePointer>[0];

    const json = encodePointer(dirty);
    expect(json).not.toContain("NEVER_LEAK_THIS_PRIVATE_OBSERVATION");
    expect(json).not.toContain("secretText");

    const parsed = parsePointer(json);
    expect(parsed).toEqual({
      ref: "about-alice:obs-1",
      ownerId: "actor-alice",
      facet: "quality_and_taste_bar",
      label: "Design taste",
    });
  });

  it("checks ownership directly and via aliases", () => {
    const pointer = { ref: "c1:i1", ownerId: "actor-alice" };
    expect(isPointerOwner(pointer, "actor-alice")).toBe(true);
    expect(isPointerOwner(pointer, "actor-bob")).toBe(false);
    expect(isPointerOwner(pointer, "actor-alice-2", ["actor-alice"])).toBe(true);
    expect(isPointerOwner(pointer, null)).toBe(false);
  });
});
