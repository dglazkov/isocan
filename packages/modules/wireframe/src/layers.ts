import { newGroupId, newVersionId, titleSlug, type CanvasContents, type Item } from "@isocan/core";
import { keptFlowsOf, writePrototype } from "./kept-flows.ts";
import { currentVersionOf, type WirePort } from "./port.ts";
import { PROTOTYPE_PROP } from "./prototype.ts";
import { readWire, renderWire } from "./render.ts";
import {
  WIRE_FIDELITY_TIERS,
  WIRE_LAYER_IDS,
  wireTitle,
  type WireFidelityTier,
  type WireLayerId,
  type WireLayers,
  type WireSpec,
} from "./spec.ts";
import type { Screen } from "./flow.ts";

export const WIRE_LAYER_PROP = "wireLayer";
export const WIRE_LAYER_PREFIX = "wireLayer:";

export interface ResolvedLayers {
  system: boolean;
  copy: boolean;
  lofi: boolean;
  hifi: boolean;
  tier: WireFidelityTier;
  hasSavedHifi: boolean;
  hasSavedLofi: boolean;
}

export const LAYER_LABELS: Record<WireLayerId, { short: string; label: string; hint: string }> = {
  system: { short: "System", label: "Design System", hint: "Governing DESIGN.md colors, type, radius & surface" },
  copy: { short: "Copy", label: "Copy & Data", hint: "Domain words & numbers instead of grey bars" },
  lofi: { short: "Low-Fi", label: "Low-Fi (Fluid UI)", hint: "Unboxed fluid layout, elevated cards & polish" },
  hifi: { short: "High-Fi", label: "High-Fi (Visual Craft)", hint: "Full art-directed visuals & studio stage" },
};

export const TIER_LABELS: Record<WireFidelityTier, { title: string; badge: string; summary: string }> = {
  wire: { title: "1 · Wire (Simple Blocks)", badge: "Wire", summary: "plain monochrome wireframe blocks and grey bars" },
  system: { title: "2 · Wire + Design System", badge: "System", summary: "design system tokens and domain copy" },
  lofi: { title: "3 · Low-Fi (Fluid UI)", badge: "Low-Fi", summary: "unboxed fluid cards, real controls and visual polish" },
  hifi: { title: "4 · High-Fi (Visual Craft)", badge: "High-Fi", summary: "art-directed high-fidelity visual craft" },
};

export function tierFromLayers(layers: Pick<ResolvedLayers, "system" | "copy" | "lofi" | "hifi">): WireFidelityTier {
  if (layers.hifi) return "hifi";
  if (layers.lofi) return "lofi";
  if (layers.system || layers.copy) return "system";
  return "wire";
}

export function layersForTier(tier: WireFidelityTier): Required<WireLayers> {
  switch (tier) {
    case "wire":
      return { system: false, copy: false, lofi: false, hifi: false };
    case "system":
      return { system: true, copy: true, lofi: false, hifi: false };
    case "lofi":
      return { system: true, copy: true, lofi: true, hifi: false };
    case "hifi":
      return { system: true, copy: true, lofi: true, hifi: true };
  }
}

function hasVersion(item: Item, versionId: string | undefined): boolean {
  return Boolean(versionId && item.versions.some((v) => v.id === versionId));
}

/**
 * Resolve the active checkable layers and fidelity tier for an item and its
 * parsed `WireSpec` (if available).
 */
export function resolveItemLayers(item: Item, spec?: WireSpec | null): ResolvedLayers {
  const props = item.properties ?? {};
  const savedHifi = props["wireLayer:hifi"];
  const savedLofi = props["wireLayer:lofi"];
  const savedSystem = props["wireLayer:system"];
  const savedWire = props["wireLayer:wire"];
  const hasSavedHifi = hasVersion(item, savedHifi);
  const hasSavedLofi = hasVersion(item, savedLofi);

  if (hasSavedHifi && item.currentVersionId === savedHifi) {
    return { system: true, copy: true, lofi: true, hifi: true, tier: "hifi", hasSavedHifi, hasSavedLofi };
  }
  if (hasSavedLofi && item.currentVersionId === savedLofi) {
    return { system: true, copy: true, lofi: true, hifi: false, tier: "lofi", hasSavedHifi, hasSavedLofi };
  }
  if (hasVersion(item, savedWire) && item.currentVersionId === savedWire && !spec?.layers) {
    return { system: false, copy: false, lofi: false, hifi: false, tier: "wire", hasSavedHifi, hasSavedLofi };
  }
  if (hasVersion(item, savedSystem) && item.currentVersionId === savedSystem && !spec?.layers) {
    return { system: true, copy: true, lofi: false, hifi: false, tier: "system", hasSavedHifi, hasSavedLofi };
  }

  const explicit = spec?.layers;
  const hifi = explicit?.hifi ?? (props[WIRE_LAYER_PROP] === "hifi");
  if (hifi) {
    return { system: true, copy: true, lofi: true, hifi: true, tier: "hifi", hasSavedHifi, hasSavedLofi };
  }
  const lofi = explicit?.lofi ?? (props[WIRE_LAYER_PROP] === "lofi" || Boolean(spec?.polish && spec.polish.length > 0));
  const system = explicit?.system ?? Boolean(spec?.style && spec.style.source !== "default");
  const copy = explicit?.copy ?? Boolean(spec?.content || spec?.slots.some((s) => s.fill !== undefined));
  const tier = tierFromLayers({ system, copy, lofi, hifi: false });
  return { system, copy, lofi, hifi: false, tier, hasSavedHifi, hasSavedLofi };
}

/**
 * Parse a layer command directive such as:
 * - `"wire"` | `"1"` | `"basic"`
 * - `"system"` | `"2"`
 * - `"lofi"` | `"low-fi"` | `"3"`
 * - `"hifi"` | `"high-fi"` | `"4"`
 * - `"+system"` | `"-system"` | `"toggle:system"` | `"+copy"` | `"-copy"` | `"+lofi"` | `"-lofi"` | `"+hifi"` | `"-hifi"`
 */
export function parseLayerDirective(
  raw: string,
  current: Pick<ResolvedLayers, "system" | "copy" | "lofi" | "hifi">,
): Required<WireLayers> {
  const tokens = raw.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    throw new Error(
      "which layer? Choose a tier (`wire`, `system`, `lofi`, `hifi`) or toggle individual layers (`+system`, `-system`, `+copy`, `-copy`, `+lofi`, `-lofi`, `+hifi`, `-hifi`).",
    );
  }

  const single = tokens[0]!;
  if (tokens.length === 1) {
    if (single === "wire" || single === "1" || single === "basic" || single === "blocks") return layersForTier("wire");
    if (single === "system" || single === "2" || single === "ds") return layersForTier("system");
    if (single === "lofi" || single === "low-fi" || single === "3" || single === "fluid") return layersForTier("lofi");
    if (single === "hifi" || single === "high-fi" || single === "4" || single === "craft") return layersForTier("hifi");
  }

  const next: Required<WireLayers> = {
    system: current.system,
    copy: current.copy,
    lofi: current.lofi,
    hifi: current.hifi,
  };

  for (const tok of tokens) {
    const normalizeLayer = (name: string): WireLayerId | null => {
      if (name === "system" || name === "ds" || name === "style") return "system";
      if (name === "copy" || name === "content" || name === "flesh" || name === "data") return "copy";
      if (name === "lofi" || name === "low-fi" || name === "polish") return "lofi";
      if (name === "hifi" || name === "high-fi" || name === "craft") return "hifi";
      return null;
    };

    let op: "on" | "off" | "toggle" = "on";
    let name = tok;
    if (tok.startsWith("+") || tok.startsWith("on:")) {
      op = "on";
      name = tok.replace(/^(\+|on:)/, "");
    } else if (tok.startsWith("-") || tok.startsWith("no-") || tok.startsWith("off:")) {
      op = "off";
      name = tok.replace(/^(-|no-|off:)/, "");
    } else if (tok.startsWith("toggle:") || tok.startsWith("~")) {
      op = "toggle";
      name = tok.replace(/^(toggle:|~)/, "");
    }

    const layer = normalizeLayer(name);
    if (!layer) {
      throw new Error(
        `unknown layer "${tok}" — layers are ${WIRE_LAYER_IDS.join(", ")} (or tiers: ${WIRE_FIDELITY_TIERS.join(", ")})`,
      );
    }

    const val = op === "toggle" ? !next[layer] : op === "on";
    if (layer === "hifi") {
      if (val) {
        next.system = true;
        next.copy = true;
        next.lofi = true;
        next.hifi = true;
      } else {
        next.hifi = false;
      }
    } else {
      next[layer] = val;
      // Turning off an underlying layer while in High-Fi peels back High-Fi to show the wireframe with that layer off.
      if (!val && next.hifi) {
        next.hifi = false;
      }
    }
  }

  return next;
}

export interface LayerChangeResult {
  group: string;
  changed: Array<{ itemId: string; title: string; tier: WireFidelityTier; layers: Required<WireLayers> }>;
  prototypes: string[];
}

/**
 * Apply a layer directive across target screens on the canvas in one op group,
 * preserving version pointers (`wireLayer:wire`, `wireLayer:system`,
 * `wireLayer:lofi`, `wireLayer:hifi`) so switching between layers never loses
 * bespoke High-Fi or Low-Fi craft, and rebuilding or switching any governed
 * prototype in the same op group.
 */
export async function applyLayersOnCanvas(
  port: WirePort,
  canvas: CanvasContents,
  all: readonly Screen[],
  targets: readonly Screen[],
  directive: string | Required<WireLayers>,
): Promise<LayerChangeResult> {
  const group = newGroupId();
  const changed: LayerChangeResult["changed"] = [];

  for (const screen of targets) {
    const item = canvas.items[screen.item];
    if (!item) continue;
    const currentResolved = resolveItemLayers(item, screen.spec);
    const nextLayers = typeof directive === "string" ? parseLayerDirective(directive, currentResolved) : directive;
    const nextTier = tierFromLayers(nextLayers);

    // Record current version pointer before switching if not yet recorded for its tier
    const propPatch: Record<string, string> = {
      [WIRE_LAYER_PROP]: nextTier,
    };
    const currentKey = `${WIRE_LAYER_PREFIX}${currentResolved.tier}`;
    if (!item.properties?.[currentKey]) {
      propPatch[currentKey] = item.currentVersionId;
    }

    // Check if the target is a clean tier that already has a saved version on the item
    const exactTierMatch =
      (nextTier === "hifi" && nextLayers.hifi) ||
      (nextTier === "lofi" && !nextLayers.hifi && nextLayers.lofi && nextLayers.system && nextLayers.copy) ||
      (nextTier === "system" && !nextLayers.hifi && !nextLayers.lofi && nextLayers.system && nextLayers.copy) ||
      (nextTier === "wire" && !nextLayers.hifi && !nextLayers.lofi && !nextLayers.system && !nextLayers.copy);

    const savedTargetVer = exactTierMatch ? item.properties?.[`${WIRE_LAYER_PREFIX}${nextTier}`] : undefined;

    if (savedTargetVer && hasVersion(item, savedTargetVer)) {
      if (item.currentVersionId !== savedTargetVer) {
        await port.send({ type: "item.setCurrentVersion", itemId: item.id, versionId: savedTargetVer }, group);
      }
      await port.send({ type: "item.update", itemId: item.id, patch: { properties: propPatch } }, group);
      changed.push({ itemId: item.id, title: item.title, tier: nextTier, layers: nextLayers });
      continue;
    }

    // Render the wireframe spec with the requested non-destructive layer flags
    const nextSpec: WireSpec = {
      ...screen.spec,
      layers: nextLayers,
    };
    const html = renderWire(nextSpec);
    const currentVer = currentVersionOf(item);
    const currentHtml = currentVer ? await port.readText(currentVer.blobHash) : "";
    if (html !== currentHtml) {
      const filename = `${titleSlug(wireTitle(nextSpec), { max: 60 }) || "screen"}.html`;
      const uploaded = await port.put(html, "text/html", filename);
      const versionId = newVersionId();
      await port.send(
        {
          type: "item.addVersion",
          itemId: item.id,
          version: { id: versionId, blobHash: uploaded.blobHash, mimeType: "text/html", filename, size: uploaded.size },
        },
        group,
      );
      if (exactTierMatch && !item.properties?.[`${WIRE_LAYER_PREFIX}${nextTier}`]) {
        propPatch[`${WIRE_LAYER_PREFIX}${nextTier}`] = versionId;
      }
    }
    await port.send({ type: "item.update", itemId: item.id, patch: { properties: propPatch } }, group);
    changed.push({ itemId: item.id, title: item.title, tier: nextTier, layers: nextLayers });
  }

  // Update or switch any affected flow prototypes in the same op group
  const prototypes: string[] = [];
  if (changed.length > 0) {
    const now = await port.canvas();
    const nowWires = await Promise.all(
      all.map(async (s) => {
        const it = now.items[s.item];
        const v = it ? currentVersionOf(it) : undefined;
        const parsed = v ? readWire(await port.readText(v.blobHash)) : null;
        return { ...s, spec: parsed ?? s.spec };
      }),
    );
    const touchedFlows = new Set(targets.map((t) => t.spec.flow).filter(Boolean));
    for (const flow of keptFlowsOf(now, nowWires)) {
      if (!touchedFlows.has(flow.flow)) continue;
      const protoItem = Object.values(now.items).find((i) => i.properties?.[PROTOTYPE_PROP] === flow.flow);
      const targetTier = changed[0]?.tier;
      const savedProtoVer = targetTier ? protoItem?.properties?.[`${WIRE_LAYER_PREFIX}${targetTier}`] : undefined;
      if (protoItem && targetTier && savedProtoVer && hasVersion(protoItem, savedProtoVer)) {
        if (protoItem.currentVersionId !== savedProtoVer) {
          await port.send({ type: "item.setCurrentVersion", itemId: protoItem.id, versionId: savedProtoVer }, group);
        }
        await port.send(
          { type: "item.update", itemId: protoItem.id, patch: { properties: { [WIRE_LAYER_PROP]: targetTier } } },
          group,
        );
        prototypes.push(protoItem.id);
      } else {
        const w = await writePrototype(port, now, flow, group);
        if (w.what !== "unchanged") prototypes.push(w.itemId);
      }
    }
  }

  return { group, changed, prototypes };
}

export function layerSummary(result: LayerChangeResult): string {
  if (result.changed.length === 0) return "No wireframe screens changed";
  const first = result.changed[0]!;
  const tierInfo = TIER_LABELS[first.tier];
  const checked = WIRE_LAYER_IDS.filter((id) => first.layers[id]).map((id) => LAYER_LABELS[id].short);
  const checkWords = checked.length > 0 ? `checked: ${checked.join(", ")}` : "all enhancement layers off (pure wire blocks)";
  const protoWords = result.prototypes.length > 0 ? ` · prototype updated` : "";
  return `${result.changed.length} screen${result.changed.length === 1 ? "" : "s"} → ${tierInfo.badge} (${checkWords})${protoWords} — one undo takes it back`;
}
