/**
 * **What a directory already claims, and what binding it would therefore do.**
 *
 * A binding is a marker committed into a repo, which is what makes it worth
 * being careful about: it is not a preference on one laptop, it is a file
 * every clone reads. Three things can be true of a directory somebody is
 * about to bind, and until now the two surfaces disagreed about all three.
 *
 * The web REFUSED to bind a directory already claimed by another canvas —
 * deliberately, because a click is a cheap gesture and a cheap gesture makes
 * a cheap mistake. `isocan use` **overwrote it without a word**: run it in a
 * repo your teammate bound and the committed marker changes under both of
 * you, silently, with the only evidence a line in `git status` you did not
 * expect. The right answer was already written down on one surface, so this
 * is the derivation moved to where both can read it rather than a new rule.
 *
 * The verdicts, and why "adopt" is not "free":
 *
 * - **free** — nothing claims it. Binding writes a marker.
 * - **adopt** — the marker already names THIS canvas. A fresh clone arrives
 *   like this: the repo knows which canvas it is and only this machine's
 *   roster is missing. Nothing is written to the repo, so this is safe in a
 *   way `free` is not — but it is worth SAYING, because "attached" and
 *   "recognised what was already here" are different facts about the world.
 * - **taken** — the marker names a different canvas. Stealing it is a real
 *   choice somebody can make, and it must be made on purpose.
 */

export interface DirClaim {
  /** The canvas the directory's marker names. */
  canvasId: string;
  /** Its title when the marker carries one — markers written before the
   *  title existed do not, so this is a nicety, never the identity. */
  title?: string;
}

export type BindVerdict = "free" | "adopt" | "taken";

export function bindVerdict(claim: DirClaim | null | undefined, canvasId: string): BindVerdict {
  if (!claim) return "free";
  return claim.canvasId === canvasId ? "adopt" : "taken";
}

/**
 * How a claimed directory is named to a person: the title when the marker has
 * one, the id when it does not. Never both — the id is noise beside a name,
 * and a bare id is better than "undefined".
 */
export function claimName(claim: DirClaim): string {
  return claim.title && claim.title.trim() !== "" ? claim.title : claim.canvasId;
}

/**
 * The one sentence both surfaces say when a directory is spoken for, so the
 * refusal a person meets in the app and the refusal they meet in the terminal
 * are the same refusal. It names the canvas that HAS it, because "already
 * bound" without a name leaves somebody staring at a folder wondering who
 * took it.
 */
export function takenSentence(root: string, claim: DirClaim): string {
  return `${root} already belongs to ${claimName(claim)}`;
}
