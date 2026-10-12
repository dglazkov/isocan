import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-YIHOMMR7.mjs";
import {
  DaemonClient
} from "./chunk-NJKV3YXW.mjs";
import "./chunk-OBGI4DDN.mjs";
import "./chunk-GSYJX6BG.mjs";
import "./chunk-XP2254ZL.mjs";
import "./chunk-TSECZAKS.mjs";
import "./chunk-JTQQVSL2.mjs";
import "./chunk-5XMBHVK5.mjs";
import "./chunk-HIO4GV42.mjs";
import "./chunk-HEO4O7QH.mjs";
import {
  readBadge
} from "./chunk-LKVR2JYE.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-PCCLWGSI.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-3Y7OTSVV.mjs";
import {
  normalizeHomeUrl
} from "./chunk-2MKTQSFE.mjs";
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
