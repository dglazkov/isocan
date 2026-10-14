import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-VYSBQ4SV.mjs";
import "./chunk-QY7XVZUW.mjs";
import "./chunk-G3Y44UB5.mjs";
import "./chunk-AMXZM6QD.mjs";
import {
  DaemonClient
} from "./chunk-4QO2WNGT.mjs";
import {
  readBadge
} from "./chunk-Z3VUTDQ4.mjs";
import "./chunk-OJ2NTRVP.mjs";
import "./chunk-4RGHVTV7.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-KP36ZV4I.mjs";
import "./chunk-AXCZ6ULV.mjs";
import "./chunk-SP3OC372.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-7PYRG36M.mjs";
import "./chunk-ZND3JSAR.mjs";
import {
  normalizeHomeUrl
} from "./chunk-WZBPKOFC.mjs";
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
