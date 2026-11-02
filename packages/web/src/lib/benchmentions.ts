/**
 * **Your bench, in the composer's `@` menu** (the bench, phase 2 — journey 3).
 *
 * Dion opens a canvas Sian has never seen, types `@S`, and Sian is offered —
 * marked *not here yet*, because she is on his bench and not on this canvas.
 * That marking is the whole reason the bench may be in the menu at all: a name
 * in an `@` menu reads as somebody who can hear you, and Sian cannot until the
 * next word is `join`.
 *
 * **Only the asker's bench, and nothing here could reach a second one.** The
 * read is `readBenchAgents(actor.id)` — one person's personal canvas — so
 * "Theo must not see Sian" is not a filter that could be forgotten, it is the
 * absence of any argument that would let it happen.
 *
 * **Fetched through `import()`, deliberately.** `lib/bench.ts` and core's
 * `benchRows` are behind a lazy boundary that `packages/web/test/yourbench.
 * test.ts` holds, and the Chat is on the canvas page — an ordinary import here
 * would put the whole bench reader into the chunk every first visit downloads,
 * which is the accident that test was written after. The hook is eager; what
 * it fetches is not.
 */
import { useEffect, useMemo, useState } from "react";
import { benchMentions, type BenchAgent, type BenchMention } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";

/** The asker's bench, ready to be handed to a composer. */
export interface BenchRoster {
  /** One candidate per bench row, each marked against the canvas in view. */
  mentions: BenchMention[];
  /**
   * The personal canvas the rows were read off — what an `agent.invite`
   * carries as the bench that vouched. Null when this person has no bench,
   * which is also when `mentions` is empty.
   */
  canvasId: string | null;
}

/** What a reader with no bench — or a bench that would not load — has. */
const NOBODY: { agents: BenchAgent[]; canvasId: string | null } = { agents: [], canvasId: null };

/**
 * This person's bench, marked against the canvas in view, for a composer.
 *
 * One actor id in, one personal canvas read — the shape is the permission.
 */
export function useBenchMentions(actorId: string): BenchRoster {
  const [read, setRead] = useState(NOBODY);
  // A subscription, not a read: an agent joining this canvas has to stop being
  // "not here yet" in the menu the moment the op lands.
  const canvas = useCanvasStore((s) => s.canvas);

  useEffect(() => {
    const control = new AbortController();
    void (async () => {
      try {
        const { readBenchAgents } = await import("./bench.ts");
        const bench = await readBenchAgents(actorId, control.signal);
        if (!control.signal.aborted) setRead(bench);
      } catch {
        // A bench that will not load offers no names. The canvas's own actors
        // still resolve, and the composer is not the place to report it.
      }
    })();
    return () => control.abort();
  }, [actorId]);

  return useMemo(
    () => ({ mentions: benchMentions(read.agents, canvas), canvasId: read.canvasId }),
    [read, canvas],
  );
}
