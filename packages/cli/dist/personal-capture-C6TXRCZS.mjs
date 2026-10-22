import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-Z6FU4TWA.mjs";
import "./chunk-6ODFFHQS.mjs";
import "./chunk-IACZ2XD4.mjs";
import "./chunk-XADNJBIP.mjs";
import {
  DaemonClient
} from "./chunk-TGEUHMAZ.mjs";
import {
  readBadge
} from "./chunk-KTH6S5NZ.mjs";
import "./chunk-J4YDZ54V.mjs";
import "./chunk-E6ZR3QG6.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-KY4VV36V.mjs";
import "./chunk-7RRKYY5L.mjs";
import "./chunk-GPT3FO42.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-6FMLGHHK.mjs";
import "./chunk-VFQYODOV.mjs";
import {
  normalizeHomeUrl
} from "./chunk-EHZ6WK53.mjs";
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
