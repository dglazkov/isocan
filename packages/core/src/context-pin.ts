import type { CanvasContents, Item } from "./model.ts";
import { isCanvasItem } from "./canvasitem.ts";
import { CONTEXT_PROP, contextMark } from "./contextmark.ts";
import { CONTEXT_SOURCE_PROP, type ContextSource } from "./context-source.ts";
import { excludedInAmbient } from "./canvas-group-context.ts";
import { groupTransformClosure } from "./canvas-groups.ts";
import { designSystem, withoutDesignRole } from "./designsystem.ts";

/**
 * **Keeping one piece of a source here** (`docs/projects/memory/pin-from-source.md`).
 *
 * Inheritance keeps FOLLOWING a source: what the other canvas decides today
 * arrives here today, and what it deletes tomorrow leaves. That is the right
 * default and it is not always what somebody wants — a review checklist read
 * through an inherited link is useful precisely because this project is going
 * to edit it, and the source team is going to keep editing theirs.
 *
 * So this is the deliberate opposite act: **take the current version of one
 * eligible piece and make an ordinary local item out of it**, pinned, saying
 * where it came from. No live reference, no second kind of link, no new
 * operation — the existing group copy carries the bytes and the existing
 * `context=pinned` property does the pinning, in one `group.change` act that
 * one undo takes back.
 *
 * This file owns the two rules that are neither transport nor layout, so the
 * CLI and the browser cannot disagree about either: **which pieces a source
 * offers**, and **what a copied item wears afterward**.
 */

/** The property a copied item wears, spelled beside the act that writes it:
 *  a reader on every canvas needs `parseContextSource`, and only a copy needs
 *  this, so they belong in different chunks (`scripts/bundle-ceiling.mjs`). */
export function contextSourceProperty(source: ContextSource): Record<string, string> {
  return { [CONTEXT_SOURCE_PROP]: JSON.stringify(source) };
}

/** One offer in the picker: a current source contribution, its size as a copy,
 *  and — when the whole closure cannot be copied — why not. */
export interface SourcePinPiece {
  kind: "design" | "pin";
  itemId: string;
  title: string;
  /** How many items this copy would bring, root included. */
  count: number;
  /** Why this whole piece refuses, when it does. Absent when it is eligible. */
  refused?: string;
}

/** A closure refuses AS A WHOLE, so a copy is never quietly less than the
 *  piece somebody chose: no silent dropping of an excluded child, a child
 *  whose bytes are gone, or a canvas link whose preview and inheritance
 *  semantics are a separate decision. */
function closureRefusal(canvas: CanvasContents, ids: readonly string[]): string | undefined {
  for (const id of ids) {
    const item = canvas.items[id];
    if (!item) return "part of this piece is no longer on the source canvas";
    if (isCanvasItem(item)) return `“${item.title}” is a canvas link — place and inherit that canvas instead of copying its card`;
    if (excludedInAmbient(canvas, item)) return `“${item.title}” is kept out of context on the source`;
    if (!item.versions.some((version) => version.id === item.currentVersionId)) return `“${item.title}” has no current version to copy`;
  }
  return undefined;
}

/**
 * **What a source offers, which is not its item list.**
 *
 * The same two contributions inheritance already reads — the source's current
 * design system and its ambient pinned items — because those are the pieces
 * somebody on that canvas deliberately named. Everything else on a source
 * canvas is that team's work in progress, and a picker that listed it would
 * be a file browser into somebody else's project.
 *
 * The existing ancestor exclusion rule applies to the roots, so a pin inside
 * an excluded group is not on offer at all.
 */
export function sourcePinPieces(canvas: CanvasContents): SourcePinPiece[] {
  const roots: Array<{ kind: "design" | "pin"; item: Item }> = [];
  const design = designSystem(canvas);
  if (design && !excludedInAmbient(canvas, design)) roots.push({ kind: "design", item: design });
  const seen = new Set(roots.map((row) => row.item.id));
  const pins = Object.values(canvas.items)
    .filter((item) => contextMark(item) === "pinned" && !seen.has(item.id) && !excludedInAmbient(canvas, item))
    .sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
  for (const item of pins) roots.push({ kind: "pin", item });
  return roots.map(({ kind, item }) => {
    // The closure the COPY will take, not a second opinion about membership.
    let ids: string[];
    try { ids = groupTransformClosure(canvas, [item.id]); }
    catch (error) { return { kind, itemId: item.id, title: item.title, count: 0, refused: error instanceof Error ? error.message : String(error) }; }
    const refused = closureRefusal(canvas, ids);
    return { kind, itemId: item.id, title: item.title, count: ids.length, ...(refused ? { refused } : {}) };
  });
}

/** Exact IDs win; anything else must identify one offered piece, and a refusal
 *  names the candidates — the same rule every other `<item>` argument keeps. */
export function resolveSourcePinPiece(pieces: readonly SourcePinPiece[], ref: string): SourcePinPiece {
  const exact = pieces.find((piece) => piece.itemId === ref);
  if (exact) return exact;
  const needle = ref.trim().toLowerCase();
  const matches = needle ? pieces.filter((piece) => piece.itemId.toLowerCase().startsWith(needle) || piece.title.toLowerCase().startsWith(needle)) : [];
  if (matches.length === 1) return matches[0]!;
  const list = pieces.map((piece) => `  ${piece.itemId}  ${piece.title}${piece.refused ? `  — ${piece.refused}` : ""}`).join("\n");
  if (matches.length === 0) throw new Error(`no piece called ${JSON.stringify(ref)} on that source — it offers:\n${list || "  nothing"}`);
  throw new Error(`ambiguous piece ${JSON.stringify(ref)}; use an ID:\n${matches.map((piece) => `  ${piece.itemId}  ${piece.title}`).join("\n")}`);
}

/**
 * **What a copied item wears afterward**, applied inside the one copy act.
 *
 * Three decisions, and each is the reason this is not left to a second write:
 *
 * - **The governing design role is stripped**, from the root and from every
 *   descendant. Copying a source's `DESIGN.md` as a reference must not quietly
 *   make it the thing that governs THIS canvas — that is a decision somebody
 *   makes with `design set`, not a side effect of keeping a copy of a note.
 * - **Every item records its own `contextSource`.** Copying a copy records the
 *   immediate source it was selected from, overwriting the older provenance:
 *   "where these bytes came from" is a fact about this copy, and a chain of
 *   previous homes is a history nobody asked this property to carry.
 * - **The chosen roots arrive pinned**, in the same act, so one undo takes
 *   back the copy AND its pin rather than leaving an unpinned orphan behind.
 */
export function contextPinDecoration(from: Pick<ContextSource, "home" | "canvasId" | "canvasTitle">) {
  return (properties: Record<string, string>, item: Item, isRoot: boolean): Record<string, string> => ({
    ...withoutDesignRole(properties),
    ...contextSourceProperty({ ...from, itemId: item.id, itemTitle: item.title, versionId: item.currentVersionId }),
    ...(isRoot ? { [CONTEXT_PROP]: "pinned" } : {}),
  });
}
