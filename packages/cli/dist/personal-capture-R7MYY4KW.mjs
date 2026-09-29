import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-PDQQCEIM.mjs";
import "./chunk-C4I2LTBP.mjs";
import "./chunk-6E5V63G7.mjs";
import "./chunk-FWG3KIWP.mjs";
import "./chunk-G52VXUHW.mjs";
import "./chunk-3FMWBBLB.mjs";
import {
  DaemonClient
} from "./chunk-HDJHGFM7.mjs";
import {
  readBadge
} from "./chunk-734LWB3U.mjs";
import "./chunk-7YIZEUBI.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-M6IHY2JM.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-IXFZEFGW.mjs";
import "./chunk-4STECMJP.mjs";
import "./chunk-CB5CS7DX.mjs";
import {
  normalizeHomeUrl
} from "./chunk-P5QBY34C.mjs";
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
