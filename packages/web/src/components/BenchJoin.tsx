import type { Actor } from "@isocan/core";
import { benchWords } from "@isocan/core";
import { sendEchoed, useCanvasStore } from "../stores/canvasStore.ts";
import { useBench } from "../lib/bench.ts";
import "./yourbench.css";

/**
 * **Your bench, in the agents panel, with a Join on every row** (the bench,
 * journey 2).
 *
 * Theo opens a canvas Percy has never worked on, opens the agents panel, and
 * above *Add an agent…* sees the agents he already has. One click and Percy
 * is in the roster, the facepile and the mention candidates.
 *
 * **This is precisely the case `AddAgent`'s rule does not cover.** That rule —
 * *"no rc, no button"* — is right about introducing a STRANGER: the actor is
 * born first-claim on the machine that will answer for it, so with no rc
 * parked there is nothing that could make one, and a button that does nothing
 * is worse than no button (issue #81). An agent on your own bench is not a
 * stranger. Its actor exists, its custody is already settled, and naming it
 * on a fifth canvas asks nothing of any machine. So this section is gated on
 * having a bench, not on an rc being parked — and that is the whole of what
 * journey 2 fixes, because today bringing an agent to its fifth canvas is as
 * hard as bringing it to its first.
 *
 * **Joining confers nothing but standing here.** The op is `agent.invite`:
 * one canvas, no turn started, no `listen` rule written, no other canvas
 * touched. The reducer carries any existing rules across untouched, so a
 * second Join cannot widen who may summon.
 *
 * **And the row says, before the click, whether anything could answer.** Same
 * words the terminal prints, from `benchWords()` in core — never spelled
 * here, which `packages/web/test/yourbench.test.ts` holds. An enrolment that
 * cannot answer yet is legitimate; one that pretends it can answer is the
 * bug, so the sentence is on the row before anybody clicks rather than in a
 * disappointment afterwards.
 */
export function BenchJoin({ canvasId, actor }: { canvasId: string; actor: Actor }) {
  const { rows, canvasId: benchCanvasId } = useBench(actor.id);
  const agents = useCanvasStore((s) => s.canvas?.agents);

  // Nothing to offer is drawn as nothing, the shape `AddAgent` decided for
  // the same question: a heading over an empty list is a promise of a feature
  // rather than the feature. A person with no bench meets `isocan bench add`
  // in the identity menu, where their own things live.
  if (!rows || rows.length === 0 || !benchCanvasId) return null;

  return (
    <section className="tray-bench" aria-label="Your bench">
      <h4 className="tray-bench-head">Your bench</h4>
      <ul className="bench-rows">
        {rows.map((row) => {
          const here = agents?.[row.actorId] !== undefined;
          return (
            <li key={row.itemId} className="bench-row tray-bench-row">
              <span className="bench-name">{row.name}</span>
              <span className={`bench-reach ${row.reach}`}>{benchWords(row)}</span>
              {here ? (
                <span className="bench-where">answers here already</span>
              ) : (
                <button
                  className="btn tray-bench-join"
                  title={`Have ${row.name} answer on this canvas`}
                  onClick={() =>
                    void sendEchoed(canvasId, actor, {
                      type: "agent.invite",
                      agent: { id: row.actorId, name: row.name },
                      from: benchCanvasId,
                    })
                  }
                >
                  Join
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
