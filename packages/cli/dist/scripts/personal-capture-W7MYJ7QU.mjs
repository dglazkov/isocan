import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-WZZSCDB5.mjs";
import {
  DaemonClient
} from "./chunk-KY7NVSZI.mjs";
import "./chunk-ZXMMOTPC.mjs";
import "./chunk-FTKNRQHD.mjs";
import "./chunk-KEP3VWPC.mjs";
import "./chunk-PAAXYB2E.mjs";
import "./chunk-P3QT4QDJ.mjs";
import "./chunk-LDFQSRZ4.mjs";
import "./chunk-3DME7YYB.mjs";
import "./chunk-3ERMB5B3.mjs";
import {
  readBadge
} from "./chunk-77466FD6.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-AXMKH2NS.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-NFQ4MN2S.mjs";
import {
  normalizeHomeUrl
} from "./chunk-HTXEXHQ3.mjs";
import "./chunk-7OLMWXEB.mjs";
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
