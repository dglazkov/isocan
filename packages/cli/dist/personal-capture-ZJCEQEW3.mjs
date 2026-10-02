import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-SB6RXX4C.mjs";
import "./chunk-TYFP7Q4J.mjs";
import "./chunk-IMLSOP2T.mjs";
import "./chunk-QJH2NXFR.mjs";
import {
  DaemonClient
} from "./chunk-ZEC6LMHW.mjs";
import {
  readBadge
} from "./chunk-NVEOYWFC.mjs";
import "./chunk-E7APC5HR.mjs";
import "./chunk-FHLVNSLL.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-2FIGREIH.mjs";
import "./chunk-ZOLA65OY.mjs";
import "./chunk-CLQXPKAT.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-GKHPOY43.mjs";
import "./chunk-5ZARNNHC.mjs";
import {
  normalizeHomeUrl
} from "./chunk-WI56ZDDN.mjs";
import "./chunk-GUY4UN4O.mjs";
import "./chunk-K4TDP4L5.mjs";
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
