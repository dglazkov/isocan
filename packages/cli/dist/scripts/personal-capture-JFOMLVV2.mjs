import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-IL7DNSWY.mjs";
import {
  DaemonClient
} from "./chunk-WGJ4642R.mjs";
import "./chunk-CPNJ4X3Q.mjs";
import "./chunk-LQWUAIXE.mjs";
import "./chunk-C2RQCLNK.mjs";
import "./chunk-XFJNMVFW.mjs";
import "./chunk-7GMQFZKS.mjs";
import "./chunk-ODA56XLI.mjs";
import "./chunk-GSSXPRLP.mjs";
import "./chunk-J767IN3Q.mjs";
import {
  readBadge
} from "./chunk-L6ARMFOS.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-DSQRIKLD.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-IDGK7SCT.mjs";
import {
  normalizeHomeUrl
} from "./chunk-CSCE4XQQ.mjs";
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
