import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-O5KAVXSZ.mjs";
import {
  DaemonClient
} from "./chunk-4BM42WFC.mjs";
import "./chunk-5AOZVEBZ.mjs";
import "./chunk-J2O75DZS.mjs";
import "./chunk-UA3URKX2.mjs";
import "./chunk-R4R45KL6.mjs";
import "./chunk-VQYYYKTS.mjs";
import "./chunk-FTWIHFMW.mjs";
import "./chunk-U3IYCDCQ.mjs";
import "./chunk-U3JZG2KA.mjs";
import "./chunk-56MQSCVY.mjs";
import {
  readBadge
} from "./chunk-BOGO6YWG.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-K2LPC2O2.mjs";
import "./chunk-OUU6V4OT.mjs";
import {
  normalizeHomeUrl
} from "./chunk-HQ5JVGZA.mjs";
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
