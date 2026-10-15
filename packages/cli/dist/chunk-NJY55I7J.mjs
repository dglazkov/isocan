import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  currentVersionOf,
  rebuildPrototypes,
  writeWire
} from "./chunk-EVZRDNOU.mjs";
import {
  DEFAULT_STYLE,
  ROLES,
  applyMapping,
  candidatesOf,
  mappingRequest,
  roleLine,
  sameLook,
  sameStyle
} from "./chunk-LC6CUN6Z.mjs";
import {
  JEV_INPUT_PRICE
} from "./chunk-TTS2OUSZ.mjs";
import {
  newGroupId,
  selectDesignSystem
} from "./chunk-FJTW2HDB.mjs";
import {
  designSurface,
  parseDesign
} from "./chunk-K4TDP4L5.mjs";

// packages/modules/wireframe/src/restyle.ts
function governingSystem(canvas, item) {
  const selected = selectDesignSystem(canvas, { at: item });
  return selected.status === "selected" ? selected.item : null;
}
var StyleResolver = class {
  constructor(port, answerer, loadKnown, onAsked) {
    this.port = port;
    this.answerer = answerer;
    this.loadKnown = loadKnown;
    this.onAsked = onAsked;
  }
  port;
  answerer;
  loadKnown;
  onAsked;
  mappings = /* @__PURE__ */ new Map();
  calls = 0;
  inputTokens = 0;
  by = "";
  known = null;
  async styleFor(system) {
    if (!system) return DEFAULT_STYLE;
    const m = await this.mapping(system);
    return { source: "design-system", itemId: system.id, versionId: m.versionId, name: m.name, ...m.by ? { by: m.by } : {}, roles: m.roles, ...m.surface !== "flat" ? { surface: m.surface } : {} };
  }
  /** A mapping on the canvas may be lent to this run: anything Jev (or nobody) answered; a stub's only to the stub. */
  lendable(style, system, versionId) {
    if (style?.source !== "design-system" || style.itemId !== system.id || style.versionId !== versionId) return false;
    return !style.by?.startsWith("stub") || this.answerer.name === "stub";
  }
  async mapping(system) {
    const current = currentVersionOf(system);
    if (!current) throw new Error(`the design system "${system.title}" has no version to read`);
    const key = `${system.id}@${current.id}`;
    const cached = this.mappings.get(key);
    if (cached) return cached;
    const base = {
      system,
      versionId: current.id,
      version: system.versions.findIndex((v) => v.id === current.id) + 1,
      versions: system.versions.length
    };
    this.known ??= [...await this.loadKnown()];
    const lent = this.known.find((s) => this.lendable(s.style, system, current.id));
    const doc = parseDesign(await this.port.readText(current.blobHash));
    const name = doc.tokens.name ?? system.title;
    const surface = designSurface(doc.tokens);
    if (lent?.style?.source === "design-system") {
      const m2 = { ...base, name, roles: lent.style.roles, surface, how: "reused", ...lent.style.by ? { by: lent.style.by } : {} };
      this.mappings.set(key, m2);
      return m2;
    }
    const candidates = candidatesOf(doc);
    const request = mappingRequest(doc, candidates);
    let response = { answers: {} };
    let ms;
    let by;
    const asking = Object.keys(request.questions).length > 0;
    if (asking) {
      const answered = await this.answerer.answer(request);
      response = answered.response;
      ms = answered.ms;
      by = answered.by;
      this.by = answered.by;
      this.calls += 1;
      this.inputTokens += response.usage?.input_tokens ?? 0;
      await this.onAsked?.(system, current.id, request, response);
    }
    const m = { ...base, name, roles: applyMapping(request, response, candidates), surface, how: asking ? "asked" : "nothing to ask", request, response, ...ms !== void 0 ? { ms } : {}, ...by ? { by } : {} };
    this.mappings.set(key, m);
    return m;
  }
  /** Who answers — the versioned model once one has, else the answerer's name. */
  get who() {
    return this.by || this.answerer.name;
  }
  cost() {
    return this.inputTokens * JEV_INPUT_PRICE;
  }
};
function mappingLines(m, by) {
  const named = ROLES.some((role) => m.roles[role]?.why === "named");
  const how = m.how === "asked" ? `mapped by ${m.by ?? by}${m.ms !== void 0 ? ` in ${m.ms} ms` : ""}` : m.how === "reused" ? `mapping (by ${m.by ?? "nobody \u2014 nothing to ask"}) reused from a wire already in this version \u2014 nothing asked` : named ? "its tokens are named for the wire's roles \u2014 nothing asked" : "every role had one candidate or none \u2014 nothing asked";
  return [
    `"${m.name}" \u2014 ${m.system.id}, version ${m.version} of ${m.versions} \xB7 ${how}`,
    ...ROLES.map((role) => `  ${roleLine(role, m.roles[role])}`),
    ...m.surface !== "flat" ? [`  ${"surface".padEnd(11)} ${m.surface}`] : []
  ];
}
function alreadyLooks(was, now) {
  const system = (s) => s?.source === "design-system" ? s.itemId : null;
  return system(was) === system(now) && sameLook(was, now);
}
async function restyle(port, canvas, all, screens, resolver, opts = {}) {
  const targets = [];
  for (const s of screens) {
    const item = canvas.items[s.item];
    const system = opts.toDefault ? null : governingSystem(canvas, item);
    targets.push({ screen: s, item, system, style: await resolver.styleFor(system) });
  }
  const group = opts.group ?? newGroupId();
  const changed = [];
  for (const t of targets) {
    if (sameStyle(t.screen.spec.style, t.style) || alreadyLooks(t.screen.spec.style, t.style)) continue;
    const spec = { ...t.screen.spec, style: t.style };
    if (!await writeWire(port, t.item, spec, group)) continue;
    t.screen = { ...t.screen, spec };
    changed.push(t);
  }
  const prototypes = await rebuildPrototypes(port, canvas, all, changed.map((t) => t.screen), group);
  return { group, targets, changed, prototypes, resolver };
}
function restyleSummary(r) {
  const { targets, changed, resolver } = r;
  const tail = changed.length ? " \u2014 one op group: one undo takes the restyle back" : " \u2014 nothing written";
  return `${changed.length} of ${targets.length} wires restyled \xB7 ${targets.length - changed.length} unchanged \xB7 ${resolver.calls === 0 ? "nothing asked" : `${resolver.calls} ${resolver.calls === 1 ? "call" : "calls"} to ${resolver.who} \xB7 ${resolver.inputTokens.toLocaleString("en-US")} input tokens \xB7 $${resolver.cost().toFixed(6)}`}${tail}`;
}

export {
  governingSystem,
  StyleResolver,
  mappingLines,
  restyle,
  restyleSummary
};
