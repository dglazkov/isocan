import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-K6HHRN54.mjs";
import {
  DaemonClient
} from "./chunk-XTAMRGQ2.mjs";
import "./chunk-4Z7PN7KF.mjs";
import "./chunk-CX7U3YKI.mjs";
import "./chunk-NZAPPWS4.mjs";
import "./chunk-AWAR4ESC.mjs";
import "./chunk-5YVTXBQP.mjs";
import "./chunk-VNVJMDUH.mjs";
import "./chunk-ZYWI5ZUR.mjs";
import "./chunk-G7LVYLXM.mjs";
import {
  readBadge
} from "./chunk-WCHP3SD6.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-5KJZLGJ7.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-AAJNSECP.mjs";
import {
  normalizeHomeUrl
} from "./chunk-WP6XOFH5.mjs";
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
