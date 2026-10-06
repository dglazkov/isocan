import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-DIPUG3BO.mjs";
import {
  DaemonClient
} from "./chunk-APTQH2T5.mjs";
import "./chunk-CX4H4OQ6.mjs";
import "./chunk-4INMHI3F.mjs";
import "./chunk-ZDEY3QLA.mjs";
import "./chunk-MZQFOU5Y.mjs";
import "./chunk-H2H3UMJ3.mjs";
import "./chunk-Z5BUW5KR.mjs";
import "./chunk-LWX7RDXM.mjs";
import "./chunk-KMLNRUPC.mjs";
import {
  readBadge
} from "./chunk-WVMVLJSC.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-4Q4473LK.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-MEKSLFT3.mjs";
import {
  normalizeHomeUrl
} from "./chunk-4AR6YVHV.mjs";
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
