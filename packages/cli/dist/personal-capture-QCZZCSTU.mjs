import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-NUM4QUIT.mjs";
import "./chunk-65KU34CD.mjs";
import "./chunk-AEJQBI5I.mjs";
import "./chunk-3GEYVXAY.mjs";
import "./chunk-HVUHTAUR.mjs";
import "./chunk-PQNFQRTL.mjs";
import {
  DaemonClient
} from "./chunk-5W2GWYXT.mjs";
import {
  readBadge
} from "./chunk-YOJM6WTI.mjs";
import "./chunk-HXFCPB3E.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-7C3PYLJJ.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-57RMNTGY.mjs";
import "./chunk-SJ255F2Q.mjs";
import "./chunk-Q6L6M4RH.mjs";
import {
  normalizeHomeUrl
} from "./chunk-4DD3YO2G.mjs";
import "./chunk-ZRGI5I2I.mjs";
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
