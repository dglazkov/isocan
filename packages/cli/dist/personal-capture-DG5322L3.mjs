import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-LQTJSFPW.mjs";
import "./chunk-NWUJPGZE.mjs";
import "./chunk-XDJVG6RY.mjs";
import "./chunk-W2DVPVIU.mjs";
import {
  DaemonClient
} from "./chunk-2KGMN3D2.mjs";
import {
  readBadge
} from "./chunk-NCT26FDW.mjs";
import "./chunk-XPXIYQ73.mjs";
import "./chunk-V65OVXPQ.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-VHDAR7GA.mjs";
import "./chunk-NAZL2DN4.mjs";
import "./chunk-6GLP4WBN.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-7B6BRZ2X.mjs";
import "./chunk-PHKC7KRG.mjs";
import {
  normalizeHomeUrl
} from "./chunk-KVFS2HGY.mjs";
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
