import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-YQGCMEEN.mjs";
import "./chunk-NN2CU7SO.mjs";
import "./chunk-EPKHZH2J.mjs";
import "./chunk-IJLIRWNZ.mjs";
import {
  DaemonClient
} from "./chunk-3V25STJ6.mjs";
import {
  readBadge
} from "./chunk-4JLHCZDF.mjs";
import "./chunk-ZHSECPXA.mjs";
import "./chunk-464DFU6O.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-UPIDYAYJ.mjs";
import "./chunk-4RXUNGEA.mjs";
import "./chunk-6IEF4PE5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-WVMLYQN5.mjs";
import "./chunk-YODCM5U5.mjs";
import {
  normalizeHomeUrl
} from "./chunk-NUEAULQD.mjs";
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
