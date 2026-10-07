import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-VQ4X7UPZ.mjs";
import {
  DaemonClient
} from "./chunk-62ZIT6J6.mjs";
import "./chunk-MLMIVHFZ.mjs";
import "./chunk-HV47AS7H.mjs";
import "./chunk-JJI2WMJI.mjs";
import "./chunk-SELH6WYL.mjs";
import "./chunk-BYLANMXO.mjs";
import "./chunk-HARRPD3H.mjs";
import "./chunk-5P25THE5.mjs";
import "./chunk-GQYBPBBC.mjs";
import {
  readBadge
} from "./chunk-4CEZJFVJ.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-XUPZA2J2.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-35KIFPZU.mjs";
import {
  normalizeHomeUrl
} from "./chunk-DHJ36Y6R.mjs";
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
