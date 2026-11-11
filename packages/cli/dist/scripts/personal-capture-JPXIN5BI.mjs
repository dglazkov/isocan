import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-GKYR53UR.mjs";
import {
  DaemonClient
} from "./chunk-2CNXEBJF.mjs";
import "./chunk-6V5C3LOM.mjs";
import "./chunk-YG6CQJID.mjs";
import "./chunk-EHWAMGTY.mjs";
import "./chunk-AZCJT4UL.mjs";
import "./chunk-JXO4G6ZW.mjs";
import "./chunk-E4CSB4EO.mjs";
import "./chunk-3563WICS.mjs";
import "./chunk-PCZVA377.mjs";
import "./chunk-EUXW2CVG.mjs";
import {
  readBadge
} from "./chunk-HDAJGWD6.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-FO5PS6BR.mjs";
import "./chunk-OUU6V4OT.mjs";
import {
  normalizeHomeUrl
} from "./chunk-34J6XBPZ.mjs";
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
