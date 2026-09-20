import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-GMTPM4VN.mjs";
import "./chunk-E42KDHFG.mjs";
import "./chunk-RPJL4U62.mjs";
import "./chunk-TT6TPNCQ.mjs";
import "./chunk-I4LL65UJ.mjs";
import "./chunk-INVWUTWE.mjs";
import {
  DaemonClient
} from "./chunk-U7I6KC2G.mjs";
import {
  readBadge
} from "./chunk-6DHDQBRY.mjs";
import "./chunk-X32DGCTD.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-Q7K5XQMZ.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-PIMRIDXX.mjs";
import "./chunk-ZPT34LMN.mjs";
import "./chunk-B7IDEAQD.mjs";
import {
  normalizeHomeUrl
} from "./chunk-MBFOGR5L.mjs";
import "./chunk-TE337AEY.mjs";
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
