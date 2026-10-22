import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  applyCopy,
  validateCopyPayload
} from "./chunk-NXFIJYOU.mjs";
import "./chunk-6CF4SFY6.mjs";
import "./chunk-XBCICSRJ.mjs";
import {
  readWire,
  renderWire
} from "./chunk-TERLGXWE.mjs";
import "./chunk-ODKP6MPE.mjs";
import {
  wireCopyFile
} from "./chunk-OFPLUO72.mjs";
import "./chunk-SGXD6ULG.mjs";
import "./chunk-CL2V5CYE.mjs";
import "./chunk-TABLAIXU.mjs";
import "./chunk-VK3MKXRI.mjs";
import {
  FIDELITY_PROP
} from "./chunk-VSVKW4DR.mjs";
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
