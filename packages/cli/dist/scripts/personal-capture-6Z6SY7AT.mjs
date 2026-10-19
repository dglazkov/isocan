import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-X34LXBN7.mjs";
import {
  DaemonClient
} from "./chunk-RHGWAU7D.mjs";
import "./chunk-NRBX77HE.mjs";
import "./chunk-32432FL2.mjs";
import "./chunk-SWJV5BPG.mjs";
import "./chunk-BZVKRUOW.mjs";
import "./chunk-T6TT7G5R.mjs";
import "./chunk-UYTE2FGF.mjs";
import "./chunk-HPXKAFNT.mjs";
import "./chunk-7YUYSOKL.mjs";
import {
  readBadge
} from "./chunk-OA5HO6VN.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-SW5VWRIJ.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-MJWQNUMR.mjs";
import {
  normalizeHomeUrl
} from "./chunk-FIE7H5TN.mjs";
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
