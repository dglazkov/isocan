import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-TTIYELAE.mjs";
import {
  DaemonClient
} from "./chunk-DH2KYNU6.mjs";
import "./chunk-OSCEPZ65.mjs";
import "./chunk-IK5GQVYR.mjs";
import "./chunk-SGWZIDJ5.mjs";
import "./chunk-AVM4JMTT.mjs";
import "./chunk-M3MWM4WJ.mjs";
import "./chunk-DUUGNJMH.mjs";
import "./chunk-UP2XGTZ5.mjs";
import "./chunk-AG5HNF7M.mjs";
import {
  readBadge
} from "./chunk-MADBJG5G.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-2M7E2Y3T.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-I6NLHQH2.mjs";
import {
  normalizeHomeUrl
} from "./chunk-CKJONC76.mjs";
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
