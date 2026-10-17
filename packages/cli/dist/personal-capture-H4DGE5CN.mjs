import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-MKT7AG6Z.mjs";
import "./chunk-AYMY3QOI.mjs";
import "./chunk-OROEECKM.mjs";
import "./chunk-INM5TBFD.mjs";
import {
  DaemonClient
} from "./chunk-IOUML7VQ.mjs";
import {
  readBadge
} from "./chunk-AVVWL2XN.mjs";
import "./chunk-PZSSFVJ5.mjs";
import "./chunk-33WIFO7S.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-YFIBJDPY.mjs";
import "./chunk-LN6M26TU.mjs";
import "./chunk-FZIQR7L5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-QWGH54CD.mjs";
import "./chunk-4YNHECZI.mjs";
import {
  normalizeHomeUrl
} from "./chunk-QCT42IYK.mjs";
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
