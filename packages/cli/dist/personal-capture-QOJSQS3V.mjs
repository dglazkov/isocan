import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-FF5J5ILX.mjs";
import "./chunk-55XHQ3JM.mjs";
import "./chunk-SO2YQOR5.mjs";
import "./chunk-HFMVORKR.mjs";
import {
  DaemonClient
} from "./chunk-ZJLAHCQ7.mjs";
import {
  readBadge
} from "./chunk-FU6XP2XW.mjs";
import "./chunk-QQO3SAVZ.mjs";
import "./chunk-T355XVG2.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-5XDSANEG.mjs";
import "./chunk-V7ZBZP6R.mjs";
import "./chunk-DXFYU4RY.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-PJT3J7FK.mjs";
import "./chunk-URHPZRVC.mjs";
import {
  normalizeHomeUrl
} from "./chunk-VPF2HJZX.mjs";
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
