import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-ZU2W6KTG.mjs";
import {
  DaemonClient
} from "./chunk-LR34CFF3.mjs";
import "./chunk-WKXOQYMV.mjs";
import "./chunk-UQYDH4MZ.mjs";
import "./chunk-H6HSGNXX.mjs";
import "./chunk-WW6GR2ND.mjs";
import "./chunk-65SXZ23E.mjs";
import "./chunk-BSRPFQ4J.mjs";
import "./chunk-LSP7SRCJ.mjs";
import "./chunk-IGE34FAI.mjs";
import {
  readBadge
} from "./chunk-RRWTT6LO.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-ROA2A22Z.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-7RBPRAVH.mjs";
import {
  normalizeHomeUrl
} from "./chunk-WLEQQAKL.mjs";
import "./chunk-ZRGI5I2I.mjs";
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
