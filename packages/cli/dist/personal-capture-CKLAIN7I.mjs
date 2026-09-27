import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-5NICYJHX.mjs";
import "./chunk-HUWOR5PV.mjs";
import "./chunk-OZZULQT7.mjs";
import "./chunk-PXDROGEW.mjs";
import "./chunk-N62SXWLY.mjs";
import "./chunk-YI4DPZCU.mjs";
import {
  DaemonClient
} from "./chunk-5PG2DJLH.mjs";
import {
  readBadge
} from "./chunk-RXNWEHMB.mjs";
import "./chunk-TB3H5GO7.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-V37NSN3T.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-HSKOBVKX.mjs";
import "./chunk-MP62XH7I.mjs";
import "./chunk-3G3GZYER.mjs";
import {
  normalizeHomeUrl
} from "./chunk-N6HIE3RP.mjs";
import "./chunk-GUY4UN4O.mjs";
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
