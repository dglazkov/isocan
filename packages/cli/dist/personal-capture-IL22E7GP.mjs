import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-M5QU472P.mjs";
import "./chunk-YYE7Y6UH.mjs";
import "./chunk-IN4GTQYE.mjs";
import "./chunk-XCYGD2FZ.mjs";
import {
  DaemonClient
} from "./chunk-PCICMSX2.mjs";
import {
  readBadge
} from "./chunk-I6JUGY7V.mjs";
import "./chunk-T7QXIUUX.mjs";
import "./chunk-TL7RXMQF.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-NSFU6T6Q.mjs";
import "./chunk-MSQ6TSWW.mjs";
import "./chunk-HN6O2HFH.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-DJA4INPS.mjs";
import "./chunk-6R7VAZEY.mjs";
import {
  normalizeHomeUrl
} from "./chunk-TDL4MCGZ.mjs";
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
