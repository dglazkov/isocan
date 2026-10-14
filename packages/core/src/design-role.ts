import type { Item } from "./model.ts";

/*
 * **The role that makes an item this canvas's design system** (moved out of
 * `designsystem.ts` on 14 Oct 2026, unchanged; `designsystem.ts`
 * re-exports it).
 *
 * The canvas asks `isDesignSystem` while it draws — the documents module
 * marks the note that governs — so the convention is in the web app's first
 * paint. Which design system governs where, and what a screen still needs, is
 * asked by the panels and the CLI; while it shared a file with the role, it
 * was in every first visit too, because a module in the entry chunk carries
 * every export any chunk uses.
 */

const ROLE_PROP = "role";
/** The `role` an item wears to BE this canvas's design system. */
export const DESIGN_SYSTEM_ROLE = "design-system";
/** What this was called for an afternoon. Canvases written in that window
 * still say it, and a rename that orphans somebody's file is not a rename. */
const LEGACY_DESIGN_ROLE = "house-style";

/** The properties that make an item this canvas's design system. */
export function designSystemProperties(): Record<string, string> {
  return { [ROLE_PROP]: DESIGN_SYSTEM_ROLE };
}

/** Is this item the design system — under either name it has been given? */
export function isDesignSystem(item: Item): boolean {
  const role = item.properties[ROLE_PROP];
  return role === DESIGN_SYSTEM_ROLE || role === LEGACY_DESIGN_ROLE;
}

/**
 * The same properties with any governing design role taken off.
 *
 * A deliberate copy of another canvas's design note is a REFERENCE here, not
 * this canvas's system: `role=design-system` is what makes an item govern, so
 * a copy that kept it would silently replace the design every screen on this
 * canvas is checked against. Both spellings come off, because a canvas written
 * in the `house-style` window still says that one.
 */
export function withoutDesignRole(properties: Record<string, string>): Record<string, string> {
  const role = properties[ROLE_PROP];
  if (role !== DESIGN_SYSTEM_ROLE && role !== LEGACY_DESIGN_ROLE) return properties;
  const { [ROLE_PROP]: _role, ...rest } = properties;
  return rest;
}
