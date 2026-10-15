import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-RMHWAR7X.mjs";
import "./chunk-KGJYQODB.mjs";
import "./chunk-RG2453A5.mjs";
import "./chunk-DAKQUPSC.mjs";
import {
  DaemonClient
} from "./chunk-ZFAEVBFM.mjs";
import {
  readBadge
} from "./chunk-RGU3B4NM.mjs";
import "./chunk-CSPCJBZS.mjs";
import "./chunk-WAN72KBQ.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-5A2FTFJZ.mjs";
import "./chunk-7U2NVJED.mjs";
import "./chunk-BZWDEFAH.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-H4XILBOB.mjs";
import "./chunk-4C7KWYQJ.mjs";
import {
  normalizeHomeUrl
} from "./chunk-DMRD2WBH.mjs";
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
