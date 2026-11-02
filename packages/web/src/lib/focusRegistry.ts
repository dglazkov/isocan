import type { ComponentType } from "react";
import {
  DESIGN_SYSTEM_ROLE,
  isDesignSystem,
  nodeCapabilitiesFor,
  visualFaceOf,
  type FocusFacts,
  type Item,
  type ItemVersion,
  type ModuleFocus,
} from "@isocan/core";
import { moduleFocusFor } from "../modules.ts";
import { imageFocusFacet } from "../components/ImageFocus.tsx";
import { designSystemFocusFacet } from "../components/DesignSystemFocus.tsx";
import { screenFocusFacet } from "../components/ScreenFocus.tsx";

/** A React-concrete `ModuleFocus` facet registered by a built-in studio or loaded module. */
export type FocusFacetRecord = ModuleFocus<ComponentType<FocusFacts>, ComponentType<FocusFacts>>;

const BUILTIN_FACETS: FocusFacetRecord[] = [
  imageFocusFacet,
  designSystemFocusFacet,
  screenFocusFacet,
];

/**
 * Register a built-in `ModuleFocus` facet (e.g. Image, Design System, HTML
 * Screen). Built-in facets have default priority 0 so any loaded module facet
 * (`priority ?? 10`) can override them when active and fall back cleanly when
 * unloaded.
 */
export function registerBuiltinFocus(facet: FocusFacetRecord): void {
  const idx = BUILTIN_FACETS.findIndex((f) => f.id === facet.id);
  if (idx >= 0) BUILTIN_FACETS[idx] = facet;
  else BUILTIN_FACETS.push(facet);
}

/** Default agent prompt chips per node kind when a facet does not supply its own. */
export function defaultAgentPromptsFor(
  item: Item,
  version: ItemVersion,
): readonly { label: string; prompt: string }[] {
  const face = visualFaceOf(version);
  if (isDesignSystem(item) || item.properties?.role === DESIGN_SYSTEM_ROLE) {
    return [
      { label: "Audit AA contrast", prompt: "Audit all color token pairs for WCAG AA contrast and fix any failures." },
      { label: "Tighten type scale", prompt: "Refine the typography scale and hierarchy for stronger visual rhythm." },
      { label: "Add dark palette", prompt: "Propose a cohesive dark-surface token set that preserves brand voice." },
    ];
  }
  if (item.properties?.fidelity === "wireframe") {
    return [
      { label: "Swap section", prompt: "Replace the selected wireframe slot with a clearer catalog block." },
      { label: "Tighten copy", prompt: "Rewrite the wireframe copy so every CTA and heading is specific." },
      { label: "Add variation", prompt: "Create an alternative wireframe layout exploring a denser information hierarchy." },
    ];
  }
  if (face.mimeType.startsWith("image/")) {
    return [
      { label: "Remove background", prompt: "Create a new version of this image with a clean transparent background." },
      { label: "Generate variant", prompt: "Generate a fresh visual variation of this image keeping the same composition." },
      { label: "Describe alt text", prompt: "Write concise, accurate accessibility alt text and metadata for this image." },
    ];
  }
  if (face.mimeType === "text/html") {
    return [
      { label: "Polish layout", prompt: "Polish spacing, alignment, and visual hierarchy on this screen." },
      { label: "Check DESIGN.md", prompt: "Align this screen's colors, fonts, and radii with the governing DESIGN.md." },
      { label: "Mobile pass", prompt: "Ensure this screen adapts cleanly down to a 390px mobile viewport." },
    ];
  }
  if (version.mimeType === "text/markdown" || version.mimeType.startsWith("text/")) {
    return [
      { label: "Tighten prose", prompt: "Edit this document for clarity, conciseness, and scannable headings." },
      { label: "Summarize key calls", prompt: "Add a crisp executive summary of the decisions at the top." },
    ];
  }
  return [
    { label: "Improve this item", prompt: "Review this item and stack an improved version." },
  ];
}

/**
 * Resolve the active `ModuleFocus` facet for `(item, version)`:
 * 1. Highest-priority matching facet from loaded modules (`moduleFocusFor`).
 * 2. Highest-priority matching built-in facet (`BUILTIN_FACETS`).
 */
export function resolveNodeFocus(item: Item, version?: ItemVersion): FocusFacetRecord | null {
  const current =
    version ?? item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0];
  if (!current) return null;

  const fromModule = moduleFocusFor(item, current);
  let bestBuiltin: FocusFacetRecord | null = null;
  let bestBuiltinPriority = -Infinity;
  for (const facet of BUILTIN_FACETS) {
    if (!facet.matches(item, current)) continue;
    const p = facet.priority ?? 0;
    if (p > bestBuiltinPriority) {
      bestBuiltin = facet;
      bestBuiltinPriority = p;
    }
  }

  if (fromModule && bestBuiltin) {
    return (fromModule.priority ?? 10) >= bestBuiltinPriority ? fromModule : bestBuiltin;
  }
  return fromModule ?? bestBuiltin;
}

/**
 * Convenience helper returning both `nodeCapabilitiesFor(item, version)` and
 * the resolved `ModuleFocus` facet + starter prompts.
 */
export function inspectNodeFocus(item: Item, version?: ItemVersion) {
  const current =
    version ?? item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0];
  const capabilities = nodeCapabilitiesFor(item, current);
  const facet = current ? resolveNodeFocus(item, current) : null;
  const agentPrompts =
    facet?.agentPrompts ?? (current ? defaultAgentPromptsFor(item, current) : []);
  return { capabilities, facet, agentPrompts };
}
