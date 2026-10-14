import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-MLXEX3MC.mjs";
import "./chunk-34HSMDS2.mjs";
import "./chunk-KSVYTT2D.mjs";
import "./chunk-JMIS2DQL.mjs";
import {
  DaemonClient
} from "./chunk-XTRELMFT.mjs";
import {
  readBadge
} from "./chunk-P5IBO7SN.mjs";
import "./chunk-NM7ADIZ2.mjs";
import "./chunk-CQLRSTTV.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-A4H4UITE.mjs";
import "./chunk-QGGK52D5.mjs";
import "./chunk-AXTESMZ6.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-BEGWIS4Y.mjs";
import "./chunk-ZAVE3O7J.mjs";
import {
  normalizeHomeUrl
} from "./chunk-RDMKTLPN.mjs";
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
