import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-BVJITGNY.mjs";
import "./chunk-UWVYC2CX.mjs";
import "./chunk-SQRQS2W7.mjs";
import "./chunk-EHE3RLH5.mjs";
import "./chunk-ARMFWFJP.mjs";
import "./chunk-CWNSWQ43.mjs";
import {
  DaemonClient
} from "./chunk-LBDXMOJS.mjs";
import {
  readBadge
} from "./chunk-Y44NMLEF.mjs";
import "./chunk-ZAADO4RK.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-4MWQO27L.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-AZGAQOUX.mjs";
import "./chunk-YHRY4MR2.mjs";
import "./chunk-6D2PZX4J.mjs";
import {
  normalizeHomeUrl
} from "./chunk-JD67K4YP.mjs";
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
