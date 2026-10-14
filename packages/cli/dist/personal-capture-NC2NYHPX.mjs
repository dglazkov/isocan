import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-HDQKBSDH.mjs";
import "./chunk-Z3JUJM33.mjs";
import "./chunk-NHXMDLNS.mjs";
import "./chunk-MIIRYQGO.mjs";
import {
  DaemonClient
} from "./chunk-XJ5Y634T.mjs";
import {
  readBadge
} from "./chunk-XAOCAIGJ.mjs";
import "./chunk-E5PVM33R.mjs";
import "./chunk-GSBIVT3Y.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-2UHVCBHL.mjs";
import "./chunk-EYK2TPY2.mjs";
import "./chunk-GZ4P2BUA.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-ZNGMVOFG.mjs";
import "./chunk-VVEC5XKN.mjs";
import {
  normalizeHomeUrl
} from "./chunk-2T2ZVJLX.mjs";
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
