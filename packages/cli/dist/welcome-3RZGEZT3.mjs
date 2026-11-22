import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  newItemId,
  newVersionId
} from "./chunk-5NDVMWWX.mjs";
import "./chunk-JYOOXWJZ.mjs";

// packages/core/src/welcome.ts
var WELCOME_ITEM_TITLE = "Welcome to Open Stitch";
var WELCOME_ITEM_FILENAME = "welcome.md";
var WELCOME_ITEM_MIME = "text/markdown";
var WELCOME_ITEM_BOUNDS = {
  x: 0,
  y: 0,
  width: 480,
  height: 360
};
var WELCOME_ITEM_BODY = [
  "# Welcome to Open Stitch",
  "",
  "Drop files, sketch ideas, or ask an agent right from the prompt bar below.",
  "",
  "## Try asking",
  '- "Draft a three-screen onboarding flow for Acme Notes"',
  '- "Compare two layouts for this card and keep the calmer one"',
  '- "Tidy this cluster into a clean row with equal gaps"',
  "",
  "## Canvas gestures",
  "- **Space + drag** or two-finger pan \u2014 move around the board",
  "- **Pinch** or **\u2318/Ctrl + scroll** \u2014 zoom at the pointer",
  "- **Shift** while resizing a corner \u2014 keep proportions; **\u2325/Alt** \u2014 resize from centre",
  "- **\u2325/Alt + drag** \u2014 push neighbours gently to make room",
  "- **Press and hold** (200 ms) \u2014 pick up a card; grab any edge ring to drag iframes",
  "- **\u2318K** \u2014 command launcher \xB7 **\u2318\\** \u2014 hide or restore the interface",
  ""
].join("\n");
function welcomeItemSpec(opts = {}) {
  return {
    kind: "document",
    title: opts.title ?? WELCOME_ITEM_TITLE,
    filename: WELCOME_ITEM_FILENAME,
    mimeType: WELCOME_ITEM_MIME,
    body: WELCOME_ITEM_BODY,
    x: opts.x ?? WELCOME_ITEM_BOUNDS.x,
    y: opts.y ?? WELCOME_ITEM_BOUNDS.y,
    width: opts.width ?? WELCOME_ITEM_BOUNDS.width,
    height: opts.height ?? WELCOME_ITEM_BOUNDS.height,
    properties: { role: "welcome" }
  };
}
function buildWelcomeItemAddOp(spec, blob, ids = {}) {
  return {
    type: "item.add",
    itemId: ids.itemId ?? newItemId(),
    title: spec.title,
    width: spec.width,
    height: spec.height,
    placement: { x: spec.x, y: spec.y, chosen: true },
    properties: { ...spec.properties },
    version: {
      id: ids.versionId ?? newVersionId(),
      blobHash: blob.blobHash,
      mimeType: spec.mimeType,
      filename: spec.filename,
      size: blob.size
    }
  };
}

// packages/cli/src/welcome.ts
async function seedWelcomeItem(transport, canvasId, opts) {
  const spec = welcomeItemSpec(opts);
  const bytes = new TextEncoder().encode(spec.body);
  const blob = await transport.uploadBlob(canvasId, bytes, spec.mimeType, spec.filename);
  const op = buildWelcomeItemAddOp(spec, blob);
  await transport.sendOp(canvasId, op);
  return { itemId: op.itemId };
}
export {
  seedWelcomeItem
};
