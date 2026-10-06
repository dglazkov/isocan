import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-4CTZ3EC7.mjs";
import "./chunk-CHKB2C42.mjs";
import "./chunk-5ZGNEQ6D.mjs";
import "./chunk-EF2FUA7T.mjs";
import {
  DaemonClient
} from "./chunk-5ZL7RVCG.mjs";
import {
  readBadge
} from "./chunk-WYSXCPPZ.mjs";
import "./chunk-GKIKDNVC.mjs";
import "./chunk-X7CGV4RH.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-P47JOHYM.mjs";
import "./chunk-K2PZX6PD.mjs";
import "./chunk-3KZ44CN4.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-DDDW3RZ6.mjs";
import "./chunk-QTG74GG5.mjs";
import {
  normalizeHomeUrl
} from "./chunk-4CAURF7V.mjs";
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
