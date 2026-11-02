/** A duration estimate changes scheduling only; discovery always owns coverage. */
export interface WeightedFile<T> {
  key: string;
  ms: number;
  value: T;
}

/** Longest first, with stable ties even when discovery returns a different order. */
export function longestFirst<T>(files: readonly WeightedFile<T>[]): WeightedFile<T>[] {
  return [...files].sort((a, b) => b.ms - a.ms || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/** Assign every discovered specification once to the lightest shard. */
export function balance<T>(files: readonly WeightedFile<T>[], count: number): WeightedFile<T>[][] {
  if (!Number.isInteger(count) || count < 1) throw new Error("shard count must be a positive integer");
  const shards: WeightedFile<T>[][] = Array.from({ length: count }, () => []);
  const totals = Array<number>(count).fill(0);
  for (const file of longestFirst(files)) {
    let lightest = 0;
    for (let i = 1; i < count; i++) {
      if (totals[i]! < totals[lightest]! ||
          (totals[i] === totals[lightest] && shards[i]!.length < shards[lightest]!.length)) lightest = i;
    }
    shards[lightest]!.push(file);
    totals[lightest]! += file.ms;
  }
  return shards;
}

/** Unknown or unusable measurements get a cost, never an exclusion. */
export function estimatedMs(weights: Record<string, number>, file: string): number {
  const ms = weights[file];
  return typeof ms === "number" && Number.isFinite(ms) && ms > 0 ? ms : 1000;
}
