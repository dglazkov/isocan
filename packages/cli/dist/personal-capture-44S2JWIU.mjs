import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-5JETY7C3.mjs";
import "./chunk-4ZFN4N7U.mjs";
import "./chunk-RWYJ64ER.mjs";
import "./chunk-5LB3WOJC.mjs";
import {
  DaemonClient
} from "./chunk-VZ363DPT.mjs";
import {
  readBadge
} from "./chunk-MHKY6FF4.mjs";
import "./chunk-WLQTLY4V.mjs";
import "./chunk-VSHHZTM6.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-J5QEDAGO.mjs";
import "./chunk-Z5NPLGMC.mjs";
import "./chunk-MPQKFHEW.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-T736F4QX.mjs";
import "./chunk-QWXS7F4H.mjs";
import {
  normalizeHomeUrl
} from "./chunk-DLQGMEJS.mjs";
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
