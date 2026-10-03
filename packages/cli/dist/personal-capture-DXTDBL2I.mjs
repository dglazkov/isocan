import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-TUBWZUVG.mjs";
import "./chunk-MCIIJKMQ.mjs";
import "./chunk-UOYLARMU.mjs";
import "./chunk-XJSSQB2Z.mjs";
import {
  DaemonClient
} from "./chunk-KAJ4V6O7.mjs";
import {
  readBadge
} from "./chunk-LOX22CYR.mjs";
import "./chunk-LU46IDRO.mjs";
import "./chunk-XIRFUEFT.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-4AWD47MD.mjs";
import "./chunk-JHEANXBC.mjs";
import "./chunk-DCCPJWQW.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-RL3CXLFD.mjs";
import "./chunk-HD4L2PPD.mjs";
import {
  normalizeHomeUrl
} from "./chunk-WOBHPJ6X.mjs";
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
