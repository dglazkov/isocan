import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-T36S55DB.mjs";
import {
  DaemonClient
} from "./chunk-QHHH5MJQ.mjs";
import "./chunk-XJUQAHVN.mjs";
import "./chunk-4JYKWWR6.mjs";
import "./chunk-G6AQIDOB.mjs";
import "./chunk-GN6KVQF2.mjs";
import "./chunk-OXRU2NWX.mjs";
import "./chunk-XLGVDKU3.mjs";
import "./chunk-S3NPR47S.mjs";
import "./chunk-IFFN2VCV.mjs";
import {
  readBadge
} from "./chunk-MVAORQP2.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-NIQO6GOH.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-BYLOGQND.mjs";
import {
  normalizeHomeUrl
} from "./chunk-2SYDPL4P.mjs";
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
