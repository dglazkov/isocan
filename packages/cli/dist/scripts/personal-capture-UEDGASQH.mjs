import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-MOWNENGJ.mjs";
import {
  DaemonClient
} from "./chunk-SVIVW65S.mjs";
import "./chunk-MKGUBRAR.mjs";
import "./chunk-ZQY6V4CF.mjs";
import "./chunk-JXBDCJ4M.mjs";
import "./chunk-QWD5KSU6.mjs";
import "./chunk-SJR64PFS.mjs";
import "./chunk-GVRC6KUY.mjs";
import "./chunk-77VKD72U.mjs";
import "./chunk-22LKPAT5.mjs";
import {
  readBadge
} from "./chunk-P5BFYJ7X.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-ROZBGXHT.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-LEL3H6I6.mjs";
import {
  normalizeHomeUrl
} from "./chunk-57O6725J.mjs";
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
