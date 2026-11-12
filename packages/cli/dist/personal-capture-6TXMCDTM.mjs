import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-JXJLR26L.mjs";
import "./chunk-FMF5BZCV.mjs";
import "./chunk-GEZCS6CR.mjs";
import "./chunk-EE5M653B.mjs";
import {
  DaemonClient
} from "./chunk-BFSCARFQ.mjs";
import {
  readBadge
} from "./chunk-NHC4BBQT.mjs";
import "./chunk-EHFG64PN.mjs";
import "./chunk-PFP7B7T6.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-FGVYZVL7.mjs";
import "./chunk-6MQXG4NJ.mjs";
import "./chunk-RZHRSRB2.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-CX2KQ5QH.mjs";
import "./chunk-XTNFIIGN.mjs";
import {
  normalizeHomeUrl
} from "./chunk-UJFMP4CZ.mjs";
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
