import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-5SWYWSDD.mjs";
import "./chunk-S2STDR3H.mjs";
import "./chunk-HCFVICTU.mjs";
import "./chunk-OKIP47NS.mjs";
import "./chunk-DVLX5IHT.mjs";
import "./chunk-SCKFEQNI.mjs";
import {
  DaemonClient
} from "./chunk-AX2NUIAM.mjs";
import {
  readBadge
} from "./chunk-BSASSNMV.mjs";
import "./chunk-2JU4YCQY.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-UMNSYLX4.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-WFKLUV4E.mjs";
import "./chunk-CFZSTY7Y.mjs";
import "./chunk-M3AFCINQ.mjs";
import {
  normalizeHomeUrl
} from "./chunk-TBDCHV6U.mjs";
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
