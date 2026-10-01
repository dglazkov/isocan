import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-EHXLTSBD.mjs";
import "./chunk-NWXJSLJE.mjs";
import "./chunk-X5HBSAOO.mjs";
import "./chunk-NZDUOLOW.mjs";
import {
  DaemonClient
} from "./chunk-6FVX5C44.mjs";
import {
  readBadge
} from "./chunk-UZ2ZAWSS.mjs";
import "./chunk-SLJIRS7J.mjs";
import "./chunk-IOBZ2O4H.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-SG43XFA3.mjs";
import "./chunk-7D6R6D2T.mjs";
import "./chunk-YMKRTM6C.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-BE2ETU7Z.mjs";
import "./chunk-7XHBZUPA.mjs";
import {
  normalizeHomeUrl
} from "./chunk-5OEPL7IS.mjs";
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
