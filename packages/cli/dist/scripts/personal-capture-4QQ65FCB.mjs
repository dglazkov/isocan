import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-IQKMR7S4.mjs";
import {
  DaemonClient
} from "./chunk-LUMWOEM3.mjs";
import "./chunk-XBT2BIY3.mjs";
import "./chunk-NWCBGVTC.mjs";
import "./chunk-RMH457EK.mjs";
import "./chunk-4UM3ZPBN.mjs";
import "./chunk-DX6DX4JA.mjs";
import "./chunk-MZVHMXAE.mjs";
import "./chunk-SDL4BW4B.mjs";
import "./chunk-KCGA7ANS.mjs";
import {
  readBadge
} from "./chunk-KI22HZJB.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-HNVRLPJY.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-4WRVPGQ7.mjs";
import {
  normalizeHomeUrl
} from "./chunk-AS7C522N.mjs";
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
