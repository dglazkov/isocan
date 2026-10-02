import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  applyCopy,
  readWire,
  renderWire,
  validateCopyPayload
} from "./chunk-Q6BPKXZA.mjs";
import {
  wireCopyFile
} from "./chunk-MC63Q3EX.mjs";
import "./chunk-NE45VMO5.mjs";
import "./chunk-CV3IWSGG.mjs";
import "./chunk-UW3E6CLE.mjs";
import "./chunk-XBCICSRJ.mjs";
import "./chunk-XSMUJNBI.mjs";
import {
  FIDELITY_PROP
} from "./chunk-KVFS2HGY.mjs";
import "./chunk-GUY4UN4O.mjs";
import "./chunk-K4TDP4L5.mjs";
import "./chunk-JYOOXWJZ.mjs";

// packages/modules/wireframe/src/copy-variant.ts
function wireCopyVariant(html, edits, by, sourceId) {
  const spec = readWire(html);
  if (!spec) throw new Error("this wireframe's spec could not be read");
  const file = wireCopyFile(html, edits);
  if (!file.ok) throw new Error(file.reason);
  const next = applyCopy(spec, validateCopyPayload(spec, file.file), by);
  return { html: renderWire({ ...next, variantOf: sourceId }), properties: { [FIDELITY_PROP]: "wireframe" } };
}
export {
  wireCopyVariant
};
