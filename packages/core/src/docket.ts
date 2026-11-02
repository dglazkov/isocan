import type { Item } from "./model.ts";
import type { Operation } from "./ops.ts";
import { hasReacted, reactOp } from "./reactions.ts";

/**
 * **The docket: persona findings that want a person, answered by a mark**
 * (#206).
 *
 * `scripts/docket.mjs` puts one item per open question on the repo's board,
 * each carrying `docket=<slug>`, and reads the verdict back from the item's
 * reactions: ✅ accepts, ❌ rejects. No new op — `item.react` — so the
 * decision carries who made it, two people disagreeing is visible, and taking
 * a mark off is an undo.
 *
 * The web app answers by clicking the chip. This file is so a terminal can
 * answer the same way (`isocan docket answer`, D7) and the two cannot drift:
 * the CLI's ops are the chip clicks a person would make, built by the same
 * `reactOp` the chip calls (`packages/web/test/docket.test.ts` holds them
 * equal against a real daemon), and the script reads the marks from here too.
 */

/** The property a docket item carries: its question's slug. */
const DOCKET_PROP = "docket";

/** The two verdict marks, and no more: a docket where six emoji mean six
 *  things is a docket nobody can read at a glance. */
export const DOCKET_MARKS = { accepted: "✅", rejected: "❌" } as const;

/** ✋ — "I am taking this". Not a verdict: a claim closes nothing, and it
 *  lives on the canvas only (the script never commits it). */
export const DOCKET_CLAIM = "✋";

/** What an answer says — the words the run pages carry in their outcome cell. */
export type DocketVerdict = keyof typeof DOCKET_MARKS;

type Marked = Pick<Item, "reactions"> & { properties?: Item["properties"] };

/** The question's slug, or null for an item that is not on the docket. */
export function docketSlug(item: Marked): string | null {
  return item.properties?.[DOCKET_PROP] || null;
}

/**
 * **What the marks say.** One verdict worn → that verdict; both → contested,
 * which is two people disagreeing and stays on the docket (the script writes
 * neither — picking a side is not a tool's job); none → null, still open.
 */
export function docketVerdict(item: Marked): DocketVerdict | "contested" | null {
  const worn = (Object.keys(DOCKET_MARKS) as DocketVerdict[]).filter(
    (v) => (item.reactions?.[DOCKET_MARKS[v]] ?? []).length > 0,
  );
  return worn.length === 2 ? "contested" : (worn[0] ?? null);
}

/**
 * **The ops that answer a question as this actor**: the chip clicks a person
 * would make to say it — take the other verdict off if they wear it, then put
 * this one on. Offs first, so the item never reads as contested between the
 * two. Empty when the actor already says exactly this.
 */
export function docketAnswer(item: Item, verdict: DocketVerdict, actorId: string): Operation[] {
  const offs: Operation[] = [];
  const ons: Operation[] = [];
  for (const v of Object.keys(DOCKET_MARKS) as DocketVerdict[]) {
    const emoji = DOCKET_MARKS[v];
    if ((v === verdict) !== hasReacted(item, emoji, actorId)) {
      (v === verdict ? ons : offs).push(reactOp(item, emoji, actorId));
    }
  }
  return [...offs, ...ons];
}
