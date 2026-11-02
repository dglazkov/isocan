/**
 * **One writer queue per canvas** — the engine's locks, and nothing else.
 *
 * The engine used to serialize every mutation on this daemon through ONE
 * promise chain, which made it correct for free and made it exactly as fast
 * as its slowest occupant. A forwarded write holds its turn across the round
 * trip to its home, so one slow home paused every write on the machine —
 * canvases homed here included, canvases at other homes included. Lessons #95
 * took the chores' network waits off the chain; this takes the chain apart,
 * so a write's own round trip pauses only the canvas it is a write to.
 *
 * A task names the KEYS it needs (`canvasKey(id)`, `HOME_KEY`, …) and runs
 * once every earlier task on any of those keys has finished. Keys are the
 * whole vocabulary: a canvas is one key, the home-scoped identity state is
 * another, and a task that spans several takes them all at once. `exclusive`
 * is the old single chain, kept for work that cannot say up front what it
 * touches: it waits for every key and everything after it waits for it.
 *
 * **Why this cannot deadlock.** Every wait is decided synchronously, at the
 * moment a task is registered, and only ever on tasks registered BEFORE it.
 * The waits-for graph therefore follows registration order and has no
 * cycles, however many keys a task takes and in whatever order two tasks name
 * them. (The keys are still sorted, so the rule reads as a fixed order to
 * anyone who looks for one.) The one way left to deadlock is re-entrance —
 * a task that awaits a NEW task on a key it holds, which waits for the task
 * awaiting it — and that was true of the single chain too: nothing inside
 * queued work may queue work and wait for it.
 *
 * A task that throws releases its keys exactly as one that returns does, so a
 * failure never poisons the queue behind it.
 */
export class WriterChains {
  /** The last task registered on each key; deleted once it settles and nothing followed it. */
  private readonly tails = new Map<string, Promise<void>>();
  /** The last `exclusive` task — every later task waits for it. */
  private barrier: Promise<void> = Promise.resolve();

  /** Run `work` once every earlier task on any of `keys` (and any earlier exclusive task) has finished. */
  run<T>(keys: readonly string[], work: () => Promise<T>): Promise<T> {
    const sorted = [...new Set(keys)].sort();
    const prior = Promise.all([this.barrier, ...sorted.map((key) => this.tails.get(key))]);
    const result = prior.then(() => work());
    const done = result.then(settle, settle);
    for (const key of sorted) {
      this.tails.set(key, done);
      void done.then(() => {
        if (this.tails.get(key) === done) this.tails.delete(key);
      });
    }
    return result;
  }

  /** Run `work` after EVERYTHING registered so far, holding off everything registered after it. */
  exclusive<T>(work: () => Promise<T>): Promise<T> {
    const prior = Promise.all([this.barrier, ...this.tails.values()]);
    const result = prior.then(() => work());
    this.barrier = result.then(settle, settle);
    return result;
  }

  /**
   * Resolves when every task registered so far on these keys has finished —
   * or, with no keys, every task registered so far on any key. It registers
   * nothing, so it holds nothing up.
   */
  idle(keys?: readonly string[]): Promise<void> {
    const waits = keys ? keys.map((key) => this.tails.get(key)) : [...this.tails.values()];
    return Promise.all([this.barrier, ...waits]).then(settle);
  }
}

/** The key of one canvas's writer queue. */
export const canvasKey = (canvasId: string): string => `canvas:${canvasId}`;

/**
 * The key of the home-scoped identity state: the actor registry (names,
 * colours, marks, joins) and the desk's claims. Its writers are
 * read-modify-writes over state no canvas owns, so they serialize against
 * each other here — and NOT against canvas writes, which only ever read it.
 */
export const HOME_KEY = "home";

/** The key personal-canvas workflows share, so two of them never interleave their desk records. */
export const PERSONAL_KEY = "personal";

function settle(): void {}
