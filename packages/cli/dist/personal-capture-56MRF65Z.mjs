import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-I2KRHSAW.mjs";
import "./chunk-FULYS3HZ.mjs";
import "./chunk-GLD3PX2Y.mjs";
import "./chunk-OTUPJ452.mjs";
import {
  DaemonClient
} from "./chunk-JSDTDEWN.mjs";
import {
  readBadge
} from "./chunk-U6Q5SEOM.mjs";
import "./chunk-F463PJ65.mjs";
import "./chunk-QKCTX66C.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-OCWPSWRN.mjs";
import "./chunk-GWHELNXA.mjs";
import "./chunk-MKOLCBW7.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-MUMZI3BR.mjs";
import "./chunk-2EZ3DQMS.mjs";
import {
  normalizeHomeUrl
} from "./chunk-M2V77ISD.mjs";
import "./chunk-GUY4UN4O.mjs";
import "./chunk-K4TDP4L5.mjs";
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
