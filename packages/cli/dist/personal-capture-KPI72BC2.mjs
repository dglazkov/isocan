import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-2HUSUU65.mjs";
import "./chunk-3FJIXUCC.mjs";
import "./chunk-26X3QUM5.mjs";
import "./chunk-IGBPQ477.mjs";
import {
  DaemonClient
} from "./chunk-SQPH5XGY.mjs";
import {
  readBadge
} from "./chunk-6OV4MA2L.mjs";
import "./chunk-UOOHCOKV.mjs";
import "./chunk-RUJPGMH3.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-GB2UBN25.mjs";
import "./chunk-MB37XZVX.mjs";
import "./chunk-Z2CSGOQH.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-5UVBM6ZF.mjs";
import "./chunk-A4NEIAGC.mjs";
import {
  normalizeHomeUrl
} from "./chunk-KMOPNYAO.mjs";
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
