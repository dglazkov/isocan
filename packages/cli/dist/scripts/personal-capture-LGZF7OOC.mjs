import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-6JLLKAM7.mjs";
import {
  DaemonClient
} from "./chunk-3KFOXDNF.mjs";
import "./chunk-5ZXQYW73.mjs";
import "./chunk-JMSQT44W.mjs";
import "./chunk-2L3XEM3U.mjs";
import "./chunk-6LICXWDZ.mjs";
import "./chunk-QGGG4X23.mjs";
import "./chunk-SHJO2ZEQ.mjs";
import "./chunk-M5ZD76OA.mjs";
import "./chunk-H5P563AL.mjs";
import {
  readBadge
} from "./chunk-JI76PGXE.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-7DEE5RTI.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-2C52WXNK.mjs";
import {
  normalizeHomeUrl
} from "./chunk-WP26P2N7.mjs";
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
