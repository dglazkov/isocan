import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-KUOB7QYP.mjs";
import "./chunk-AKD546HO.mjs";
import "./chunk-XVHFTS7P.mjs";
import "./chunk-KIOKBPPQ.mjs";
import {
  DaemonClient
} from "./chunk-QFJY7LTZ.mjs";
import {
  readBadge
} from "./chunk-UEM55NXN.mjs";
import "./chunk-EGG6AKZE.mjs";
import "./chunk-STAZRU4U.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-X3XNHALB.mjs";
import "./chunk-YYZQTMKB.mjs";
import "./chunk-NEOBOGB7.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-H4KYQJWX.mjs";
import "./chunk-OHZTMIXW.mjs";
import {
  normalizeHomeUrl
} from "./chunk-XCXLPJA6.mjs";
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
