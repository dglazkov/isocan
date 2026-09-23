import type { CoreModule } from "@isocan/core";

/** The keep mark (design §6): a property, as a slide is — anybody can take it off. */
export const KEEP_PROP = "wireKeep";
export const KEEP_EMOJI = "📐";

/**
 * **The record both surfaces register** — and nothing else, on purpose.
 *
 * A screen is an ordinary HTML item, so the module adds no kind and no mime:
 * the canvas already knows how to draw everything it makes. What it adds is
 * one mark, as data — the shell draws 📐, offers Keep / Unkeep in the item
 * menu and answers ⇧K without importing anything from here. The record lives
 * apart from `core.ts` so the web half can register it without importing the
 * catalog and the renderer, which a first visit to the app has no use for
 * (the entry chunk's budget, `scripts/bundle-ceiling.mjs`).
 */
// `fidelity` is core's FIDELITY_PROP, spelled out: importing the constant pulls
// all of `design-scope.ts` into the entry chunk (+592 bytes, measured), and a
// test holds the two equal (`test/vary.test.ts`).
export const wireframeModule: CoreModule = {
  name: "@isocan/wireframe",
  // `wireLinks` (a person's overrides, links.ts) and `wirePrototype` (prototype.ts) are spelled out too.
  propertyKeys: [KEEP_PROP, "wireLinks", "wirePrototype"],
  marks: [{ property: KEEP_PROP, emoji: KEEP_EMOJI, title: "Kept", on: "Keep", off: "Unkeep", key: "K", offeredOn: { fidelity: "wireframe" } }],
};
