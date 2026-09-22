import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-2C3JS655.mjs";
import "./chunk-WSOCCGLY.mjs";
import "./chunk-5TVO5UVT.mjs";
import "./chunk-GPGVNA5L.mjs";
import "./chunk-YXYKV4PR.mjs";
import "./chunk-UT6SUZGT.mjs";
import {
  DaemonClient
} from "./chunk-IG3Y44LQ.mjs";
import {
  readBadge
} from "./chunk-JJCQH656.mjs";
import "./chunk-4POU4FN7.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-5TOU2GFN.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-R7ZTGY4D.mjs";
import "./chunk-EACMSUMJ.mjs";
import "./chunk-YAQJQABV.mjs";
import {
  normalizeHomeUrl
} from "./chunk-TNZFS7IX.mjs";
import "./chunk-TE337AEY.mjs";
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
