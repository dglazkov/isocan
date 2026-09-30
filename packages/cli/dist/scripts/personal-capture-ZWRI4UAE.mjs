import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-SMAU5A3K.mjs";
import {
  DaemonClient
} from "./chunk-RRFVNNF2.mjs";
import "./chunk-VOH7T2VT.mjs";
import "./chunk-3GDG4IAA.mjs";
import "./chunk-J3MP2BLT.mjs";
import "./chunk-NM5RUGYH.mjs";
import "./chunk-5VJJ3667.mjs";
import "./chunk-OS6MWKLO.mjs";
import "./chunk-NW3QF6NJ.mjs";
import "./chunk-E5CBQK2O.mjs";
import {
  readBadge
} from "./chunk-6UVCYD4D.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-7BOFXDBT.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-RNDWYXCZ.mjs";
import {
  normalizeHomeUrl
} from "./chunk-G633H2CB.mjs";
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
