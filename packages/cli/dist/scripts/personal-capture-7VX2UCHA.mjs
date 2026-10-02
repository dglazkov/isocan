import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-VT6M7GX2.mjs";
import {
  DaemonClient
} from "./chunk-4FPI25UW.mjs";
import "./chunk-52BETZ6D.mjs";
import "./chunk-J7PFTFEH.mjs";
import "./chunk-MJPUDCDQ.mjs";
import "./chunk-47NRNZUY.mjs";
import "./chunk-AE47NVGT.mjs";
import "./chunk-IRUO7B7F.mjs";
import "./chunk-BPCDEAG4.mjs";
import "./chunk-COEHAVBV.mjs";
import {
  readBadge
} from "./chunk-RBRUEJAG.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-YUDVA6BT.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-DZDDNLNT.mjs";
import {
  normalizeHomeUrl
} from "./chunk-RPLK4NMB.mjs";
import "./chunk-7OLMWXEB.mjs";
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
