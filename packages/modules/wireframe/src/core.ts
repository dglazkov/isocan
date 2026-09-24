import { wireframeModule } from "./record.ts";
import { wireframeCore } from "./command.ts";

/**
 * **Wireframes** (`docs/projects/wireframes/design.md`).
 *
 * The pure half both surfaces draw with: the catalog (archetype recipes,
 * blocks, primitives, intents — as data), the spec, and `renderWire` /
 * `readWire`. A screen is an ordinary HTML item whose file carries its own
 * spec, so it renders anywhere an HTML item does and outlives this module.
 * The composer's rounds and the answerer seam (Jev, the home, the seeded
 * stub) are here too — and since phase 5 the composer's canvas half as well
 * (`flow.ts`, `restyle.ts`, `kept-flows.ts`, written against the `WirePort`
 * in `port.ts`), so the web composes a flow with the same code the CLI does.
 * Since phase 7 the content packs too (`content/`, design §10): sample
 * words, numbers and pictograms a flesh writes into a spec, and `flesh.ts`,
 * the canvas half of `wire flesh`.
 * No operation is new; nothing here imports React or Node.
 */
export * from "./catalog/index.ts";
export * from "./spec.ts";
export { SKELETON_COLORS, WIRE_MARKER, WIRE_SCRIPT_ID, readWire, renderFrame, renderWire, styleOf, themeCss, wireCss } from "./render.ts";
export * from "./theme.ts";
export * from "./links.ts";
export * from "./prototype.ts";
export * from "./compose.ts";
export * from "./answerer.ts";
export * from "./vary.ts";
export * from "./keep.ts";
export * from "./maybe.ts";
export * from "./port.ts";
export * from "./flow.ts";
export * from "./restyle.ts";
export * from "./kept-flows.ts";
export * from "./rerender.ts";
export * from "./link-override.ts";
export * from "./chat.ts";
export { FILLERS, contentTitle, entity, fillSlot, fillable, packOf, type Entity, type FillItem, type FillStat, type SlotFill, type WireContent } from "./content/fill.ts";
export * from "./content/flesh-spec.ts";
export * from "./content/choose.ts";
export { PACKS, PACK_BY_ID, PACK_IDS, GENERIC_PACK } from "./content/packs.ts";
export { FIRST_NAMES, type Pack, type Metric } from "./content/pack.ts";
export { PICTOGRAM_IDS, hasPictogram, pictogram } from "./content/pictograms.ts";
export * from "./flesh.ts";
export { wireframeModule, wireframeCore };

export default wireframeCore;
