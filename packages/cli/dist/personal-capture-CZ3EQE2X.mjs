import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-CNIPAVYG.mjs";
import "./chunk-O7NPDLJQ.mjs";
import "./chunk-OXKOXPHJ.mjs";
import "./chunk-FH44QR7X.mjs";
import "./chunk-P3RZHU3R.mjs";
import "./chunk-6MQZCAIZ.mjs";
import {
  DaemonClient
} from "./chunk-TVFJE7SA.mjs";
import {
  readBadge
} from "./chunk-FSGR4H27.mjs";
import "./chunk-MV4XURJU.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-UCPUBQ5G.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-RDDYRW7N.mjs";
import "./chunk-CF54KJRK.mjs";
import "./chunk-OUMSDKJF.mjs";
import {
  normalizeHomeUrl
} from "./chunk-B3VU6FID.mjs";
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
