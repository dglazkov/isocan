import { describe, expect, it } from "vitest";
import { blobsInProperties } from "../src/index.ts";
import type { CanvasState } from "../src/index.ts";

const HASH = "a".repeat(64);
const OTHER = "b".repeat(64);

const state = (over: {
  canvasProps?: Record<string, string>;
  itemProps?: Record<string, string>;
  trashProps?: Record<string, string>;
}): CanvasState =>
  ({
    project: { id: "prj_1", title: "T", properties: over.canvasProps ?? {} },
    canvas: {
      items: over.itemProps
        ? { itm_1: { id: "itm_1", properties: over.itemProps, versions: [] } }
        : {},
      threads: {},
      trash: over.trashProps
        ? [{ item: { id: "itm_2", properties: over.trashProps, versions: [] } }]
        : [],
    },
  }) as unknown as CanvasState;

/**
 * **A blob a property names is a blob somebody is using.**
 *
 * The sweeper marks a blob reachable from item versions, the trash, and
 * retained log entries — and that was the whole of it. Correct today, because
 * nothing names a blob from a property; wrong the moment something does, and a
 * home sweeps itself on an hour's timer. A custom background (#204) is a tile
 * stored exactly that way, so it would have gone within the hour with nothing
 * logged and nothing to see.
 *
 * Written before the feature rather than after the bug report.
 */
describe("blobs a property names", () => {
  it("finds one on the canvas record, where a background would live", () => {
    // The canvas's own properties are on the RECORD, not on its contents —
    // which is why this takes the whole state. A signature over
    // `CanvasContents` could not see the thing this exists for.
    expect([...blobsInProperties(state({ canvasProps: { tile: HASH } }))]).toEqual([HASH]);
  });

  it("finds one on an item, and one in the trash", () => {
    /* An item property may name a blob that is not one of its own versions — a
       poster frame, a generated thumbnail — and the sweeper cannot tell that
       from a tile. The trash counts because a restore must find its bytes. */
    expect([...blobsInProperties(state({ itemProps: { poster: HASH } }))]).toEqual([HASH]);
    expect([...blobsInProperties(state({ trashProps: { poster: OTHER } }))]).toEqual([OTHER]);
  });

  it("ignores everything that is not a hash", () => {
    /* Matched by SHAPE rather than by a list of blessed property names, which
       would be a second thing to keep right and would fail silently — the
       exact shape this file exists to prevent. `export.ts`'s `blobsNamedBy`
       made the same call for the log: "a new op that names bytes is backed up
       the day it ships rather than the day somebody remembers this." */
    const props = {
      parent: "itm_9xKq",
      canvas: "prj_1gmxsUOdQM",
      tint: "#0b2733",
      shelved: "2026-09-07T10:00:00.000Z",
      theme: "galaxy",
      short: "a".repeat(63),
      long: "a".repeat(65),
      upper: "A".repeat(64),
    };
    expect([...blobsInProperties(state({ canvasProps: props }))]).toEqual([]);
  });

  it("errs toward keeping, because the two mistakes are not equal", () => {
    /* A false positive retains bytes nobody needs, which a later sweep
       reclaims once the property goes. A false negative deletes somebody's
       work. So a 64-char hex string is treated as a hash wherever it appears,
       even under a key nothing has ever used. */
    expect([...blobsInProperties(state({ canvasProps: { somethingNobodyHasWrittenYet: HASH } }))]).toEqual([HASH]);
  });

  it("says nothing about a canvas with no properties at all", () => {
    expect([...blobsInProperties(state({}))]).toEqual([]);
  });
});
