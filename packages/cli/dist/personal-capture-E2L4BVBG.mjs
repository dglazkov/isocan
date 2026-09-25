import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-7O7QAF55.mjs";
import "./chunk-7PFO37TI.mjs";
import "./chunk-DDPJQAGY.mjs";
import "./chunk-BQVOEZFK.mjs";
import "./chunk-5ULWRB2Z.mjs";
import "./chunk-YNJTEHAI.mjs";
import {
  DaemonClient
} from "./chunk-4NSSXRJA.mjs";
import {
  readBadge
} from "./chunk-YNCXTOJF.mjs";
import "./chunk-36FSNDO6.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-WE7NRBCO.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-TWYWFC6Y.mjs";
import "./chunk-HDRQD7VJ.mjs";
import "./chunk-24RYMSE5.mjs";
import {
  normalizeHomeUrl
} from "./chunk-GXGIYXSG.mjs";
import "./chunk-ZRGI5I2I.mjs";
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
