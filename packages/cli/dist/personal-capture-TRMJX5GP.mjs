import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-GW54XKLF.mjs";
import "./chunk-GYY23MI4.mjs";
import "./chunk-HJI22KRE.mjs";
import "./chunk-ICQIH6WH.mjs";
import {
  DaemonClient
} from "./chunk-574LRMCJ.mjs";
import {
  readBadge
} from "./chunk-UBYXGBKB.mjs";
import "./chunk-L6L6DUAG.mjs";
import "./chunk-TOM63E53.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-B7GOFWMP.mjs";
import "./chunk-5KCS26LU.mjs";
import "./chunk-LURQ2TAD.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-OAHZM6DP.mjs";
import "./chunk-63EZO3RM.mjs";
import {
  normalizeHomeUrl
} from "./chunk-H363BMQD.mjs";
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
