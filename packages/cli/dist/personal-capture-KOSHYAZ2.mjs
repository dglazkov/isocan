import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-XEAB2Y7S.mjs";
import "./chunk-4JXLGGXR.mjs";
import "./chunk-JUAC6HSG.mjs";
import "./chunk-AI4KW5CZ.mjs";
import {
  DaemonClient
} from "./chunk-O4XUTSVN.mjs";
import {
  readBadge
} from "./chunk-TYISYTDA.mjs";
import "./chunk-FMZIAEPT.mjs";
import "./chunk-LPAWSPV6.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-DS4WEEZI.mjs";
import "./chunk-S53D4MUY.mjs";
import "./chunk-VORD5VRE.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-3HKIKXUY.mjs";
import "./chunk-3ADTZT6K.mjs";
import {
  normalizeHomeUrl
} from "./chunk-FJTW2HDB.mjs";
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
