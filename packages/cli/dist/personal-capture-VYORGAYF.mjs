import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-ZU2QTCNA.mjs";
import "./chunk-UP2BKW6A.mjs";
import "./chunk-I5CMFAS6.mjs";
import "./chunk-QASKIZID.mjs";
import {
  DaemonClient
} from "./chunk-ADP7O46Q.mjs";
import {
  readBadge
} from "./chunk-AJ2EACVI.mjs";
import "./chunk-32BSRCYT.mjs";
import "./chunk-YKGCNFT4.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-LL2ZIYU7.mjs";
import "./chunk-NDAAPEUA.mjs";
import "./chunk-M2X6FKBN.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-IHRDVV6L.mjs";
import "./chunk-WWKN2IAP.mjs";
import {
  normalizeHomeUrl
} from "./chunk-HC7KSA3H.mjs";
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
