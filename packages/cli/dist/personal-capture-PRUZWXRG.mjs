import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-6R6U3EAM.mjs";
import "./chunk-VJ65OLH7.mjs";
import "./chunk-VURUHFM7.mjs";
import "./chunk-PQDKDDEP.mjs";
import {
  DaemonClient
} from "./chunk-SSH2EGY3.mjs";
import {
  readBadge
} from "./chunk-ZC6YZGGW.mjs";
import "./chunk-ARFSPLCI.mjs";
import "./chunk-DQU4246C.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-66L4UZH4.mjs";
import "./chunk-HRWQCJ46.mjs";
import "./chunk-YI6RF3EE.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-Y2Z2ZVHY.mjs";
import "./chunk-FCHDMNPZ.mjs";
import {
  normalizeHomeUrl
} from "./chunk-VSVKW4DR.mjs";
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
