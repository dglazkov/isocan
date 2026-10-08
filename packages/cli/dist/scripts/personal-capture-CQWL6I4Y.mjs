import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-2X4NQXP7.mjs";
import {
  DaemonClient
} from "./chunk-FFFO52SC.mjs";
import "./chunk-LBSH7MLU.mjs";
import "./chunk-2GPS3E7J.mjs";
import "./chunk-XZF7WROH.mjs";
import "./chunk-CCXZQE4G.mjs";
import "./chunk-RTIA7NQB.mjs";
import "./chunk-WPZL3TSA.mjs";
import "./chunk-WE7OBI22.mjs";
import "./chunk-24ZVMBUE.mjs";
import {
  readBadge
} from "./chunk-6SOIXPMR.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-G4HIMHAB.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-UJO2UFUC.mjs";
import {
  normalizeHomeUrl
} from "./chunk-K3XV34XI.mjs";
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
