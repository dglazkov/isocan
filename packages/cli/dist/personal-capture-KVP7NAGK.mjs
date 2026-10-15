import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-MNUPZY2S.mjs";
import "./chunk-IM3L7IEV.mjs";
import "./chunk-MG7STEOB.mjs";
import "./chunk-HGHXT3U2.mjs";
import {
  DaemonClient
} from "./chunk-HQTALRY5.mjs";
import {
  readBadge
} from "./chunk-ZKWPTHFC.mjs";
import "./chunk-ZWA5JOLR.mjs";
import "./chunk-KP5HOKK2.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-BXGU6GDB.mjs";
import "./chunk-7EJLBY7R.mjs";
import "./chunk-7FDTL4BW.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-N2TXNBMN.mjs";
import "./chunk-H2FJRWCQ.mjs";
import {
  normalizeHomeUrl
} from "./chunk-WMDWXGMU.mjs";
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
