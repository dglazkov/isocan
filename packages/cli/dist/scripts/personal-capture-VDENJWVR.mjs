import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-WEETTRDH.mjs";
import {
  DaemonClient
} from "./chunk-N6NW7EOT.mjs";
import "./chunk-7VOTSFP3.mjs";
import "./chunk-7RKCDWYU.mjs";
import "./chunk-DOXPFYE2.mjs";
import "./chunk-P64FN6BP.mjs";
import "./chunk-EPPGX4EV.mjs";
import "./chunk-6U3OAYIV.mjs";
import "./chunk-VOZPJVDI.mjs";
import "./chunk-FNORE3TM.mjs";
import {
  readBadge
} from "./chunk-XA4OSZC5.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-3FH6DAPE.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-GRCQNK4P.mjs";
import {
  normalizeHomeUrl
} from "./chunk-BAEGLIM7.mjs";
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
