import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-PWHONYKN.mjs";
import "./chunk-IYHZMBAH.mjs";
import "./chunk-DRPM5NJ5.mjs";
import "./chunk-I4SZESWD.mjs";
import {
  DaemonClient
} from "./chunk-VA7EFNT6.mjs";
import {
  readBadge
} from "./chunk-CL3SRBZR.mjs";
import "./chunk-JLIU3E5A.mjs";
import "./chunk-OQFJARFL.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-ZJBXRZ6P.mjs";
import "./chunk-UMU3UG3X.mjs";
import "./chunk-VCXMTK6I.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-C2NOCPN5.mjs";
import "./chunk-BNXN2D3X.mjs";
import {
  normalizeHomeUrl
} from "./chunk-MIMXUUWC.mjs";
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
