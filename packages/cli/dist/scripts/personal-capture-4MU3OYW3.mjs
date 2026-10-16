import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-K4ARS37N.mjs";
import {
  DaemonClient
} from "./chunk-BEDQA6VG.mjs";
import "./chunk-U4WAKFDU.mjs";
import "./chunk-FSOSS5MY.mjs";
import "./chunk-BUG7BQYI.mjs";
import "./chunk-RF3LM23J.mjs";
import "./chunk-HXPXPLOW.mjs";
import "./chunk-L4UABWFL.mjs";
import "./chunk-UC6F2EQP.mjs";
import "./chunk-BJFPE3E3.mjs";
import {
  readBadge
} from "./chunk-GUS7HXDY.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-YL6TASSP.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-YPXQWH5N.mjs";
import {
  normalizeHomeUrl
} from "./chunk-THPUTCFV.mjs";
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
