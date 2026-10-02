import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-ODOEETPA.mjs";
import {
  DaemonClient
} from "./chunk-S4UM32N7.mjs";
import "./chunk-YLSVJBVQ.mjs";
import "./chunk-52PS5DZB.mjs";
import "./chunk-GRZYU4QQ.mjs";
import "./chunk-7UBZQU63.mjs";
import "./chunk-3XQ5XM4S.mjs";
import "./chunk-ZUBFVADA.mjs";
import "./chunk-W7JXPKXA.mjs";
import "./chunk-DI3Z33W6.mjs";
import {
  readBadge
} from "./chunk-L36EPT3F.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-T6HTNXIX.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-LAY5HA6K.mjs";
import {
  normalizeHomeUrl
} from "./chunk-IHPXMWEI.mjs";
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
