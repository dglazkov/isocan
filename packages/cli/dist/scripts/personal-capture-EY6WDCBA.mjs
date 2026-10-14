import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-6JGNVCMP.mjs";
import {
  DaemonClient
} from "./chunk-YS42AABB.mjs";
import "./chunk-SVX5PL3B.mjs";
import "./chunk-UVBKDNCK.mjs";
import "./chunk-MBPZVTO3.mjs";
import "./chunk-MXJZLDAH.mjs";
import "./chunk-W5CEAPAV.mjs";
import "./chunk-5IOKSKX4.mjs";
import "./chunk-4J3GXSSL.mjs";
import "./chunk-BLTCDWUH.mjs";
import {
  readBadge
} from "./chunk-4JTUIIYJ.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-UCLWTG65.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-OUFG36W5.mjs";
import {
  normalizeHomeUrl
} from "./chunk-J562VGI4.mjs";
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
