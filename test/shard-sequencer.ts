import { readFileSync } from "node:fs";
import path from "node:path";
import { BaseSequencer, type TestSpecification } from "vitest/node";
import { balance, estimatedMs, longestFirst, type WeightedFile } from "./sharding.ts";

/**
 * All runners read the same committed snapshot. A per-runner cache could give
 * different partitions and silently omit files. Stale estimates only affect
 * speed: Vitest's discovered specifications, not the snapshot, are partitioned.
 */
export default class DurationSequencer extends BaseSequencer {
  private weighted(files: TestSpecification[]): WeightedFile<TestSpecification>[] {
    const { weights } = JSON.parse(readFileSync(path.join(this.ctx.config.root, "test/shard-weights.json"), "utf8")) as {
      weights: Record<string, number>;
    };
    return files.map((spec) => {
      const file = path.relative(this.ctx.config.root, spec.moduleId).split(path.sep).join("/");
      return { key: `${spec.project.name}:${file}:${spec.pool}`, ms: estimatedMs(weights, file), value: spec };
    });
  }

  override async shard(files: TestSpecification[]): Promise<TestSpecification[]> {
    const shard = this.ctx.config.shard;
    if (!shard) return files;
    return balance(this.weighted(files), shard.count)[shard.index - 1]!.map((file) => file.value);
  }

  override async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    // Keep local Vitest's failed-first cache. CI starts without that cache.
    if (!this.ctx.config.shard) return super.sort(files);
    return longestFirst(this.weighted(files)).map((file) => file.value);
  }
}
