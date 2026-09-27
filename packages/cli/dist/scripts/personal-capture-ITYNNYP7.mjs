import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-HPG5YN42.mjs";
import {
  DaemonClient
} from "./chunk-XH4SMP3M.mjs";
import "./chunk-YS3NTFOQ.mjs";
import "./chunk-XKRQQCBW.mjs";
import "./chunk-D6OI2VQ7.mjs";
import "./chunk-RZECGKZX.mjs";
import "./chunk-O4O7IO34.mjs";
import "./chunk-2RUYS4QA.mjs";
import "./chunk-ZJQDKT7L.mjs";
import "./chunk-VFFI533S.mjs";
import {
  readBadge
} from "./chunk-XN64NIOR.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-ZKXIFSZV.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-5ZGGLCES.mjs";
import {
  normalizeHomeUrl
} from "./chunk-LFRJZAP3.mjs";
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
