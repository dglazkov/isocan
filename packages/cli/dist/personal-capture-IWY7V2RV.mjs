import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-GMJP6YUY.mjs";
import "./chunk-YTXA6M2W.mjs";
import "./chunk-V6AM3IMQ.mjs";
import "./chunk-5VS4KROT.mjs";
import {
  DaemonClient
} from "./chunk-NUL7JUTH.mjs";
import {
  readBadge
} from "./chunk-N73UHUP7.mjs";
import "./chunk-4FXALPHQ.mjs";
import "./chunk-TYB77SDJ.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-QNFM6ECE.mjs";
import "./chunk-LJVDCK23.mjs";
import "./chunk-W6IS2764.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-OZBAYWS2.mjs";
import "./chunk-JYKQDHCL.mjs";
import {
  normalizeHomeUrl
} from "./chunk-MNBJSNW6.mjs";
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
