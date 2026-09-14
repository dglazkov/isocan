import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Item } from "@isocan/core";
import { prunedVersions } from "@isocan/core";
import { FAN_LIVE, PRUNE_KEEP, PRUNE_OFFER_DEPTH } from "../src/components/VersionFanOut.tsx";

/**
 * **The fan is the one place the canvas ever paid for every version at once.**
 *
 * The ordinary render fetches an item's current version and nothing else —
 * measured at 14 items × 150 versions: the snapshot in 16 ms, one blob per
 * item. Fanning a stack out used to mount a live document per version, so a
 * silted stack (a generator republishing on every commit) was 150 iframes
 * and 150 blob fetches for a gesture meant to compare the last few. The
 * window is held here so it cannot quietly go back to "all of them".
 *
 * The offer to prune is held to the same rule the reducer applies — an offer
 * that names a number a different function would keep is a lie with a
 * button on it.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const styles = readFileSync(path.join(here, "../src/styles.css"), "utf8");

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

describe("the version fan", () => {
  it("mounts a bounded number of live documents, and folds the rest", () => {
    expect(FAN_LIVE).toBeGreaterThanOrEqual(8);
    expect(FAN_LIVE).toBeLessThanOrEqual(40);
    // The folded card has a body to say so in — not a rule that hides it.
    expect(styles).toMatch(/\.fan-card\.folded \.fan-body \{[^}]*display: flex/);
  });

  it("offers to prune only past a depth a person does not make by hand", () => {
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
