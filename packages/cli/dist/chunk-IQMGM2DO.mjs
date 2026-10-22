import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  governingSystem
} from "./chunk-IWWF6GFE.mjs";
import {
  PROTOTYPE_PROP,
  currentVersionOf
} from "./chunk-G5OFTIXF.mjs";
import {
  ROLES,
  candidatesOf,
  surfaceOf
} from "./chunk-TERLGXWE.mjs";
import {
  FIDELITY_PROP
} from "./chunk-67GJIBXL.mjs";
import {
  designSurface,
  parseDesign
} from "./chunk-K4TDP4L5.mjs";

// packages/modules/wireframe/src/behind.ts
function checkState(spec, system, doc) {
  const s = spec.style;
  if (!system) return s?.source === "design-system" ? "no system governs" : "current";
  if (s?.source !== "design-system") return "not in it yet";
  if (s.itemId !== system.id) return "other system";
  if (s.versionId === system.currentVersionId) return "current";
  return doc && stillDraws(s, doc) ? "current" : "behind";
}
function stillDraws(style, doc) {
  if (designSurface(doc.tokens) !== surfaceOf(style)) return false;
  const now = candidatesOf(doc);
  for (const role of ROLES) {
    const was = style.roles[role];
    if (was?.token !== void 0) {
      if (!now[role].some((c) => c.token === was.token && c.value === was.value)) return false;
    } else if (!was || was.why === "none") {
      if (now[role].length > 0) return false;
    }
  }
  return true;
}
function checkWire(canvas, item, spec, docOf) {
  const system = governingSystem(canvas, item);
  const drawn = spec.style?.source === "design-system" ? spec.style : null;
  const index = drawn ? canvas.items[drawn.itemId]?.versions.findIndex((v) => v.id === drawn.versionId) : void 0;
  return {
    itemId: item.id,
    state: checkState(spec, system, system ? docOf?.(system) : void 0),
    governedBy: system ? { itemId: system.id, title: system.title, version: system.versions.findIndex((v) => v.id === system.currentVersionId) + 1, versions: system.versions.length } : null,
    drawnBy: drawn ? { itemId: drawn.itemId, version: index !== void 0 && index >= 0 ? index + 1 : null, name: drawn.name ?? null } : "default"
  };
}
function checkWords(c) {
  const d = c.drawnBy;
  const was = typeof d === "string" ? "the default look" : `"${d.name ?? d.itemId}" version ${d.version ?? "?"}`;
  const is = c.governedBy ? `"${c.governedBy.title}" version ${c.governedBy.version} of ${c.governedBy.versions}` : "no system";
  return `${c.state}: drawn in ${was}, governed by ${is}`;
}
function systemName(c) {
  return typeof c.drawnBy !== "string" && c.drawnBy.name ? c.drawnBy.name : c.governedBy?.title ?? "its design system";
}
function restyleLabel(c) {
  return `Restyle to ${systemName(c)}`;
}
function behindCount(n) {
  return `${n} wire${n === 1 ? "" : "s"} behind`;
}
function restyleArgs(itemIds) {
  return `style system ${itemIds.join(" ")}`;
}
function isWire(item) {
  return item.properties?.[FIDELITY_PROP] === "wireframe" && item.properties?.[PROTOTYPE_PROP] === void 0;
}
function specKey(item) {
  const v = currentVersionOf(item);
  return v && v.mimeType === "text/html" ? v.blobHash : null;
}
function wiresBehind(canvas, specOf, docOf) {
  const out = [];
  for (const item of Object.values(canvas.items)) {
    if (!isWire(item)) continue;
    const key = specKey(item);
    const spec = key ? specOf(key) : null;
    if (!spec) continue;
    const system = governingSystem(canvas, item);
    if (system && docOf(system) === void 0) continue;
    const c = checkWire(canvas, item, spec, docOf);
    if (c.state === "behind") out.push(c);
  }
  return out;
}
async function readSystemDoc(system, readText) {
  const v = currentVersionOf(system);
  if (!v) return null;
  try {
    return parseDesign(await readText(v.blobHash));
  } catch {
    return null;
  }
}
function systemsToRead(canvas, specOf) {
  const out = /* @__PURE__ */ new Map();
  for (const item of Object.values(canvas.items)) {
    if (!isWire(item)) continue;
    const key = specKey(item);
    const s = key ? specOf(key)?.style : void 0;
    if (s?.source !== "design-system") continue;
    const system = governingSystem(canvas, item);
    if (system && system.id === s.itemId && system.currentVersionId !== s.versionId) out.set(system.id, system);
  }
  return [...out.values()];
}
async function readWiresBehind(canvas, readText) {
  const { readWire } = await import("./render-FFAVAJRZ.mjs");
  const specs = /* @__PURE__ */ new Map();
  await Promise.all(Object.values(canvas.items).filter(isWire).map(async (item) => {
    const key = specKey(item);
    if (!key || specs.has(key)) return;
    try {
      specs.set(key, readWire(await readText(key)));
    } catch {
      specs.set(key, null);
    }
  }));
  const specOf = (hash) => specs.get(hash) ?? null;
  const docs = /* @__PURE__ */ new Map();
  for (const system of systemsToRead(canvas, specOf)) docs.set(system.id, await readSystemDoc(system, readText));
  return wiresBehind(canvas, specOf, (system) => docs.has(system.id) ? docs.get(system.id) : null).map((c) => ({ title: canvas.items[c.itemId]?.title || c.itemId, system: systemName(c) }));
}

export {
  checkState,
  stillDraws,
  checkWire,
  checkWords,
  systemName,
  restyleLabel,
  behindCount,
  restyleArgs,
  isWire,
  specKey,
  wiresBehind,
  readSystemDoc,
  systemsToRead,
  readWiresBehind
};
