import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-VJH6SQ6Z.mjs";
import "./chunk-TJMTUQFT.mjs";
import "./chunk-IVX2NCYZ.mjs";
import "./chunk-VRAVYLDL.mjs";
import {
  DaemonClient
} from "./chunk-JQ34IHZY.mjs";
import {
  readBadge
} from "./chunk-S2X6BEJQ.mjs";
import "./chunk-W4Y3CVBV.mjs";
import "./chunk-VCQZRT56.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-VRNKWG4D.mjs";
import "./chunk-OS5HBJMC.mjs";
import "./chunk-TM3UVVDI.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-TBJK2DC7.mjs";
import "./chunk-XWDU2TEQ.mjs";
import {
  normalizeHomeUrl
} from "./chunk-3UWLEJX3.mjs";
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
