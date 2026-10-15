import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-NGUDPETM.mjs";
import "./chunk-4B4N6CFJ.mjs";
import "./chunk-GP3TSHV2.mjs";
import "./chunk-FO4NCDMC.mjs";
import {
  DaemonClient
} from "./chunk-UO3ZXJG4.mjs";
import {
  readBadge
} from "./chunk-5I4NYCRY.mjs";
import "./chunk-IT4EDWEW.mjs";
import "./chunk-AWYK6MSC.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-SFG6HLS4.mjs";
import "./chunk-CLATEESS.mjs";
import "./chunk-JOJEPIQK.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-BYQCL5W3.mjs";
import "./chunk-GR7RNVXK.mjs";
import {
  normalizeHomeUrl
} from "./chunk-FDNENQYZ.mjs";
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
