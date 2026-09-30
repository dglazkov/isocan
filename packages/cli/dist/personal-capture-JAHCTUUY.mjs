import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import "./chunk-LXUEVXFZ.mjs";
import "./chunk-AN6I476M.mjs";
import "./chunk-SBJA75XS.mjs";
import "./chunk-BMBEEQYP.mjs";
import "./chunk-GDR4XZZ2.mjs";
import "./chunk-QF2TOWOR.mjs";
import {
  DaemonClient
} from "./chunk-DFDHCNT6.mjs";
import {
  readBadge
} from "./chunk-7XVNURUX.mjs";
import "./chunk-3FMZIBLS.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-FBIJNKMS.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-G3CG6XIB.mjs";
import "./chunk-V7WWGRVW.mjs";
import "./chunk-2IL57OX5.mjs";
import {
  normalizeHomeUrl
} from "./chunk-SLCSB4GO.mjs";
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
