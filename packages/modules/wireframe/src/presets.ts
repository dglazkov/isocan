import { canvasScopes, isGroupItem, newGroupId, newItemId, newVersionId, type CanvasContents, type Item } from "@isocan/core";
import { designUse, ownDesignSystemAt } from "@isocan/core/design-use";
import type { Screen } from "./flow.ts";
import { currentVersionOf, type WirePort } from "./port.ts";
import { governingSystem, restyle, type Restyled, type StyleResolver } from "./restyle.ts";

/**
 * **Wire styles — a named look in one act** (24 Sep 2026, Dion: *"change the
 * style from 'house' (default) to 'material' for material design, 'shadcn'
 * … and others most popular"*).
 *
 * A wire style is a DESIGN.md the module ships (`assets/styles/<id>/`), or
 * one of the design competition's nine packs where that module's files can
 * be read. Choosing one is three things any person could already do by hand,
 * done as ONE op group so one undo takes all of it back:
 *
 * 1. **Place the file** beside the flow as a markdown item, marked
 *    `wirePreset=<id>` — or, where the flow's scope already governs by a
 *    wire style, give that item a NEW VERSION (and its new name) rather than
 *    a second item: the version stack is the history of looks tried, and a
 *    canvas does not fill with DESIGN.md files nobody chose twice.
 * 2. **Make it the scope's design system** — core's `designUse`, the op the
 *    item menu's "Use as design system" and `isocan design use` send. The
 *    scope is where the flow sits: its group, or the canvas when it sits in
 *    none (then it governs every wire no group of its own governs).
 * 3. **Restyle** — `restyle.ts`, over every wire the change touched: the
 *    flows asked for, and any other wire whose governing system just moved.
 *
 * `house` is the way back: the scope's wire-style item goes to the trash,
 * and those wires return to the default greys — `wire style --default`, plus
 * letting go of the file. A scope governed by a DESIGN.md somebody WROTE is
 * never overwritten by a wire style: that is refused, with the way to stop
 * it governing, because a preset landing as a new version of a person's own
 * system is a surprise nobody asked for.
 *
 * Nothing here asks a model for the module's own styles: they name their
 * tokens for the wire's roles (theme.ts's `namedRoles`), so the mapping is
 * read, not asked. A pack is a person's system in someone else's words, and
 * is mapped by the answerer once per version, as any other.
 */

/** The default look, by name — the greys every wire starts in. */
export const HOUSE = "house";
/** The property a wire-style DESIGN.md wears: which style it is. What the menu's tick reads. */
export const PRESET_PROP = "wirePreset";

/** One named look. */
export interface WirePreset {
  id: string;
  /** How a person sees it named. */
  name: string;
  /** One line: what it looks like. */
  about: string;
  /** `own`: this module's `assets/styles/<id>/DESIGN.md`; `pack`: the design competition's `assets/packs/<id>/DESIGN.md`. */
  from: "own" | "pack";
}

/** The module's own wire styles — original token sets, inspired by each system, system fonts only. */
export const OWN_PRESETS: readonly WirePreset[] = [
  { id: "material", name: "Material", about: "Material 3's ideas — tonal violet, 12px corners, elevation", from: "own" },
  { id: "shadcn", name: "Shadcn", about: "shadcn/ui's look — zinc neutrals, hairline borders, small corners", from: "own" },
  { id: "glass", name: "Glass", about: "glassmorphism — frosted translucent panes over a soft gradient", from: "own" },
  { id: "ios", name: "iOS", about: "Apple's HIG — system face, grouped greys, 10px corners, tint blue", from: "own" },
  { id: "fluent", name: "Fluent", about: "Fluent 2's ideas — neutral greys, communication blue, 4px corners, light shadows", from: "own" },
  { id: "carbon", name: "Carbon", about: "Carbon's ideas — square, dense, cool greys, one strong blue", from: "own" },
  { id: "brutalist", name: "Brutalist", about: "thick black borders, hard shadows, monospace, loud flat colour", from: "own" },
];

/**
 * The design competition's packs, addressable by name when that module's
 * files are there to read (`wire style --list` says when they are not). A
 * test holds this list to the packs directory, so a tenth pack is named here
 * or the suite says so.
 */
export const PACK_PRESETS: readonly WirePreset[] = ["duarte", "frog", "ideo", "ive", "kare", "linear", "rams", "tufte", "victor"].map((id) => ({
  id,
  name: id[0]!.toUpperCase() + id.slice(1),
  about: "a design-competition pack — its tokens mapped onto the wire by the answerer",
  from: "pack" as const,
}));

/** Every name `wire style --preset` takes, in the order the menu lists them: house, the module's own, the packs. */
export const PRESET_NAMES: readonly string[] = [HOUSE, ...OWN_PRESETS.map((p) => p.id), ...PACK_PRESETS.map((p) => p.id)];

/** A wire style by name, or undefined — `house` is not a file, so it is not one. */
export function presetById(id: string): WirePreset | undefined {
  return OWN_PRESETS.find((p) => p.id === id) ?? PACK_PRESETS.find((p) => p.id === id);
}

/** Where a style's DESIGN.md is, relative to the module that ships it. */
export function presetFile(preset: WirePreset): string {
  return preset.from === "own" ? `assets/styles/${preset.id}/DESIGN.md` : `assets/packs/${preset.id}/DESIGN.md`;
}

/** Refuse a name that is not a style, saying which are. */
export function presetOrSay(name: string): WirePreset | typeof HOUSE {
  const id = name.trim().toLowerCase();
  if (id === HOUSE) return HOUSE;
  const found = presetById(id);
  if (!found) throw new Error(`"${name}" is not a wire style — ${PRESET_NAMES.join(", ")}`);
  return found;
}

/** The title a style's DESIGN.md wears on the canvas. Ends in DESIGN.md, so the item menu knows it for one. */
export function presetTitle(preset: WirePreset): string {
  return `${preset.name} — DESIGN.md`;
}

/**
 * **Which style these items are drawn under**, for the menu's tick: the
 * wire style that governs every one of them, `house` where no system
 * governs any of them, and undefined when they differ or a DESIGN.md
 * somebody wrote governs — a person's own system is not a preset.
 */
export function currentPreset(canvas: CanvasContents, items: readonly Item[]): string | undefined {
  const each = new Set(items.map((item) => {
    const system = governingSystem(canvas, item);
    return system ? system.properties?.[PRESET_PROP] ?? "" : HOUSE;
  }));
  const [only] = each;
  return each.size === 1 && only ? only : undefined;
}

/** The screens of every flow these items belong to — variations included — or all of them when none is named. */
export function flowScreens(all: readonly Screen[], itemIds: readonly string[]): Screen[] {
  if (itemIds.length === 0) return [...all];
  const named = new Set(itemIds);
  const flows = new Set(all.filter((s) => named.has(s.item)).map((s) => s.spec.flow || s.item));
  return all.filter((s) => named.has(s.item) || flows.has(s.spec.flow || s.item));
}

/** What happened to one scope's wire-style item. */
export interface PresetPlacement {
  itemId: string;
  /** The group it governs; null for the canvas. */
  scope: string | null;
  what: "added" | "versioned" | "unchanged" | "removed";
}

export interface PresetResult {
  group: string;
  /** `house`, or the style's id. */
  name: string;
  placed: PresetPlacement[];
  restyled: Restyled;
}

const GAP = 160;

/** Refuse before anything is written: a scope governed by a DESIGN.md somebody wrote. */
function refuseOwnSystem(system: Item, scope: Item | null): Error {
  const where = scope ? `the group “${scope.title}”` : "this canvas";
  return new Error(`“${system.title}” is the design system of ${where}, and a wire style would become a new version of it. Wires draw in it already (\`isocan wire style\`); to use a wire style instead, stop it governing first — \`isocan design use ${system.id} --off\`, or its right-click menu → Stop using as design system.`);
}

/**
 * **Choose a wire style for these screens' flows** — the one act both
 * surfaces run (`isocan wire style --preset`, `/wire style <name>`, the
 * wire's Style ▸ menu). `text` is the style's DESIGN.md (null for `house`),
 * read by the surface: a file on the terminal, a fetch in the browser.
 */
export async function applyPreset(
  port: WirePort,
  all: readonly Screen[],
  screens: readonly Screen[],
  choice: WirePreset | typeof HOUSE,
  text: string | null,
  resolver: StyleResolver,
): Promise<PresetResult> {
  if (screens.length === 0) throw new Error("no wireframe to style — `isocan wire \"<request>\"` composes some");
  if (choice !== HOUSE && !text) throw new Error(`the ${choice.name} wire style has no DESIGN.md to read`);
  const before = await port.canvas();
  const group = newGroupId();

  // One wire-style item per scope: the group a screen sits in, or the canvas.
  const byScope = new Map<string | null, Screen[]>();
  for (const s of screens) {
    const item = before.items[s.item];
    if (!item) continue;
    const scope = canvasScopes(before, item)[0]?.id ?? null;
    byScope.set(scope, [...(byScope.get(scope) ?? []), s]);
  }
  if (choice !== HOUSE) {
    for (const scope of byScope.keys()) {
      const own = ownDesignSystemAt(before, scope);
      if (own && own.properties?.[PRESET_PROP] === undefined) throw refuseOwnSystem(own, scope ? before.items[scope] ?? null : null);
    }
  }

  const placed: PresetPlacement[] = [];
  for (const [scope, list] of byScope) {
    const own = ownDesignSystemAt(before, scope);
    const mine = own && own.properties?.[PRESET_PROP] !== undefined ? own : null;
    if (choice === HOUSE) {
      if (mine) {
        await port.send({ type: "item.delete", itemId: mine.id }, group);
        placed.push({ itemId: mine.id, scope, what: "removed" });
      }
      continue;
    }
    const words = text!;
    const title = presetTitle(choice);
    if (mine) {
      const current = currentVersionOf(mine);
      if (mine.properties[PRESET_PROP] === choice.id && current && (await port.readText(current.blobHash)) === words) {
        placed.push({ itemId: mine.id, scope, what: "unchanged" });
        continue;
      }
      // A new version of the same item, and its new name: the stack is the looks this flow has worn.
      const upload = await port.put(words, "text/markdown", "DESIGN.md");
      await port.send({ type: "item.addVersion", itemId: mine.id, version: { id: newVersionId(), blobHash: upload.blobHash, mimeType: "text/markdown", filename: "DESIGN.md", size: upload.size } }, group);
      await port.send({ type: "item.update", itemId: mine.id, patch: { title, properties: { [PRESET_PROP]: choice.id } } }, group);
      placed.push({ itemId: mine.id, scope, what: "versioned" });
      continue;
    }
    const upload = await port.put(words, "text/markdown", "DESIGN.md");
    const itemId = newItemId();
    const scopeItem = scope ? before.items[scope] : undefined;
    await port.send({
      type: "item.add",
      itemId,
      version: { id: newVersionId(), blobHash: upload.blobHash, mimeType: "text/markdown", filename: "DESIGN.md", size: upload.size },
      width: 560,
      height: 720,
      // Beside the flow, level with its top: where somebody looking at the screens looks next.
      placement: { x: Math.max(...list.map((s) => s.x + s.width)) + GAP, y: Math.min(...list.map((s) => s.y)), chosen: true } as never,
      title,
      properties: { [PRESET_PROP]: choice.id },
      ...(scopeItem && isGroupItem(scopeItem) ? { containerId: scopeItem.id, groupPlacement: "exact" as const } : {}),
    }, group);
    // …and make it govern, with the op the item menu's "Use as design system" sends for it.
    const landed = await port.canvas();
    await port.send(designUse(landed, landed.items[itemId]!).op, group);
    placed.push({ itemId, scope, what: "added" });
  }

  // Restyle what moved: the flows asked for, and any wire whose governing system (or its version) just changed.
  const after = await port.canvas();
  const governs = (canvas: CanvasContents, s: Screen) => {
    const item = canvas.items[s.item];
    const system = item ? governingSystem(canvas, item) : null;
    return system ? `${system.id}@${system.currentVersionId}` : "";
  };
  const asked = new Set(screens.map((s) => s.item));
  const touched = all.filter((s) => after.items[s.item] && (asked.has(s.item) || governs(before, s) !== governs(after, s)));
  const restyled = await restyle(port, after, all, touched, resolver, { toDefault: choice === HOUSE, group });
  return { group, name: choice === HOUSE ? HOUSE : choice.id, placed, restyled };
}

/** The act, in a line for a person: which style, what happened to its file, how many wires moved. */
export function presetSummary(r: PresetResult): string {
  const style = r.name === HOUSE ? "house (the default greys)" : presetById(r.name)?.name ?? r.name;
  const files = r.placed.map((p) => p.what === "added" ? "its DESIGN.md placed beside the flow" : p.what === "versioned" ? "a new version of the flow's wire-style DESIGN.md" : p.what === "removed" ? "the wire-style DESIGN.md moved to the trash" : "its DESIGN.md already there");
  const { changed, targets } = r.restyled;
  const wrote = changed.length > 0 || r.placed.some((p) => p.what !== "unchanged");
  return `${style}: ${[...new Set(files)].join("; ") || "no file to change"} · ${changed.length} of ${targets.length} wires restyled${wrote ? " — one op group: one undo takes it all back" : " — nothing written"}`;
}
