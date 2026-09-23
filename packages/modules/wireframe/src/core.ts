import { wireframeModule } from "./record.ts";

/**
 * **Wireframes** (`docs/projects/wireframes/design.md`).
 *
 * The pure half both surfaces draw with: the catalog (archetype recipes,
 * blocks, primitives, intents — as data), the spec, and `renderWire` /
 * `readWire`. A screen is an ordinary HTML item whose file carries its own
 * spec, so it renders anywhere an HTML item does and outlives this module.
 * The composer's rounds and the answerer seam (Jev, the seeded stub) are
 * here too, so the home can compose a flow the way the CLI does (phase 4).
 * No operation is new; nothing here imports React or Node.
 */
export * from "./catalog/index.ts";
export * from "./spec.ts";
export { SKELETON_COLORS, WIRE_MARKER, WIRE_SCRIPT_ID, readWire, renderFrame, renderWire, wireCss } from "./render.ts";
export * from "./links.ts";
export * from "./prototype.ts";
export * from "./compose.ts";
export * from "./answerer.ts";
export * from "./vary.ts";
export * from "./keep.ts";
export { wireframeModule };

export default wireframeModule;
