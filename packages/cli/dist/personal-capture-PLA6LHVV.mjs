import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-QZBZBM5T.mjs";
import "./chunk-GLFPXY6L.mjs";
import "./chunk-7YNMPWOI.mjs";
import "./chunk-TYWDA5GB.mjs";
import {
  DaemonClient
} from "./chunk-CT3ZCUMQ.mjs";
import {
  readBadge
} from "./chunk-23YWZGSS.mjs";
import "./chunk-K7FYWFKY.mjs";
import "./chunk-JF7OF6DS.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-VLEENS5W.mjs";
import "./chunk-EMHSTYIZ.mjs";
import "./chunk-MTUDTMGH.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-MU5RUB2A.mjs";
import "./chunk-4CEDV3WZ.mjs";
import {
  normalizeHomeUrl
} from "./chunk-K4X2FIZO.mjs";
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
