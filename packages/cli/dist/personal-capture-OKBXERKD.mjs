import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-DYAT3ADD.mjs";
import "./chunk-3FHQEW67.mjs";
import "./chunk-DXLNS7XU.mjs";
import "./chunk-TJYFKBFZ.mjs";
import "./chunk-2LZDKGOX.mjs";
import "./chunk-MPAF53BT.mjs";
import {
  DaemonClient
} from "./chunk-XOF2LHN5.mjs";
import {
  readBadge
} from "./chunk-N4XILX5G.mjs";
import "./chunk-MA4W7Z46.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-WNHU2A73.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-VB3BDVQ7.mjs";
import "./chunk-ZGDW24KA.mjs";
import "./chunk-HS26AHJQ.mjs";
import {
  normalizeHomeUrl
} from "./chunk-R27GCOU3.mjs";
import "./chunk-GUY4UN4O.mjs";
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
