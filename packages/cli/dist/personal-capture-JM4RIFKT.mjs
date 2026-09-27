import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-BBFNIVCH.mjs";
import "./chunk-TQNNWRJO.mjs";
import "./chunk-ZAIESZ5P.mjs";
import "./chunk-ZF77NRFX.mjs";
import "./chunk-OLCNC6KA.mjs";
import "./chunk-PS72LIHB.mjs";
import {
  DaemonClient
} from "./chunk-FL4FXAR3.mjs";
import {
  readBadge
} from "./chunk-K62QQBM4.mjs";
import "./chunk-T27ZV2JW.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-27ZBYJU5.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-GE7A2PKY.mjs";
import "./chunk-RNY7MTDF.mjs";
import "./chunk-7CKFAZBF.mjs";
import {
  normalizeHomeUrl
} from "./chunk-P5ZMYC6M.mjs";
import "./chunk-GUY4UN4O.mjs";
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
