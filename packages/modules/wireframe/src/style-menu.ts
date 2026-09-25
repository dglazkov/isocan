import { FIDELITY_PROP, type Item, type ModuleMenuFacts, type ModuleMenuRow } from "@isocan/core";
import { HOUSE, OWN_PRESETS, PACK_PRESETS, currentPreset, presetById } from "./presets.ts";
import { PROTOTYPE_PROP } from "./prototype.ts";

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
export function styleMenu({ canvas, items, open }: ModuleMenuFacts): ModuleMenuRow[] {
  if (items.length === 0 || !items.every(isWire)) return [];
  const now = currentPreset(canvas, items);
  const row = (id: string, label: string): ModuleMenuRow => ({ label, checked: id === now, writes: true, run: () => open("wire", `style ${id}`) });
  return [{
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

/** A wire the Style menu is for: a screen or a variation — not a prototype, which plays its screens' looks. */
function isWire(item: Item): boolean {
  return item.properties?.[FIDELITY_PROP] === "wireframe" && item.properties?.[PROTOTYPE_PROP] === undefined;
}
