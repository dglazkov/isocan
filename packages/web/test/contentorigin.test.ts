import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { blobUrl } from "../src/lib/api.ts";
import { adoptContentBase, contentBase } from "../src/lib/contentBase.ts";
import { itemFrame } from "../src/lib/frame.ts";

/**
 * Stage 1 of the content-origin plan
 * (`docs/projects/atlas/content-origin-plan.md`): the seam, with nothing
 * routed to it. These are the plan's invariants 1 and 2 as tests, written
 * BEFORE any base exists so the flip in stage 2 changes code, not contracts.
 */

describe("invariant 2: the sandbox upgrade is keyed to the split, never to a flag", () => {
  it("no content base → exactly today's frame, byte for byte", () => {
    const frame = itemFrame(null, "prj_1", "blob_abc");
    expect(frame.src).toBe(blobUrl("prj_1", "blob_abc"));
    expect(frame.sandbox).toBe("allow-scripts");
  });

  it("a content base → src moves origin AND the grant arrives, together", () => {
    for (const base of ["http://127.0.0.1:4442", "https://content.example.com"]) {
      const frame = itemFrame(base, "prj_1", "blob_abc");
      expect(frame.src).toBe(`${base}${blobUrl("prj_1", "blob_abc")}`);
      expect(frame.sandbox).toBe("allow-scripts allow-same-origin");
    }
  });

  it("the pair app-origin src + allow-same-origin is unbuildable", () => {
    // The property itself, across every input shape: allow-same-origin
    // appears exactly when the src is an absolute URL on another origin.
    // A same-origin path NEVER carries the grant — that pair is the
    // whole-home compromise the content-origin proposal opens with.
    for (const base of [null, "http://127.0.0.1:4442", "https://content.example.com"]) {
      const frame = itemFrame(base, "prj_1", "blob_abc");
      const crossOrigin = frame.src.startsWith("http");
      expect(frame.sandbox.includes("allow-same-origin")).toBe(crossOrigin);
    }
  });

  it("ItemView builds its html frame through itemFrame — the one builder", () => {
    const source = readFileSync(
      new URL("../src/components/ItemView.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("itemFrame(contentBase(), canvasId, blobHash)");
    // The old hand-paired frame must not come back: an html-view src with a
    // literal sandbox is a second place deciding the pair.
    expect(source).not.toMatch(/className="html-view"\s+src=\{url\}\s+sandbox="/);
  });
});

describe("stage 2: the tab learns the base at boot", () => {
  it("main.tsx asks beside the color and name loads, fire-and-forget", () => {
    const source = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");
    expect(source).toContain("void loadContentBase()");
  });
});

describe("invariant 1: unconfigured means today", () => {
  it("the tab starts with no content base, and adopt is reversible", () => {
    // Module state starts null — nothing sets it until stage 2's boot fetch —
    // and null is the fallback for a failed or absent advertisement too, so
    // clearing must restore today's behavior exactly.
    expect(contentBase()).toBe(null);
    adoptContentBase("http://127.0.0.1:4442");
    expect(contentBase()).toBe("http://127.0.0.1:4442");
    adoptContentBase(null);
    expect(contentBase()).toBe(null);
    expect(itemFrame(contentBase(), "prj_1", "b").sandbox).toBe("allow-scripts");
  });
});
