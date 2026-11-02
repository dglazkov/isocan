import { useCallback, useEffect, useMemo, useState } from "react";
import { benchAgents, benchFollowPatch, benchRows, type Actor, type BenchAgent, type BenchCanvas, type BenchRow } from "@isocan/core";
import { sendEchoedResult } from "../stores/canvasStore.ts";
import { fetchRcAnswering, getSnapshot, listCanvases } from "./api.ts";
import { personalApi } from "./personal.ts";

/**
 * **Reading a person's bench, once, for every panel that draws it.**
 *
 * It began inside `YourBench.tsx` and moved here the day a second panel
 * needed it (the bench, phase 1 — journey 2 puts **Join** on each bench row in
 * the AGENTS panel). The move is the isomorphism rule one level down: a
 * second copy of "find the personal canvas, snapshot every canvas this reader
 * can see, ask the daemon who is answering on each" would agree with the
 * first for about a week, and then one of them would learn something.
 *
 * **Nothing here decides anything.** Every word a panel prints comes from
 * `benchRows()` in `@isocan/core`, which is a fourth caller of `roster()` —
 * the same fold `isocan who`, the agent tray and the workbench read. This
 * fetches and hands over; `packages/web/test/yourbench.test.ts` fails if a
 * panel, or this reader, starts spelling one of the three states for itself.
 *
 * What a browser cannot measure it does not claim. The machine-local running
 * half — `~/.isocan/rc-agents.json` — is not readable from a tab, so the set
 * is passed empty and `elsewhere` is carried by the enrolments, which are
 * canvas state and travel. Likewise the sessions: the per-canvas presence
 * lists belong to the socket for the canvas you are looking at, so `ready`
 * here rests on the daemon's connection-bound rc holds, which is the
 * strongest fact available either way.
 */
export interface Bench {
  /** The rows, or null while the read is still out. */
  rows: BenchRow[] | null;
  /**
   * The personal canvas the rows were read off — what an `agent.invite`
   * carries as the bench that vouched. Null when this person has no bench
   * yet, which is also when `rows` is empty.
   */
  canvasId: string | null;
  error: string | null;
}

/**
 * **The bench as a RECORD, without measuring whether anything could answer.**
 *
 * The composer's `@Name` menu (phase 2, journey 3) needs the names on your
 * bench and nothing else: the row is offered because it is yours, not because
 * it is reachable, and `benchWords` never appears in a mention menu. So this
 * reads the one canvas the rows live on and stops, where `useBench` above goes
 * on to snapshot every canvas this reader can see and ask the daemon who is
 * answering on each — a walk the size of somebody's canvas list, paid on every
 * canvas page load if the composer used it.
 *
 * It is not a second derivation: both fold the SAME `benchAgents()` out of the
 * same canvas, and the thing `yourbench.test.ts` guards — that nobody spells
 * one of the three reachability states for itself — is untouched, because this
 * one computes no state at all.
 */
export async function readBenchAgents(
  actorId: string,
  signal?: AbortSignal,
): Promise<{ agents: BenchAgent[]; canvasId: string | null }> {
  const status = await personalApi.personalStatus(actorId, signal);
  const source = status.source?.state === "live" ? status.source.canvasId : null;
  if (!source) return { agents: [], canvasId: null };
  const mine = await getSnapshot(source, signal);
  return { agents: benchAgents(mine.canvas), canvasId: source };
}

/** The person's bench as rows with their reach, read live from their own
 *  canvas and the canvases they can see — the agents panel's and the identity
 *  menu's list. `rows` is null until it has loaded. */
export function useBench(actorId: string): Bench {
  const [bench, setBench] = useState<Bench>({ rows: null, canvasId: null, error: null });

  useEffect(() => {
    const control = new AbortController();
    void (async () => {
      try {
        const status = await personalApi.personalStatus(actorId, control.signal);
        const source = status.source?.state === "live" ? status.source.canvasId : null;
        if (!source) {
          if (!control.signal.aborted) setBench({ rows: [], canvasId: null, error: null });
          return;
        }
        const mine = await getSnapshot(source, control.signal);
        const canvases = await listCanvases();
        const seen = await Promise.all(
          canvases.map(async (canvas): Promise<BenchCanvas | null> => {
            const snapshot = await getSnapshot(canvas.id, control.signal).catch(() => null);
            if (!snapshot) return null;
            const answering = await fetchRcAnswering(canvas.id).catch(() => null);
            return {
              canvasId: canvas.id,
              canvasTitle: canvas.title,
              canvas: snapshot.canvas,
              sessions: [],
              ...(answering ? { answerable: new Set(answering.actorIds) } : {}),
            };
          }),
        );
        if (control.signal.aborted) return;
        setBench({
          rows: benchRows(
            benchAgents(mine.canvas),
            seen.filter((one): one is BenchCanvas => one !== null),
            new Set<string>(),
            Date.now(),
          ),
          canvasId: source,
          error: null,
        });
      } catch (err) {
        if (!control.signal.aborted) {
          setBench({
            rows: null,
            canvasId: null,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    })();
    return () => control.abort();
  }, [actorId]);

  return bench;
}

/**
 * **Follows me** — the switch that makes a bench agent your pet
 * (`docs/projects/pets`, phase 2, scenes 2 and 4), as a hook both bench panels
 * draw: under your face (`YourBench`) and in the agents panel (`BenchJoin`).
 *
 * One `item.update` on the row on your personal canvas, its patch spelled by
 * core's `benchFollowPatch` so this and `isocan bench follow` write the same
 * bytes. Flipping it invites the agent nowhere: following is acted on when you
 * next ARRIVE on a canvas you can edit (`lib/pets.ts`). Off takes it off
 * nothing — where it already stands, it stays.
 *
 * A hook here rather than a component of its own, and that is a measurement:
 * a component imported by both panels became a chunk of its own, and the
 * entry's preload list grew by its name — 34 bytes against a ceiling with a
 * hundred in it. Both panels already load this file.
 *
 * The bench is read once per panel, so the switch keeps its own word until the
 * next read rather than waiting on one; a refusal puts it back.
 */
export function useFollows(row: BenchAgent, benchCanvasId: string, actor: Actor): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(row.follows);
  const flip = useCallback(
    (next: boolean) => {
      setOn(next);
      void sendEchoedResult(benchCanvasId, actor, { type: "item.update", itemId: row.itemId, patch: benchFollowPatch(next) })
        .then((receipt) => { if (receipt.status === "refused") setOn(!next); })
        .catch(() => setOn(!next));
    },
    [benchCanvasId, actor, row.itemId],
  );
  return useMemo((): [boolean, (on: boolean) => void] => [on, flip], [on, flip]);
}

/** What the switch says on hover, spelled once for both panels. */
export const followsHint = (name: string): string =>
  `${name} comes along to every canvas you open and can edit, unless somebody removed it there`;
