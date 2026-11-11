import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-3MIEQT6P.mjs";
import "./chunk-JBOKOWEU.mjs";
import "./chunk-3OST7B5T.mjs";
import "./chunk-35GJTNOF.mjs";
import {
  DaemonClient
} from "./chunk-EINOCLEI.mjs";
import {
  readBadge
} from "./chunk-QHCU2REL.mjs";
import "./chunk-OSDMNUMY.mjs";
import "./chunk-QDBPAJP2.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-UWDEQQKG.mjs";
import "./chunk-3OP6ZO4E.mjs";
import "./chunk-TKYKI5OJ.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-BK5GXVYG.mjs";
import "./chunk-AIWU4OLC.mjs";
import {
  normalizeHomeUrl
} from "./chunk-DCWGWS42.mjs";
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
