import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-YVR77ISA.mjs";
import "./chunk-GO4OWGBQ.mjs";
import "./chunk-67ISKFHL.mjs";
import "./chunk-M6XS3ZHU.mjs";
import "./chunk-V4HA6NJJ.mjs";
import "./chunk-WCMXRRIT.mjs";
import {
  DaemonClient
} from "./chunk-E36WCCDF.mjs";
import {
  readBadge
} from "./chunk-QVAV3OBE.mjs";
import "./chunk-YFJUOJLA.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-RUSJ7JFX.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-JTJK77YY.mjs";
import "./chunk-ZXAJCYDK.mjs";
import "./chunk-JLQ6QJS3.mjs";
import {
  normalizeHomeUrl
} from "./chunk-WHUBDAMU.mjs";
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
