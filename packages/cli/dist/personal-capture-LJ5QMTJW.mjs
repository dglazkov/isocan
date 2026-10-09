import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-KYVACL53.mjs";
import "./chunk-QR4IC3GS.mjs";
import "./chunk-MKC6J4ZU.mjs";
import "./chunk-D256PAW6.mjs";
import {
  DaemonClient
} from "./chunk-LCAMHML3.mjs";
import {
  readBadge
} from "./chunk-BSXL2VQ6.mjs";
import "./chunk-NX5VYJUM.mjs";
import "./chunk-JYUTNLEW.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-XVQPQJHQ.mjs";
import "./chunk-BIHFSFJA.mjs";
import "./chunk-X6SYN5TU.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-MVAABOPJ.mjs";
import "./chunk-YUNAFKF4.mjs";
import {
  normalizeHomeUrl
} from "./chunk-DJC3PAX3.mjs";
import "./chunk-GUY4UN4O.mjs";
import "./chunk-K4TDP4L5.mjs";
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
