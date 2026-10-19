import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-VQEJO5JQ.mjs";
import "./chunk-4ABJBX3Q.mjs";
import "./chunk-XM6DRTIR.mjs";
import "./chunk-JB3WSMNH.mjs";
import {
  DaemonClient
} from "./chunk-PKLB4Q4D.mjs";
import {
  readBadge
} from "./chunk-3XVAPSJK.mjs";
import "./chunk-277KZSL6.mjs";
import "./chunk-SE6MXBJN.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-7JXJUBFP.mjs";
import "./chunk-L5NID5KJ.mjs";
import "./chunk-5225VPDA.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-AJNWCMYG.mjs";
import "./chunk-GOD6USWK.mjs";
import {
  normalizeHomeUrl
} from "./chunk-QZNVB57B.mjs";
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
