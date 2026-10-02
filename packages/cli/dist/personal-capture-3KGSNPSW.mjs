import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-FLPFNYLJ.mjs";
import "./chunk-JHEI2CH6.mjs";
import "./chunk-KKKW76Y4.mjs";
import "./chunk-5UNNLP37.mjs";
import {
  DaemonClient
} from "./chunk-NDITQOSJ.mjs";
import {
  readBadge
} from "./chunk-ZONRAIK3.mjs";
import "./chunk-5OY7AKVA.mjs";
import "./chunk-MQHPFFI6.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-R6BURVMP.mjs";
import "./chunk-CJ7VWXPX.mjs";
import "./chunk-M2LX5QKL.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-J7DRP4VI.mjs";
import "./chunk-DIHPYFFR.mjs";
import {
  normalizeHomeUrl
} from "./chunk-7RKFGFDC.mjs";
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
