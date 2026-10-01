import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-PDZR2SPF.mjs";
import {
  DaemonClient
} from "./chunk-YNPWSAJW.mjs";
import "./chunk-7JA2DXNM.mjs";
import "./chunk-PMXMUGLM.mjs";
import "./chunk-LOE6ELOH.mjs";
import "./chunk-3GBZ6JHO.mjs";
import "./chunk-7OHWSKL3.mjs";
import "./chunk-4GZEVYWP.mjs";
import "./chunk-4UT6TJVI.mjs";
import "./chunk-HWWBHJXK.mjs";
import {
  readBadge
} from "./chunk-UYW76TNX.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-ILCBSRRS.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-5AMOGKCJ.mjs";
import {
  normalizeHomeUrl
} from "./chunk-47TMYADE.mjs";
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
