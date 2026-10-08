import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-KK75PEDB.mjs";
import "./chunk-WD4WQSWK.mjs";
import "./chunk-FWWUTUPJ.mjs";
import "./chunk-DHSFI6F6.mjs";
import {
  DaemonClient
} from "./chunk-ZBTU5VL4.mjs";
import {
  readBadge
} from "./chunk-2SKP46K5.mjs";
import "./chunk-6JPK32LG.mjs";
import "./chunk-CALSFAEB.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-PDPKRCW5.mjs";
import "./chunk-JRUX46VX.mjs";
import "./chunk-TL7SN6UJ.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-RHT3QPMP.mjs";
import "./chunk-ZJXUXSQ7.mjs";
import {
  normalizeHomeUrl
} from "./chunk-NEI2BJP3.mjs";
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
