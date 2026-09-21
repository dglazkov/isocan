import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-J4WD523E.mjs";
import "./chunk-LDIFTOL2.mjs";
import "./chunk-5UXLLLFS.mjs";
import "./chunk-WHD4XTEL.mjs";
import "./chunk-CPTWDVGI.mjs";
import "./chunk-3GXWL7LT.mjs";
import {
  DaemonClient
} from "./chunk-4TGLL56E.mjs";
import {
  readBadge
} from "./chunk-IXDAWHMY.mjs";
import "./chunk-2GF6FFDC.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-6PVHBSRQ.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-JFCRAV6Q.mjs";
import "./chunk-L3KH66E7.mjs";
import "./chunk-U2DRA7X3.mjs";
import {
  normalizeHomeUrl
} from "./chunk-2KTJ3OHO.mjs";
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
