import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-QZABHEEX.mjs";
import "./chunk-XNAMVGWK.mjs";
import "./chunk-7KG4X2IF.mjs";
import "./chunk-OVCR7HAE.mjs";
import {
  DaemonClient
} from "./chunk-G7IDXOTZ.mjs";
import {
  readBadge
} from "./chunk-APWHOW7C.mjs";
import "./chunk-5EWCQDST.mjs";
import "./chunk-KX3VXFMZ.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-GIG6ZOOP.mjs";
import "./chunk-6NPLQWD7.mjs";
import "./chunk-7DH73KOM.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-CIHIGNXI.mjs";
import "./chunk-5XN2CZHL.mjs";
import {
  normalizeHomeUrl
} from "./chunk-27TN4XZ2.mjs";
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
