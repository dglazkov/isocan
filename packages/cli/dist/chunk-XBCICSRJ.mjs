import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);

// packages/modules/wireframe/src/record.ts
var KEEP_PROP = "wireKeep";
var KEEP_EMOJI = "\u{1F4D0}";
var MAYBE_PROP = "wireMaybe";
var wireframeModule = {
  name: "@isocan/wireframe",
  // A prototype is lit on the hovered minimap (phase 8): the one item on a busy canvas you can play.
  spotlights: ["wirePrototype"],
  marks: [{ property: KEEP_PROP, emoji: KEEP_EMOJI, title: "In the prototype", on: "Use in prototype", off: "Remove from prototype", key: "K", offeredOn: { fidelity: "wireframe" } }],
  commands: [{ name: "wire", description: "Wireframes from a request", usage: "[basic] <request>|prototype|style|links", source: "module", opens: "wire", body: "" }]
};

export {
  KEEP_PROP,
  KEEP_EMOJI,
  MAYBE_PROP,
  wireframeModule
};
