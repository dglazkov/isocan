import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-S3ODNS6L.mjs";
import "./chunk-SOOWA2W5.mjs";
import "./chunk-6HUTUWRL.mjs";
import "./chunk-4SNCT3B2.mjs";
import {
  DaemonClient
} from "./chunk-MDU3IUKX.mjs";
import {
  readBadge
} from "./chunk-XK2JQMTE.mjs";
import "./chunk-HWA435ED.mjs";
import "./chunk-WQODYIT7.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-Y22O3OUD.mjs";
import "./chunk-EUPD3PVQ.mjs";
import "./chunk-NXK3VWC7.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-FQ5J4ALV.mjs";
import "./chunk-3LMK2UPP.mjs";
import {
  normalizeHomeUrl
} from "./chunk-H42KDQRH.mjs";
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
