import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-EPPRNYJ6.mjs";
import "./chunk-RDILJQTH.mjs";
import "./chunk-MYOTWWEP.mjs";
import "./chunk-TVGLMMYY.mjs";
import {
  DaemonClient
} from "./chunk-64MLWJY6.mjs";
import {
  readBadge
} from "./chunk-774TYAHX.mjs";
import "./chunk-6DDZMIP6.mjs";
import "./chunk-UKL45OQB.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-XOL5AGTV.mjs";
import "./chunk-NZ6J2KJ7.mjs";
import "./chunk-CVPCV7LK.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-SWF7QYE5.mjs";
import "./chunk-7FWAVLFA.mjs";
import {
  normalizeHomeUrl
} from "./chunk-HYON2Y4M.mjs";
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
