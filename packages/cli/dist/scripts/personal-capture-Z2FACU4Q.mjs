import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-L7CO2MHJ.mjs";
import {
  DaemonClient
} from "./chunk-R7ADUMXD.mjs";
import "./chunk-GSQ66SP3.mjs";
import "./chunk-FYVFQTV5.mjs";
import "./chunk-UXEIKXI6.mjs";
import "./chunk-E6HJ7YJ3.mjs";
import "./chunk-FR45RUN2.mjs";
import "./chunk-C37VUTOH.mjs";
import "./chunk-DM2ZMOFX.mjs";
import "./chunk-W2KRAFRW.mjs";
import {
  readBadge
} from "./chunk-K255QIVM.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-THJRMZQO.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-SO3EQ7MG.mjs";
import {
  normalizeHomeUrl
} from "./chunk-J5FFB36L.mjs";
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
