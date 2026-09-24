import type { CanvasContents, Item } from "./model.ts";
import type { Operation } from "./ops.ts";
import { canvasScopes } from "./canvas-scope.ts";
import { designSystemProperties, isDesignSystem } from "./designsystem.ts";
import { newVersionId } from "./ids.ts";

/**
 * **Choosing which DESIGN.md governs, from an item already on the canvas.**
 *
 * `isocan design set <file>` was the only way to say "this is the system",
 * and it takes a FILE: a person looking at a DESIGN.md on the canvas had no
 * way to say it at all. This is that act for an item, shared by the web's
 * item menu and `isocan design use <item>`, so the two cannot send different
 * things. It is a subpath of core rather than a line in its index because
 * only a menu click and one CLI verb ever run it — the entry chunk pays for
 * the label, not for this.
 *
 * It sends what `design set` sends, never a new op. A DESIGN.md governs by
 * where it sits, so the scope is the one the item is already in:
 *
 * - **That scope already has its own system** — the item's words become a
 *   new VERSION of it: `item.addVersion`, byte for byte what `isocan design
 *   set <this file>` (with `--in` for a group) writes. A version, never a
 *   replacement, for design set's reason: the system you are moving away
 *   from is the one you will want to compare against tomorrow.
 * - **It has none** — the item itself takes the property `design set` gives
 *   the item it makes (`designSystemProperties`), as an `item.update`. Making
 *   a second copy of words that are already here would be a duplicate to
 *   tidy up, not a choice.
 *
 * The reverse takes the property off (`designSystemRemoval`): the item stays,
 * its words stay, and what governs that scope is whatever did before.
 * Either way it is one op, so one undo.
 */
export interface DesignUse {
  op: Operation;
  /** The group (or legacy area) it governs; null for the whole canvas. */
  scope: Item | null;
  /** The system that took a new version, when the scope already had one. */
  into: Item | null;
}

/**
 * Could this item BE a design system — markdown words, rather than a screen,
 * a picture, a group or a caption? What `isocan design use` accepts.
 *
 * Here rather than beside `isDesignSystem` for the bytes: `designsystem.ts`
 * is in the web's entry chunk, and anything added to it rides along even when
 * only a lazy chunk calls it.
 */
export function isDesignDocument(item: Item): boolean {
  const kind = item.properties.kind;
  if (kind === "text" || kind === "group") return false;
  const current = item.versions.find((v) => v.id === item.currentVersionId);
  return !!current && (current.mimeType.startsWith("text/markdown") || /\.md$/i.test(current.filename));
}

/** A markdown item called DESIGN.md — the one the item menu offers to make
 *  the design system, so a canvas of notes is not a canvas of offers. */
export function isDesignFile(item: Item): boolean {
  const current = item.versions.find((v) => v.id === item.currentVersionId);
  return isDesignDocument(item) && [item.title, current?.filename ?? ""].some((name) => /(^|[^a-z])design\.md$/i.test(name.trim()));
}

/** The patch that stops an item governing: every property that made it one
 *  comes off, and the item and its words stay. `removeProperties`, because
 *  `properties` merges. */
export function designSystemRemoval(): { removeProperties: string[] } {
  return { removeProperties: Object.keys(designSystemProperties()) };
}

/** The design system that belongs to exactly this level — the group's own, or
 *  the canvas's own for null. What `design set` versions; never an ancestor's. */
export function ownDesignSystemAt(canvas: CanvasContents, scopeId: string | null): Item | null {
  const mine = Object.values(canvas.items)
    .filter(isDesignSystem)
    .filter((item) => (canvasScopes(canvas, item)[0]?.id ?? null) === scopeId)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
  return mine[0] ?? null;
}

/** Make `item` the design system of the scope it sits in. */
export function designUse(canvas: CanvasContents, item: Item, versionId: string = newVersionId()): DesignUse {
  if (!isDesignDocument(item)) throw new Error(`“${item.title}” is not markdown — a design system is a DESIGN.md`);
  if (isDesignSystem(item)) throw new Error(`“${item.title}” is already a design system`);
  const scope = canvasScopes(canvas, item)[0] ?? null;
  const into = ownDesignSystemAt(canvas, scope?.id ?? null);
  if (into) {
    const current = item.versions.find((v) => v.id === item.currentVersionId)!;
    return {
      op: {
        type: "item.addVersion",
        itemId: into.id,
        version: { id: versionId, blobHash: current.blobHash, mimeType: current.mimeType, filename: current.filename, size: current.size },
      },
      scope,
      into,
    };
  }
  return { op: { type: "item.update", itemId: item.id, patch: { properties: designSystemProperties() } }, scope, into: null };
}

/** Stop `item` governing: the property comes off and the item stays. */
export function designUnuse(canvas: CanvasContents, item: Item): DesignUse {
  if (!isDesignSystem(item)) throw new Error(`“${item.title}” is not a design system`);
  return { op: { type: "item.update", itemId: item.id, patch: designSystemRemoval() }, scope: canvasScopes(canvas, item)[0] ?? null, into: null };
}
