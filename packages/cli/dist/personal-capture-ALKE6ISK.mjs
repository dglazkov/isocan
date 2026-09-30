import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-UJZ6XVG2.mjs";
import "./chunk-PHX2OK5P.mjs";
import "./chunk-QWTKKHRZ.mjs";
import "./chunk-4PGNUMIC.mjs";
import "./chunk-X2I4LUBJ.mjs";
import "./chunk-RL3F3MCG.mjs";
import {
  DaemonClient
} from "./chunk-DKV6JX7Y.mjs";
import {
  readBadge
} from "./chunk-AEV5V7XQ.mjs";
import "./chunk-CGJDSXHD.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-ZZDIMY4C.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-ALHWK5RF.mjs";
import "./chunk-36B6BRED.mjs";
import "./chunk-B66QXSQD.mjs";
import {
  normalizeHomeUrl
} from "./chunk-ITXTURCZ.mjs";
import "./chunk-GUY4UN4O.mjs";
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
