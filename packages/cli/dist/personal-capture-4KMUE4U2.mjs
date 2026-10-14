import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-7JIWEW6K.mjs";
import "./chunk-GJFC5KED.mjs";
import "./chunk-PYI3PATF.mjs";
import "./chunk-XKSNKPKJ.mjs";
import {
  DaemonClient
} from "./chunk-VOGRK4DS.mjs";
import {
  readBadge
} from "./chunk-KFVWLM5B.mjs";
import "./chunk-XWOKEOOW.mjs";
import "./chunk-OR2K2IYL.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-DURZHUFX.mjs";
import "./chunk-X77Y423D.mjs";
import "./chunk-QV4GBJKD.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-SXZZAXTB.mjs";
import "./chunk-XQMUWOQP.mjs";
import {
  normalizeHomeUrl
} from "./chunk-VL2HVHY5.mjs";
import "./chunk-GUY4UN4O.mjs";
import "./chunk-K4TDP4L5.mjs";
import "./chunk-JYOOXWJZ.mjs";

// packages/cli/src/personal-capture.ts
async function personalCaptureOwner(clientHome, home, canvasId, actor) {
  const badge = await readBadge(clientHome, home);
  if (!badge) throw new Error("Private capture requires your existing owner credential at the canvas's authoritative home.");
  const direct = new DaemonClient(home, clientHome);
  const status = await direct.personalStatus(actor.id, void 0, canvasId);
  if (normalizeHomeUrl(status.home) !== normalizeHomeUrl(home) || ![status.source, ...status.preserved].some((source) => source?.canvasId === canvasId && source.state === "live")) {
    throw new Error("This home could not verify that the selected person owns this private canvas.");
  }
  return { badge, actor };
}
export {
  personalCaptureOwner
};
