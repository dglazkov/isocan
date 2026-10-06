import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-DO5E6RM5.mjs";
import {
  DaemonClient
} from "./chunk-7GFYGYXV.mjs";
import "./chunk-U5IJALHV.mjs";
import "./chunk-YPOVCNWG.mjs";
import "./chunk-OKHCJB6S.mjs";
import "./chunk-AJ4K7PQH.mjs";
import "./chunk-GV2LA7EG.mjs";
import "./chunk-JX3RCBW2.mjs";
import "./chunk-SCR5QKKN.mjs";
import "./chunk-QGSXK5QH.mjs";
import {
  readBadge
} from "./chunk-6CXFWEE6.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-ZNRNQQX6.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-4DMML4XN.mjs";
import {
  normalizeHomeUrl
} from "./chunk-VEGSNUQI.mjs";
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
