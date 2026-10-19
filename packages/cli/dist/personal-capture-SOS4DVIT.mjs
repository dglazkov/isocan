import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-SOENDYHB.mjs";
import "./chunk-GNA3BIOL.mjs";
import "./chunk-GKU3UUOX.mjs";
import "./chunk-KHFEL7YT.mjs";
import {
  DaemonClient
} from "./chunk-F2SGQ54N.mjs";
import {
  readBadge
} from "./chunk-PATZWN7A.mjs";
import "./chunk-3M4OR7PG.mjs";
import "./chunk-6DNF2INC.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-5UOA2MUM.mjs";
import "./chunk-BGDFBMQO.mjs";
import "./chunk-6M7LEZEP.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-RGOZE4DZ.mjs";
import "./chunk-5EUFOHM6.mjs";
import {
  normalizeHomeUrl
} from "./chunk-NP5K66IV.mjs";
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
