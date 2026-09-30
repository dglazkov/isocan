import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-FD4GN3FJ.mjs";
import {
  DaemonClient
} from "./chunk-CNECHX7K.mjs";
import "./chunk-TIVFISSE.mjs";
import "./chunk-VTLWNXOL.mjs";
import "./chunk-X346K7Z6.mjs";
import "./chunk-OYPM34TD.mjs";
import "./chunk-6R35XT4L.mjs";
import "./chunk-3W5L7RA2.mjs";
import "./chunk-ZARCURWP.mjs";
import "./chunk-LYT7UEKC.mjs";
import {
  readBadge
} from "./chunk-ZWNENRAA.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-KHDYT4NJ.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-OMJ24OEX.mjs";
import {
  normalizeHomeUrl
} from "./chunk-ETY6L5SY.mjs";
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
