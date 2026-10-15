import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-UTS2YREP.mjs";
import {
  DaemonClient
} from "./chunk-WMGF6O6N.mjs";
import "./chunk-EF6LKXCM.mjs";
import "./chunk-WRVTHGL2.mjs";
import "./chunk-TXLHTTQP.mjs";
import "./chunk-6T5JOXRN.mjs";
import "./chunk-YJ2I3VGY.mjs";
import "./chunk-R46MPZS3.mjs";
import "./chunk-HD4J2J2D.mjs";
import "./chunk-XZB24CMG.mjs";
import {
  readBadge
} from "./chunk-MGQS3GX4.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-GMVQVJKL.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-HJBESHEX.mjs";
import {
  normalizeHomeUrl
} from "./chunk-WBARALQD.mjs";
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
