import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-PQZ6AI5J.mjs";
import "./chunk-52BDIYEG.mjs";
import "./chunk-YQT66JMB.mjs";
import "./chunk-XWJQNE2C.mjs";
import {
  DaemonClient
} from "./chunk-KJ3P3PTV.mjs";
import {
  readBadge
} from "./chunk-D2LCFYG2.mjs";
import "./chunk-4VFSFB4W.mjs";
import "./chunk-AH4MWKHF.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-2DEKPOGF.mjs";
import "./chunk-DQBZXU53.mjs";
import "./chunk-OT3ZBTYG.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-4ZNY5T7O.mjs";
import "./chunk-3KQXFJFT.mjs";
import {
  normalizeHomeUrl
} from "./chunk-2A5T7SLH.mjs";
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
