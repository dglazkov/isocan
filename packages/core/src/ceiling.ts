import type { CanvasContents } from "./model.ts";
import type { Operation } from "./ops.ts";

/**
 * **A ceiling on one agent's standing on one canvas** (critique phase 2,
 * design §4). The badge's capability says what its holder may do; a ceiling
 * says what ONE of the actors riding that badge may do on ONE canvas, and it
 * is asked after the capability, so it can only ever narrow.
 *
 * There is one ceiling, `note`, and it is a critic's: it may pin a thread to
 * an item, reply in a thread, and react to an item (with or without a
 * point). Everything else it sends is refused with this code and a
 * sentence, before anything is written.
 *
 * It lives on the enrolment row (`EnrolledAgent.ceiling`), which is canvas
 * state: the home that applies the op is the one holding the row, so a
 * replica that forwards an op to a home cannot be the only thing standing in
 * the way, and the CLI and the web read the same refusal from the same place.
 */
export const BEYOND_CEILING = "beyond-ceiling";

/** Whether an op fits under the `note` ceiling. */
function withinNoteCeiling(op: Operation): boolean {
  switch (op.type) {
    case "thread.create":
      return op.anchorItemId !== null;
    case "thread.reply":
    case "item.react":
      return true;
    default:
      return false;
  }
}

/**
 * The refusal for this actor's op on this canvas, or `null` when it may go
 * on. Asked at the home's one apply point (`Engine.applyAndPersist`, and
 * undo and redo before they choose anything), with the enrolment row as the
 * canvas holds it at that moment.
 */
export function ceilingRefusal(canvas: CanvasContents, actorId: string, op: Operation | null): string | null {
  const row = canvas.agents?.[actorId];
  if (row?.ceiling !== "note") return null;
  if (op && withinNoteCeiling(op)) return null;
  const what = op ? (op.type === "thread.create" ? "a thread pinned to no item" : op.type) : "an undo";
  return (
    `${row.actor.name} is a critic on this canvas: it may pin notes on items, reply in threads and react, ` +
    `and nothing else — ${what} was refused and nothing was written. ` +
    `${row.ceilingBy?.name ?? "Whoever enrolled it"} can lift that with \`isocan critic release ${row.actor.name}\`.`
  );
}
