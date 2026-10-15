import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-OSIOQOA5.mjs";
import {
  DaemonClient
} from "./chunk-OHTWHGGI.mjs";
import "./chunk-AA5YN7WC.mjs";
import "./chunk-74QM6YVU.mjs";
import "./chunk-4D4EWBIO.mjs";
import "./chunk-LRHW72I2.mjs";
import "./chunk-WJMV2OEA.mjs";
import "./chunk-NQKBAB4X.mjs";
import "./chunk-XUWDQ5WO.mjs";
import "./chunk-FSYZ5UEW.mjs";
import {
  readBadge
} from "./chunk-ZNYDBDRN.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-ZDYSAEML.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-PYS5DN6J.mjs";
import {
  normalizeHomeUrl
} from "./chunk-AQYFEYAF.mjs";
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
