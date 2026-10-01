import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-Q6FV3ECI.mjs";
import "./chunk-UMMOEUON.mjs";
import "./chunk-3TNZJMIJ.mjs";
import "./chunk-622ADMI3.mjs";
import {
  DaemonClient
} from "./chunk-3PRKWZOA.mjs";
import {
  readBadge
} from "./chunk-HZTCVEHK.mjs";
import "./chunk-NNFXQRRX.mjs";
import "./chunk-YDB4RQZW.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-MCD7IU3C.mjs";
import "./chunk-T5UWZTVR.mjs";
import "./chunk-W3DWYUAP.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-REYAWBXG.mjs";
import "./chunk-FBGO46RF.mjs";
import {
  normalizeHomeUrl
} from "./chunk-ICS4EDXB.mjs";
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
