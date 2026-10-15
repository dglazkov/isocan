import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-DT3ST5O3.mjs";
import {
  DaemonClient
} from "./chunk-EHH4JAFK.mjs";
import "./chunk-DLVQ2W4K.mjs";
import "./chunk-JCLAXJPE.mjs";
import "./chunk-LFNMND5M.mjs";
import "./chunk-UU2R4JGJ.mjs";
import "./chunk-6TJ6EKIW.mjs";
import "./chunk-PBGOG5IP.mjs";
import "./chunk-SMFJTV2A.mjs";
import "./chunk-2ZB35WYZ.mjs";
import {
  readBadge
} from "./chunk-JGONY4QV.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-2E2HQBPR.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-TEIACUOH.mjs";
import {
  normalizeHomeUrl
} from "./chunk-NMBJURUD.mjs";
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
