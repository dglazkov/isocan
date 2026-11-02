/**
 * **Pets follow** (`docs/projects/pets`, phase 2, scene 3) — on arrival, bring
 * the agents on your bench that follow you.
 *
 * Called once per arrival by `CanvasPage`'s arrival effect, after the
 * snapshot, through `import()`: this file and the bench reader it pulls in are
 * behind a lazy boundary, so a first visit's entry chunk pays only the call.
 *
 * **No new op and no new decision.** Which agents come is `petsToBring` in
 * core — following, not already standing here, never withdrawn from here, and
 * nothing at all on a canvas this person cannot edit. Each is sent the same
 * `agent.invite` the panel's **Join** and `@Name join` send, and on the home's
 * receipt — never on the optimistic echo — the thread gets ONE line naming the
 * owner. A refusal says nothing: a pet that was turned away is not news for
 * the room.
 *
 * **Never a loop.** An arrival invites each pet at most once, and a second
 * call for the same arrival while one is out (React's double effect, a quick
 * re-render) finds it in `running` and does nothing.
 */
import type { Actor } from "@isocan/core";
import { petCameWords, petsToBring } from "@isocan/core";
import { sendEchoedResult, useCanvasStore } from "../stores/canvasStore.ts";
import { readBenchAgents } from "./bench.ts";
import { canEditNow } from "./capability.ts";
import { postToMain } from "./mainthread.ts";

const running = new Set<string>();

/**
 * The home's own word on this canvas, before anything is decided: the
 * capability arrives with the socket's snapshot, and a canvas drawn from this
 * tab's cache before then reads as `edit` by default — which on a canvas
 * shared read-only would send an invite the home then refuses. Resolves false
 * if the snapshot never comes, and the arrival brings nobody.
 */
function live(canvasId: string): Promise<boolean> {
  const ready = () => {
    const s = useCanvasStore.getState();
    return s.canvasId === canvasId && s.connection === "live" && s.canvas !== null;
  };
  if (ready()) return Promise.resolve(true);
  return new Promise((resolve) => {
    const stop = useCanvasStore.subscribe(() => {
      if (!ready()) return;
      stop();
      clearTimeout(timer);
      resolve(true);
    });
    const timer = setTimeout(() => { stop(); resolve(false); }, 30_000);
  });
}

/** On arrival at a canvas the person can edit, invite every bench agent that
 *  follows them and is not here or withdrawn from here, and say so once in the
 *  thread (pets phase 2). At most one run per canvas and person at a time. */
export async function bringPets(canvasId: string, actor: Actor): Promise<void> {
  const key = `${canvasId}:${actor.id}`;
  if (running.has(key)) return;
  running.add(key);
  try {
    const { agents, canvasId: benchCanvasId } = await readBenchAgents(actor.id);
    if (!agents.some((row) => row.follows) || !(await live(canvasId))) return;
    // Still here? An arrival that has become a departure brings nobody.
    const here = () => useCanvasStore.getState().canvasId === canvasId ? useCanvasStore.getState().canvas : null;
    const canvas = here();
    // Never onto the bench itself: the personal canvas is where the rows
    // live, not a room the pets stand in.
    if (!benchCanvasId || !canvas || benchCanvasId === canvasId) return;
    for (const pet of petsToBring(agents, canvas, canEditNow())) {
      const receipt = await sendEchoedResult(canvasId, actor, {
        type: "agent.invite",
        agent: { id: pet.actorId, name: pet.name },
        from: benchCanvasId,
      });
      if (receipt.status !== "accepted" || !here()) continue;
      await postToMain(canvasId, actor, petCameWords(pet.name, actor.name));
    }
  } catch {
    // A bench that will not load, or a home that will not answer, brings no
    // pets this time; the canvas is not the place to report it.
  } finally {
    running.delete(key);
  }
}
