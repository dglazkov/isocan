import { describe, expect, it } from "vitest";
// @ts-expect-error plain Node script; this is the command's implementation
import { snapshotFrom } from "../scripts/update-shard-weights.mjs";

const profile = (index: number) => ({
  revision: "acme", ciRun: "123.1", workers: 3, node: "v24", platform: "linux/x64", lane: "deep", filtered: false,
  shard: `${index}/2`, reason: "passed", errors: 0, failed: 0, files: 1, at: "2026-10-02T12:00:00Z",
  fileDurations: [{ file: `test/${index}.test.ts`, ms: index * 100, passed: true }],
});

describe("refreshing the shared shard weights", () => {
  it("is stable across artifact order", () => {
    const expected = snapshotFrom([profile(1), profile(2)]);
    expect(expected.weights).toEqual({ "test/1.test.ts": 100, "test/2.test.ts": 200 });
    expect(snapshotFrom([profile(2), profile(1)])).toEqual(expected);
  });

  it("refuses missing shards, duplicate shards and overlapping file inventories", () => {
    expect(() => snapshotFrom([])).toThrow();
    expect(() => snapshotFrom([profile(1)])).toThrow();
    expect(() => snapshotFrom([profile(1), profile(1)])).toThrow();
    expect(() => snapshotFrom([profile(1), { ...profile(2), fileDurations: profile(1).fileDurations }])).toThrow();
    expect(() => snapshotFrom([profile(1), profile(2)].map((p) => ({ ...p, workers: undefined })))).toThrow(/worker limit/);
  });

  it("refuses mixed, partial, failed, interrupted and incomplete measurements", () => {
    for (const bad of [{ revision: "other" }, { ciRun: "123.2" }, { workers: 2 }, { dirty: true }, { node: "other" }, { platform: "other" }, { filtered: true },
      { lane: "fast" }, { failed: 1 }, { errors: 1 }, { reason: "interrupted" }, { files: 2 }]) {
      expect(() => snapshotFrom([profile(1), { ...profile(2), ...bad }])).toThrow();
    }
  });
});
