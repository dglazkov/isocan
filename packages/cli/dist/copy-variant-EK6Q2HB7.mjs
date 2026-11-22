import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  applyCopy,
  validateCopyPayload
} from "./chunk-USZVC6EM.mjs";
import "./chunk-ACM7JBOJ.mjs";
import "./chunk-XBCICSRJ.mjs";
import {
  readWire,
  renderWire
} from "./chunk-V7GB5HCC.mjs";
import {
  wireCopyFile
} from "./chunk-OFPLUO72.mjs";
import "./chunk-SGXD6ULG.mjs";
import "./chunk-CL2V5CYE.mjs";
import "./chunk-VK3MKXRI.mjs";
import "./chunk-YFZFUVCG.mjs";
import "./chunk-236HKTFA.mjs";
import {
  FIDELITY_PROP
} from "./chunk-J5Q22QZF.mjs";
import "./chunk-5NDVMWWX.mjs";
import "./chunk-GUY4UN4O.mjs";
import "./chunk-K4TDP4L5.mjs";
import "./chunk-DX6WJD6A.mjs";
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
