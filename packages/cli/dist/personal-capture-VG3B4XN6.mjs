import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-M4KXWIS3.mjs";
import "./chunk-6TC7BWAP.mjs";
import "./chunk-OG5NGMPV.mjs";
import "./chunk-OCWDSPMH.mjs";
import {
  DaemonClient
} from "./chunk-55JOJGGH.mjs";
import {
  readBadge
} from "./chunk-JP2R76S2.mjs";
import "./chunk-UL44ROVF.mjs";
import "./chunk-ZFD6BQBA.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-KZD7Z237.mjs";
import "./chunk-PKFSIWPV.mjs";
import "./chunk-JSWJMBVK.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-COOY66CD.mjs";
import "./chunk-ODYP2A67.mjs";
import {
  normalizeHomeUrl
} from "./chunk-VMZRQO4Z.mjs";
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
