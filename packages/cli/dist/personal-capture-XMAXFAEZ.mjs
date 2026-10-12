import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-NMOUCQQP.mjs";
import "./chunk-SWDFMEY5.mjs";
import "./chunk-BFU4X6QA.mjs";
import "./chunk-SSE44PPK.mjs";
import {
  DaemonClient
} from "./chunk-IMQM46IZ.mjs";
import {
  readBadge
} from "./chunk-FWLQPADX.mjs";
import "./chunk-R6GDVQOR.mjs";
import "./chunk-KIKDRYB4.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-ST7X5672.mjs";
import "./chunk-DMCHK325.mjs";
import "./chunk-5LJQSM37.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-VW4RAS7L.mjs";
import "./chunk-EWDNRPLR.mjs";
import {
  normalizeHomeUrl
} from "./chunk-DJMGXP36.mjs";
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
