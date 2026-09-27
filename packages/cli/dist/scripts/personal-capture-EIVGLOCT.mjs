import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-UZARVAWQ.mjs";
import {
  DaemonClient
} from "./chunk-RCYSCLCJ.mjs";
import "./chunk-L2IN3BZC.mjs";
import "./chunk-M34WHR6Q.mjs";
import "./chunk-2YOJ3IMA.mjs";
import "./chunk-Z4JAT7NR.mjs";
import "./chunk-EPBXTW7E.mjs";
import "./chunk-ELRRDXJ4.mjs";
import "./chunk-RRPCZJG5.mjs";
import "./chunk-BUX5CCVT.mjs";
import {
  readBadge
} from "./chunk-GUX5S3GR.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-WH6REG5Q.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-EYPZKVPY.mjs";
import {
  normalizeHomeUrl
} from "./chunk-SYSFKFLG.mjs";
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
