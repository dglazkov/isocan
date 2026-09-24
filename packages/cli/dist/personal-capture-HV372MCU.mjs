import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-IXH4I4LA.mjs";
import "./chunk-R22DO5OE.mjs";
import "./chunk-NF2BGHVX.mjs";
import "./chunk-DAMEVBGQ.mjs";
import "./chunk-5VQIYGHU.mjs";
import "./chunk-VJ5BA5NR.mjs";
import {
  DaemonClient
} from "./chunk-2WG4BBJX.mjs";
import {
  readBadge
} from "./chunk-AFLLYDF6.mjs";
import "./chunk-VSVE42MP.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-HGX62322.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-JZKGCGTU.mjs";
import "./chunk-TBER2WMC.mjs";
import "./chunk-T3YCBVVJ.mjs";
import {
  normalizeHomeUrl
} from "./chunk-XCJH5BEN.mjs";
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
