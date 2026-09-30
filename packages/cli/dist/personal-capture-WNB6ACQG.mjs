import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-R5BGN7OR.mjs";
import "./chunk-OAIXRG6Z.mjs";
import "./chunk-HUVRUWN7.mjs";
import "./chunk-DJMPAGOD.mjs";
import "./chunk-7VG2WG23.mjs";
import "./chunk-QHHPD5JI.mjs";
import {
  DaemonClient
} from "./chunk-P5VGQ6MY.mjs";
import {
  readBadge
} from "./chunk-CX63F3PX.mjs";
import "./chunk-GMNZOLG5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-HET3LQ4C.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-BHTSLVSQ.mjs";
import "./chunk-FYLKXHFB.mjs";
import "./chunk-K7UJZAGC.mjs";
import {
  normalizeHomeUrl
} from "./chunk-STLIOPCC.mjs";
import "./chunk-GUY4UN4O.mjs";
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
