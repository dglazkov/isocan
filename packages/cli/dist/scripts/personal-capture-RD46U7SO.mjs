import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-HV2GJTQQ.mjs";
import {
  DaemonClient
} from "./chunk-LMYUCA7W.mjs";
import "./chunk-S2CXGN7M.mjs";
import "./chunk-QRD4WFGO.mjs";
import "./chunk-CWNLKGNM.mjs";
import "./chunk-I5KHM3AM.mjs";
import "./chunk-E4MNKJI2.mjs";
import "./chunk-57SBLDBS.mjs";
import "./chunk-TVH7OPDJ.mjs";
import "./chunk-SET7KDFB.mjs";
import {
  readBadge
} from "./chunk-YJPERQSG.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-Z4QH3WAB.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-D3JTA2W6.mjs";
import {
  normalizeHomeUrl
} from "./chunk-UUGSC4Z2.mjs";
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
