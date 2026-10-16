import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-HB323CDI.mjs";
import "./chunk-LZUMFPL2.mjs";
import "./chunk-HQMYU7RX.mjs";
import "./chunk-SZHX6PJW.mjs";
import {
  DaemonClient
} from "./chunk-5ZN2OCNF.mjs";
import {
  readBadge
} from "./chunk-G5RCN5FR.mjs";
import "./chunk-AZE2XD7C.mjs";
import "./chunk-PMM4AT6N.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-N42HMO2F.mjs";
import "./chunk-ID76PZSI.mjs";
import "./chunk-XG5UAXLM.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-ZYF6RFSY.mjs";
import "./chunk-DVXGZZO6.mjs";
import {
  normalizeHomeUrl
} from "./chunk-NGNONKZX.mjs";
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
