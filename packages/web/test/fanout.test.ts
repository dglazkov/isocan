import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Item } from "@isocan/core";
import { prunedVersions } from "@isocan/core";
import { PRUNE_KEEP, PRUNE_OFFER_DEPTH } from "../src/components/VersionFanOut.tsx";

/**
 * **The offer to bound a silted version stack.**
 *
 * Fanning a stack out is the one gesture that ever put every version of an
 * item on the canvas at once; a generator republishing on each commit silts
 * a stack to 150 and the fan is then a row nobody reads the end of. Drawing
 * that row is `VersionFanOut`'s own problem and it solves it by drawing a
 * card's document only once the card is on screen — this file is about the
 * other half, the offer to actually cut the stack down.
 *
 * The offer is held to the same rule the reducer applies: an offer that
 * names a number a different function would keep is a lie with a button on
 * it. And it must never appear with nothing to drop, because a destructive
 * button that does nothing teaches people to press destructive buttons.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const styles = readFileSync(path.join(here, "../src/components/version-fan.css"), "utf8");

const stack = (depth: number, current = depth): Item =>
  ({
    id: "itm_a",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    title: "a",
    properties: {},
    currentVersionId: `ver_${current}`,
    versions: Array.from({ length: depth }, (_, n) => ({
      id: `ver_${n + 1}`,
      blobHash: "h",
      mimeType: "text/plain",
      filename: "a.txt",
      size: 1,
    })),
  }) as unknown as Item;

describe("the version fan's prune offer", () => {
  it("offers only past a depth a person does not make by hand", () => {
    expect(PRUNE_OFFER_DEPTH).toBeGreaterThanOrEqual(PRUNE_KEEP);
    // An offer must always have something to drop.
    expect(prunedVersions(stack(PRUNE_OFFER_DEPTH + 1), PRUNE_KEEP).length).toBeGreaterThan(0);
    expect(prunedVersions(stack(PRUNE_OFFER_DEPTH), PRUNE_KEEP)).toEqual([]);
  });

  it("keeps the current version whatever the offer drops", () => {
    const item = stack(PRUNE_OFFER_DEPTH * 3, 2);
    const dropped = prunedVersions(item, PRUNE_KEEP).map((v) => v.id);
    expect(dropped).not.toContain("ver_2");
    expect(dropped).toContain("ver_1");
    expect(styles).toMatch(/\.fan-prune \{/);
  });
});
