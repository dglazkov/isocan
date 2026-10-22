import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-MLAWLDZ2.mjs";
import "./chunk-IKLWARUR.mjs";
import "./chunk-6EVE6BDI.mjs";
import "./chunk-IJXH3L4T.mjs";
import {
  DaemonClient
} from "./chunk-YKBBJJRR.mjs";
import {
  readBadge
} from "./chunk-V5DRXSAP.mjs";
import "./chunk-6JXECWWD.mjs";
import "./chunk-LNBL4NDC.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-G2VEZSQX.mjs";
import "./chunk-2G2WFIDZ.mjs";
import "./chunk-2EUQZ6YJ.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-UAZUCT24.mjs";
import "./chunk-ZUTXQVF5.mjs";
import {
  normalizeHomeUrl
} from "./chunk-67GJIBXL.mjs";
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
