import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-MHTC6M2Z.mjs";
import "./chunk-JFYLXRTB.mjs";
import {
  DaemonClient
} from "./chunk-IMOWEALO.mjs";
import {
  readBadge
} from "./chunk-DACMKLUD.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-LPVDL455.mjs";
import "./chunk-J6AZYFV5.mjs";
import "./chunk-D3KRUJBU.mjs";
import "./chunk-KM4AZWN5.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-62SGM47M.mjs";
import "./chunk-6EADFTCK.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-NVZ2M57T.mjs";
import "./chunk-K543DD4C.mjs";
import "./chunk-ZFRYAQLF.mjs";
import "./chunk-OUU6V4OT.mjs";
import {
  normalizeHomeUrl
} from "./chunk-7S2PYKPX.mjs";
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
