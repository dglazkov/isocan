import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-U2DSTFHE.mjs";
import "./chunk-HAGIKJJF.mjs";
import "./chunk-25N7GERM.mjs";
import "./chunk-XJAB4YPY.mjs";
import "./chunk-PG7QVEPP.mjs";
import "./chunk-D7ZXWWS6.mjs";
import {
  DaemonClient
} from "./chunk-CZ3LSHUR.mjs";
import {
  readBadge
} from "./chunk-TOPC6FNO.mjs";
import "./chunk-KOKNOXWD.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-4XKBMNRH.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-USRCPL6L.mjs";
import "./chunk-UBIB54CH.mjs";
import "./chunk-5KH5SNT5.mjs";
import {
  normalizeHomeUrl
} from "./chunk-L7JBIBVC.mjs";
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
