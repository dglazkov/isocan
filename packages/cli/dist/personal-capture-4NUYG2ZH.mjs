import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-KLQ3DSF2.mjs";
import "./chunk-UNZWN4Q4.mjs";
import "./chunk-KVCOREZM.mjs";
import "./chunk-IAWOYOVI.mjs";
import {
  DaemonClient
} from "./chunk-JLS5GML6.mjs";
import {
  readBadge
} from "./chunk-GIUQMPQS.mjs";
import "./chunk-XN7NTSBC.mjs";
import "./chunk-FXX63EKZ.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-YSN4GFIA.mjs";
import "./chunk-F6WGXFGU.mjs";
import "./chunk-SFIH5SAC.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-UCLTUSKH.mjs";
import "./chunk-A5GXVLWT.mjs";
import {
  normalizeHomeUrl
} from "./chunk-2DMH3A56.mjs";
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
