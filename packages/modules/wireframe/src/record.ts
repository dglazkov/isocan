import type { CoreModule } from "@isocan/core";

/**
 * The keep mark (design §6): a property, as a slide is — anybody can take it
 * off. Its words say what it does, "Use in prototype" (24 Sep 2026: "Keep"
 * read as "don't delete", which every screen already is); the property, ⇧K
 * and `wire keep` keep their names, because stored data and muscle memory
 * outlive a label.
 */
export const KEEP_PROP = "wireKeep";
export const KEEP_EMOJI = "📐";
/** A screen round 1 was unsure of (its P(yes), as text), set by the `item.add` that draws it; the canvas marks it while it is not kept. */
export const MAYBE_PROP = "wireMaybe";

/**
 * **The record both surfaces register** — and nothing else, on purpose.
 *
 * A screen is an ordinary HTML item, so the module adds no kind and no mime:
 * the canvas already knows how to draw everything it makes. What it adds is
 * one mark, as data — the shell draws 📐, offers Use in prototype / Remove
 * from prototype in the item menu and answers ⇧K without importing anything
 * from here — and one slash command, `/wire`, whose menu row the Chat must
 * offer before the module's web half has loaded: on the web it opens the `wire` dialog (`web.tsx`,
 * lazy), on the terminal its body is the skill (`command.ts`, which both
 * loaded halves register in place of this `body: ""`). The record lives
 * apart from `core.ts` so the web half can register it without importing the
 * catalog and the renderer, which a first visit to the app has no use for
 * (the entry chunk's budget, `scripts/bundle-ceiling.mjs`).
 */
// `fidelity` is core's FIDELITY_PROP, spelled out: importing the constant pulls
// all of `design-scope.ts` into the entry chunk (+592 bytes, measured), and a
// test holds the two equal (`test/vary.test.ts`).
// The property keys it owns are not here: first paint never reads them, so they ride
// `wireframeCore` (command.ts), which the CLI and the lazy web half register (24 Sep 2026).
export const wireframeModule: CoreModule = {
  name: "@isocan/wireframe",
  // A prototype is lit on the hovered minimap (phase 8): the one item on a busy canvas you can play.
  spotlights: ["wirePrototype"],
  marks: [{ property: KEEP_PROP, emoji: KEEP_EMOJI, title: "In the prototype", on: "Use in prototype", off: "Remove from prototype", key: "K", offeredOn: { fidelity: "wireframe" } }],
  commands: [{ name: "wire", description: "Wireframes from a request", usage: "[basic] <request>|prototype|style|links", source: "module", opens: "wire", body: "" }],
};
