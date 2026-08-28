import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { RAIL_INSET, railSpan } from "../src/lib/stage.ts";

/**
 * **How much room the rail takes is spelled once.**
 *
 * It used to be `panelWidth`, and every surface that had to stand beside the
 * rail wrote that itself plus a gap: the minimap `panelWidth + 14`, the file
 * hover card `panelWidth + 10`, the thread hover card the same. Four copies of
 * one fact, which was fine only because the fact was trivial.
 *
 * Phase 1 floated the rail and the fact stopped being trivial: the panel now
 * starts 20px in, so what it OCCUPIES is `20 + panelWidth`. `dockEdges` was
 * moved onto `railSpan` and framing stayed correct — and the three hand-copies
 * were missed, so all three landed 20px too far left and sat on the panel's
 * rounded corner. Reported as "the minimap overlaps", which was three bugs
 * wearing one coat.
 *
 * So: arithmetic on `panelWidth` belongs to `stage.ts`. Reading it to SIZE the
 * panel itself (`width: panelWidth`) is not arithmetic and is not the rule's
 * business — the rule is about anything that has to stand next to the rail,
 * because that is the thing that changes when the rail's shape changes.
 */
const SRC = fileURLToPath(new URL("../src", import.meta.url));

describe("the rail's footprint has one spelling", () => {
  it("is the inset plus the panel, and says so", () => {
    expect(railSpan(320)).toBe(RAIL_INSET + 320);
    // The floating rail's own inset — if this stops matching the stylesheet,
    // every surface beside the rail is wrong by the difference.
    const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
    const rule = /\.dock-panel\s*\{[^}]*\}/.exec(css)?.[0] ?? "";
    expect(rule, ".dock-panel must be inset by RAIL_INSET").toMatch(
      new RegExp(`left:\\s*${RAIL_INSET}px`),
    );
  });

  it("is not re-derived anywhere else", () => {
    /**
     * An ALLOWLIST, not a search for bad arithmetic. The first version of this
     * guard looked for `panelWidth +`, passed, and was useless: the line it
     * was written for reads `(panelOpen ? panelWidth : 0) + 14`, where the
     * arithmetic is on the parenthesis and not on the name. Enumerating the
     * three honest uses is the only version that cannot be side-stepped by
     * putting a bracket in the way.
     */
    const ALLOWED = [
      /s\.panelWidth/, // reading it out of the store
      /width: panelWidth/, // sizing the panel itself, which is not standing beside it
      /railSpan\(/, // going through the one spelling
    ];
    const offenders: string[] = [];
    for (const rel of readdirSync(SRC, { recursive: true, encoding: "utf8" })) {
      if (!rel.endsWith(".tsx") && !rel.endsWith(".ts")) continue;
      // Two homes, not exemptions: `uiStore` DECLARES the number and persists
      // it, `stage.ts` decides what it means for the layout. Everywhere else
      // is a consumer standing beside the rail, which is what the rule is for.
      if (rel.endsWith("lib/stage.ts") || rel.endsWith("stores/uiStore.ts")) continue;
      readFileSync(`${SRC}/${rel}`, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (!line.includes("panelWidth")) return;
          const code = line.trim();
          // Prose about the rule is not a breach of it — `CanvasPage` explains
          // the `innerWidth + panelWidth` hack this replaced.
          if (code.startsWith("//") || code.startsWith("*")) return;
          if (ALLOWED.some((ok) => ok.test(line))) return;
          offenders.push(`src/${rel}:${i + 1} — ${code}`);
        });
    }
    expect(offenders, "stand beside the rail with railSpan(), not by adding to panelWidth").toEqual(
      [],
    );
  });
});
