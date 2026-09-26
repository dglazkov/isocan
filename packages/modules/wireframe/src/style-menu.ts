import { isDesignSystem, type ModuleMenuFacts, type ModuleMenuRow } from "@isocan/core";
import { behindCount, isWire, restyleArgs, restyleLabel, wiresBehind } from "./behind.ts";
import { HOUSE, OWN_PRESETS, PACK_PRESETS, currentPreset, presetById } from "./presets.ts";
import { cachedDoc, cachedSpec } from "./spec-cache.ts";

/**
 * **Right-click a wire → Style ▸** (24 Sep 2026, Dion: *"right click on a
 * wire and have 'Style' as an option in the context menu and be able to
 * choose a type"*).
 *
 * A submenu of the wire styles — house, the module's own, then the design
 * competition's packs under their own heading — with a tick on the one that
 * governs every selected wire (`currentPreset`), and its name beside
 * *Style* so the answer shows without opening it. Offered only when every
 * item is a wire (a screen or a variation; a prototype is not styled, its
 * screens are).
 *
 * A pick does nothing of its own: it opens the Wireframes dialog with
 * `style <id>`, which is what typing `/wire style <id>` does — so the menu,
 * the Chat and `isocan wire style --preset` are one act (`presets.ts`), and
 * the dialog applies it to the flows of the wires selected. This is the
 * module's lazy half; the shell's entry chunk pays one call to ask for it.
 */
export function styleMenu(facts: ModuleMenuFacts): ModuleMenuRow[] {
  const { canvas, items, open } = facts;
  if (items.length === 1 && isDesignSystem(items[0]!)) return behindRows(facts);
  if (items.length === 0 || !items.every(isWire)) return [];
  const now = currentPreset(canvas, items);
  const row = (id: string, label: string): ModuleMenuRow => ({ label, checked: id === now, writes: true, run: () => open("wire", `style ${id}`) });
  return [...behindRows(facts), {
    label: "Style",
    value: now === undefined ? "" : now === HOUSE ? "House" : presetById(now)?.name ?? now,
    writes: true,
    run: () => {},
    submenu: [
      row(HOUSE, "House"),
      ...OWN_PRESETS.map((p) => row(p.id, p.name)),
      { separator: "Design packs" },
      ...PACK_PRESETS.map((p) => row(p.id, p.name)),
    ],
  }];
}

/**
 * **Restyle to <system>** (26 Sep 2026) — offered on a wire whose governing
 * DESIGN.md has moved on, and on the DESIGN.md itself with how many wires
 * are behind it. The same act as the canvas's "behind" tag
 * (`behind-marks.tsx`): `/wire style system <ids>`, which is `isocan wire
 * style <screens…>` — those wires' flows, one op group. Read from the specs
 * the canvas has already read (`spec-cache.ts`); a wire not read yet offers
 * nothing rather than a guess.
 */
function behindRows({ canvas, items, open }: ModuleMenuFacts): ModuleMenuRow[] {
  const all = wiresBehind(canvas, cachedSpec, cachedDoc);
  const system = items.length === 1 && isDesignSystem(items[0]!) ? items[0]! : null;
  const picked = new Set(items.map((i) => i.id));
  const behind = system ? all.filter((c) => c.governedBy?.itemId === system.id) : all.filter((c) => picked.has(c.itemId));
  if (behind.length === 0) return [];
  const systems = new Set(behind.map((c) => c.governedBy?.itemId));
  const label = systems.size === 1 ? restyleLabel(behind[0]!) : "Restyle to their design systems";
  return [{ label, ...(system ? { value: behindCount(behind.length) } : {}), writes: true, run: () => open("wire", restyleArgs(behind.map((c) => c.itemId))) }];
}
