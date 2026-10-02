import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  DEFAULT_STYLE,
  DENSITY_LEVELS,
  GENERIC_PACK,
  LEAVE_OUT,
  PACKS,
  PACK_BY_ID,
  PLATFORMS,
  PROTOTYPE_CLEAR,
  RECIPES,
  ROLES,
  TEMPLATE_IDS,
  applyCopy,
  applyMapping,
  applyPropsRound,
  applyStructure,
  barsSpec,
  blockContentSchema,
  candidatesOf,
  chromeFor,
  copyAiOnCanvas,
  copyOf,
  currentVersionOf,
  decideFlow,
  firstChoices,
  fleshSpec,
  flowScreen,
  isBlueprint,
  keepPatch,
  keptFlowsOf,
  mappingRequest,
  nameFlowOnCanvas,
  packOf,
  pendingRound,
  readWire,
  rebuildPrototypes,
  recipe,
  refill,
  renderWire,
  requestBlueprint,
  resolveSlot,
  resolveTextGenerator,
  roleLine,
  roundCalls,
  sameLook,
  sameStyle,
  seedKey,
  validateCopyPayload,
  wireBy,
  wireSize,
  wireTitle,
  writePrototype,
  writeWire
} from "./chunk-Q6BPKXZA.mjs";
import {
  wireCopyFile
} from "./chunk-MC63Q3EX.mjs";
import {
  resolveKey,
  resolveTextKey
} from "./chunk-4JGK7HA2.mjs";
import {
  DEFAULT_CONFIDENCE_FLOOR,
  DEFAULT_ENTROPY_GATE,
  JEV_INPUT_PRICE,
  JEV_MODEL,
  PriorityGate,
  chosenOption,
  gatedChoice,
  homeAnswerer,
  homeOrStub,
  jevAnswerer,
  stubAnswerer
} from "./chunk-CV3IWSGG.mjs";
import {
  FIDELITY_PROP,
  groupContentBox,
  groupDescendants,
  newGroupId,
  newItemId,
  newVersionId,
  selectDesignSystem,
  titleSlug
} from "./chunk-KVFS2HGY.mjs";
import {
  designSurface,
  parseDesign
} from "./chunk-K4TDP4L5.mjs";

// packages/modules/wireframe/src/flesh-cli.ts
import { readFile } from "node:fs/promises";

// packages/modules/wireframe/src/cli-port.ts
function cliPort(host, ctx, canvasId) {
  return {
    canvasId,
    // Read lazily: the actor is a getter that demands a name, and a read-only verb has no need of one.
    get actor() {
      try {
        return { id: ctx.actor.id, name: ctx.actor.name };
      } catch {
        return void 0;
      }
    },
    canvas: async () => (await ctx.client.snapshot(canvasId)).canvas,
    readText: async (blobHash) => Buffer.from(await ctx.client.downloadBlob(canvasId, blobHash)).toString("utf8"),
    put: async (text, mimeType, filename) => {
      const upload = await ctx.client.uploadBlob(canvasId, Buffer.from(text, "utf8"), mimeType, filename);
      return { blobHash: upload.blobHash, size: upload.size };
    },
    send: async (op, group) => {
      const result = await host.sendOp(ctx, canvasId, op, group);
      if (op.type !== "item.add") return;
      const at = host.insertionReceiptPlacement(result.envelope.op, op.itemId);
      return { x: at.x ?? 0, y: at.y ?? 0 };
    }
  };
}
function localJevKey() {
  return resolveKey("typesafe")?.key;
}
function localTextKey() {
  return resolveTextKey();
}
function cliAnswerer(ctx, canvasId, name, seed, say) {
  const key = localJevKey();
  const chosen = name ?? (key ? "jev" : "home");
  if (chosen === "stub") return stubAnswerer(seed);
  if (chosen === "jev") return jevAnswerer({ key });
  if (chosen !== "home") throw new Error(`--answerer must be jev, home, stub or agent \u2014 got: ${chosen}`);
  const home = homeAnswerer((question) => ctx.client.judgment(question), canvasId);
  if (name === "home") return home;
  return homeOrStub(home, stubAnswerer(seed), () => say(`the home has no judge either (judgment-unavailable) \u2014 answering with the stub (seed ${seed}), random and honest about it`));
}

// packages/modules/wireframe/src/content/choose.ts
var PACK_FLOOR = 0.4;
function packRequest(request) {
  return {
    model: JEV_MODEL,
    state: { request },
    questions: {
      pack: {
        type: "choice",
        instructions: "Which domain does the product in the request belong to? Its screens will be filled with that domain's sample nouns, people, numbers and pictures. Choose generic when no other fits.",
        criteria: Object.fromEntries(PACKS.map((p) => [p.id, `${p.name}: ${p.about}`]))
      }
    }
  };
}
function readPackChoice(request, response, by) {
  const { value, p, distribution } = chosenOption(request.questions.pack, response.answers.pack);
  const known = PACK_BY_ID.has(value) ? value : GENERIC_PACK;
  return { pack: p >= PACK_FLOOR ? known : GENERIC_PACK, p, leaned: known, by, how: "asked", distribution, inputTokens: response.usage?.input_tokens ?? 0 };
}
async function choosePack(answerer, request) {
  const req = packRequest(request);
  const answered = await answerer.answer(req);
  return { ...readPackChoice(req, answered.response, answered.by), ms: answered.ms };
}
function flagPack(id) {
  if (!PACK_BY_ID.has(id)) throw new Error(`no pack "${id}" \u2014 the packs are: ${PACKS.map((p) => p.id).join(", ")}`);
  return { pack: id, p: 1, leaned: id, by: "--pack", how: "flag" };
}
function packLine(c, flowWords) {
  const name = PACK_BY_ID.get(c.pack)?.name ?? c.pack;
  if (c.how === "flag") return `pack: ${c.pack} (${name}) \u2014 chosen with --pack \xB7 ${flowWords}`;
  if (c.how === "reused") return `pack: ${c.pack} (${name}) \u2014 already on these screens, nothing asked \xB7 ${flowWords}`;
  const top = Object.entries(c.distribution ?? {}).sort((a, b) => b[1] - a[1]).slice(1, 3).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(", ");
  const under = c.p < PACK_FLOOR ? ` \u2014 under ${PACK_FLOOR}, so the generic pack fills${c.leaned !== c.pack ? ` (--pack ${c.leaned} to take the lean)` : ""}` : "";
  return `pack: ${c.leaned} p ${c.p.toFixed(2)}${top ? ` (then ${top})` : ""}${under} \xB7 chosen by ${c.by} \xB7 ${flowWords}`;
}

// packages/modules/wireframe/src/flesh.ts
function packOnCanvas(all, flow) {
  for (const s of all) {
    const c = s.spec.content;
    if (s.spec.flow !== flow || !c || !c.pack) continue;
    return { pack: c.pack, p: c.source === "pack" ? c.p ?? 1 : 1, leaned: c.pack, by: c.source === "pack" ? c.by ?? "" : c.by, how: "reused" };
  }
  return null;
}
async function packFor(answerer, all, flow, request, flag) {
  if (flag !== void 0) return flagPack(flag);
  const lent = packOnCanvas(all, flow);
  if (lent) return lent;
  if (!request.trim()) return { pack: GENERIC_PACK, p: 1, leaned: GENERIC_PACK, by: "nobody \u2014 no request to choose from", how: "flag" };
  return choosePack(answerer, request);
}
async function flesh(port, canvas, all, screens, answerer, opts = {}) {
  const group = opts.group ?? newGroupId();
  const choices = /* @__PURE__ */ new Map();
  let calls = 0;
  let inputTokens = 0;
  if (!opts.bars) {
    const flows = /* @__PURE__ */ new Map();
    for (const s of screens) if (!isBlueprint(s.spec) && !flows.has(s.spec.flow)) flows.set(s.spec.flow, s.spec.request);
    await Promise.all([...flows].map(async ([flow, request]) => {
      const choice = await packFor(answerer, all, flow, request, opts.pack);
      if (choice.how === "asked") {
        calls += 1;
        inputTokens += choice.inputTokens ?? 0;
      }
      choices.set(flow, choice);
    }));
  }
  const targets = screens.map((screen) => {
    const spec = screen.spec;
    if (!opts.bars && isBlueprint(spec)) return { screen, spec, skipped: "blueprint" };
    if (spec.content?.source === "copy" && !opts.bars && opts.pack === void 0) return { screen, spec, skipped: "copy" };
    if (opts.bars) return { screen, spec: barsSpec(spec) };
    const c = choices.get(spec.flow);
    const meta = c.how === "reused" ? { ...spec.content?.source === "pack" ? { p: spec.content.p, by: spec.content.by } : { p: c.p, by: c.by } } : { p: c.p, by: c.by };
    return { screen, spec: fleshSpec(spec, seedKey(spec, screen.item), packOf(c.pack), meta) };
  });
  const changed = [];
  for (const t of targets) {
    if (t.skipped || JSON.stringify(t.spec) === JSON.stringify(t.screen.spec)) continue;
    if (await writeWire(port, canvas.items[t.screen.item], t.spec, group, t.screen.spec)) changed.push(t);
  }
  const prototypes = await rebuildPrototypes(port, canvas, all, changed.map((t) => ({ item: t.screen.item, spec: t.spec })), group);
  return { group, targets, changed, choices, prototypes, calls, inputTokens };
}
function fleshLines(r) {
  const out = [];
  for (const [flow, choice] of r.choices) {
    const n = r.targets.filter((t) => t.screen.spec.flow === flow && !t.skipped).length;
    out.push(packLine(choice, `${n} screen${n === 1 ? "" : "s"} in flow ${flow || "(hand-drawn)"}`));
  }
  const copy = r.targets.filter((t) => t.skipped === "copy");
  const blue = r.targets.filter((t) => t.skipped === "blueprint");
  if (copy.length) out.push(`${copy.length} screen${copy.length === 1 ? "" : "s"} keep${copy.length === 1 ? "s" : ""} the exact words written for ${copy.length === 1 ? "it" : "them"} (${copy.map((t) => wireTitle(t.screen.spec)).join(", ")}) \u2014 --pack <id> or --bars replaces them`);
  if (blue.length) out.push(`${blue.length} blueprint${blue.length === 1 ? "" : "s"} left blue \u2014 nothing is chosen to fill yet`);
  for (const p of r.prototypes) out.push(`prototype ${p.itemId} \u2014 ${p.what === "versioned" ? "rebuilt as a new version" : p.what}`);
  return out;
}
function fleshSummary(r, bars) {
  const tail = r.changed.length ? " \u2014 one op group: one undo takes it back" : " \u2014 nothing written";
  const asked = r.calls === 0 ? "nothing asked" : `${r.calls} ${r.calls === 1 ? "call" : "calls"} \xB7 ${r.inputTokens.toLocaleString("en-US")} input tokens \xB7 $${(r.inputTokens * JEV_INPUT_PRICE).toFixed(6)}`;
  return `${r.changed.length} of ${r.targets.length} wires ${bars ? "back to bars" : "fleshed"} \xB7 ${r.targets.length - r.changed.length} unchanged \xB7 ${asked}${tail}`;
}

// packages/modules/wireframe/src/entropy-ask.ts
var ROOT_GATE_KEYS = ["platform", "pack", "style.direction"];
var ROOT_PROMPTS = {
  platform: "Which platform should this flow target?",
  pack: "Which domain content pack fits this request best?",
  "style.direction": "Which visual style direction should govern this flow?"
};
function parsePinFlags(flags) {
  const out = {};
  if (!flags) return out;
  for (const raw of flags) {
    const eq = raw.indexOf("=");
    if (eq <= 0 || eq === raw.length - 1) {
      throw new Error(`--pin "${raw}" must be key=value (for example: --pin platform=web)`);
    }
    const key = raw.slice(0, eq).trim();
    const value = raw.slice(eq + 1).trim();
    if (!key || !value) {
      throw new Error(`--pin "${raw}" must have a non-empty key and value`);
    }
    out[key] = value;
  }
  return out;
}
function gateFlowDecision(req, res, opts = {}) {
  const resolved = { ...opts.pinned ?? {} };
  const asks = [];
  for (const key of ROOT_GATE_KEYS) {
    const q = req.questions[key];
    const a = res.answers[key];
    if (!q || !a) continue;
    const gated = gatedChoice(q, a, {
      ...opts.pinned?.[key] !== void 0 ? { pinned: opts.pinned[key] } : {},
      ...opts.noAsk !== void 0 ? { noAsk: opts.noAsk } : {},
      maxEntropyBits: opts.maxEntropyBits ?? DEFAULT_ENTROPY_GATE,
      minConfidence: opts.minConfidence ?? DEFAULT_CONFIDENCE_FLOOR,
      topK: 3
    });
    resolved[key] = gated.value;
    if (gated.status === "ask") {
      asks.push({
        key,
        prompt: ROOT_PROMPTS[key],
        entropy: gated.entropy,
        options: gated.options,
        chosen: gated.value
      });
    }
  }
  return { resolved, asks };
}
function formatAskComment(q) {
  const opts = q.options.map((o) => `${o.value} (${Math.round(o.p * 100)}%)`).join(" \xB7 ");
  return `/ask ${q.prompt} [entropy ${q.entropy.toFixed(2)} bits] \u2014 ${opts}`;
}
function applyPinnedToSpecs(specs, pinned) {
  if (!pinned || Object.keys(pinned).length === 0) return [...specs];
  const pinnedPlatform = PLATFORMS.includes(pinned.platform) ? pinned.platform : void 0;
  const pinnedTemplate = TEMPLATE_IDS.includes(pinned.template) ? pinned.template : void 0;
  const pinnedDensity = DENSITY_LEVELS.includes(pinned.density) ? pinned.density : void 0;
  return specs.map((spec) => ({
    ...spec,
    ...pinnedPlatform ? { platform: pinnedPlatform } : {},
    ...pinnedTemplate ? { template: pinnedTemplate } : {},
    ...pinnedDensity ? { density: pinnedDensity } : {},
    pinned: { ...spec.pinned ?? {}, ...pinned }
  }));
}

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

// packages/modules/wireframe/src/vary.ts
var VARIATION_FLOOR = 0.1;
var DEFAULT_VARIATIONS = 2;
function decisions(spec) {
  const r = recipe(spec.archetype);
  const out = [];
  const order = (slot) => r.sections.findIndex((s) => s.slot === slot);
  for (const slot of spec.slots) {
    if (slot.block === null) continue;
    const section = r.sections.find((s) => s.slot === slot.slot);
    if (!section || spec.chrome && chromeFor(section, spec.chrome) !== null) continue;
    const alts = slot.alternatives ?? [];
    const block = alts.find((a) => a.block !== LEAVE_OUT);
    if (block && slot.p !== void 0) {
      out.push({ slot: slot.slot, kind: "block", from: slot.block, to: block.block, p: slot.p, runnerUp: block.p });
    }
    const out_ = alts.find((a) => a.block === LEAVE_OUT);
    if (out_) out.push({ slot: slot.slot, kind: "include", from: slot.block, to: LEAVE_OUT, p: 1 - out_.p, runnerUp: out_.p });
  }
  for (const d of spec.declined ?? []) {
    out.push({ slot: d.slot, kind: "include", from: LEAVE_OUT, to: d.block, p: d.p, runnerUp: 1 - d.p });
  }
  return out.sort((a, b) => order(a.slot) - order(b.slot));
}
var same = (a, b) => a.slot === b.slot && a.from === b.from && a.to === b.to;
function honestFlips(spec, made = []) {
  const r = recipe(spec.archetype);
  const order = (slot) => r.sections.findIndex((s) => s.slot === slot);
  return decisions(spec).filter((d) => d.runnerUp >= VARIATION_FLOOR && !made.some((m) => same(m, d))).sort((a, b) => b.runnerUp - a.runnerUp || a.p - b.p || order(a.slot) - order(b.slot));
}
function vary(spec, d, variantOf) {
  const r = recipe(spec.archetype);
  let slots = spec.slots;
  let declined = spec.declined ?? [];
  if (d.kind === "block") {
    slots = slots.map((slot) => {
      if (slot.slot !== d.slot) return slot;
      const alternatives = [{ block: d.from, p: d.p }, ...(slot.alternatives ?? []).filter((a) => a.block !== d.to)].sort((a, b) => b.p - a.p);
      return {
        ...resolveSlot(r.id, slot.slot, d.to),
        p: d.runnerUp,
        alternatives,
        ...slot.region !== void 0 ? { region: slot.region } : {}
      };
    });
  } else if (d.to === LEAVE_OUT) {
    slots = slots.filter((slot) => slot.slot !== d.slot);
    declined = [...declined, { slot: d.slot, p: d.runnerUp, block: d.from }];
  } else {
    const back = { ...resolveSlot(r.id, d.slot, d.to), p: d.runnerUp, alternatives: [{ block: LEAVE_OUT, p: d.p }] };
    const at = r.sections.findIndex((s) => s.slot === d.slot);
    const before = slots.filter((slot) => r.sections.findIndex((s) => s.slot === slot.slot) < at);
    slots = [...before, back, ...slots.slice(before.length)];
    declined = declined.filter((x) => x.slot !== d.slot);
  }
  const out = {
    ...spec,
    slots,
    declined,
    variantOf,
    flip: { slot: d.slot, from: d.from, to: d.to },
    round: 3
  };
  delete out.varied;
  if (declined.length === 0) delete out.declined;
  return refill(out, variantOf, [d.slot]);
}
function variations(spec, variantOf, count = DEFAULT_VARIATIONS, made = []) {
  const room = Math.max(0, count - made.length);
  return honestFlips(spec, made).slice(0, room).map((d) => vary(spec, d, variantOf));
}

// packages/modules/wireframe/src/maybe.ts
var MAYBE_PROP = "wireMaybe";
function maybeProperties(spec) {
  return spec.maybe ? { [MAYBE_PROP]: (spec.need ?? 0).toFixed(2) } : {};
}

// packages/modules/wireframe/src/flow.ts
var GAP = 80;
function slugOf(title) {
  return titleSlug(title, { max: 60 }) || "screen";
}
var FlowCanvas = class {
  constructor(port, group) {
    this.port = port;
    this.group = group;
  }
  port;
  group;
  /** Variations this run added, in the order they landed. */
  variants = [];
  /**
   * The governing design system's mapping (design §9), stamped on every spec
   * this canvas writes that has none of its own — so a flow asked for where a
   * system governs arrives in it. Unset: the default look.
   */
  style;
  /**
   * The group every item this canvas adds lands in — `wire --in <group>`'s,
   * or the source screen's for a variation. Sent as the op's own
   * `containerId` (not inside `placement`), which both surfaces' writers read.
   */
  into;
  /**
   * The pack a composed flow fills from (design §10): stamped on every
   * screen as round 3 draws it, so the flow arrives fleshed — no second pass.
   */
  pack;
  /**
   * Who is drawing (`WireSpec.by`): stamped on every spec this canvas writes
   * once an answerer has spoken — the composer sets it when round 1 answers,
   * `wire answer` for an agent, `wire vary` from the screen it varies.
   */
  by;
  /**
   * Root decisions pinned via `--pin key=value` or `/ask` disambiguation
   * (design §12), stamped on every non-blueprint spec this flow writes.
   */
  pinned;
  styled(given, itemId) {
    const signed = this.by && given.round !== 0 ? { ...given, by: this.by } : given;
    const withPinned = given.round !== 0 ? applyPinnedToSpecs([signed], this.pinned)[0] : signed;
    const spec = this.style && withPinned.style === void 0 ? { ...withPinned, style: this.style } : withPinned;
    if (!this.pack || spec.round !== 3 || spec.content) return spec;
    return fleshSpec(spec, seedKey(spec, itemId), packOf(this.pack.pack), { p: this.pack.p, by: this.pack.by });
  }
  async version(spec) {
    const filename = `${slugOf(wireTitle(spec))}.html`;
    const upload = await this.port.put(renderWire(spec), "text/html", filename);
    return { id: newVersionId(), blobHash: upload.blobHash, mimeType: "text/html", filename, size: upload.size };
  }
  send(op) {
    return this.port.send(op, this.group);
  }
  async add(given, placement, into = this.into) {
    const itemId = newItemId();
    const spec = this.styled(given, itemId);
    const { width, height } = wireSize(spec);
    const at = await this.send({
      type: "item.add",
      itemId,
      version: await this.version(spec),
      width,
      height,
      placement,
      title: wireTitle(spec),
      // A maybe says so in the op that draws it; the canvas marks it until it is kept (maybe.ts).
      properties: { [FIDELITY_PROP]: "wireframe", ...maybeProperties(spec) },
      ...into ?? {}
    });
    const landed = at ?? placement;
    return { item: itemId, spec, x: landed.x ?? 0, y: landed.y ?? 0, width, height, ...into ? { containerId: into.containerId } : {} };
  }
  /** A new version of the same item — the screen fills in place — and its title and size if they moved. */
  async write(screen, given) {
    const spec = this.styled(given, screen.item);
    await this.send({ type: "item.addVersion", itemId: screen.item, version: await this.version(spec) });
    const maybe = maybeProperties(spec);
    const retitled = wireTitle(spec) !== wireTitle(screen.spec);
    const newlyMaybe = spec.maybe === true && !screen.spec.maybe;
    if (retitled || newlyMaybe) {
      await this.send({ type: "item.update", itemId: screen.item, patch: { ...retitled ? { title: wireTitle(spec) } : {}, ...newlyMaybe ? { properties: maybe } : {} } });
    }
    const { width, height } = wireSize(spec);
    if (width !== screen.width || height !== screen.height) await this.send({ type: "item.resize", itemId: screen.item, width, height });
    return { ...screen, spec, width, height };
  }
};
var PROTOTYPE_ROOM = PROTOTYPE_CLEAR + 1e3;
function rowStart(canvas, room = 0) {
  const items = Object.values(canvas.items ?? {});
  if (items.length === 0) return { x: 0, y: 0, chosen: true };
  const left = Math.min(...items.map((i) => i.x));
  const bottom = Math.max(...items.map((i) => i.y + i.height));
  return { x: Math.round(left), y: Math.round(bottom + 160 + room), chosen: true };
}
function rowStartIn(canvas, groupId, room = 0) {
  const group = canvas.items[groupId];
  if (!group) throw new Error(`no group ${groupId} on this canvas`);
  const inside = groupDescendants(canvas, groupId);
  if (inside.length === 0) {
    const box = groupContentBox(group);
    return { x: Math.round(box.x), y: Math.round(box.y), chosen: true };
  }
  const left = Math.min(...inside.map((i) => i.x));
  const bottom = Math.max(...inside.map((i) => i.y + i.height));
  return { x: Math.round(left), y: Math.round(bottom + 160 + room), chosen: true };
}
async function ask(answerer, round, calls, onAsked) {
  const t0 = Date.now();
  let by = answerer.name;
  const answered = await Promise.all(calls.map(async (call) => {
    if (Object.keys(call.request.questions).length === 0) return { response: { answers: {} }, asked: false };
    const a = await answerer.answer(call.request);
    by = a.by;
    return { response: a.response, asked: true };
  }));
  const ms = Date.now() - t0;
  const responses = answered.map((a) => a.response);
  await onAsked?.(round, calls, responses);
  return {
    responses,
    by,
    tally: {
      round,
      calls: answered.filter((a) => a.asked).length,
      ms,
      inputTokens: responses.reduce((sum, r) => sum + (r.usage?.input_tokens ?? 0), 0)
    }
  };
}
var pct = (p) => p === void 0 ? "\u2014" : p.toFixed(2);
var MAYBE_WORDS = "maybe \u2014 round 1 was unsure it is needed; use it in the prototype (\u{1F4D0}) or leave it";
function describeFlow(d) {
  const chosen = d.archetypes.map((a) => `${a.id} ${pct(a.p)}${a.maybe ? " (maybe)" : ""}`).join(", ");
  const declined = d.declined.map((a) => `${a.id} ${pct(a.p)}${a.why === "platform" ? ` (not on ${d.platform})` : ""}`).join(", ");
  return `flow: ${d.platform} ${pct(d.distributions.platform[d.platform])} \xB7 nav ${d.chrome.nav} ${pct(d.distributions.nav[d.chrome.nav])} \xB7 header ${d.chrome.header} ${pct(d.distributions.header[d.chrome.header])}
  screens: ${chosen}
  declined: ${declined || "none"}`;
}
function screenLine(s, note) {
  const open = s.spec.slots.filter((x) => x.block === null).length;
  const state = open === 0 ? "wireframe" : open === s.spec.slots.length ? "blueprint" : `${s.spec.slots.length - open} of ${s.spec.slots.length} slots chosen`;
  return `${s.item}  ${wireTitle(s.spec)} \u2014 ${s.spec.archetype}, ${s.spec.platform}, ${state}${note ? ` \xB7 ${note}` : ""}`;
}
async function applyRound(canvas, round, screens, calls, responses, say) {
  if (round === 1) {
    const first = screens[0];
    const decision = decideFlow(calls[0].request, responses[0]);
    say(describeFlow(decision));
    const specs2 = decision.archetypes.map((a) => flowScreen(a.id, first.spec.request, first.spec.flow, decision));
    const out2 = [await canvas.write(first, specs2[0])];
    for (const spec of specs2.slice(1)) {
      const prev = out2[out2.length - 1];
      out2.push(await canvas.add(spec, { x: prev.x + prev.width + GAP, y: prev.y, chosen: true }));
    }
    out2.forEach((s, i) => say(screenLine(s, `p(yes) ${pct(decision.archetypes[i].p)}${s.spec.maybe ? ` \xB7 ${MAYBE_WORDS}` : ""}`)));
    return out2;
  }
  const specs = round === 2 ? screens.map((screen, i) => applyStructure(screen.spec, calls[i].request, responses[i])) : applyPropsRound(screens.map((s) => s.spec), calls.map((c) => c.request), responses).map((spec) => honestFlips(spec).length === 0 ? { ...spec, varied: "none" } : spec);
  const out = [];
  for (const [i, screen] of screens.entries()) out.push(await canvas.write(screen, specs[i]));
  if (round === 3) {
    for (const s of out) {
      if (s.spec.maybe) {
        say(screenLine(s, "maybe \u2014 no variations until it is in the prototype (`wire vary` draws them)"));
        continue;
      }
      const made = await addVariations(canvas, s, [], DEFAULT_VARIATIONS);
      say(screenLine(s, s.spec.varied === "none" ? "one way to draw this" : `${made.length} variation${made.length === 1 ? "" : "s"}`));
      for (const v of made) say(`  ${screenLine(v, "")}`);
    }
  }
  return out;
}
async function addVariations(canvas, screen, siblings, count) {
  const specs = variations(screen.spec, screen.item, count, siblings.map((v) => v.spec.flip).filter(Boolean));
  const made = [];
  let bottom = Math.max(screen.y + screen.height, ...siblings.map((v) => v.y + v.height));
  const into = canvas.into ?? (screen.containerId ? { containerId: screen.containerId, groupPlacement: "exact" } : void 0);
  for (const spec of specs) {
    const v = await canvas.add(spec, { x: screen.x, y: bottom + GAP, chosen: true }, into);
    bottom = v.y + v.height;
    made.push(v);
    canvas.variants.push(v);
  }
  return made;
}
async function wiresOn(port, canvas) {
  const items = Object.values(canvas.items ?? {}).filter((i) => i.properties?.[FIDELITY_PROP] === "wireframe");
  const read = await Promise.all(items.map(async (item) => {
    const current = currentVersionOf(item);
    if (!current || current.mimeType !== "text/html") return null;
    let spec = readWire(await port.readText(current.blobHash));
    if (!spec) {
      const fallbackId = item.properties?.["wireLayer:system"] ?? item.properties?.["wireLayer:wire"];
      const fallbackVer = fallbackId ? item.versions.find((v) => v.id === fallbackId) : void 0;
      if (fallbackVer && fallbackVer.mimeType === "text/html") {
        spec = readWire(await port.readText(fallbackVer.blobHash));
      }
    }
    if (spec?.variantOf === item.id) {
      const { variantOf: _self, ...own } = spec;
      spec = own;
    }
    return spec ? { item: item.id, spec, x: item.x, y: item.y, width: item.width, height: item.height, ...item.containerId ? { containerId: item.containerId } : {} } : null;
  }));
  return read.filter((s) => s !== null);
}
async function flowsOn(port, canvas) {
  const flows = /* @__PURE__ */ new Map();
  const order = (s) => RECIPES.findIndex((r) => r.id === s.spec.archetype);
  for (const s of await wiresOn(port, canvas)) {
    if (!s.spec.flow || s.spec.variantOf) continue;
    flows.set(s.spec.flow, [...flows.get(s.spec.flow) ?? [], s]);
  }
  for (const list of flows.values()) list.sort((a, b) => order(a) - order(b));
  return flows;
}
function pickFlow(flows, wanted) {
  if (wanted) {
    const screens = flows.get(wanted);
    if (!screens) throw new Error(`no wireframe flow "${wanted}" on this canvas`);
    const round = pendingRound(screens.map((s) => s.spec));
    if (!round) throw new Error(`flow ${wanted} is drawn \u2014 every screen has answered all three rounds`);
    return { flow: wanted, screens, round };
  }
  const pending = [...flows.entries()].flatMap(([flow, screens]) => {
    const round = pendingRound(screens.map((s) => s.spec));
    return round ? [{ flow, screens, round }] : [];
  });
  if (pending.length === 0) throw new Error('no wireframe flow on this canvas is waiting on answers \u2014 `isocan wire "<request>" --answerer agent` starts one');
  return pending[pending.length - 1];
}
async function styleAt(port, itemId, mapper) {
  const canvas = await port.canvas();
  const item = canvas.items[itemId];
  const system = item ? governingSystem(canvas, item) : null;
  const style = await mapper.styleFor(system);
  if (!system) return { system, style, lines: [] };
  const m = [...mapper.mappings.values()].find((x) => x.system.id === system.id);
  const cost = mapper.calls ? ` \xB7 ${mapper.inputTokens.toLocaleString("en-US")} input tokens \xB7 $${mapper.cost().toFixed(6)}` : "";
  return { system, style, lines: [`style: in the design system that governs here${cost}`, ...mappingLines(m, mapper.who).map((l) => `  ${l}`)] };
}
async function startFlow(port, request, placement, room = 0) {
  const flow = newGroupId();
  const canvas = new FlowCanvas(port, flow);
  const { containerId, groupPlacement, ...spot } = placement ?? rowStart(await port.canvas(), room);
  if (typeof containerId === "string") canvas.into = { containerId, groupPlacement: "exact" };
  const where = typeof containerId === "string" && groupPlacement !== "exact" ? rowStartIn(await port.canvas(), containerId, room) : spot;
  const first = await canvas.add(requestBlueprint(request, flow), where);
  return { canvas, first, flow };
}
async function composeFlow(port, request, answerer, opts = {}) {
  const say = opts.say ?? (() => {
  });
  const gate = opts.priorityGate ?? new PriorityGate();
  const gatedAnswerer = gate.asAnswerer(answerer, "normal");
  const activePinned = { ...opts.pinned ?? {} };
  const t0 = Date.now();
  const { canvas, first, flow } = await startFlow(port, request, opts.placement, opts.flesh === false ? 0 : PROTOTYPE_ROOM);
  if (Object.keys(activePinned).length > 0) canvas.pinned = activePinned;
  const firstMs = Date.now() - t0;
  await opts.onBlueprint?.(first, firstMs, flow);
  const mapper = new StyleResolver(port, opts.mappingAnswerer ?? gatedAnswerer, async () => (await wiresOn(port, await port.canvas())).map((s) => s.spec), opts.onMappingAsked);
  const styling = styleAt(port, first.item, mapper);
  styling.catch(() => {
  });
  const fleshWith = opts.flesh === false ? void 0 : opts.flesh ?? {};
  const packPin = activePinned.pack ?? fleshWith?.pack;
  const choosing = fleshWith ? (packPin !== void 0 ? Promise.resolve(flagPack(packPin)) : choosePack(gatedAnswerer, request)).catch((e) => e instanceof Error ? e : new Error(String(e))) : void 0;
  let screens = [first];
  const tallies = [];
  let by = answerer.name;
  let askedGates;
  for (const round of [1, 2, 3]) {
    const calls = roundCalls(round, screens);
    const asked = await ask(gatedAnswerer, round, calls, opts.onAsked);
    tallies.push(asked.tally);
    by = asked.by;
    canvas.by = wireBy(by, port.actor);
    if (round === 1) {
      const gateResult = gateFlowDecision(calls[0].request, asked.responses[0], {
        pinned: activePinned,
        ...opts.noAsk !== void 0 ? { noAsk: opts.noAsk } : {}
      });
      if (gateResult.asks.length > 0) {
        askedGates = gateResult.asks;
        if (opts.onGateAsk) {
          for (const q of gateResult.asks) {
            const comment = formatAskComment(q);
            say(comment);
            const picked = await opts.onGateAsk(q, comment);
            if (picked) activePinned[q.key] = picked;
          }
        }
      }
      if (Object.keys(activePinned).length > 0) {
        canvas.pinned = { ...activePinned };
        const prevPlatform = asked.responses[0]?.answers.platform;
        if (activePinned.platform && prevPlatform?.type === "choice") {
          asked.responses[0] = {
            ...asked.responses[0],
            answers: {
              ...asked.responses[0].answers,
              platform: {
                type: "choice",
                choice: activePinned.platform,
                probabilities: {
                  ...Object.fromEntries(Object.keys(prevPlatform.probabilities).map((k) => [k, 0])),
                  [activePinned.platform]: 1
                }
              }
            }
          };
        }
      }
      const styled = await styling;
      canvas.style = styled.system ? styled.style : void 0;
      for (const line of styled.lines) say(line);
    }
    if (round === 3 && choosing) {
      const chosen = await choosing;
      if (chosen instanceof Error) {
        say(`no pack: ${chosen.message} \u2014 the screens stay in grey bars; \`wire flesh\` fills them later`);
      } else {
        canvas.pack = chosen;
        say(packLine(chosen, "the screens arrive fleshed"));
        if (chosen.how === "asked" && tallies[0]) {
          tallies[0].calls += 1;
          tallies[0].inputTokens += chosen.inputTokens ?? 0;
        }
      }
    }
    screens = await applyRound(canvas, round, screens, calls, asked.responses, say);
  }
  const prototype = fleshWith ? await prototypeOfFirstChoices(canvas, screens, say) : void 0;
  return {
    flow,
    screens,
    variants: canvas.variants,
    tallies,
    by,
    firstMs,
    totalMs: Date.now() - t0,
    style: canvas.style,
    mapper,
    ...canvas.pack ? { pack: canvas.pack } : {},
    ...prototype ? { prototype } : {},
    ...canvas.pinned ? { pinned: canvas.pinned } : {},
    ...askedGates ? { askedGates } : {}
  };
}
async function prototypeOfFirstChoices(canvas, screens, say = () => {
}) {
  const picked = firstChoices(screens);
  if (picked.length === 0) {
    say("no prototype: round 1 was confident of no screen \u2014 use the ones that belong (\u{1F4D0}), then `wire prototype`");
    return void 0;
  }
  const answerer = canvas.by?.answerer ?? "jev";
  for (const s of picked) await canvas.port.send({ type: "item.update", itemId: s.item, patch: keepPatch(true, answerer) }, canvas.group);
  const now = await canvas.port.canvas();
  const flow = keptFlowsOf(now, [...screens, ...canvas.variants]).find((f) => f.flow === picked[0].spec.flow);
  if (!flow) return void 0;
  const written = await writePrototype(canvas.port, now, flow, canvas.group);
  const inIt = flow.items.map((i) => picked.find((s) => s.item === i.id)).filter(Boolean);
  const line = prototypeWords(inIt.length, answerer);
  say(`${written.itemId}  "${written.title}" \u2014 ${line}`);
  return { itemId: written.itemId, title: written.title, links: written.links, screens: inIt, answerer };
}
function prototypeWords(screens, answerer) {
  const whose = answerer === "stub" ? "the stub's" : answerer === "agent" ? "the agent's" : "Jev's";
  return `prototype of ${screens} screen${screens === 1 ? "" : "s"}, ${whose} first choices`;
}
function costLine(tallies, by, screens, maybe = 0) {
  const tokens = tallies.reduce((s, t) => s + t.inputTokens, 0);
  const calls = tallies.reduce((s, t) => s + t.calls, 0);
  const rounds = tallies.map((t) => `round ${t.round} ${t.ms} ms`).join(" \xB7 ");
  return `${screens} screens${maybe ? ` (${maybe} maybe)` : ""}, one op group \u2014 answered by ${by} \xB7 ${rounds} \xB7 ${calls} calls \xB7 ${tokens.toLocaleString("en-US")} input tokens \xB7 $${(tokens * JEV_INPUT_PRICE).toFixed(6)}`;
}

// packages/modules/wireframe/src/flesh-cli.ts
async function screensFor(host, snapshot, all, refs, flow) {
  if (refs.length > 0) {
    return refs.map((ref) => {
      const item = host.resolveItem(snapshot, ref);
      const found = all.find((s) => s.item === item.id);
      if (!found) throw new Error(`"${item.title}" is not a wireframe screen \u2014 \`isocan wire "<request>"\` composes some`);
      return found;
    });
  }
  const screens = flow === void 0 ? all : all.filter((s) => s.spec.flow === flow);
  if (screens.length === 0) throw new Error(flow === void 0 ? 'no wireframe on this canvas \u2014 `isocan wire "<request>"` composes some' : `no wireframe in flow "${flow}" on this canvas`);
  return screens;
}
async function writeWireCopy(port, canvas, all, screen, raw, by) {
  const spec = screen.spec;
  const validated = validateCopyPayload(spec, raw);
  const next = applyCopy(spec, validated, by);
  if (JSON.stringify(next) === JSON.stringify(spec)) return { changed: false };
  const item = canvas.items[screen.item];
  const filename = currentVersionOf(item)?.filename ?? "wireframe.html";
  const group = newGroupId();
  const versionId = newVersionId();
  const upload = await port.put(renderWire(next), "text/html", filename);
  await port.send({ type: "item.addVersion", itemId: item.id, version: { id: versionId, blobHash: upload.blobHash, mimeType: "text/html", filename, size: upload.size } }, group);
  const prototypes = await rebuildPrototypes(port, canvas, all, [{ item: item.id, spec: next }], group);
  return { changed: true, next, group, versionId, prototypes };
}
var wireCopyWriter = {
  kind: "wire",
  async apply(host, ctx, canvasId, itemId, edits, by) {
    const port = cliPort(host, ctx, canvasId);
    const snapshot = await ctx.client.snapshot(canvasId);
    const all = await wiresOn(port, snapshot.canvas);
    const screen = all.find((s) => s.item === itemId);
    if (!screen) throw new Error("this wireframe's spec could not be read \u2014 `isocan wire copy` cannot write it either");
    const item = snapshot.canvas.items[itemId];
    const html = await port.readText(currentVersionOf(item).blobHash);
    const file = wireCopyFile(html, edits);
    if (!file.ok) throw new Error(file.reason);
    const r = await writeWireCopy(port, snapshot.canvas, all, screen, file.file, by);
    if (!r.changed) return { changed: [] };
    return { changed: file.changed, group: r.group, versionId: r.versionId, note: `exact copy by ${by}${r.prototypes.length ? ", prototype rebuilt" : ""}` };
  }
};
function registerFlesh(host, wire) {
  const { run, ctxOf, resolveCanvas, printJson } = host;
  wire.command("flesh [screens...]").description("Fill wires with sample content instead of grey bars \u2014 Jev picks one content pack per flow from its request (p recorded; --pack <id> overrides); one op group, a version per changed wire. --bars goes back to bars").option("--canvas <canvas>").option("--flow <flow>", "only this flow's screens and their variations").option("--bars", "back to bars: take the content off").option("--packs", "write nothing: list the content packs").action(
    run(async (refs, _local, cmd) => {
      const opts = cmd.optsWithGlobals();
      if (opts.packs) {
        if (cmd.optsWithGlobals().json) return printJson({ packs: PACKS.map((p2) => ({ id: p2.id, name: p2.name, about: p2.about, motifs: p2.motifs })) });
        for (const p2 of PACKS) console.log(`${p2.id.padEnd(14)} ${p2.name} \u2014 ${p2.about}`);
        return;
      }
      if (opts.bars && opts.pack !== void 0) throw new Error("--bars takes content off and --pack puts it on \u2014 say one");
      const ctx = await ctxOf(cmd);
      const say = (line) => {
        if (!ctx.json) console.log(line);
      };
      const p = await resolveCanvas(ctx);
      const port = cliPort(host, ctx, p.id);
      const snapshot = await ctx.client.snapshot(p.id);
      const all = await wiresOn(port, snapshot.canvas);
      const screens = await screensFor(host, snapshot, all, refs, opts.flow);
      const answerer = cliAnswerer(ctx, p.id, opts.answerer === "agent" ? void 0 : opts.answerer, Number(opts.seed ?? 1), say);
      const r = await flesh(port, snapshot.canvas, all, screens, answerer, { ...opts.pack !== void 0 ? { pack: opts.pack } : {}, bars: Boolean(opts.bars) });
      if (ctx.json) {
        return printJson({
          group: r.group,
          content: opts.bars ? "bars" : "pack",
          packs: [...r.choices].map(([flow, c]) => ({ flow, pack: c.pack, leaned: c.leaned, p: c.p, how: c.how, by: c.by })),
          fleshed: r.changed.map((t) => ({ itemId: t.screen.item, title: wireTitle(t.spec), pack: t.spec.content?.pack ?? null, heading: t.spec.content?.title ?? null })),
          unchanged: r.targets.filter((t) => !r.changed.includes(t)).map((t) => ({ itemId: t.screen.item, ...t.skipped ? { skipped: t.skipped } : {} })),
          prototypes: r.prototypes,
          calls: r.calls,
          inputTokens: r.inputTokens
        });
      }
      for (const line of fleshLines(r)) say(line);
      for (const t of r.changed) say(`${t.screen.item}  ${wireTitle(t.spec)}${t.spec.content?.title ? ` \u2014 "${t.spec.content.title}"` : ""}`);
      say(fleshSummary(r, Boolean(opts.bars)).replace("one undo takes", "`isocan undo` takes"));
    })
  );
  wire.command("copy [screens...]").description(`Print a fleshed screen's words and JSON schema by slot and path; --apply <file> writes exact words back (source "copy") as one version; --ai fills schema-validated copy across one screen or flow`).option("--canvas <canvas>").option("--flow <flow>", "with --ai: only this flow's screens").option("--apply <file>", 'a JSON file: { "title"?: string, "slots": { "<slot>": { "<path>": "words" } | ["words", \u2026] } }').option("--ai", "generate schema-validated copy across target screen(s) in one op group").option("--brief <words>", "extra domain or tone brief for --ai").option("--by <name>", "who wrote the words \u2014 recorded on the screen", "agent").action(
    run(async (refs, _local, cmd) => {
      const opts = cmd.optsWithGlobals();
      const ctx = await ctxOf(cmd);
      const p = await resolveCanvas(ctx);
      const port = cliPort(host, ctx, p.id);
      const snapshot = await ctx.client.snapshot(p.id);
      const all = await wiresOn(port, snapshot.canvas);
      if (opts.ai) {
        const screens = await screensFor(host, snapshot, all, refs, opts.flow);
        const gen = resolveTextGenerator({
          seed: Number(opts.seed ?? 1),
          useStub: opts.answerer === "stub",
          text: localTextKey()
        });
        const r2 = await copyAiOnCanvas(port, snapshot.canvas, all, screens, gen, {
          ...opts.brief ? { brief: opts.brief } : {}
        });
        if (ctx.json) {
          return printJson({
            group: r2.group,
            by: r2.by,
            changed: r2.changed.map((c) => ({ itemId: c.itemId, title: c.title, content: c.spec.content })),
            prototypes: r2.prototypes
          });
        }
        for (const c of r2.changed) {
          console.log(`${c.itemId}  ${c.title}${c.spec.content?.title ? ` \u2014 "${c.spec.content.title}"` : ""}`);
        }
        console.log(
          `${r2.changed.length} of ${screens.length} wire${screens.length === 1 ? "" : "s"} filled with AI copy (${r2.by})${r2.prototypes.length ? ", prototype rebuilt" : ""} \u2014 \`isocan undo\` takes it back`
        );
        return;
      }
      const ref = refs[0];
      if (!ref) throw new Error("missing required argument 'screen' (or pass --ai)");
      const [screen] = await screensFor(host, snapshot, all, [ref], void 0);
      const spec = screen.spec;
      if (!opts.apply) {
        const words = copyOf(spec);
        if (!spec.content) throw new Error(`"${wireTitle(spec)}" draws bars \u2014 \`isocan wire flesh ${screen.item}\` fills it first; then \`wire copy\` prints its words to replace`);
        console.log(JSON.stringify({
          screen: screen.item,
          title: words.title,
          ...spec.content.bar !== void 0 ? { bar: spec.content.bar } : {},
          content: words.content,
          schema: blockContentSchema(spec),
          slots: Object.fromEntries(words.slots.map((s) => [s.slot, { block: s.block, words: s.words }]))
        }, null, 2));
        return;
      }
      let raw;
      try {
        raw = JSON.parse(await readFile(opts.apply, "utf8"));
      } catch (error) {
        throw new Error(`${opts.apply} is not a JSON file this can read: ${error.message}`);
      }
      const r = await writeWireCopy(port, snapshot.canvas, all, screen, raw, opts.by);
      if (!r.changed) {
        if (ctx.json) return printJson({ itemId: screen.item, changed: false });
        console.log(`${screen.item}  ${wireTitle(spec)} \u2014 the same words; nothing written`);
        return;
      }
      if (ctx.json) return printJson({ itemId: screen.item, changed: true, group: r.group, content: r.next.content, prototypes: r.prototypes });
      console.log(`${screen.item}  ${wireTitle(r.next)} \u2014 exact copy by ${opts.by}, one version${r.prototypes.length ? `, prototype rebuilt` : ""} \u2014 \`isocan undo\` takes it back`);
    })
  );
  wire.command("name [screens...]").description("Name a flow's brand, per-screen titles, and shared navigation bar labels coherently in one op group").option("--canvas <canvas>").option("--flow <flow>", "only this flow's screens").option("--request <words>", "override the flow request when naming").action(
    run(async (refs, _local, cmd) => {
      const opts = cmd.optsWithGlobals();
      const ctx = await ctxOf(cmd);
      const p = await resolveCanvas(ctx);
      const port = cliPort(host, ctx, p.id);
      const snapshot = await ctx.client.snapshot(p.id);
      const all = await wiresOn(port, snapshot.canvas);
      const screens = await screensFor(host, snapshot, all, refs, opts.flow);
      const gen = resolveTextGenerator({
        seed: Number(opts.seed ?? 1),
        useStub: opts.answerer === "stub",
        text: localTextKey()
      });
      const r = await nameFlowOnCanvas(port, snapshot.canvas, all, screens, gen, {
        ...opts.request ? { request: opts.request } : {}
      });
      if (ctx.json) {
        return printJson({
          group: r.group,
          by: r.by,
          brand: r.brand,
          navLabels: r.navLabels,
          changed: r.changed.map((c) => ({ itemId: c.itemId, title: c.title })),
          prototypes: r.prototypes
        });
      }
      console.log(`brand: ${r.brand} \xB7 nav: ${r.navLabels.join(" \xB7 ") || "none"}`);
      for (const c of r.changed) {
        console.log(`${c.itemId}  ${c.title}`);
      }
      console.log(
        `${r.changed.length} wire${r.changed.length === 1 ? "" : "s"} named (${r.by})${r.prototypes.length ? ", prototype rebuilt" : ""} \u2014 \`isocan undo\` takes it back`
      );
    })
  );
}

export {
  parsePinFlags,
  governingSystem,
  StyleResolver,
  mappingLines,
  restyle,
  restyleSummary,
  VARIATION_FLOOR,
  DEFAULT_VARIATIONS,
  decisions,
  honestFlips,
  flagPack,
  FlowCanvas,
  applyRound,
  addVariations,
  wiresOn,
  flowsOn,
  pickFlow,
  styleAt,
  startFlow,
  composeFlow,
  costLine,
  cliPort,
  localJevKey,
  localTextKey,
  cliAnswerer,
  writeWireCopy,
  wireCopyWriter,
  registerFlesh
};
