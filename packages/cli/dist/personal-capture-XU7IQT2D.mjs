import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-VPRLL443.mjs";
import "./chunk-NQYV7O3H.mjs";
import "./chunk-WIHONRIL.mjs";
import "./chunk-GRQDOUYW.mjs";
import {
  DaemonClient
} from "./chunk-EKDVIP2Q.mjs";
import {
  readBadge
} from "./chunk-XYG5MC6U.mjs";
import "./chunk-M337VOV7.mjs";
import "./chunk-2ITCYOB6.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-MK4XMFZY.mjs";
import "./chunk-L6IIOSA2.mjs";
import "./chunk-HHRFYGK5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-6K3F6UO2.mjs";
import "./chunk-OTCZPK54.mjs";
import {
  normalizeHomeUrl
} from "./chunk-I5JRO3JY.mjs";
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
