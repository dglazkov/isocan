import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-IUPST4PL.mjs";
import "./chunk-2437RCDO.mjs";
import "./chunk-NDLPLNHJ.mjs";
import "./chunk-2XQ6RMBL.mjs";
import "./chunk-7M334Q55.mjs";
import "./chunk-YAQCF34V.mjs";
import {
  DaemonClient
} from "./chunk-LSRYKJNC.mjs";
import {
  readBadge
} from "./chunk-4RAQIAHZ.mjs";
import "./chunk-4KUR3I4S.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-EFWQYF5F.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-PLUM6LPJ.mjs";
import "./chunk-2VBYOBE3.mjs";
import "./chunk-FAZ6CHRG.mjs";
import {
  normalizeHomeUrl
} from "./chunk-ZFQTWVT2.mjs";
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
