import { wireframeModule } from "./record.ts";

/**
 * **Wireframes** (`docs/projects/wireframes/design.md`).
 *
 * The pure half both surfaces draw with: the catalog (archetype recipes,
 * blocks, primitives, intents — as data), the spec, and `renderWire` /
 * `readWire`. A screen is an ordinary HTML item whose file carries its own
 * spec, so it renders anywhere an HTML item does and outlives this module.
 * No operation is new; nothing here imports React or Node.
 */
export * from "./catalog/index.ts";
export * from "./spec.ts";
export { SKELETON_COLORS, WIRE_MARKER, WIRE_SCRIPT_ID, readWire, renderWire } from "./render.ts";
export { wireframeModule };

export default wireframeModule;
