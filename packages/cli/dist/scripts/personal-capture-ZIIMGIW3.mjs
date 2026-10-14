import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-64APM6PX.mjs";
import {
  DaemonClient
} from "./chunk-VBG2C2CZ.mjs";
import "./chunk-HDDZLYUV.mjs";
import "./chunk-4NXQ7SPI.mjs";
import "./chunk-VI7TKCNT.mjs";
import "./chunk-AME4TOTH.mjs";
import "./chunk-GBKJ35YX.mjs";
import "./chunk-VG5SW37K.mjs";
import "./chunk-F2G5DQBX.mjs";
import "./chunk-BHTYDMPV.mjs";
import {
  readBadge
} from "./chunk-WAP5ORKT.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-DQMKMOSW.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-Z25RL3XO.mjs";
import {
  normalizeHomeUrl
} from "./chunk-COQVN3BH.mjs";
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
