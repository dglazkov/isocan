import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-FM3ERK7G.mjs";
import "./chunk-QDAZWA46.mjs";
import "./chunk-H4T7NPSD.mjs";
import "./chunk-4S6PSHTJ.mjs";
import {
  DaemonClient
} from "./chunk-GWBCRYWR.mjs";
import {
  readBadge
} from "./chunk-ANMS3ZJO.mjs";
import "./chunk-BXHHTQOI.mjs";
import "./chunk-EHM4KVGV.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-SQDBD46V.mjs";
import "./chunk-VHGDT2PK.mjs";
import "./chunk-22EOKWRY.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-KA62IO2Q.mjs";
import "./chunk-MTVYQTB7.mjs";
import {
  normalizeHomeUrl
} from "./chunk-QVCIKCED.mjs";
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
