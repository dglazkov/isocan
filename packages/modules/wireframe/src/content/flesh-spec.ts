import type { WireSlot, WireSpec } from "../spec.ts";
import { contentTitle, domainTitle, fillSlot, packOf, type SlotFill, type WireContent } from "./fill.ts";
import { RECIPE_BY_ID } from "../catalog/index.ts";
import type { Pack } from "./pack.ts";

/**
 * **A spec, fleshed — or back to bars** (design §10). Pure: the canvas half
 * (`flesh.ts`) decides which screens and which pack; this writes `fill`
 * into every chosen slot and `content` onto the spec. A blueprint takes no
 * content (blue means still being drawn), and an undecided slot keeps none.
 */

/** The seed a screen fills with: its item id — a variation's is its screen's, so the two agree. */
export function seedKey(spec: WireSpec, itemId: string): string {
  return spec.variantOf ?? itemId;
}

export function isBlueprint(spec: WireSpec): boolean {
  return spec.slots.every((s) => s.block === null);
}

/** Fill every chosen slot from `pack`, seeded by `key`; the content says which pack, at what p, by whom. */
export function fleshSpec(spec: WireSpec, key: string, pack: Pack, meta: { p?: number | undefined; by?: string | undefined } = {}): WireSpec {
  if (isBlueprint(spec)) return barsSpec(spec);
  const title = contentTitle(spec.archetype, pack, spec.flow || key, spec.slots.map((s) => s.block));
  const content: WireContent = {
    source: "pack",
    pack: pack.id,
    ...(meta.p !== undefined ? { p: Math.round(meta.p * 1000) / 1000 } : {}),
    ...(meta.by ? { by: meta.by } : {}),
    ...(title !== undefined ? { title } : {}),
    ...(spec.archetype === "detail" ? { bar: pack.noun[0] } : {}),
  };
  return { ...spec, title: fleshedTitle(spec, pack), content, slots: spec.slots.map((slot) => withFill(slot, fillSlot(pack, spec, key, slot))) };
}

/**
 * **The screen's name, in the pack's words** (24 Sep 2026): "Deliveries",
 * not "List". Only a title that is still the archetype's, or the one an
 * earlier pack gave it, changes — a title an agent or a person chose stays.
 * The item's own title follows it only where nobody renamed the item
 * (`writeWire`).
 */
function fleshedTitle(spec: WireSpec, pack: Pack): string {
  const archetype = RECIPE_BY_ID.get(spec.archetype)?.title;
  const earlier = spec.content?.pack ? domainTitle(spec.archetype, packOf(spec.content.pack)) : undefined;
  if (spec.title !== archetype && (earlier === undefined || spec.title !== earlier)) return spec.title;
  return domainTitle(spec.archetype, pack) ?? archetype ?? spec.title;
}

/** Bars again: no content, no fill anywhere — and the archetype's name back where the pack gave one. */
export function barsSpec(spec: WireSpec): WireSpec {
  const given = spec.content?.pack ? domainTitle(spec.archetype, packOf(spec.content.pack)) : undefined;
  const archetype = RECIPE_BY_ID.get(spec.archetype)?.title;
  const out: WireSpec = {
    ...spec,
    ...(given !== undefined && spec.title === given && archetype ? { title: archetype } : {}),
    slots: spec.slots.map((slot) => withFill(slot, undefined)),
  };
  delete out.content;
  return out;
}

function withFill(slot: WireSlot, fill: SlotFill | undefined): WireSlot {
  const out = { ...slot };
  if (fill) out.fill = fill;
  else delete out.fill;
  return out;
}

/**
 * Fill the named slots again from the spec's own pack — what a variation
 * needs after it swaps a block, so the flipped slot is fleshed with the
 * same pack and seed as the rest of the screen. A spec with no content is
 * returned as it is.
 */
export function refill(spec: WireSpec, key: string, slots: readonly string[]): WireSpec {
  if (!spec.content) return spec;
  const pack = packOf(spec.content.pack);
  return { ...spec, slots: spec.slots.map((slot) => (slots.includes(slot.slot) ? withFill(slot, fillSlot(pack, spec, key, slot)) : slot)) };
}

// ---------- exact copy

/** Every word a fill holds, by path — `items.0.title`, `stats.1.value`. Pictograms and numbers are not words. */
export function wordsOf(fill: SlotFill | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fill) return out;
  for (const key of ["heading", "sub", "person"] as const) if (fill[key] !== undefined) out[key] = fill[key]!;
  for (const key of ["lines", "labels", "values", "groups"] as const) fill[key]?.forEach((w, i) => (out[`${key}.${i}`] = w));
  fill.items?.forEach((it, i) => {
    for (const key of ["title", "sub", "status", "meta", "person", "text"] as const) if (it[key] !== undefined) out[`items.${i}.${key}`] = it[key]!;
    it.cells?.forEach((w, j) => (out[`items.${i}.cells.${j}`] = w));
  });
  fill.stats?.forEach((s, i) => {
    out[`stats.${i}.label`] = s.label;
    out[`stats.${i}.value`] = s.value;
    if (s.delta !== undefined) out[`stats.${i}.delta`] = s.delta;
  });
  Object.entries(fill.actions ?? {}).forEach(([element, w]) => {
    out[`actions.${element}`] = w;
  });
  return out;
}

/** Put words back by path. A path the fill does not hold is refused, so copy never invents a slot's shape. */
export function withWords(fill: SlotFill, words: Record<string, string> | readonly string[], where: string): SlotFill {
  const have = wordsOf(fill);
  const paths = Object.keys(have);
  const pairs: Array<[string, string]> = Array.isArray(words)
    ? (words as readonly string[]).map((w, i) => {
      if (i >= paths.length) throw new Error(`${where}: ${words.length} words given, but the slot holds ${paths.length}`);
      return [paths[i]!, w];
    })
    : Object.entries(words as Record<string, string>);
  const out = structuredClone(fill) as SlotFill & Record<string, unknown>;
  for (const [path, word] of pairs) {
    if (!(path in have)) throw new Error(`${where}: no word at "${path}" — it holds ${paths.join(", ")}`);
    if (typeof word !== "string") throw new Error(`${where}: "${path}" must be a string`);
    const parts = path.split(".");
    let at: Record<string, unknown> = out;
    for (const part of parts.slice(0, -1)) at = at[part] as Record<string, unknown>;
    at[parts[parts.length - 1]!] = word;
  }
  return out;
}

/** A copy file: the heading and, per slot, words by path (or in the order `wire copy` prints them). */
export interface CopyFile {
  title?: string;
  /** What the app bar says where the body draws the heading. */
  bar?: string;
  slots?: Record<string, Record<string, string> | string[]>;
}

/** The words a screen holds, for `wire copy` to print. */
export function copyOf(spec: WireSpec): { title: string; content: WireContent | null; slots: Array<{ slot: string; block: string; words: Record<string, string> }> } {
  return {
    title: spec.content?.title ?? spec.title,
    content: spec.content ?? null,
    slots: spec.slots.filter((s) => s.block && s.fill).map((s) => ({ slot: s.slot, block: s.block!, words: wordsOf(s.fill) })),
  };
}

/** Apply exact words: the spec's content becomes `copy`, by whoever wrote it. */
export function applyCopy(spec: WireSpec, file: CopyFile, by: string): WireSpec {
  if (!spec.content) throw new Error("this screen draws bars — `isocan wire flesh <screen>` fills it first, then its words can be replaced");
  const bySlot = new Map(spec.slots.map((s) => [s.slot, s]));
  for (const name of Object.keys(file.slots ?? {})) {
    const slot = bySlot.get(name);
    if (!slot) throw new Error(`no slot "${name}" on this screen — it has ${spec.slots.map((s) => s.slot).join(", ")}`);
    if (!slot.fill) throw new Error(`slot "${name}" (${slot.block ?? "undecided"}) holds no words`);
  }
  if (file.title !== undefined && typeof file.title !== "string") throw new Error("title must be a string");
  const slots = spec.slots.map((slot) => {
    const words = file.slots?.[slot.slot];
    return words && slot.fill ? { ...slot, fill: withWords(slot.fill, words, `slot "${slot.slot}"`) } : slot;
  });
  const pack = spec.content.pack;
  const title = file.title ?? spec.content.title;
  if (file.bar !== undefined && typeof file.bar !== "string") throw new Error("bar must be a string");
  const bar = file.bar ?? spec.content.bar;
  const content: WireContent = { source: "copy", by, ...(pack ? { pack } : {}), ...(title !== undefined ? { title } : {}), ...(bar !== undefined ? { bar } : {}) };
  return { ...spec, content, slots };
}
