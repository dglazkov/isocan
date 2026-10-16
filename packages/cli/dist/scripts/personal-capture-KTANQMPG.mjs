import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-BSWHGC6Y.mjs";
import {
  DaemonClient
} from "./chunk-XAHZBF5J.mjs";
import "./chunk-WVIOX2JU.mjs";
import "./chunk-IHWHCLBG.mjs";
import "./chunk-VNY3AWFE.mjs";
import "./chunk-LHW7L6HC.mjs";
import "./chunk-IFKXLEYA.mjs";
import "./chunk-BNBCL65L.mjs";
import "./chunk-5ZM7Q6KA.mjs";
import "./chunk-EO4MWTZT.mjs";
import {
  readBadge
} from "./chunk-TXKGXIW2.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-QRXTJCPN.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-ZW2DAUVZ.mjs";
import {
  normalizeHomeUrl
} from "./chunk-UFQZ7OL3.mjs";
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
