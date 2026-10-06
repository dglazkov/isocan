import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-Y3NEKMVT.mjs";
import {
  DaemonClient
} from "./chunk-VVNQN26L.mjs";
import "./chunk-FNE3WONT.mjs";
import "./chunk-LJESO2JM.mjs";
import "./chunk-SSINE4DE.mjs";
import "./chunk-KKIGY4JO.mjs";
import "./chunk-4X5PK2US.mjs";
import "./chunk-5YUJCKFZ.mjs";
import "./chunk-73W6VFV2.mjs";
import "./chunk-RIYCPXIC.mjs";
import {
  readBadge
} from "./chunk-J7VALTWM.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-NW44YUJ2.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-T2PU3S4L.mjs";
import {
  normalizeHomeUrl
} from "./chunk-DEUAWJHO.mjs";
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
