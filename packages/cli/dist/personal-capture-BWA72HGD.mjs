import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-7EZU52H6.mjs";
import "./chunk-7IDLELBZ.mjs";
import "./chunk-TPP7PZCO.mjs";
import "./chunk-ZH3KHWZN.mjs";
import "./chunk-DFZ6FR2P.mjs";
import "./chunk-YBZE4VFR.mjs";
import {
  DaemonClient
} from "./chunk-BOQAXFRG.mjs";
import {
  readBadge
} from "./chunk-WZVG3OOI.mjs";
import "./chunk-6Q26VJAH.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-IBKIVBGH.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-TJ7FWO6R.mjs";
import "./chunk-WBX6S7DS.mjs";
import "./chunk-DDDIERXA.mjs";
import {
  normalizeHomeUrl
} from "./chunk-GYKGYKWC.mjs";
import "./chunk-GUY4UN4O.mjs";
import "./chunk-7OLMWXEB.mjs";
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
