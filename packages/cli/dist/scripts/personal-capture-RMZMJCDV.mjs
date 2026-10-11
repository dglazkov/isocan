import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-2X5ITANY.mjs";
import {
  DaemonClient
} from "./chunk-IM2HHCJN.mjs";
import "./chunk-RICI2IKA.mjs";
import "./chunk-MODXQG3H.mjs";
import "./chunk-YKZJBKMS.mjs";
import "./chunk-I7U5TYZK.mjs";
import "./chunk-L4U37YA6.mjs";
import "./chunk-YDGDSSZ5.mjs";
import "./chunk-5NBMCBOW.mjs";
import "./chunk-6YIY3HN2.mjs";
import {
  readBadge
} from "./chunk-LBJQEJLL.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-PLIBOGTS.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-FJL7QJF5.mjs";
import {
  normalizeHomeUrl
} from "./chunk-TIFQDM7A.mjs";
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
