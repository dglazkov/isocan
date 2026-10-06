import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-EHKJWFGS.mjs";
import "./chunk-TV66CE7M.mjs";
import "./chunk-TZ37NZTQ.mjs";
import "./chunk-7V2KMXP6.mjs";
import {
  DaemonClient
} from "./chunk-2TFVZNRC.mjs";
import {
  readBadge
} from "./chunk-3Q4ZQBZ5.mjs";
import "./chunk-2VH6ARCZ.mjs";
import "./chunk-WQM4JKAS.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-5WY6FU4O.mjs";
import "./chunk-SK2Q2R2T.mjs";
import "./chunk-PEND2SUF.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-64KOQR6N.mjs";
import "./chunk-R2IWRWFV.mjs";
import {
  normalizeHomeUrl
} from "./chunk-OIUPO6NH.mjs";
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
