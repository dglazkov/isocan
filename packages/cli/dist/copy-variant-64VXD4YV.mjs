import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  applyCopy,
  validateCopyPayload
} from "./chunk-BRULCA4X.mjs";
import "./chunk-36R3NWBQ.mjs";
import "./chunk-XBCICSRJ.mjs";
import {
  readWire,
  renderWire
} from "./chunk-TERLGXWE.mjs";
import "./chunk-ODKP6MPE.mjs";
import {
  wireCopyFile
} from "./chunk-ZR3H7O5A.mjs";
import "./chunk-SGXD6ULG.mjs";
import "./chunk-NE45VMO5.mjs";
import "./chunk-TABLAIXU.mjs";
import "./chunk-XSMUJNBI.mjs";
import {
  FIDELITY_PROP
} from "./chunk-QCT42IYK.mjs";
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
