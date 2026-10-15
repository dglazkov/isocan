import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-Q42RYUBI.mjs";
import {
  DaemonClient
} from "./chunk-FGOGXLPM.mjs";
import "./chunk-Z666ZAL2.mjs";
import "./chunk-A5FZY2T7.mjs";
import "./chunk-JVLY3RVJ.mjs";
import "./chunk-3WNZIZES.mjs";
import "./chunk-5O7AITCM.mjs";
import "./chunk-DJI7D6IR.mjs";
import "./chunk-CXULXKVI.mjs";
import "./chunk-ODUHNQZB.mjs";
import {
  readBadge
} from "./chunk-N73YPAAA.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-NCSMRBK2.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-3CF4STBY.mjs";
import {
  normalizeHomeUrl
} from "./chunk-3YPYAXTO.mjs";
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
