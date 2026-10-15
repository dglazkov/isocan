import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-IFXDSVWZ.mjs";
import {
  DaemonClient
} from "./chunk-QJVHK4Y2.mjs";
import "./chunk-YHWHIWIM.mjs";
import "./chunk-TAXOGMWI.mjs";
import "./chunk-IAUK25S2.mjs";
import "./chunk-7AAJBDNV.mjs";
import "./chunk-LRGKJAW7.mjs";
import "./chunk-ZF2IDFZR.mjs";
import "./chunk-RLPNTMIJ.mjs";
import "./chunk-QM6VYDD7.mjs";
import {
  readBadge
} from "./chunk-CYV53DAW.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-LPN2IS4Q.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-VYR7I64R.mjs";
import {
  normalizeHomeUrl
} from "./chunk-BNOO2LOO.mjs";
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
