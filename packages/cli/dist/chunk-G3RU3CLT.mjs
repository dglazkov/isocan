import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  canvasScopes,
  designSystemProperties,
  isDesignSystem,
  newVersionId
} from "./chunk-WI56ZDDN.mjs";

// packages/core/src/design-use.ts
function isDesignDocument(item) {
  const kind = item.properties.kind;
  if (kind === "text" || kind === "group") return false;
  const current = item.versions.find((v) => v.id === item.currentVersionId);
  return !!current && (current.mimeType.startsWith("text/markdown") || /\.md$/i.test(current.filename));
}
function designSystemRemoval() {
  return { removeProperties: Object.keys(designSystemProperties()) };
}
function ownDesignSystemAt(canvas, scopeId) {
  const mine = Object.values(canvas.items).filter(isDesignSystem).filter((item) => (canvasScopes(canvas, item)[0]?.id ?? null) === scopeId).sort((a, b) => a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0);
  return mine[0] ?? null;
}
function designUse(canvas, item, versionId = newVersionId()) {
  if (!isDesignDocument(item)) throw new Error(`\u201C${item.title}\u201D is not markdown \u2014 a design system is a DESIGN.md`);
  if (isDesignSystem(item)) throw new Error(`\u201C${item.title}\u201D is already a design system`);
  const scope = canvasScopes(canvas, item)[0] ?? null;
  const into = ownDesignSystemAt(canvas, scope?.id ?? null);
  if (into) {
    const current = item.versions.find((v) => v.id === item.currentVersionId);
    return {
      op: {
        type: "item.addVersion",
        itemId: into.id,
        version: { id: versionId, blobHash: current.blobHash, mimeType: current.mimeType, filename: current.filename, size: current.size }
      },
      scope,
      into
    };
  }
  return { op: { type: "item.update", itemId: item.id, patch: { properties: designSystemProperties() } }, scope, into: null };
}
function designUnuse(canvas, item) {
  if (!isDesignSystem(item)) throw new Error(`\u201C${item.title}\u201D is not a design system`);
  return { op: { type: "item.update", itemId: item.id, patch: designSystemRemoval() }, scope: canvasScopes(canvas, item)[0] ?? null, into: null };
}

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

// packages/modules/wireframe/src/wire-command.ts
var WIRE_COMMAND = {
  ...wireframeModule.commands[0],
  body: `Wireframes on this canvas, with the \`isocan wire\` verbs \u2014 never draw a
screen by hand, and never write its copy yourself unless asked.

- \`/wire <what the screens are for>\` \u2192 \`isocan wire "<request>"\`. Blueprints
  land first, then fill in place, arrive fleshed with sample content, and end
  with a prototype of the answerer's first choices (\u{1F4D0}) above the row; one
  \`isocan undo\` takes the whole flow back, content and prototype and all.
  With no TYPESAFE_API_KEY here the canvas's home answers (the CLI says which).
- \`/wire basic <what the screens are for>\` \u2192 \`isocan wire --basic "<request>"\`
  (plain grey wires, no sample content, nothing in a prototype).
- \`/wire prototype\` \u2192 \`isocan wire prototype\` (the screens marked \u{1F4D0} \u2014 use
  some in it first with \`isocan wire use <screens\u2026>\` if none is).
- \`/wire style <name>\` \u2192 \`isocan wire style --preset <name>\` (a named look \u2014
  material, shadcn, glass, ios, fluent, carbon, brutalist, a design-competition
  pack, or house for the greys \u2014 placed beside the flow as its DESIGN.md and
  made its design system; one undo takes it back). \`/wire style\` alone \u2192
  \`isocan wire style --list\`: say which styles there are and ask which.
- \`/wire style system\` \u2192 \`isocan wire style\` (every wire in the design
  system that governs it); \`/wire style --default\` \u2192 \`isocan wire style
  --default\`.
- \`/wire flesh\` \u2192 \`isocan wire flesh\` (sample content instead of grey bars
  on wires that have none;
  \`/wire flesh --pack <id>\` and \`/wire flesh --bars\` pass through). Exact
  words for a screen are \`isocan wire copy <screen>\`, edited, then
  \`isocan wire copy <screen> --apply <file>\` \u2014 only when asked for copy.
- \`/wire rerender\` \u2192 \`isocan wire render --all\` (every wire drawn again from
  its own spec; a version only where the bytes change).
- \`/wire layer <wire|system|lofi|hifi|+layer|-layer>\` \u2192 \`isocan wire layer
  <directive> [screens\u2026]\` (check or uncheck fidelity layers \`system\`,
  \`copy\`, \`lofi\`, \`hifi\`, or jump between the 4 fidelity tiers
  non-destructively).
- \`/wire prototypes\` \u2192 \`isocan ls --filter Prototype\` (the prototypes carry
  \`wirePrototype\`); say which ones there are and where.

Post ONE comment saying what landed: how many screens, which answered, and
that one undo takes it back.`
};
var WIRE_PROPERTY_KEYS = [
  KEEP_PROP,
  "wireKeepBy",
  MAYBE_PROP,
  "wireLinks",
  "wireLink:*",
  "wirePrototype",
  "wirePrototypeAt",
  "wirePreset",
  "wireLayer",
  "wireLayer:*"
];

export {
  ownDesignSystemAt,
  designUse,
  designUnuse,
  KEEP_EMOJI,
  wireframeModule,
  WIRE_COMMAND,
  WIRE_PROPERTY_KEYS
};
