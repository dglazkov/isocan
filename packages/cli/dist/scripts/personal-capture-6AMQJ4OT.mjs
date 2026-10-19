import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-G3EHMEJ6.mjs";
import {
  DaemonClient
} from "./chunk-F5XCQHLX.mjs";
import "./chunk-ZA4QYC2G.mjs";
import "./chunk-ZDAORFOJ.mjs";
import "./chunk-GRRBFXCL.mjs";
import "./chunk-UT75QWLW.mjs";
import "./chunk-5WG245O3.mjs";
import "./chunk-CDPFJLWD.mjs";
import "./chunk-HBOPUERC.mjs";
import "./chunk-E2SOYEFF.mjs";
import {
  readBadge
} from "./chunk-4PJ3IWNU.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-M7VXBKBU.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-H6AYDKFB.mjs";
import {
  normalizeHomeUrl
} from "./chunk-3LKMPMUL.mjs";
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
