import { FIDELITY_PROP, designSurface, parseDesign, type CanvasContents, type DesignDoc, type Item } from "@isocan/core";
import { currentVersionOf } from "./port.ts";
import { PROTOTYPE_PROP } from "./prototype.ts";
import { governingSystem } from "./restyle.ts";
import type { WireSpec } from "./spec.ts";
import { ROLES, candidatesOf, surfaceOf, type WireStyle } from "./theme.ts";

/**
 * **A wire behind its design system** (design §9: "the wires say they are
 * behind it (the spec names the version) and `wire style` brings them
 * forward"; 26 Sep 2026, the Stitch Loop review).
 *
 * A wire's spec records the DESIGN.md version that drew it (`WireStyle`'s
 * `versionId`). When the system that governs the wire's place has a newer
 * current version, the wire is *behind* it. That is DERIVED — from the spec
 * in the wire's file and the DESIGN.md item's `currentVersionId` — on every
 * read, and never written: the canvas marks it (`behind-marks.tsx`), the
 * item menu offers *Restyle to <system>* (`style-menu.ts`), and `isocan wire
 * style --check` lists it, all from this one function, in the same words.
 * Restyling on its own when a DESIGN.md changes is still refused — it would
 * rewrite forty items behind somebody's back — so the mark asks, and the
 * restyle is the person's click: what `isocan wire style <screen>` runs.
 */

/** Where a wire stands against the system that governs its place. */
export type CheckState = "current" | "behind" | "other system" | "not in it yet" | "no system governs";

/**
 * A wire's state from its spec and the system that governs its place (null:
 * none does). `doc` is that system's CURRENT version, parsed: given, a wire
 * drawn from an older version is behind only when something it draws from
 * moved (`stillDraws`); absent, an older version is enough.
 */
export function checkState(spec: WireSpec, system: Item | null, doc?: DesignDoc | null): CheckState {
  const s = spec.style;
  if (!system) return s?.source === "design-system" ? "no system governs" : "current";
  if (s?.source !== "design-system") return "not in it yet";
  if (s.itemId !== system.id) return "other system";
  if (s.versionId === system.currentVersionId) return "current";
  return doc && stillDraws(s, doc) ? "current" : "behind";
}

/**
 * **Does the system still say what this wire draws?** A new version of a
 * DESIGN.md that only adds tints, or changes a colour no role took, leaves
 * the wire's look exactly the system's — and a restyle would write nothing
 * (`alreadyLooks`, Porchlight #9), so calling it behind would be a mark no
 * click could clear. It is behind when a token one of its roles took is gone
 * or holds another value, when a role that had nothing to draw from now has
 * something, or when the system's `surface:` changed. A role the answerer
 * was unsure of drew the default, not the system, so it cannot fall behind.
 */
export function stillDraws(style: Extract<WireStyle, { source: "design-system" }>, doc: DesignDoc): boolean {
  if (designSurface(doc.tokens) !== surfaceOf(style)) return false;
  const now = candidatesOf(doc);
  for (const role of ROLES) {
    const was = style.roles[role];
    if (was?.token !== undefined) {
      if (!now[role].some((c) => c.token === was.token && c.value === was.value)) return false;
    } else if (!was || was.why === "none") {
      if (now[role].length > 0) return false;
    }
  }
  return true;
}

/** A system's current version, parsed — null: it cannot be read; undefined: not read yet. */
export type DocOf = (system: Item) => DesignDoc | null | undefined;

/** One wire, checked: which state, what drew it and what governs it now — `--check`'s row. */
export interface WireCheck {
  itemId: string;
  state: CheckState;
  governedBy: { itemId: string; title: string; version: number; versions: number } | null;
  drawnBy: { itemId: string; version: number | null; name: string | null } | "default";
}

/** Check one wire against the system that governs its place — read-only. */
export function checkWire(canvas: CanvasContents, item: Item, spec: WireSpec, docOf?: DocOf): WireCheck {
  const system = governingSystem(canvas, item);
  const drawn = spec.style?.source === "design-system" ? spec.style : null;
  const index = drawn ? canvas.items[drawn.itemId]?.versions.findIndex((v) => v.id === drawn.versionId) : undefined;
  return {
    itemId: item.id,
    state: checkState(spec, system, system ? docOf?.(system) : undefined),
    governedBy: system ? { itemId: system.id, title: system.title, version: system.versions.findIndex((v) => v.id === system.currentVersionId) + 1, versions: system.versions.length } : null,
    drawnBy: drawn ? { itemId: drawn.itemId, version: index !== undefined && index >= 0 ? index + 1 : null, name: drawn.name ?? null } : "default",
  };
}

/** A check in words — `behind: drawn in "Acme Warm" version 1, governed by "DESIGN.md" version 2 of 2`. The CLI prints it; the canvas's mark says it under the pointer. */
export function checkWords(c: WireCheck): string {
  const d = c.drawnBy;
  const was = typeof d === "string" ? "the default look" : `"${d.name ?? d.itemId}" version ${d.version ?? "?"}`;
  const is = c.governedBy ? `"${c.governedBy.title}" version ${c.governedBy.version} of ${c.governedBy.versions}` : "no system";
  return `${c.state}: drawn in ${was}, governed by ${is}`;
}

/** The system's own name, as the wire recorded it (its DESIGN.md's `name:`), else the item's title. */
export function systemName(c: WireCheck): string {
  return typeof c.drawnBy !== "string" && c.drawnBy.name ? c.drawnBy.name : c.governedBy?.title ?? "its design system";
}

/** What the canvas offers for a wire behind its system — the menu row and the mark's click are the one act. */
export function restyleLabel(c: WireCheck): string {
  return `Restyle to ${systemName(c)}`;
}

/** How many wires are behind, said once — the DESIGN.md's mark and its menu row. */
export function behindCount(n: number): string {
  return `${n} wire${n === 1 ? "" : "s"} behind`;
}

/** The `/wire` words that restyle these wires' flows — `isocan wire style <screens…>` on the web. */
export function restyleArgs(itemIds: readonly string[]): string {
  return `style system ${itemIds.join(" ")}`;
}

/** A wire the canvas checks: a screen or a variation — a prototype plays its screens' looks and is never styled. */
export function isWire(item: Item): boolean {
  return item.properties?.[FIDELITY_PROP] === "wireframe" && item.properties?.[PROTOTYPE_PROP] === undefined;
}

/** The hash of the file a wire's spec is read from, or null when its current version is not a page. */
export function specKey(item: Item): string | null {
  const v = currentVersionOf(item);
  return v && v.mimeType === "text/html" ? v.blobHash : null;
}

/**
 * **Every wire behind its system**, from what has been read: `specOf` answers
 * per version hash (null: not a wire; undefined: not read yet), `docOf` per
 * system. A wire whose spec or whose system's file is not read yet is not
 * marked, rather than guessed at. Reads, never writes.
 */
export function wiresBehind(canvas: CanvasContents, specOf: (hash: string) => WireSpec | null | undefined, docOf: DocOf): WireCheck[] {
  const out: WireCheck[] = [];
  for (const item of Object.values(canvas.items)) {
    if (!isWire(item)) continue;
    const key = specKey(item);
    const spec = key ? specOf(key) : null;
    if (!spec) continue;
    const system = governingSystem(canvas, item);
    if (system && docOf(system) === undefined) continue;
    const c = checkWire(canvas, item, spec, docOf);
    if (c.state === "behind") out.push(c);
  }
  return out;
}

/** A system's current file, parsed — or null when it has none or it cannot be read (an older version is then enough to be behind). */
export async function readSystemDoc(system: Item, readText: (blobHash: string) => Promise<string>): Promise<DesignDoc | null> {
  const v = currentVersionOf(system);
  if (!v) return null;
  try {
    return parseDesign(await readText(v.blobHash));
  } catch {
    return null;
  }
}

/** The systems whose current file `wiresBehind` needs read: every one governing a wire drawn from an older version of it. */
export function systemsToRead(canvas: CanvasContents, specOf: (hash: string) => WireSpec | null | undefined): Item[] {
  const out = new Map<string, Item>();
  for (const item of Object.values(canvas.items)) {
    if (!isWire(item)) continue;
    const key = specKey(item);
    const s = key ? specOf(key)?.style : undefined;
    if (s?.source !== "design-system") continue;
    const system = governingSystem(canvas, item);
    if (system && system.id === s.itemId && system.currentVersionId !== s.versionId) out.set(system.id, system);
  }
  return [...out.values()];
}
