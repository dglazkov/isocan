import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-DRRP3WNN.mjs";
import {
  DaemonClient
} from "./chunk-BMMD62FM.mjs";
import "./chunk-P5KM7U2U.mjs";
import "./chunk-S76J7AQG.mjs";
import "./chunk-SDUPNLTL.mjs";
import "./chunk-Q74GGCZF.mjs";
import "./chunk-ODUDUCID.mjs";
import "./chunk-RJHSTFYF.mjs";
import "./chunk-QJXYQIDQ.mjs";
import "./chunk-EJJFDJXV.mjs";
import {
  readBadge
} from "./chunk-RBR4XAHF.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-SIAJU65V.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-TZF4NHHR.mjs";
import {
  normalizeHomeUrl
} from "./chunk-LBKASY76.mjs";
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
