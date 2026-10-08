import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-34JRSGVY.mjs";
import {
  DaemonClient
} from "./chunk-NCIIGB3Q.mjs";
import "./chunk-2SLIVNOW.mjs";
import "./chunk-FMECSO6U.mjs";
import "./chunk-SADWFLZW.mjs";
import "./chunk-QVZKU7P2.mjs";
import "./chunk-QJOUAOBI.mjs";
import "./chunk-5NZ3W67X.mjs";
import "./chunk-IE5LW4XX.mjs";
import "./chunk-7Y47OCVK.mjs";
import {
  readBadge
} from "./chunk-ZGQMWETO.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-VWDCCXKM.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-LR35IDBF.mjs";
import {
  normalizeHomeUrl
} from "./chunk-S5P7JILF.mjs";
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
