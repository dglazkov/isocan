import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

/**
 * **"Commit this here" means here — and the next gesture cannot forget it.**
 *
 * New items ask the daemon for a spot and are tidied clear of what is there,
 * which is right for a computed spot and wrong for one a person pointed at.
 * `Placement.chosen` is the wire's word for the difference. This file is the
 * guard the question asked for: every gesture that places at a POINTER
 * position must say `chosen`, every computed spot must not, and both ends
 * of the wire must honour it — so a new tool that forgets fails here, at
 * the moment it is written, instead of teleporting on commit.
 */
describe("every pointer-placed gesture says chosen", () => {
  it("the Text tool — the composer opened where you clicked", () => {
    expect(read("../src/components/TextComposer.tsx")).toContain("{ x: at.x, y: at.y, chosen: true }");
  });

  it("a drop on the canvas — files let go at the pointer", () => {
    expect(read("../src/components/CanvasViewport.tsx")).toContain("addFiles(canvasId, actor, files, { ...world, chosen: true })");
  });

  it("a paste at a point, and not a paste beside the originals", () => {
    const clipboard = read("../src/lib/clipboard.ts");
    expect(clipboard).toContain("placement: { x, y, ...(want ? { chosen: true } : {}) }");
  });

  it("a row of dropped files inherits the drop's intent", () => {
    expect(read("../src/lib/upload.ts")).toMatch(/\(placement as \{ chosen\?: boolean \}\)\.chosen \? \{ chosen: true \} : \{\}/);
  });
});

describe("computed spots stay tidyable", () => {
  it("the rail's file button and the workbench's ＋ compute a spot, and say so by saying nothing", () => {
    // Both place at a spot found for them — a clear spot in view, the middle
    // of the window — which nobody chose. They must not claim otherwise.
    expect(read("../src/components/CanvasTools.tsx")).not.toContain("chosen: true");
    expect(read("../src/components/WbFiles.tsx")).not.toContain("chosen: true");
  });
});

describe("both ends of the wire honour it", () => {
  it("core reads the flag, and only from coordinates", () => {
    const core = read("../../core/src/placement.ts");
    const fn = core.slice(core.indexOf("export function positionIsMeaningful"));
    expect(fn).toContain('if (!("x" in op.placement)) return false;');
    expect(fn).toContain("op.placement.chosen === true");
  });

  it("the daemon keeps the flag on the logged op", () => {
    expect(read("../../server/src/engine.ts")).toContain('"x" in op.placement && op.placement.chosen ? { chosen: true } : {}');
  });

  it("the CLI's --at is a chosen spot; --anchor and the default are not", () => {
    const cli = read("../../cli/src/main.ts");
    expect(cli).toContain("if (opts.at) return { ...parseXY(opts.at), chosen: true };");
    expect(cli).toContain("placement: { x, y, ...(opts.at ? { chosen: true } : {}) }");
    expect(cli).not.toContain("{ anchorItemId: resolveItem(snapshot, opts.anchor).id, chosen");
  });
});
