import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-6IICQE27.mjs";
import {
  DaemonClient
} from "./chunk-ETRSSOC5.mjs";
import "./chunk-SY4IJA5B.mjs";
import "./chunk-7RSATGF2.mjs";
import "./chunk-CUC5S4SX.mjs";
import "./chunk-XXA6USHW.mjs";
import "./chunk-RHGCJG7W.mjs";
import "./chunk-CWA4KGRO.mjs";
import "./chunk-QG5GAZHR.mjs";
import "./chunk-P3LY5J4S.mjs";
import {
  readBadge
} from "./chunk-TPUGFPC2.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-KH5ZM55F.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-TPI5V5EL.mjs";
import {
  normalizeHomeUrl
} from "./chunk-CUJHAG3B.mjs";
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
