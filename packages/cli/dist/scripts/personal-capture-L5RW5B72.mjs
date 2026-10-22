import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-SDZLLFP4.mjs";
import {
  DaemonClient
} from "./chunk-RRXYXD2T.mjs";
import "./chunk-R55W4WOO.mjs";
import "./chunk-OLUFWXTW.mjs";
import "./chunk-YZMH56YP.mjs";
import "./chunk-3E5AQUBV.mjs";
import "./chunk-3BSD5B27.mjs";
import "./chunk-L6C5UQFH.mjs";
import "./chunk-O53B4TLY.mjs";
import "./chunk-OJQD2PJP.mjs";
import "./chunk-BQKI6ES6.mjs";
import {
  readBadge
} from "./chunk-QQ5XXMLS.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-IU2VT5UX.mjs";
import "./chunk-OUU6V4OT.mjs";
import {
  normalizeHomeUrl
} from "./chunk-HYLJ757N.mjs";
import "./chunk-7OLMWXEB.mjs";
import "./chunk-2ZAY35XO.mjs";
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
