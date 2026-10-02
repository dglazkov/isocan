import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-SIC2CSFA.mjs";
import "./chunk-LO52XPE6.mjs";
import "./chunk-U7QK7EYS.mjs";
import "./chunk-TGUBJVOF.mjs";
import {
  DaemonClient
} from "./chunk-RL76MXLO.mjs";
import {
  readBadge
} from "./chunk-JSUDJ6GG.mjs";
import "./chunk-ZI77XYUT.mjs";
import "./chunk-GZ2HJJLF.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-5PNGO3VT.mjs";
import "./chunk-XQNKMP2G.mjs";
import "./chunk-GGKYBFUI.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-7Y565X7F.mjs";
import "./chunk-BWJLLUHU.mjs";
import {
  normalizeHomeUrl
} from "./chunk-YFTHZOOD.mjs";
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
