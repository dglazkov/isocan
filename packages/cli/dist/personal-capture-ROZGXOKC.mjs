import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-W4BK6RMN.mjs";
import "./chunk-LR3OHUR5.mjs";
import "./chunk-5KITSWJW.mjs";
import "./chunk-OJMCGSIY.mjs";
import {
  DaemonClient
} from "./chunk-WEVLTYMW.mjs";
import {
  readBadge
} from "./chunk-2FO2TIZE.mjs";
import "./chunk-4EVU7D3Y.mjs";
import "./chunk-XTG2VEAW.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-UGL4ZDUO.mjs";
import "./chunk-NQ5E4WNB.mjs";
import "./chunk-Q63KJMWL.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-EFKVHAER.mjs";
import "./chunk-BXWR67LC.mjs";
import {
  normalizeHomeUrl
} from "./chunk-JCK7CHNU.mjs";
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
