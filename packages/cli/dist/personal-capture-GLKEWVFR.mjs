import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-HMT7F2GA.mjs";
import "./chunk-HKS2CE76.mjs";
import "./chunk-LN6L7SYE.mjs";
import "./chunk-CCLZPFBJ.mjs";
import {
  DaemonClient
} from "./chunk-PBYPOT3D.mjs";
import {
  readBadge
} from "./chunk-4HVLBL65.mjs";
import "./chunk-N5TI2HXP.mjs";
import "./chunk-6PS4ZTIK.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U3UTQU47.mjs";
import "./chunk-SRCAFMDS.mjs";
import "./chunk-GJXEVBPJ.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-MJSBC47R.mjs";
import "./chunk-3VKSEJJY.mjs";
import {
  normalizeHomeUrl
} from "./chunk-OWJSNEOI.mjs";
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
