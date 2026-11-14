import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-MFVCSWLT.mjs";
import {
  DaemonClient
} from "./chunk-7BR34MXL.mjs";
import {
  readBadge
} from "./chunk-WJRD7EI4.mjs";
import "./chunk-ZKJYSM5E.mjs";
import "./chunk-FDZME7H4.mjs";
import "./chunk-VAGOT3XC.mjs";
import "./chunk-F7XNK3B3.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-MIC5FPQB.mjs";
import "./chunk-UKINM7SS.mjs";
import "./chunk-637ZLHVJ.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-O2DM65H4.mjs";
import "./chunk-VEQHFGTD.mjs";
import "./chunk-PPFKQNME.mjs";
import "./chunk-OUU6V4OT.mjs";
import {
  normalizeHomeUrl
} from "./chunk-SWYFDYSR.mjs";
import "./chunk-7OLMWXEB.mjs";
import "./chunk-2ZAY35XO.mjs";
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
