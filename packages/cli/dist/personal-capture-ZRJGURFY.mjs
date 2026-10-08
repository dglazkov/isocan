import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-OA7XS6YT.mjs";
import "./chunk-VK3JUY64.mjs";
import "./chunk-VHJ33JSV.mjs";
import "./chunk-ZNXNKXE7.mjs";
import {
  DaemonClient
} from "./chunk-DM6VM2QK.mjs";
import {
  readBadge
} from "./chunk-BZDOD2DN.mjs";
import "./chunk-NN4K5OLB.mjs";
import "./chunk-EWGMO4MA.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-QWGAL54M.mjs";
import "./chunk-KC3OZKHC.mjs";
import "./chunk-JAV4ISVV.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-PRBST3UV.mjs";
import "./chunk-OTJ7XBW4.mjs";
import {
  normalizeHomeUrl
} from "./chunk-GMIITGZJ.mjs";
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
