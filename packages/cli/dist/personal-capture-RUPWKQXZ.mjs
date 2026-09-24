import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-CXEWB74U.mjs";
import "./chunk-EJABOOHJ.mjs";
import "./chunk-2TEINB4W.mjs";
import "./chunk-PFYA7EUP.mjs";
import "./chunk-J6BZS3ZZ.mjs";
import "./chunk-BUE2M76L.mjs";
import {
  DaemonClient
} from "./chunk-MJSKQXWI.mjs";
import {
  readBadge
} from "./chunk-WFQPXJM2.mjs";
import "./chunk-PVG3OZ3U.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-B56ITTGZ.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-XMGARX5T.mjs";
import "./chunk-67BQCG2E.mjs";
import "./chunk-R6PIJL4Y.mjs";
import {
  normalizeHomeUrl
} from "./chunk-KMHA34UU.mjs";
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
