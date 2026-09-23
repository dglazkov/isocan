import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-E6WPVZ7G.mjs";
import "./chunk-E65Z6RDK.mjs";
import "./chunk-LV7HK5OI.mjs";
import "./chunk-DOODWCZH.mjs";
import "./chunk-VL2CA3MI.mjs";
import "./chunk-E66SZLYM.mjs";
import {
  DaemonClient
} from "./chunk-H2OWY6TA.mjs";
import {
  readBadge
} from "./chunk-7LHDOUVF.mjs";
import "./chunk-3QAFYW7M.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-A4C6OHDO.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-TCWRAQEW.mjs";
import "./chunk-OA4UADPF.mjs";
import "./chunk-SV5RAW6R.mjs";
import {
  normalizeHomeUrl
} from "./chunk-4JILTJDB.mjs";
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
