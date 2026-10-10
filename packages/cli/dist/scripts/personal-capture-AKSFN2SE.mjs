import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-QRBXY7SE.mjs";
import {
  DaemonClient
} from "./chunk-UVELB6P3.mjs";
import "./chunk-5LC6DI4T.mjs";
import "./chunk-QQXLFT72.mjs";
import "./chunk-EY4ZMWBE.mjs";
import "./chunk-57WAHPBP.mjs";
import "./chunk-QEOVW3TB.mjs";
import "./chunk-T3EAQ5GS.mjs";
import "./chunk-7XM74QVZ.mjs";
import "./chunk-3KMRZ2GC.mjs";
import {
  readBadge
} from "./chunk-LGR34FUU.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-OT3PB5EY.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-O4BKQZOU.mjs";
import {
  normalizeHomeUrl
} from "./chunk-ASYP7DSA.mjs";
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
