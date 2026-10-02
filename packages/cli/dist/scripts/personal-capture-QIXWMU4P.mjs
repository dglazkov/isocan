import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-NS2NHFU2.mjs";
import {
  DaemonClient
} from "./chunk-JMMXSUFA.mjs";
import "./chunk-2NGQLKRM.mjs";
import "./chunk-64WNQ3RZ.mjs";
import "./chunk-TWHIA2OJ.mjs";
import "./chunk-TZ7BZU75.mjs";
import "./chunk-7Y6BAICC.mjs";
import "./chunk-3EMSTGQI.mjs";
import "./chunk-WMXPGVKF.mjs";
import "./chunk-EEBCTM3N.mjs";
import {
  readBadge
} from "./chunk-ZIEKK7EZ.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-DEJZX6TL.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-7GZ2V36Z.mjs";
import {
  normalizeHomeUrl
} from "./chunk-4GD4JFFH.mjs";
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
