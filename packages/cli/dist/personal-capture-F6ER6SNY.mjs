import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-JC2M4YQP.mjs";
import "./chunk-63VN5ECH.mjs";
import "./chunk-ARQLKAKJ.mjs";
import "./chunk-7D6MNQQG.mjs";
import "./chunk-YCZDTLMC.mjs";
import "./chunk-UQXLVG33.mjs";
import {
  DaemonClient
} from "./chunk-P25TSG4T.mjs";
import {
  readBadge
} from "./chunk-72K74LBI.mjs";
import "./chunk-SOEGLXRB.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-D2CRCYC7.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-VQUCNOJH.mjs";
import "./chunk-4LKMGDYT.mjs";
import "./chunk-5HRHUGTP.mjs";
import {
  normalizeHomeUrl
} from "./chunk-A2JZRIAA.mjs";
import "./chunk-TE337AEY.mjs";
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
