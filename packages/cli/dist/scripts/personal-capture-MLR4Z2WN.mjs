import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-EPEZJ3L7.mjs";
import {
  DaemonClient
} from "./chunk-FLQRKSXT.mjs";
import "./chunk-LW46KCBF.mjs";
import "./chunk-36FKOPSD.mjs";
import "./chunk-4CC3DZCV.mjs";
import "./chunk-RPRKYFAT.mjs";
import "./chunk-IMF5N7UX.mjs";
import "./chunk-PMDOPCLL.mjs";
import "./chunk-M6QJAIQO.mjs";
import "./chunk-MZVWN2UG.mjs";
import {
  readBadge
} from "./chunk-F4MNYOEQ.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-E6GQKXQU.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-QQHQURQC.mjs";
import {
  normalizeHomeUrl
} from "./chunk-5CSGRCUR.mjs";
import "./chunk-7OLMWXEB.mjs";
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
