import type { CanvasContents, Item } from "./model.js";
import { type ContextSource } from "./context-source.js";
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
export declare function contextSourceProperty(source: ContextSource): Record<string, string>;
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
export declare function sourcePinPieces(canvas: CanvasContents): SourcePinPiece[];
/** Exact IDs win; anything else must identify one offered piece, and a refusal
 *  names the candidates — the same rule every other `<item>` argument keeps. */
export declare function resolveSourcePinPiece(pieces: readonly SourcePinPiece[], ref: string): SourcePinPiece;
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
export declare function contextPinDecoration(from: Pick<ContextSource, "home" | "canvasId" | "canvasTitle">): (properties: Record<string, string>, item: Item, isRoot: boolean) => Record<string, string>;
