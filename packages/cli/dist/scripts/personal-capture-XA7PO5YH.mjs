import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-5CRECJFM.mjs";
import {
  DaemonClient
} from "./chunk-VSLYMB6C.mjs";
import "./chunk-UE4LMSO3.mjs";
import "./chunk-ZRT7VFZW.mjs";
import "./chunk-ZZW47XPZ.mjs";
import "./chunk-5TBBANIG.mjs";
import "./chunk-URW6YSGB.mjs";
import "./chunk-7Z4IHIYV.mjs";
import "./chunk-HQTNEQ52.mjs";
import "./chunk-HR2ZTQYC.mjs";
import {
  readBadge
} from "./chunk-TBEWYXBT.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-545E6SWL.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-224O33UU.mjs";
import {
  normalizeHomeUrl
} from "./chunk-I5LS62QU.mjs";
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
