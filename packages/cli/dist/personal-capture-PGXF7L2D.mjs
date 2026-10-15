import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-TBQRVWI3.mjs";
import "./chunk-SAGOTBGE.mjs";
import "./chunk-T2BW32BB.mjs";
import "./chunk-D7UB4G3J.mjs";
import {
  DaemonClient
} from "./chunk-5TKM6O4X.mjs";
import {
  readBadge
} from "./chunk-D3QW3YPR.mjs";
import "./chunk-JBJRK3AH.mjs";
import "./chunk-NVMSRTBS.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-UBUG3NDH.mjs";
import "./chunk-CCHVE46S.mjs";
import "./chunk-MZ4KMSQY.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-XHOIU524.mjs";
import "./chunk-SBO7QA6M.mjs";
import {
  normalizeHomeUrl
} from "./chunk-ZWMAKRLV.mjs";
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
