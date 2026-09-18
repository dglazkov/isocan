import type { CanvasContents, Item } from "./model.ts";
import { isCanvasItem } from "./canvasitem.ts";
import { CONTEXT_PROP, contextMark } from "./contextmark.ts";
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

/** `contextSource=<json>` — durable provenance, written once by the copy.
 *
 * It is a RECORD, never a capability: it names where these bytes came from so
 * a reader can say so, and it is read by nothing that fetches. A link that
 * kept following the source is what inheritance already is. */
export const CONTEXT_SOURCE_PROP = "contextSource";

/** Where a copied item came from, frozen at the moment it was copied.
 *
 * Deliberately six plain facts and no seventh: no badge, no token, no actor,
 * nothing private. A copied card travels — into an export, into another
 * project, into somebody else's snapshot — and everything this property says
 * is already visible to anyone who could read the source. */
export interface ContextSource {
  /** The authoritative home the source was read from. */
  home: string;
  canvasId: string;
  canvasTitle: string;
  itemId: string;
  itemTitle: string;
  /** The source item's current version at the moment of the copy. */
  versionId: string;
}

/** The property a copied item wears, spelled in one place so a reader and a
 *  writer cannot disagree about the shape of the JSON. */
export function contextSourceProperty(source: ContextSource): Record<string, string> {
  return { [CONTEXT_SOURCE_PROP]: JSON.stringify(source) };
}

/**
 * Provenance as read back, or null.
 *
 * **Malformed provenance is ignored as metadata rather than refused.** A
 * property is a string anyone can set, and an item whose `contextSource` is
 * nonsense is still a perfectly good item — the honest answer is to say
 * nothing about where it came from, not to break the view that lists it.
 * Unknown keys are dropped for the same reason this type has exactly six:
 * what a reader repeats should be what the copy decided to record.
 */
export function parseContextSource(raw: unknown): ContextSource | null {
  if (typeof raw !== "string" || raw.length > 4096) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const keys = ["home", "canvasId", "canvasTitle", "itemId", "itemTitle", "versionId"] as const;
  const out = {} as Record<(typeof keys)[number], string>;
  for (const key of keys) {
    const field = row[key];
    if (typeof field !== "string" || field.length === 0 || field.length > 1024) return null;
    out[key] = field;
  }
  return out;
}

/** What this item says about where it was copied from, or nothing. */
export function contextSourceOf(item: Item): ContextSource | null {
  return parseContextSource(item.properties?.[CONTEXT_SOURCE_PROP]);
}

/** One sentence naming a copy's origin, shared by the panel, the terminal and
 *  the MCP summary so all three say it the same way. */
export function formatContextSource(source: ContextSource): string {
  return `copied from “${source.itemTitle}” on ${source.canvasTitle} (${source.canvasId}) at ${source.home}`;
}

/** The local items that were copied from a source, in reading order — what
 *  Context lists beside its pins so the copy's origin stays visible here. */
export function copiedContextItems(canvas: CanvasContents): Array<{ item: Item; source: ContextSource }> {
  return Object.values(canvas.items)
    .flatMap((item) => {
      const source = contextSourceOf(item);
      return source && !excludedInAmbient(canvas, item) ? [{ item, source }] : [];
    })
    .sort((a, b) => a.item.y - b.item.y || a.item.x - b.item.x || a.item.id.localeCompare(b.item.id));
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
