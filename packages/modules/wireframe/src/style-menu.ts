import { isDesignSystem, type Item, type ModuleMenuFacts, type ModuleMenuRow } from "@isocan/core";
import { behindCount, isWire, restyleArgs, restyleLabel, wiresBehind } from "./behind.ts";
import { LAYER_LABELS, TIER_LABELS, resolveItemLayers } from "./layers.ts";
import { currentVersionOf } from "./port.ts";
import { HOUSE, OWN_PRESETS, PACK_PRESETS, currentPreset, presetById } from "./presets.ts";
import { WIRE_FIDELITY_TIERS, WIRE_LAYER_IDS } from "./spec.ts";
import { cachedDoc, cachedSpec } from "./spec-cache.ts";

/**
 * **Right-click a wire → Style ▸ and Layers ▸** (24 Sep 2026 & 1 Oct 2026,
 * Dion: *"right click on a wire and have 'Style' as an option in the context
 * menu"* and *"bake in layers so when you select the screen there are layers
 * you can check/uncheck to turn on and off"*).
 *
 * A submenu of the wire styles — house, the module's own, then the design
 * competition's packs under their own heading — with a tick on the one that
 * governs every selected wire (`currentPreset`), and its name beside
 * *Style* so the answer shows without opening it. Beside it, **Layers ▸**
 * offers checkable fidelity layers (`System`, `Copy`, `Low-Fi`, `High-Fi`)
 * and the four fidelity tiers (`1 · Wire`, `2 · Wire + Design System`,
 * `3 · Low-Fi`, `4 · High-Fi`).
 */
export function styleMenu(facts: ModuleMenuFacts): ModuleMenuRow[] {
  const { canvas, items, open } = facts;
  if (items.length === 1 && isDesignSystem(items[0]!)) return behindRows(facts);
  if (items.length === 0 || !items.every(isWire)) return [];
  const now = currentPreset(canvas, items);
  const row = (id: string, label: string): ModuleMenuRow => ({ label, checked: id === now, writes: true, run: () => open("wire", `style ${id}`) });
  return [
    ...behindRows(facts),
    {
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
    },
    ...layersRows(items, open),
  ];
}

function layersRows(items: readonly Item[], open: ModuleMenuFacts["open"]): ModuleMenuRow[] {
  const first = items[0];
  if (!first) return [];
  const ver = currentVersionOf(first);
  const spec = ver ? cachedSpec(ver.blobHash) : null;
  const resolved = resolveItemLayers(first, spec);
  const tierInfo = TIER_LABELS[resolved.tier];

  const checkRows: ModuleMenuRow[] = WIRE_LAYER_IDS.map((layerId) => {
    const on = resolved[layerId];
    const meta = LAYER_LABELS[layerId];
    return {
      label: `${meta.short} — ${meta.label}`,
      checked: on,
      writes: true,
      run: () => open("wire", `layer ${on ? "-" : "+"}${layerId}`),
    };
  });

  const tierRows: ModuleMenuRow[] = WIRE_FIDELITY_TIERS.map((tier) => ({
    label: TIER_LABELS[tier].title,
    checked: resolved.tier === tier,
    writes: true,
    run: () => open("wire", `layer ${tier}`),
  }));

  return [{
    label: "Layers",
    value: tierInfo.badge,
    writes: true,
    run: () => {},
    submenu: [
      ...checkRows,
      { separator: "Fidelity tiers" },
      ...tierRows,
      { separator: "Flow" },
      {
        label: `Sync entire flow to ${tierInfo.badge}`,
        writes: true,
        run: () => open("wire", `layer ${resolved.tier} --flow`),
      },
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
