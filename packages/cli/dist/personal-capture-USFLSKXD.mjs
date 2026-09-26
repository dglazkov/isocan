import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-4PPKF3XQ.mjs";
import "./chunk-FFHA77WR.mjs";
import "./chunk-H6OKOT3O.mjs";
import "./chunk-KYELLUUM.mjs";
import "./chunk-LBCPV422.mjs";
import "./chunk-CYZUGPVD.mjs";
import {
  DaemonClient
} from "./chunk-I5ZN4IHH.mjs";
import {
  readBadge
} from "./chunk-BIWF2KMM.mjs";
import "./chunk-ACX5QCIC.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-IZWKSKK7.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-4ZYSAUKB.mjs";
import "./chunk-T66XP5FU.mjs";
import "./chunk-YEB27CLD.mjs";
import {
  normalizeHomeUrl
} from "./chunk-CNJVQWQO.mjs";
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
