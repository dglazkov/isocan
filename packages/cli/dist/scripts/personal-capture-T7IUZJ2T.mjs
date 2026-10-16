import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-6EZEJVGI.mjs";
import {
  DaemonClient
} from "./chunk-WRU5GXKQ.mjs";
import "./chunk-LIQ4UNZT.mjs";
import "./chunk-D3JEPHLT.mjs";
import "./chunk-M2BVWT5I.mjs";
import "./chunk-PAOWTKBB.mjs";
import "./chunk-DD2NS2L3.mjs";
import "./chunk-PPGFHUV5.mjs";
import "./chunk-I4WAFMQJ.mjs";
import "./chunk-LQTLNZLS.mjs";
import {
  readBadge
} from "./chunk-DTFWTW3B.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-E23ASHWR.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-ZWGHKJ3K.mjs";
import {
  normalizeHomeUrl
} from "./chunk-ZFVZCQUT.mjs";
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
