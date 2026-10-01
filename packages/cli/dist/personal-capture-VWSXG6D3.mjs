import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-AGEEMMRP.mjs";
import "./chunk-K6UC5KOI.mjs";
import "./chunk-D4UDUD7C.mjs";
import "./chunk-P4TTACKI.mjs";
import {
  DaemonClient
} from "./chunk-WUHGNZVD.mjs";
import {
  readBadge
} from "./chunk-UV6DTJ5L.mjs";
import "./chunk-6VP3W7IP.mjs";
import "./chunk-USBIOIMX.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-JOMUDPWQ.mjs";
import "./chunk-ZLLFDJYY.mjs";
import "./chunk-DEX7YUYE.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-G7HC4MS2.mjs";
import "./chunk-WYGWE3RA.mjs";
import {
  normalizeHomeUrl
} from "./chunk-PDSUENMN.mjs";
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
