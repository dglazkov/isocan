import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-6IPAS2RV.mjs";
import {
  DaemonClient
} from "./chunk-ADJQ7QAN.mjs";
import "./chunk-JZL43VTK.mjs";
import "./chunk-6NANUTU3.mjs";
import "./chunk-ZHPDP7WQ.mjs";
import "./chunk-6XCAIR7N.mjs";
import "./chunk-A6F5BP34.mjs";
import "./chunk-J2ZE2NJL.mjs";
import "./chunk-K26QVEGO.mjs";
import "./chunk-YEX5LQXS.mjs";
import {
  readBadge
} from "./chunk-HBVJVVSU.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-Y6QBFFWH.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-J5IEALG2.mjs";
import {
  normalizeHomeUrl
} from "./chunk-WGZGRJMW.mjs";
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
