import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-SONLW244.mjs";
import "./chunk-UVI2GQGY.mjs";
import "./chunk-4X66TTWL.mjs";
import "./chunk-RG3Q2IKZ.mjs";
import "./chunk-G7JU62II.mjs";
import "./chunk-ENRR52Q4.mjs";
import {
  DaemonClient
} from "./chunk-R4G7QWLO.mjs";
import {
  readBadge
} from "./chunk-MUIPBOOH.mjs";
import "./chunk-OMUAHONA.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-PPNRVEWE.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-S3RA4KK2.mjs";
import "./chunk-XKQBNB4H.mjs";
import "./chunk-6WYRBKFT.mjs";
import {
  normalizeHomeUrl
} from "./chunk-Y26ZN4ZJ.mjs";
import "./chunk-ZRGI5I2I.mjs";
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
