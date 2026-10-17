import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-GHIIN7M6.mjs";
import {
  DaemonClient
} from "./chunk-CIQQSTDP.mjs";
import "./chunk-SQ3PFGGR.mjs";
import "./chunk-3EYY5SFK.mjs";
import "./chunk-Q23Q6ZEP.mjs";
import "./chunk-3IYDJOZB.mjs";
import "./chunk-CKSCMNYH.mjs";
import "./chunk-WARPXNCB.mjs";
import "./chunk-VSJ33AIY.mjs";
import "./chunk-7EFUESUO.mjs";
import {
  readBadge
} from "./chunk-WDEX3BND.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-TMISGAUM.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-LBZN2LAT.mjs";
import {
  normalizeHomeUrl
} from "./chunk-UWP4RVNW.mjs";
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
