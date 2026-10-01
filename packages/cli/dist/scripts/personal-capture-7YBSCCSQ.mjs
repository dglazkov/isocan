import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-ZV33N6HQ.mjs";
import {
  DaemonClient
} from "./chunk-4PCZVJWR.mjs";
import "./chunk-ZOH7GMBU.mjs";
import "./chunk-USF7OPFP.mjs";
import "./chunk-ZUE7R4TV.mjs";
import "./chunk-6LB3FPU6.mjs";
import "./chunk-HVRTEV2U.mjs";
import "./chunk-25UM6EYJ.mjs";
import "./chunk-OY3FDSDH.mjs";
import "./chunk-2E2RMEGK.mjs";
import {
  readBadge
} from "./chunk-4TH77JUF.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-RULCNTDB.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-2QREU7QQ.mjs";
import {
  normalizeHomeUrl
} from "./chunk-LPLOJPAK.mjs";
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
