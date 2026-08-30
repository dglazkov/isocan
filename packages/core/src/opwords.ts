import type { OperationType } from "./ops.ts";

/**
 * **What an operation is called, in words, in one place.**
 *
 * There were two tables mapping operation types to phrases — `timeline.ts`'s,
 * for the seams on a track, and the CLI's `describeEntry`, which spells out a
 * whole entry with ids and bodies. They answer different questions and both
 * should exist. What should not exist is a THIRD, which is what the home
 * screen needed when it began saying "Di moved something" under each canvas.
 *
 * So the table lives here and `majorWhat` reads it. A canvas card, a timeline
 * tick and `isocan timeline` now say the same words about the same event,
 * which is the same rule the significance function is held to: two surfaces
 * disagreeing about what happened is the one thing this architecture does not
 * permit.
 *
 * **The subject is always a person**, so every phrase completes "Di …". That
 * is what makes them composable into a sentence by callers that resolve names
 * differently — the web through an actor map, the CLI through its own.
 */
const OP_WORDS: Partial<Record<OperationType, string>> = {
  "project.create": "made the canvas",
  "project.update": "renamed the canvas",
  "item.add": "added something",
  "item.delete": "deleted something",
  "items.delete": "deleted several things",
  "item.restore": "restored something",
  "items.restore": "restored several things",
  "item.addVersion": "made a new version",
  "item.setCurrentVersion": "switched version",
  "item.removeVersion": "removed a version",
  "item.restoreVersion": "restored a version",
  "item.move": "moved something",
  "items.move": "moved several things",
  "item.resize": "resized something",
  "item.update": "edited something",
  "item.react": "left a mark",
  "thread.create": "started a conversation",
  "thread.reply": "replied",
  "thread.delete": "removed a conversation",
  "thread.restore": "restored a conversation",
  "thread.setAnchor": "moved a conversation",
  "thread.setMain": "moved the Chat",
  "comment.update": "edited a comment",
  "comment.remove": "removed a comment",
  "comment.restore": "restored a comment",
  "trash.empty": "emptied the trash",
};

/**
 * The phrase for an operation type, or `undefined` when there is not one.
 *
 * **The fallback belongs to the caller, and deliberately so.** A track drawn
 * for somebody reading history falls back to the raw op type, because naming
 * an unknown thing precisely is more useful there than a vague phrase —
 * `timeline.ts` decided that and a test holds it. A card on a home screen
 * cannot do the same: `item.setCurrentVersion` under a canvas shows a person
 * the vocabulary instead of telling them what happened, so it says "did
 * something" instead.
 *
 * That is not two surfaces disagreeing. Every op the system HAS is in the
 * table and both read the same words from it; they differ only on an op that
 * does not exist yet, where their audiences genuinely want different things.
 */
export function opWords(type: string | undefined): string | undefined {
  if (!type) return undefined;
  return OP_WORDS[type as OperationType];
}
