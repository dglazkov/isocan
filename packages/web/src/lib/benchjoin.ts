/**
 * **`@Name join`, carried out** (the bench, phase 2 — journey 3).
 *
 * The line the composer recognised, turned into the same `agent.invite` the
 * tray's **Join** and `isocan bench join` send. **No new op**: joining from a
 * sentence and joining from a button are one act, and one act is one undo.
 *
 * Two things this file is careful about, both of which are the phase rather
 * than the plumbing.
 *
 * **The refusal is core's, unchanged, and it is given only the name.** A line
 * that named nobody on YOUR bench is refused with `benchJoinRefusal`, which
 * cannot tell "on somebody else's bench" from "nowhere at all" because it is
 * handed nothing that would distinguish them. The second `ask.actorId === null`
 * arm below — no bench canvas — deliberately produces the identical sentence
 * rather than a better-informed one.
 *
 * **One line in the thread, when it lands.** The ask was made in the Chat, so
 * the answer belongs in the Chat: the canvas is the only channel, and a toast
 * is a second one that nobody else on this canvas can read. Nothing is posted
 * when the join does not land — a refusal is for the person who typed it, and
 * posting it would tell the whole canvas which names somebody tried.
 */
import type { Actor, BenchJoinAsk } from "@isocan/core";
import { benchJoinRefusal, benchJoinWords } from "@isocan/core";
import { sendEchoedResult } from "../stores/canvasStore.ts";
import type { BenchRoster } from "./benchmentions.ts";
import { postToMain } from "./mainthread.ts";

/**
 * Carry out the ask, or say why not.
 *
 * Returns what to tell the ASKER — a refusal, or the note that the agent
 * already answers here — and null when the join landed and the thread now
 * carries its line. One channel for both, because both are answers to a
 * sentence somebody typed and neither is news for the canvas.
 */
export async function joinFromChat(
  canvasId: string,
  actor: Actor,
  ask: BenchJoinAsk,
  bench: BenchRoster,
): Promise<string | null> {
  const row = ask.actorId === null ? undefined : bench.mentions.find((one) => one.id === ask.actorId);
  if (!row || bench.canvasId === null) return benchJoinRefusal(ask.name);
  // Already standing is not a refusal and not a second grant: the reducer
  // would preserve the existing rules anyway, and sending the op regardless
  // would put a second line in the thread saying something that was already
  // true.
  if (!row.notHereYet) return `${row.name} already answers here`;
  // The RECEIPT decides, not the optimistic echo: `sendEchoed` applies the op
  // locally before the home has seen it, so reading the store back would say
  // "she is here" for an invite the home refused. The thread's line is a
  // record, and a record must not be written from a guess.
  const receipt = await sendEchoedResult(canvasId, actor, {
    type: "agent.invite",
    agent: { id: row.id, name: row.name },
    from: bench.canvasId,
  });
  if (receipt.status !== "accepted") {
    return receipt.message ?? `${row.name} has not arrived yet — this canvas's home has not confirmed it.`;
  }
  await postToMain(canvasId, actor, benchJoinWords(row.name));
  return null;
}
