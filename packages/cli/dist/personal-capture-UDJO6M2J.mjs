import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-6PJNB3AG.mjs";
import "./chunk-KCEWL6DN.mjs";
import "./chunk-Z6OGOPFL.mjs";
import "./chunk-Y76QET6V.mjs";
import {
  DaemonClient
} from "./chunk-KO4RNEMI.mjs";
import {
  readBadge
} from "./chunk-CKSVOESF.mjs";
import "./chunk-XVRB2POJ.mjs";
import "./chunk-KHISQV77.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-QL5WWMMI.mjs";
import "./chunk-RCL2OWEB.mjs";
import "./chunk-ZLZPT4IH.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-C6ZZTEYO.mjs";
import "./chunk-O543ES7R.mjs";
import {
  normalizeHomeUrl
} from "./chunk-QJ4RWFOM.mjs";
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
