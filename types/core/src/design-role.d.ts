import type { Item } from "./model.js";
/** The `role` an item wears to BE this canvas's design system. */
export declare const DESIGN_SYSTEM_ROLE = "design-system";
/** The properties that make an item this canvas's design system. */
export declare function designSystemProperties(): Record<string, string>;
/** Is this item the design system — under either name it has been given? */
export declare function isDesignSystem(item: Item): boolean;
/**
 * The same properties with any governing design role taken off.
 *
 * A deliberate copy of another canvas's design note is a REFERENCE here, not
 * this canvas's system: `role=design-system` is what makes an item govern, so
 * a copy that kept it would silently replace the design every screen on this
 * canvas is checked against. Both spellings come off, because a canvas written
 * in the `house-style` window still says that one.
 */
export declare function withoutDesignRole(properties: Record<string, string>): Record<string, string>;
