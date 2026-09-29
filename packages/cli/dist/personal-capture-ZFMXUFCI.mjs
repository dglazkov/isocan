import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-UIMCRJWC.mjs";
import "./chunk-HS7FWJFC.mjs";
import "./chunk-GKAHL2UM.mjs";
import "./chunk-JPU6PSNO.mjs";
import "./chunk-QUZ4CMLU.mjs";
import "./chunk-E2MOKWRI.mjs";
import {
  DaemonClient
} from "./chunk-O7KEGQYP.mjs";
import {
  readBadge
} from "./chunk-T6HPJCMP.mjs";
import "./chunk-EU4OU4UO.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-QMBZH3IX.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-MYGTPCNG.mjs";
import "./chunk-CHFMVPAZ.mjs";
import "./chunk-7SXFVNYT.mjs";
import {
  normalizeHomeUrl
} from "./chunk-UI3YG6YD.mjs";
import "./chunk-GUY4UN4O.mjs";
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
