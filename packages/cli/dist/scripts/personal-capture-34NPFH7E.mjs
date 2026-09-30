import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-EHUR4MX5.mjs";
import {
  DaemonClient
} from "./chunk-KBKQPJX5.mjs";
import "./chunk-OF2QKONJ.mjs";
import "./chunk-UBIMOMWO.mjs";
import "./chunk-FFSWD5EP.mjs";
import "./chunk-MOWMSPMT.mjs";
import "./chunk-WM3I6EIK.mjs";
import "./chunk-MKIHARNH.mjs";
import "./chunk-UXTPDXYM.mjs";
import "./chunk-LOQAF2MU.mjs";
import {
  readBadge
} from "./chunk-EOSDXUJR.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-25HWF7JM.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-HEEUYEZS.mjs";
import {
  normalizeHomeUrl
} from "./chunk-PL5FAGED.mjs";
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
