import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-J7ODWNRS.mjs";
import {
  DaemonClient
} from "./chunk-PEHIY5U4.mjs";
import "./chunk-RXHCSFJP.mjs";
import "./chunk-5C35ZMQK.mjs";
import "./chunk-3E3QTU2R.mjs";
import "./chunk-7QQISID3.mjs";
import "./chunk-3VHBY2YR.mjs";
import "./chunk-O77FLHVN.mjs";
import "./chunk-MU6OCDVT.mjs";
import "./chunk-P5QZCLV4.mjs";
import {
  readBadge
} from "./chunk-A2ZOCVEC.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-RHR67TMP.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-3IJDBLK4.mjs";
import {
  normalizeHomeUrl
} from "./chunk-ICKCG4C2.mjs";
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
