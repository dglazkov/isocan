import type { CanvasContents, Item, ItemVersion } from "./model.ts";
import { childrenOf, parentOf } from "./lineage.ts";

/**
 * **This one won.**
 *
 * The canvas can already diverge: `/variation` makes siblings from an item,
 * and each carries `parent` saying what it was made from. It has never been
 * able to CONVERGE — to say "this is the one" and have the exploration fold
 * back into the thing it explored. So a canvas accumulates four screens where
 * a decision was made about one, and the decision itself is recorded nowhere.
 *
 * Folding is: the winner's content becomes a new VERSION of the source, and
 * every child of that source — the winner included — goes to the trash. The
 * winner goes too, and that is the point rather than an oversight: its content
 * now lives on the parent's stack, so leaving it would be two copies of one
 * decision and an invitation to edit the wrong one. Nothing is lost; the trash
 * is reversible and undo brings the whole thing back at once.
 *
 * **No new op type, which is a change from the research that asked for this.**
 * That argued for one composite operation with a computed inverse, and it was
 * right at the time. Op grouping shipped since: `item.addVersion` plus one
 * `item.delete` per child, all carrying one group, gives the same
 * one-gesture-one-undo out of ops that already exist and already replay. A new
 * op type would have been a second way to say something the vocabulary can
 * already say.
 *
 * **Where the decision is recorded, honestly.** The research wanted the
 * winner's idea-name carried onto the version so the stack says what was
 * chosen. There is no field for that — `ItemVersion` has a filename and an
 * author, and a filename is the file's name rather than a label to write on.
 *
 * A group id is not a label either: grouping matches by string equality, so
 * two decisions that happened to share a human name and land next to each
 * other would merge into one undo. The id stays an id.
 *
 * So what actually records the decision is what the canvas already keeps: the
 * winner's content is now the source's top version with its own author and
 * time, and every explored sibling sits in the trash under the name somebody
 * gave it, recoverable. `label` below is the sentence the CLI prints, not a
 * field anything stores — and calling it what it is beats implying a record
 * that does not exist.
 */
export interface ConvergePlan {
  /** The item the winner folds into. */
  parentId: string;
  /** The winner's current version, to be added to the parent. */
  version: ItemVersion;
  /** Everything that goes to the trash — the winner and its siblings. */
  trash: string[];
  /** The sentence a surface says about this decision. Not stored. */
  label: string;
}

export type ConvergeRefusal = { refused: string };

/**
 * What choosing this item would do, or why it cannot be done.
 *
 * A refusal is a sentence, not a boolean: every one of these is something
 * somebody could reasonably try, and "cannot converge" tells them nothing
 * about which of their assumptions was wrong.
 */
export function convergePlan(
  canvas: CanvasContents,
  chosenId: string,
): ConvergePlan | ConvergeRefusal {
  const chosen = canvas.items[chosenId];
  if (!chosen) return { refused: `no item ${chosenId} on this canvas` };

  const parentId = parentOf(chosen);
  if (parentId === null) {
    return {
      refused: `"${chosen.title}" was not made from anything — there is nothing to fold it back into`,
    };
  }
  const parent = canvas.items[parentId];
  if (!parent) {
    return {
      refused: `"${chosen.title}" was made from an item that is no longer on the canvas`,
    };
  }

  const version =
    chosen.versions.find((v) => v.id === chosen.currentVersionId) ?? chosen.versions[0];
  if (!version) return { refused: `"${chosen.title}" has no content to fold in` };

  // Every sibling, the winner included. `childrenOf` is the same reader
  // `isocan lineage` prints from, so what converges is exactly what that
  // command says was made from this source.
  const family = childrenOf(canvas, parentId).map((item: Item) => item.id);
  const trash = family.includes(chosenId) ? family : [chosenId, ...family];

  return {
    parentId,
    version,
    trash,
    label: `chose ${chosen.title}`,
  };
}

export function isRefusal(plan: ConvergePlan | ConvergeRefusal): plan is ConvergeRefusal {
  return "refused" in plan;
}
