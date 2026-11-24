import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-RSUEX7F5.mjs";
import {
  DaemonClient
} from "./chunk-WYI45WOI.mjs";
import {
  readBadge
} from "./chunk-L2IGV3TO.mjs";
import "./chunk-ORLOV7YY.mjs";
import "./chunk-PGY3EUSM.mjs";
import "./chunk-IEB64R4N.mjs";
import "./chunk-DK2FAG5B.mjs";
import "./chunk-RWYTE2AW.mjs";
import "./chunk-WD4JJSHN.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-XFLHEMLN.mjs";
import "./chunk-YFZFUVCG.mjs";
import "./chunk-236HKTFA.mjs";
import "./chunk-IOC6ZUHP.mjs";
import "./chunk-QRU2AIGL.mjs";
import "./chunk-RHG4YZ2M.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-OMKRGJT3.mjs";
import {
  normalizeHomeUrl
} from "./chunk-FXLBUDHK.mjs";
import "./chunk-5NDVMWWX.mjs";
import "./chunk-GUY4UN4O.mjs";
import "./chunk-K4TDP4L5.mjs";
import "./chunk-DX6WJD6A.mjs";
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
