import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-SUU4MLFN.mjs";
import "./chunk-2F6WPOES.mjs";
import "./chunk-M4NZM6XY.mjs";
import "./chunk-NHEYQZDM.mjs";
import {
  DaemonClient
} from "./chunk-4POM2R33.mjs";
import {
  readBadge
} from "./chunk-D6OH336U.mjs";
import "./chunk-LVQ2PWCJ.mjs";
import "./chunk-3654L4LU.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-FFMOAVWO.mjs";
import "./chunk-6BOEOYYW.mjs";
import "./chunk-4D5GS4XQ.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-HRNJY445.mjs";
import "./chunk-6M44SDTA.mjs";
import {
  normalizeHomeUrl
} from "./chunk-Q65UYN4B.mjs";
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
