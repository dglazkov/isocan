import type { CanvasContents, Item, ItemVersion } from "./model.ts";
import { childrenOf, parentOf } from "./lineage.ts";
import type { MetaPatch, Operation } from "./ops.ts";
import { copyPreferencePatch } from "./preference.ts";

/** `copy-variants.ts`'s `COPY_STANCE_PROP`, spelled here so core's barrel never imports the lazy copy-variants chunk. */
const COPY_STANCE_PROP = "copyStance";

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
 * gave it, recoverable. When the winner is a copy variant with sibling voices,
 * `preference` records the winning stance and `preferredOver` on the source in
 * the same op group (copy-edit phase 6). `label` below is the sentence the CLI
 * prints.
 */
interface ConvergePlan {
  /** The item the winner folds into. */
  parentId: string;
  /** The winner's current version, to be added to the parent. */
  version: ItemVersion;
  /** Everything that goes to the trash — the winner and its siblings. */
  trash: string[];
  /** The sentence a surface says about this decision. Not stored. */
  label: string;
  /** On a copy variant with sibling voices: the preference patch for `parentId`. */
  preference?: MetaPatch;
}

type ConvergeRefusal = { refused: string };

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
  const siblings = childrenOf(canvas, parentId);
  const family = siblings.map((item: Item) => item.id);
  const trash = family.includes(chosenId) ? family : [chosenId, ...family];

  const stance = chosen.properties[COPY_STANCE_PROP]?.trim();
  const losingCopy = stance ? siblings.filter((s) => s.id !== chosenId && Boolean(s.properties[COPY_STANCE_PROP]?.trim())) : [];
  const preference =
    stance && losingCopy.length > 0
      ? copyPreferencePatch(parent, {
          how: "choose",
          stance,
          against: losingCopy.map((s) => s.properties[COPY_STANCE_PROP]!.trim()),
          chosen: chosenId,
          againstIds: losingCopy.map((s) => s.id),
        })
      : null;

  return {
    parentId,
    version,
    trash,
    label: `chose ${chosen.title}`,
    ...(preference ? { preference } : {}),
  };
}

export function isRefusal(plan: ConvergePlan | ConvergeRefusal): plan is ConvergeRefusal {
  return "refused" in plan;
}

/**
 * **The ops a choice sends, in order**: the winner onto the parent's stack,
 * the copy preference on the parent when choosing between copy variants,
 * then every child to the trash. The caller sends them under ONE group, so
 * one ⌘Z takes the version back and brings every child out of the trash.
 *
 * Here rather than in either client because there are two: `isocan choose`
 * and the item menu's "Choose this variation" both send exactly this list
 * (`packages/web/test/choose.test.ts` holds them equal against a daemon).
 */
export function convergeOps(plan: ConvergePlan): Operation[] {
  return [
    { type: "item.addVersion", itemId: plan.parentId, version: plan.version },
    ...(plan.preference ? [{ type: "item.update" as const, itemId: plan.parentId, patch: plan.preference }] : []),
    ...plan.trash.map((itemId): Operation => ({ type: "item.delete", itemId })),
  ];
}

