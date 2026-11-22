import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-AKUNACIZ.mjs";
import "./chunk-ROGH5GWV.mjs";
import {
  DaemonClient
} from "./chunk-WVU7MENY.mjs";
import {
  readBadge
} from "./chunk-2U3GDXKK.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-4KACQIS3.mjs";
import "./chunk-LBUGPAYO.mjs";
import "./chunk-FCRJHRWU.mjs";
import "./chunk-3RPLYEU6.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-KMNQUMAN.mjs";
import "./chunk-WJ4YW67F.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-36FA3T2N.mjs";
import "./chunk-Y3CBABQU.mjs";
import "./chunk-NAZGT6JW.mjs";
import "./chunk-OUU6V4OT.mjs";
import {
  normalizeHomeUrl
} from "./chunk-LBRBQJEE.mjs";
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
