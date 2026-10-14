import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-FJCB2LLS.mjs";
import {
  DaemonClient
} from "./chunk-2EE63W7H.mjs";
import "./chunk-JAVJDEWZ.mjs";
import "./chunk-BXKKLGSD.mjs";
import "./chunk-VHPPQPKI.mjs";
import "./chunk-CDHWYSEO.mjs";
import "./chunk-LAEMKJ5C.mjs";
import "./chunk-QMXVASFB.mjs";
import "./chunk-KQY4LEZ7.mjs";
import "./chunk-RZ3MN2KJ.mjs";
import {
  readBadge
} from "./chunk-2WGTOAOY.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-M46NPXGT.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-HQ2KYPHQ.mjs";
import {
  normalizeHomeUrl
} from "./chunk-OSYDQIAJ.mjs";
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
