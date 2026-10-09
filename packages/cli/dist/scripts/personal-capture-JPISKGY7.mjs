import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-QQIFKJBV.mjs";
import {
  DaemonClient
} from "./chunk-4UAMB3SM.mjs";
import "./chunk-CBV4IVJD.mjs";
import "./chunk-IRCGWTAH.mjs";
import "./chunk-OTVCOQZP.mjs";
import "./chunk-6Y26LKRU.mjs";
import "./chunk-N74MERS4.mjs";
import "./chunk-M7J4WYJL.mjs";
import "./chunk-NEAXDUTY.mjs";
import "./chunk-OEAJGLQG.mjs";
import {
  readBadge
} from "./chunk-TUWNNCX7.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-LIQBQSRC.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-W5GVIPWG.mjs";
import {
  normalizeHomeUrl
} from "./chunk-CJVUBGKB.mjs";
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
