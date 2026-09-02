import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
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

/**
 * **The guard for code this file has never seen.**
 *
 * The cases above name today's producers. This scan does not: it walks both
 * surfaces for anything that builds a coordinate placement — a `placement:`
 * literal, a `Placement`-typed value, a call into the two helpers that take
 * one — and requires the word `chosen` within a few lines of it. Either the
 * flag is there, or a comment says why it is not (ink is meaningful by kind;
 * the middle of the window is a spot found for the file). A new tool that
 * places at a pointer and says neither fails here, with the line.
 */
describe("every coordinate placement on either surface says chosen, or says why not", () => {
  const roots = ["../src", "../../cli/src"].map((rel) => fileURLToPath(new URL(rel, import.meta.url)));
  const PRODUCER = /placement: \{|: Placement =|\bplacement = |\): Placement \{|\baddFiles\(|\baddTextNode\(/;
  const BEFORE = 6;
  const AFTER = 8;

  function* sources(dir: string): Generator<string> {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) yield* sources(full);
      else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts")) yield full;
    }
  }

  it("finds the producers it is meant to guard", () => {
    // If this scan ever matches nothing, it is guarding nothing.
    const hits = [...roots.flatMap((r) => [...sources(r)])].filter((f) => PRODUCER.test(readFileSync(f, "utf8")));
    expect(hits.length).toBeGreaterThanOrEqual(6);
  });

  for (const root of roots) {
    for (const file of sources(root)) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (!PRODUCER.test(line)) return;
        // Definitions and imports are not producers.
        if (/^\s*(export )?(async )?function |^\s*import /.test(line)) return;
        // Reading a placement back off the wire is not producing one.
        if (/\.placement;?\s*$/.test(line)) return;
        it(`${file.slice(file.lastIndexOf("/packages/") + 10)}:${i + 1} — ${line.trim().slice(0, 60)}`, () => {
          const window = lines.slice(Math.max(0, i - BEFORE), i + AFTER + 1).join("\n");
          expect(window, "say `chosen: true`, or say in a comment why this spot is not chosen").toMatch(/chosen/);
        });
      });
    }
  }
});
