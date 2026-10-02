import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-IBR5HMP4.mjs";
import "./chunk-SNWJTT2R.mjs";
import "./chunk-YHNVKUBA.mjs";
import "./chunk-CDTLI724.mjs";
import {
  DaemonClient
} from "./chunk-QOECTMFZ.mjs";
import {
  readBadge
} from "./chunk-ECI6URZV.mjs";
import "./chunk-KQTYNNKZ.mjs";
import "./chunk-3APDXOVZ.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-IQAVHGU7.mjs";
import "./chunk-F45VFD2N.mjs";
import "./chunk-2SXHYTSJ.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-YCOLYZH3.mjs";
import "./chunk-BFZJ734V.mjs";
import {
  normalizeHomeUrl
} from "./chunk-7WD5QFHE.mjs";
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
