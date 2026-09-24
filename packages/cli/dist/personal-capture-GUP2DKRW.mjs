import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-RMR7A2NG.mjs";
import "./chunk-EZPTXCG2.mjs";
import "./chunk-32UYK4L6.mjs";
import "./chunk-DOWAYAD7.mjs";
import "./chunk-ETOXTBTV.mjs";
import "./chunk-AKXSIHE3.mjs";
import {
  DaemonClient
} from "./chunk-YAITKOSK.mjs";
import {
  readBadge
} from "./chunk-2C7VWSBM.mjs";
import "./chunk-UUFUSVXV.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-2KFFBEM5.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-RSJMEIFN.mjs";
import "./chunk-TSMQ6NYQ.mjs";
import "./chunk-VV323Y3G.mjs";
import {
  normalizeHomeUrl
} from "./chunk-ROVMIDQR.mjs";
import "./chunk-TE337AEY.mjs";
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
