import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { TestSpecification, Vitest } from "vitest/node";
import DurationSequencer from "./shard-sequencer.ts";
import { balance, estimatedMs } from "./sharding.ts";

describe("duration sharding", () => {
  const files = [100, 90, 80, 70, 60, 50, 40, 30].map((ms, i) => ({ key: `file-${i}`, ms, value: i }));

  it("balances known unequal work instead of equal file counts", () => {
    const shards = balance(files, 4);
    expect(shards.map((shard) => shard.reduce((sum, file) => sum + file.ms, 0))).toEqual([130, 130, 130, 130]);
  });

  it("is independent of discovery order, including ties and unseen files", () => {
    const tied = files.map((file) => ({ ...file, ms: 1000 }));
    expect(balance([...tied].reverse(), 3)).toEqual(balance(tied, 3));
    expect(balance([...files].reverse(), 4)).toEqual(balance(files, 4));
  });

  it("partitions every input exactly once for empty, small and uneven inventories", () => {
    for (let size = 0; size <= files.length; size++) {
      for (let count = 1; count <= 10; count++) {
        const input = files.slice(0, size);
        expect(balance(input, count).flat().map((file) => file.value).sort()).toEqual(input.map((file) => file.value).sort());
      }
    }
    expect(() => balance(files, 0)).toThrow();
    expect(() => balance(files, 1.5)).toThrow();
  });

  it("uses an estimate for absent, zero and invalid costs", () => {
    for (const weights of [{}, { new: 0 }, { new: -1 }, { new: NaN }, { new: Infinity }]) {
      expect(estimatedMs(weights, "new")).toBe(1000);
    }
    expect(estimatedMs({ known: 52 }, "known")).toBe(52);
  });

  it("the Vitest adapter partitions discovered specs, including new files and repeated paths in projects", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "isocan-shards-"));
    const { mkdirSync } = await import("node:fs");
    mkdirSync(path.join(root, "test"));
    writeFileSync(path.join(root, "test/shard-weights.json"), JSON.stringify({ weights: { "known.test.ts": 100, "deleted.test.ts": 9000 } }));
    const specs = ["known.test.ts", "new.test.ts", "renamed.test.ts", "known.test.ts"].map((file, i) => ({
      moduleId: path.join(root, file), project: { name: i === 3 ? "second" : "" }, pool: "forks",
    })) as TestSpecification[];
    try {
      const results = [];
      for (let index = 1; index <= 4; index++) {
        const sequencer = new DurationSequencer({ config: { root, shard: { index, count: 4 } } } as Vitest);
        const selected = await sequencer.shard([...specs].reverse());
        results.push(...await sequencer.sort(selected));
      }
      expect(results).toHaveLength(specs.length);
      expect(new Set(results)).toEqual(new Set(specs));
    } finally { rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
  });
});
