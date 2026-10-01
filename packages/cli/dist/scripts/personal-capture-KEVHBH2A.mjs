import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-HMPGDH56.mjs";
import {
  DaemonClient
} from "./chunk-AZAYP7ZY.mjs";
import "./chunk-RPO762DJ.mjs";
import "./chunk-A4MZ4KHC.mjs";
import "./chunk-UA6BW6MR.mjs";
import "./chunk-MOYMH54W.mjs";
import "./chunk-OVEURHFD.mjs";
import "./chunk-VIXUSCWH.mjs";
import "./chunk-PGIWBRBE.mjs";
import "./chunk-OQ3RMRGG.mjs";
import {
  readBadge
} from "./chunk-MVG4OYYK.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-ZYTQENTR.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-LLVV6VS7.mjs";
import {
  normalizeHomeUrl
} from "./chunk-RBTHLA6I.mjs";
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
