import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  applyCopy,
  validateCopyPayload
} from "./chunk-B7HU7FHZ.mjs";
import "./chunk-WQTIKQDP.mjs";
import "./chunk-XBCICSRJ.mjs";
import {
  readWire,
  renderWire
} from "./chunk-LC6CUN6Z.mjs";
import "./chunk-TTS2OUSZ.mjs";
import {
  wireCopyFile
} from "./chunk-ZR3H7O5A.mjs";
import "./chunk-SGXD6ULG.mjs";
import "./chunk-NE45VMO5.mjs";
import "./chunk-KQ3WEYIK.mjs";
import "./chunk-XSMUJNBI.mjs";
import {
  FIDELITY_PROP
} from "./chunk-NGNONKZX.mjs";
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
