import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-A67Q3OU4.mjs";
import "./chunk-U2MJFXWG.mjs";
import "./chunk-SG4MAWPR.mjs";
import "./chunk-WLLT2M3X.mjs";
import "./chunk-VI2PGDZU.mjs";
import "./chunk-4V3F7RFK.mjs";
import {
  DaemonClient
} from "./chunk-PHSGCIRG.mjs";
import {
  readBadge
} from "./chunk-32NZJL2K.mjs";
import "./chunk-N37LXSWG.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-EHGYAAVY.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-CSFNNBJP.mjs";
import "./chunk-OQWKPAAY.mjs";
import "./chunk-BDAEQ3TK.mjs";
import {
  normalizeHomeUrl
} from "./chunk-B7JOBMSP.mjs";
import "./chunk-TE337AEY.mjs";
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
