import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-M276P2PM.mjs";
import "./chunk-7NLF7E34.mjs";
import "./chunk-5RGFSO2S.mjs";
import "./chunk-23BZEPFW.mjs";
import "./chunk-DEZYUUTP.mjs";
import "./chunk-SXDBDSNQ.mjs";
import {
  DaemonClient
} from "./chunk-EBOTUVIX.mjs";
import {
  readBadge
} from "./chunk-BISDSHN7.mjs";
import "./chunk-362G7JI7.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-VCXIZFYZ.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-XO5S5P2U.mjs";
import "./chunk-OY7MZFSI.mjs";
import "./chunk-JNO6CSXZ.mjs";
import {
  normalizeHomeUrl
} from "./chunk-5CQWGZGQ.mjs";
import "./chunk-TE337AEY.mjs";
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
