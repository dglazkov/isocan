import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-6IABNJPW.mjs";
import "./chunk-6IQ2U75S.mjs";
import "./chunk-WHDM4LLM.mjs";
import "./chunk-XCY5HUD6.mjs";
import {
  DaemonClient
} from "./chunk-RU4GLYPE.mjs";
import {
  readBadge
} from "./chunk-P6KJP2O6.mjs";
import "./chunk-ZOLN6GIO.mjs";
import "./chunk-G2HHBIVO.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-MM7VOA4O.mjs";
import "./chunk-YEQVZ6C6.mjs";
import "./chunk-72NYZBNR.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-3SAA67ZD.mjs";
import "./chunk-QA4LDJ2F.mjs";
import {
  normalizeHomeUrl
} from "./chunk-QL5EVFHO.mjs";
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
