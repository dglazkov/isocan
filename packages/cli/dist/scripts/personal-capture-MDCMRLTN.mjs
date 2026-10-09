import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-7ZDZRSQ5.mjs";
import {
  DaemonClient
} from "./chunk-ZRR2GR5C.mjs";
import "./chunk-UZNXUY2L.mjs";
import "./chunk-FGPIB4HT.mjs";
import "./chunk-CPHUCQKC.mjs";
import "./chunk-6HWZKERC.mjs";
import "./chunk-VQPZK2TW.mjs";
import "./chunk-KVLQ2ZCO.mjs";
import "./chunk-AAH33I6N.mjs";
import "./chunk-IOEISYXQ.mjs";
import {
  readBadge
} from "./chunk-3UTDRJ7X.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-5BBGJCXQ.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-MUOOS3DQ.mjs";
import {
  normalizeHomeUrl
} from "./chunk-GOBQRW64.mjs";
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
