import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-PDJTMYSJ.mjs";
import "./chunk-7SZFXDGM.mjs";
import "./chunk-BQ6PCFX7.mjs";
import "./chunk-UUJSN3CM.mjs";
import "./chunk-HKKKQXTQ.mjs";
import "./chunk-XDW2SVZ2.mjs";
import {
  DaemonClient
} from "./chunk-PVQVFPRO.mjs";
import {
  readBadge
} from "./chunk-SAH2PPRZ.mjs";
import "./chunk-NHSYTBRW.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-DCHUM2IO.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-X4PVFWLY.mjs";
import "./chunk-C5F6ZE45.mjs";
import "./chunk-KEV4Z5CD.mjs";
import {
  normalizeHomeUrl
} from "./chunk-JM775MAC.mjs";
import "./chunk-TE337AEY.mjs";
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
