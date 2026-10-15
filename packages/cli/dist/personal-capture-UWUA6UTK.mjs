import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-AH6FAIWI.mjs";
import "./chunk-T7K3TIO5.mjs";
import "./chunk-QBTS4ZQG.mjs";
import "./chunk-PCR4B4JR.mjs";
import {
  DaemonClient
} from "./chunk-2YPQSQYY.mjs";
import {
  readBadge
} from "./chunk-JIF666GE.mjs";
import "./chunk-X7O2MI35.mjs";
import "./chunk-T7VUWKRY.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-TN5OAYKU.mjs";
import "./chunk-S5RI2P73.mjs";
import "./chunk-C4OESZOP.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-7W3BYBD2.mjs";
import "./chunk-B4GRHABO.mjs";
import {
  normalizeHomeUrl
} from "./chunk-BCSF6PJB.mjs";
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
