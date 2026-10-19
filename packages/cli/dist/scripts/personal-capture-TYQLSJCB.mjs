import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-VQHHY4OE.mjs";
import {
  DaemonClient
} from "./chunk-6CR7SLAA.mjs";
import "./chunk-TIA45PBN.mjs";
import "./chunk-BJDMTI2T.mjs";
import "./chunk-N3Z3SEFL.mjs";
import "./chunk-CJZH2VR2.mjs";
import "./chunk-U2KQCWKR.mjs";
import "./chunk-6JLBRCDS.mjs";
import "./chunk-2OTFU52A.mjs";
import "./chunk-TNMILXD2.mjs";
import {
  readBadge
} from "./chunk-7ZAXBGVI.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-ZUENAFLD.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-A7OTOMDA.mjs";
import {
  normalizeHomeUrl
} from "./chunk-LQ6FDKN3.mjs";
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
