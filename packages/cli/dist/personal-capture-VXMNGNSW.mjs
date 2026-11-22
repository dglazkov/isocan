import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-T4LMSPFM.mjs";
import {
  DaemonClient
} from "./chunk-54HCMC2L.mjs";
import {
  readBadge
} from "./chunk-QZ5ZDBZU.mjs";
import "./chunk-JDNKRDOA.mjs";
import "./chunk-3VC5ZAEL.mjs";
import "./chunk-O7A67R2R.mjs";
import "./chunk-CPKHQO6E.mjs";
import "./chunk-GAJX4R3V.mjs";
import "./chunk-2KSBM74U.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-XFLHEMLN.mjs";
import "./chunk-YFZFUVCG.mjs";
import "./chunk-236HKTFA.mjs";
import "./chunk-O735QEST.mjs";
import "./chunk-DGLWR6MP.mjs";
import "./chunk-YD4GAIKS.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-2Q4BD67B.mjs";
import {
  normalizeHomeUrl
} from "./chunk-J5Q22QZF.mjs";
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
