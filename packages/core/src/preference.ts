import type { CanvasContents, Item } from "./model.ts";
import type { MetaPatch } from "./ops.ts";

/**
 * **Which one you liked better, kept as a fact** (9 Sep 2026).
 *
 * > "including allowing the user to say what's best. Let me run an A/B 'eye
 * > test' and quickly pick left vs right and flip through alternatives"
 *
 * The canvas could already diverge (`/variation`) and converge (`choose`, via
 * `converge.ts`). What it could not do is hold a PREFERENCE — and `converge.ts`
 * says so in as many words: *"what actually records the decision is what the
 * canvas already keeps"*, which is to say the resulting state, and nothing that
 * can be asked a question later.
 *
 * That mattered more than it looked. `slop.ts` is honest that its forty tells
 * are a FLOOR — *"removing these reliably stops the bad thing; it does not
 * produce the good thing"* — and the design system supplies coherence, not
 * taste. Nothing in the whole apparatus knew what anybody LIKED. A preference
 * is the only signal here that carries taste, and twenty of them are a
 * question you can ask: what do the winners have in common, and should the
 * design system say it out loud?
 *
 * ## A preference is not a convergence, and keeping them apart is the point
 *
 * `choose` folds the winner into its source and trashes the siblings: final,
 * one per exploration. This costs nothing and can happen twenty times — left,
 * right, left, next pair — which is what an eye test IS. Fold them together
 * and every glance destroys four items, so nobody would glance.
 *
 * It also means a preference outlives the thing it was about: converge trashes
 * the losers, and the ids recorded here still name them, because the trash is
 * a place rather than a deletion.
 *
 * ## Recorded on the winner
 *
 * Not being chosen is not a fact about the loser — it is a fact about the
 * comparison, and the comparison belongs to the thing that won it. It is also
 * the direction the useful question runs: you start from what you kept.
 *
 * ## No note, deliberately
 *
 * The obvious next field is "why", and it is left out on purpose. An eye test
 * is left-or-right at a glance; asking for a sentence each time is what stops
 * somebody doing it twenty times, and twenty picks with no reasons say more
 * than three with paragraphs. The reason is recoverable anyway — both sources
 * are still on the canvas, and what they have in common is computable.
 *
 * ## No new operation
 *
 * A property on `item.update`'s `MetaPatch`, the way themes, paper, `shelved`
 * and the design skip all are. `op-types` is a ratcheted bound at 33, and
 * `converge.ts` already made this argument for the harder case: a new op type
 * would be a second way to say what the vocabulary can already say.
 */
export const PREFERRED_OVER_PROP = "preferredOver";

/** The items this one has been chosen over, oldest first. */
export function preferredOver(item: Item): string[] {
  const raw = item.properties[PREFERRED_OVER_PROP];
  if (typeof raw !== "string" || raw === "") return [];
  return raw.split(",").filter((id) => id !== "");
}

/**
 * The patch that records a preference, or `null` when there is nothing to
 * record.
 *
 * **Null rather than a no-op patch**, so a caller can tell the difference
 * between "done" and "already true" and say so. Preferring the same thing
 * twice is one fact, and an op that changes nothing still makes a version and
 * still costs an undo step — a person clicking left twice would build a stack
 * of nothings to press ⌘Z through.
 */
export function preferPatch(winner: Item, loserIds: string[]): MetaPatch | null {
  const already = preferredOver(winner);
  const fresh = loserIds.filter((id) => id !== winner.id && !already.includes(id));
  if (fresh.length === 0) return null;
  return { properties: { [PREFERRED_OVER_PROP]: [...already, ...fresh].join(",") } };
}

/** Take one back. A preference somebody changed their mind about must be
 *  removable, or the record is a record of first impressions. */
export function unpreferPatch(winner: Item, loserId: string): MetaPatch | null {
  const kept = preferredOver(winner).filter((id) => id !== loserId);
  if (kept.length === preferredOver(winner).length) return null;
  return kept.length === 0
    ? { removeProperties: [PREFERRED_OVER_PROP] }
    : { properties: { [PREFERRED_OVER_PROP]: kept.join(",") } };
}

/** One comparison somebody made. */
export interface Preference {
  winnerId: string;
  loserId: string;
}

/**
 * Every preference on this canvas, as flat comparisons.
 *
 * The shape a reader wants is pairs, and the shape the canvas stores is a list
 * per winner — this is the fold between them, in one place so the app, the CLI
 * and anything asking "what do the winners have in common" all read the same
 * answer.
 *
 * A loser that is no longer on the canvas is kept rather than dropped: it is in
 * the trash, which is a place, and a comparison whose loser was tidied away
 * still happened. A reader that needs the item can say so.
 */
export function preferences(canvas: CanvasContents): Preference[] {
  const out: Preference[] = [];
  for (const item of Object.values(canvas.items)) {
    for (const loserId of preferredOver(item)) out.push({ winnerId: item.id, loserId });
  }
  return out;
}

/** How often each item has been preferred, most-preferred first — the reading
 *  an eye test is FOR, once there are enough of them to mean anything. */
export function standings(canvas: CanvasContents): { itemId: string; won: number }[] {
  const won = new Map<string, number>();
  for (const { winnerId } of preferences(canvas)) won.set(winnerId, (won.get(winnerId) ?? 0) + 1);
  return [...won.entries()]
    .map(([itemId, n]) => ({ itemId, won: n }))
    .sort((a, b) => b.won - a.won || a.itemId.localeCompare(b.itemId));
}
