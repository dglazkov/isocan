import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-REGHUQIN.mjs";
import "./chunk-JQFLFOK2.mjs";
import {
  DaemonClient
} from "./chunk-YQPWVWY6.mjs";
import {
  readBadge
} from "./chunk-CMW7IDP4.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-65MZXJNN.mjs";
import "./chunk-4RG6GMP3.mjs";
import "./chunk-7OTJMXWA.mjs";
import "./chunk-QITKL35M.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-S732QFEW.mjs";
import "./chunk-AGNDM72Z.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-ZZTK7V62.mjs";
import "./chunk-3WWY372N.mjs";
import "./chunk-OS7Q6SM6.mjs";
import "./chunk-OUU6V4OT.mjs";
import {
  normalizeHomeUrl
} from "./chunk-DFRDSUN6.mjs";
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
