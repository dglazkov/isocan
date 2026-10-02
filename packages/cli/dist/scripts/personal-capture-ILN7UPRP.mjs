import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-AVI7H7TZ.mjs";
import {
  DaemonClient
} from "./chunk-2LEGXQ36.mjs";
import "./chunk-3BMCZZ6Y.mjs";
import "./chunk-754LFRFK.mjs";
import "./chunk-DTVWZXQI.mjs";
import "./chunk-ABVIG6AP.mjs";
import "./chunk-CFQCQCWE.mjs";
import "./chunk-BL2K3WDN.mjs";
import "./chunk-PCVZCS7J.mjs";
import "./chunk-DX6HWOKO.mjs";
import {
  readBadge
} from "./chunk-IOMKHILL.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-ULCFVEWX.mjs";
import "./chunk-OUU6V4OT.mjs";
import "./chunk-2ZAY35XO.mjs";
import "./chunk-TJPEVR5E.mjs";
import {
  normalizeHomeUrl
} from "./chunk-6WDN4JT6.mjs";
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
