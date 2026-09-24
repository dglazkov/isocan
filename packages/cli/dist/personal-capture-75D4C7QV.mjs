import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-XHL6SK2M.mjs";
import "./chunk-KGXN5EBW.mjs";
import "./chunk-KMMX35KW.mjs";
import "./chunk-D34FLR7T.mjs";
import "./chunk-H3T6ZZQY.mjs";
import "./chunk-ZPHEJPL5.mjs";
import {
  DaemonClient
} from "./chunk-TD7H3FGX.mjs";
import {
  readBadge
} from "./chunk-5PRUQ4NU.mjs";
import "./chunk-TJ2HD4VG.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-GJN2MWQQ.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-PS3DF5AA.mjs";
import "./chunk-6WJYHBI6.mjs";
import "./chunk-BVKZ3B6O.mjs";
import {
  normalizeHomeUrl
} from "./chunk-SVVLIUYC.mjs";
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
