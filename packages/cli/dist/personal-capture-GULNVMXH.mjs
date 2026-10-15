import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-ILQQGD5C.mjs";
import "./chunk-EJ2TF764.mjs";
import "./chunk-PHCZTV3P.mjs";
import "./chunk-3RI4CEIP.mjs";
import {
  DaemonClient
} from "./chunk-DEPDUI3U.mjs";
import {
  readBadge
} from "./chunk-JNV7IFSE.mjs";
import "./chunk-HPFTKOB6.mjs";
import "./chunk-BW3SAZCE.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-SQGYEDW5.mjs";
import "./chunk-L53WM2YB.mjs";
import "./chunk-7IQJCBGY.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-DUIOTTIJ.mjs";
import "./chunk-FYZDNGZ4.mjs";
import {
  normalizeHomeUrl
} from "./chunk-L3EVJHHR.mjs";
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
