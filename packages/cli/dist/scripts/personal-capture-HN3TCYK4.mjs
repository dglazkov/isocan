import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-TMY746D2.mjs";
import {
  DaemonClient
} from "./chunk-WZZVZGCS.mjs";
import "./chunk-BTG46BXH.mjs";
import "./chunk-C3HTAJ72.mjs";
import "./chunk-WVL66LHJ.mjs";
import "./chunk-M7XYHNVS.mjs";
import "./chunk-O4BYZ4QP.mjs";
import "./chunk-5FAEBIMS.mjs";
import "./chunk-VCGD2TZO.mjs";
import "./chunk-FYE543AE.mjs";
import {
  readBadge
} from "./chunk-VDZNQLWQ.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-ETDROZEL.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-6VCF7QBO.mjs";
import {
  normalizeHomeUrl
} from "./chunk-NR26CBW5.mjs";
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
