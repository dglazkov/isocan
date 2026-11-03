import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-CVKINFQJ.mjs";
import {
  DaemonClient
} from "./chunk-ZM6PTU5O.mjs";
import "./chunk-KZUY5TS5.mjs";
import "./chunk-N4EO73KV.mjs";
import "./chunk-E5OHPQDM.mjs";
import "./chunk-CRXSHFA7.mjs";
import "./chunk-XXXEFFAO.mjs";
import "./chunk-GUUEGULB.mjs";
import "./chunk-VIEIIYK3.mjs";
import "./chunk-TKAJH52F.mjs";
import "./chunk-V5TNXN7I.mjs";
import {
  readBadge
} from "./chunk-FY66YM6H.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-PU4LVAAR.mjs";
import "./chunk-OUU6V4OT.mjs";
import {
  normalizeHomeUrl
} from "./chunk-EFGQZUK3.mjs";
import "./chunk-7OLMWXEB.mjs";
import "./chunk-2ZAY35XO.mjs";
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
