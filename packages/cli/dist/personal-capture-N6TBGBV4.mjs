import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-HECJE5XX.mjs";
import "./chunk-A22ANYJD.mjs";
import "./chunk-ETXVGJJV.mjs";
import "./chunk-H37B7YK4.mjs";
import {
  DaemonClient
} from "./chunk-KEDP6M33.mjs";
import {
  readBadge
} from "./chunk-ANIHCJ2N.mjs";
import "./chunk-EOWTYQXH.mjs";
import "./chunk-54BXJU2P.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-5ZUT4LV7.mjs";
import "./chunk-DGI6O4II.mjs";
import "./chunk-7E6M5HTA.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-7GL6YLZR.mjs";
import "./chunk-CKOANZMP.mjs";
import {
  normalizeHomeUrl
} from "./chunk-CVBHXI2X.mjs";
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
