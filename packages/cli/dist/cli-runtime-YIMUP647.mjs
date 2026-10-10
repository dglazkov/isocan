import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  WIRE_COMMAND,
  WIRE_PROPERTY_KEYS,
  designUse,
  ownDesignSystemAt
} from "./chunk-N3NXUPOE.mjs";
import {
  DEFAULT_VARIATIONS,
  FlowCanvas,
  StyleResolver,
  VARIATION_FLOOR,
  addVariations,
  applyRound,
  cliAnswerer,
  cliPort,
  compactDecisions,
  composeFlow,
  costLine,
  decisions,
  explainWireDecision,
  flagPack,
  flowsOn,
  governingSystem,
  honestFlips,
  localJevKey,
  localTextKey,
  mappingLines,
  parsePinFlags,
  pickFlow,
  registerFlesh,
  requireScopedScreens,
  restyle,
  restyleSummary,
  scopeFlowScreens,
  startFlow,
  styleAt,
  wiresOn,
  writeWireCopy
} from "./chunk-AJK3IZ43.mjs";
import {
  MAX_COPY_VARIANTS,
  checkCopyVariants,
  copyVariantsRequest,
  flowCopyDeck,
  placeholderCopyVariants,
  splitFlowEdits
} from "./chunk-J4VZM2HF.mjs";
import {
  voiceOf
} from "./chunk-3GCZKVLQ.mjs";
import {
  BLOCKS,
  DEFAULT_THEME,
  DENSITY_LEVELS,
  INTENTS,
  KEEP_EMOJI,
  KEEP_MARK,
  LINK_BACK,
  LINK_NONE,
  PLATFORMS,
  POLISH_TOKENS,
  PRIMITIVES,
  PROTOTYPE_PROP,
  RECIPES,
  ROLES,
  TEMPLATE_BY_ID,
  TEMPLATE_IDS,
  WIRE_FIDELITY_TIERS,
  WIRE_LAYER_IDS,
  answeredResponse,
  blueprint,
  candidatesOf,
  component,
  currentVersionOf,
  flipWords,
  hotspots,
  inferLinks,
  isBlueprint,
  isKept,
  keepPatch,
  keepable,
  kept,
  keptFlowsOf,
  overridesOf,
  pendingRound,
  pickKeptFlow,
  playAnchor,
  presentElements,
  prototypeScreens,
  readWire,
  rebuildPrototypes,
  recipe,
  renderWire,
  requestBlueprint,
  rerender,
  rerenderLines,
  rerenderSummary,
  resolveSlot,
  resolveTextGenerator,
  rewriteSlotCopy,
  roundCalls,
  sanitizeFlowTitle,
  setLinkOverride,
  surfaceOf,
  validateWire,
  wireBy,
  wireSize,
  wireTitle,
  wireframe,
  writePrototype,
  writeWire
} from "./chunk-77O7GJCN.mjs";
import {
  wireframeModule
} from "./chunk-XBCICSRJ.mjs";
import {
  copyDeck,
  wireCopyFile
} from "./chunk-RBQUYPUY.mjs";
import "./chunk-NE45VMO5.mjs";
import "./chunk-SGXD6ULG.mjs";
import "./chunk-P363CJIM.mjs";
import {
  JEV_INPUT_PRICE,
  JEV_MODEL,
  chosenOption,
  stubAnswerer,
  stubTextGenerator
} from "./chunk-WTISZQKP.mjs";
import "./chunk-KQ3WEYIK.mjs";
import "./chunk-XSMUJNBI.mjs";
import {
  COPY_PREFERENCE_PROP,
  FIDELITY_PROP,
  canvasScopes,
  checkDesign,
  isGroupItem,
  itemUrl,
  moduleAsset,
  newGroupId,
  newItemId,
  newVersionId,
  serializeCopyPreference,
  titleSlug
} from "./chunk-2A5T7SLH.mjs";
import "./chunk-GUY4UN4O.mjs";
import {
  CONTRAST_BODY,
  contrastRatio,
  designSurface,
  luminance,
  parseDesign,
  parseHex
} from "./chunk-K4TDP4L5.mjs";
import "./chunk-JYOOXWJZ.mjs";

// packages/modules/wireframe/src/cli-runtime.ts
import { readFile as readFile3 } from "node:fs/promises";

// packages/modules/wireframe/src/web-port.ts
function webPort(canvasId, host) {
  return {
    canvasId,
    actor: host.viewer ? { id: host.viewer.id, name: host.viewer.name } : void 0,
    canvas: async () => host.getCanvas(),
    readText: (blobHash) => host.readText(blobHash),
    put: (text, mimeType, filename) => host.putBlob(new Blob([text], { type: mimeType }), filename),
    send: async (op, group) => {
      await host.send([op], group);
      if (op.type !== "item.add") return;
      const landed = host.getCanvas().items[op.itemId];
      return landed ? { x: landed.x, y: landed.y } : void 0;
    }
  };
}

// packages/modules/wireframe/src/follow.ts
async function followMarks(port, changed, group) {
  const canvas = await port.canvas();
  const all = await wiresOn(port, canvas);
  const moved = new Set(changed);
  const flowsOfChanged = new Set(all.filter((w) => moved.has(w.item)).map((w) => w.spec.flow));
  const kept2 = keptFlowsOf(canvas, all);
  const out = [];
  for (const proto of Object.values(canvas.items).filter((i) => i.properties?.[PROTOTYPE_PROP] !== void 0)) {
    const flow = proto.properties[PROTOTYPE_PROP];
    const current = kept2.find((f) => f.flow === flow);
    const linksToChanged = Object.values(canvas.items).some((i) => all.some((w) => w.item === i.id && w.spec.flow === flow) && Object.values(overridesOf(i.properties)).some((to) => moved.has(to)));
    if (!flowsOfChanged.has(flow) && !linksToChanged) continue;
    if (!current) {
      out.push({ flow, itemId: proto.id, what: "left", screens: 0 });
      continue;
    }
    const written = await writePrototype(port, canvas, current, group);
    out.push({ flow, itemId: written.itemId, what: written.what === "added" ? "versioned" : written.what, screens: current.screens.length });
  }
  return out;
}
async function followOnWeb({ canvasId, group, changed, host }) {
  await followMarks(webPort(canvasId, host), changed.map((i) => i.id), group);
}
function followedLine(f) {
  if (f.what === "left") return `prototype ${f.itemId} left as it was \u2014 nothing of its flow is in it now; \`isocan wire use <screens...>\` puts some back`;
  if (f.what === "unchanged") return `prototype ${f.itemId} already plays these ${f.screens} screens`;
  return `prototype ${f.itemId} follows \u2014 it plays ${f.screens} screen${f.screens === 1 ? "" : "s"} now${f.what === "moved" ? ", back above its flow" : ""}`;
}

// packages/modules/wireframe/src/command.ts
var wireframeCore = {
  ...wireframeModule,
  marks: [{ ...KEEP_MARK, follow: followOnWeb }],
  propertyKeys: [...WIRE_PROPERTY_KEYS],
  commands: [WIRE_COMMAND]
};

// packages/modules/wireframe/src/edit.ts
var EDIT_KINDS = ["content", "add", "remove", "variant", "restyle"];
function scopeEdit(spec, edit) {
  const r = recipe(spec.archetype);
  if (edit.kind === "content") {
    const idx = spec.slots.findIndex((s) => s.slot === edit.slot);
    if (idx < 0) throw new Error(`${spec.title} has no slot "${edit.slot}" to update content on`);
    if (!edit.fill) {
      throw new Error(`a content edit on "${edit.slot}" needs words \u2014 \`editWireOnCanvas\` writes them from the instruction`);
    }
    const slots2 = spec.slots.map((s, i) => {
      if (i !== idx) return s;
      const mergedFill = { ...s.fill ?? {}, ...edit.fill ?? {} };
      return { ...s, fill: mergedFill };
    });
    return {
      ...spec,
      slots: slots2,
      content: spec.content ?? { source: "copy", by: spec.by?.model ?? spec.by?.answerer ?? "agent" }
    };
  }
  if (edit.kind === "variant") {
    const idx = spec.slots.findIndex((s) => s.slot === edit.slot);
    if (idx < 0) throw new Error(`${spec.title} has no slot "${edit.slot}" to vary`);
    const current = spec.slots[idx];
    const section = r.sections.find((s) => s.slot === edit.slot);
    const nextBlock = edit.block ?? current.block;
    if (!nextBlock) throw new Error(`slot "${edit.slot}" is undecided \u2014 give a block to resolve it`);
    if (section && !section.options.includes(nextBlock)) {
      throw new Error(`slot "${edit.slot}" on ${r.id} accepts ${section.options.join(", ")} \u2014 not "${nextBlock}"`);
    }
    const baseSlot = nextBlock !== current.block ? resolveSlot(r.id, edit.slot, nextBlock, edit.props) : (() => {
      const c = component(nextBlock);
      const mergedProps = { ...current.props, ...edit.props ?? {} };
      const present = presentElements(c, mergedProps);
      const resolved = resolveSlot(r.id, edit.slot, nextBlock, mergedProps);
      const intents = present.length > 0 ? Object.fromEntries(present.map((el) => [el, current.intents?.[el] ?? resolved.intents[el]])) : void 0;
      return {
        ...current,
        props: resolved.props,
        ...intents ? { intents } : {}
      };
    })();
    const updatedSlot = {
      ...baseSlot,
      ...current.p !== void 0 && nextBlock === current.block ? { p: current.p } : {},
      ...current.alternatives && nextBlock === current.block ? { alternatives: current.alternatives } : {},
      ...edit.region ?? current.region ? { region: edit.region ?? current.region } : {},
      ...current.fill && nextBlock === current.block ? { fill: current.fill } : {}
    };
    const slots2 = spec.slots.map((s, i) => i === idx ? updatedSlot : s);
    return { ...spec, slots: slots2 };
  }
  if (edit.kind === "add") {
    const section = r.sections.find((s) => s.slot === edit.slot);
    if (!section) {
      throw new Error(`${r.id} has no section "${edit.slot}" \u2014 valid sections: ${r.sections.map((s) => s.slot).join(", ")}`);
    }
    const chosenBlock = edit.block ?? spec.declined?.find((d) => d.slot === edit.slot)?.block ?? section.options[0];
    if (!section.options.includes(chosenBlock)) {
      throw new Error(`slot "${edit.slot}" on ${r.id} accepts ${section.options.join(", ")} \u2014 not "${chosenBlock}"`);
    }
    const resolved = resolveSlot(r.id, edit.slot, chosenBlock, edit.props);
    const newSlot = {
      ...resolved,
      ...edit.region ? { region: edit.region } : {},
      ...edit.fill ? { fill: edit.fill } : {}
    };
    const existingIdx = spec.slots.findIndex((s) => s.slot === edit.slot);
    let slots2;
    if (existingIdx >= 0) {
      slots2 = spec.slots.map((s, i) => i === existingIdx ? newSlot : s);
    } else {
      const order = r.sections.map((s) => s.slot);
      const targetOrder = order.indexOf(edit.slot);
      slots2 = [...spec.slots];
      const insertAt = slots2.findIndex((s) => order.indexOf(s.slot) > targetOrder);
      if (insertAt < 0) slots2.push(newSlot);
      else slots2.splice(insertAt, 0, newSlot);
    }
    const nextDeclined = (spec.declined ?? []).filter((d) => d.slot !== edit.slot);
    const out = { ...spec, slots: slots2 };
    if (nextDeclined.length > 0) out.declined = nextDeclined;
    else delete out.declined;
    return out;
  }
  if (edit.kind === "remove") {
    const idx = spec.slots.findIndex((s) => s.slot === edit.slot);
    if (idx < 0) throw new Error(`${spec.title} has no slot "${edit.slot}" to remove`);
    const removed = spec.slots[idx];
    const section = r.sections.find((s) => s.slot === edit.slot);
    const slots2 = spec.slots.filter((_, i) => i !== idx);
    const nextDeclined = [...(spec.declined ?? []).filter((d) => d.slot !== edit.slot)];
    if (section?.optional && removed.block) {
      nextDeclined.push({ slot: edit.slot, p: 1, block: removed.block });
    }
    return {
      ...spec,
      slots: slots2,
      ...nextDeclined.length > 0 ? { declined: nextDeclined } : {}
    };
  }
  const nextTemplate = edit.template && TEMPLATE_IDS.includes(edit.template) ? edit.template : spec.template;
  const nextDensity = edit.density && DENSITY_LEVELS.includes(edit.density) ? edit.density : spec.density;
  const slots = edit.region ? spec.slots.map((s) => s.slot === edit.slot ? { ...s, region: edit.region } : s) : spec.slots;
  return {
    ...spec,
    slots,
    ...nextTemplate ? { template: nextTemplate } : {},
    ...nextDensity ? { density: nextDensity } : {}
  };
}
async function planEditWithJev(screens, instruction, answerer, targetScreenId) {
  if (screens.length === 0) {
    throw new Error("no wireframe screens on this canvas to edit");
  }
  let screen;
  let by = answerer.name;
  if (targetScreenId) {
    screen = screens.find((s) => s.item === targetScreenId || s.spec.title.toLowerCase() === targetScreenId.toLowerCase());
    if (!screen) throw new Error(`no wireframe screen "${targetScreenId}" on this canvas`);
  } else if (screens.length === 1) {
    screen = screens[0];
  } else {
    const pickReq = {
      model: JEV_MODEL,
      state: { instruction, screens: screens.map((s) => ({ id: s.item, title: s.spec.title, archetype: s.spec.archetype })) },
      questions: {
        screen: {
          type: "choice",
          instructions: "Which wireframe screen should this edit instruction apply to?",
          criteria: Object.fromEntries(screens.map((s) => [s.item, `${s.spec.title} (${s.spec.archetype})`]))
        }
      }
    };
    const picked = await answerer.answer(pickReq);
    by = picked.by;
    const itemId = chosenOption(pickReq.questions.screen, picked.response.answers.screen).value;
    screen = screens.find((s) => s.item === itemId) ?? screens[0];
  }
  const r = recipe(screen.spec.archetype);
  const allSlots = r.sections.map((s) => s.slot);
  const presentSlots = screen.spec.slots.map((s) => s.slot);
  const slotChoices = allSlots.length > 0 ? allSlots : presentSlots;
  const questions2 = {
    kind: {
      type: "choice",
      instructions: "What kind of surgical edit does the instruction ask for?",
      criteria: {
        variant: "Swap a slot's block or adjust its component props",
        content: "Change the heading, labels, or sample text inside a slot",
        add: "Add or restore an optional section on the screen",
        remove: "Remove an optional section from the screen",
        restyle: "Adjust layout template, region assignment, or spacing density"
      }
    },
    slot: {
      type: "choice",
      instructions: "Which slot on the screen does the instruction target?",
      criteria: Object.fromEntries(
        r.sections.map((s) => [s.slot, `${s.region} (${s.options.join(" | ")}${s.optional ? ", optional" : ""})`])
      )
    },
    density: {
      type: "choice",
      instructions: "If the instruction adjusts spacing density, which density should apply?",
      criteria: {
        compact: "Tight 8px spacing",
        default: "Balanced 12px spacing",
        spacious: "Airy 16px spacing"
      }
    }
  };
  for (const s of r.sections) {
    if (s.options.length > 1) {
      questions2[`block:${s.slot}`] = {
        type: "choice",
        instructions: `If slot ${s.slot} changes block, which block should fill it?`,
        criteria: Object.fromEntries(s.options.map((o) => [o, o.replace(/-/g, " ")]))
      };
    }
  }
  const editReq = {
    model: JEV_MODEL,
    state: {
      instruction,
      screen: screen.spec.title,
      archetype: screen.spec.archetype,
      slots: screen.spec.slots.map((s) => ({ slot: s.slot, block: s.block })),
      declined: screen.spec.declined ?? []
    },
    questions: questions2
  };
  const answered = await answerer.answer(editReq);
  by = answered.by;
  const kind = chosenOption(questions2.kind, answered.response.answers.kind).value;
  const chosenSlot = slotChoices.includes(chosenOption(questions2.slot, answered.response.answers.slot).value) ? chosenOption(questions2.slot, answered.response.answers.slot).value : presentSlots[0] ?? slotChoices[0];
  const targetSlot = (kind === "remove" || kind === "variant" || kind === "content") && !presentSlots.includes(chosenSlot) ? presentSlots.find((s) => s.startsWith("main")) ?? presentSlots[0] : chosenSlot;
  const section = r.sections.find((s) => s.slot === targetSlot);
  const blockQ = questions2[`block:${targetSlot}`];
  const blockA = answered.response.answers[`block:${targetSlot}`];
  const chosenBlock = blockQ && blockA ? chosenOption(blockQ, blockA).value : section?.options[0];
  const chosenDensity = chosenOption(questions2.density, answered.response.answers.density).value;
  const edit = {
    kind,
    slot: targetSlot,
    ...kind === "variant" || kind === "add" ? chosenBlock ? { block: chosenBlock } : {} : {},
    ...kind === "content" ? { instruction } : {},
    ...kind === "restyle" ? { density: chosenDensity } : {}
  };
  return { screen, edit, by };
}
async function editWireOnCanvas(port, instruction, answerer, opts = {}) {
  const beforeCanvas = await port.canvas();
  const all = await wiresOn(port, beforeCanvas);
  const primaryScreens = all.filter((s) => !s.spec.variantOf);
  const pool = opts.screenId ? all : primaryScreens.length > 0 ? primaryScreens : all;
  const planned = opts.edit ? (() => {
    const target = opts.screenId ? pool.find((s) => s.item === opts.screenId || s.spec.title.toLowerCase() === opts.screenId.toLowerCase()) : pool[0];
    if (!target) throw new Error(opts.screenId ? `no wireframe screen "${opts.screenId}" on this canvas` : "no wireframe screens on this canvas");
    return { screen: target, edit: opts.edit, by: answerer.name };
  })() : await planEditWithJev(pool, instruction, answerer, opts.screenId);
  const previous = planned.screen.spec;
  if (planned.edit.kind === "content" && !planned.edit.fill) {
    const fill = await rewriteSlotCopy(previous, planned.edit.slot, planned.edit.instruction ?? instruction, opts.generator ?? stubTextGenerator(1));
    planned.edit = { ...planned.edit, fill };
  }
  const nextSpec = {
    ...scopeEdit(previous, planned.edit),
    by: wireBy(planned.by, port.actor)
  };
  const group = newGroupId();
  const title = wireTitle(nextSpec);
  const filename = `${titleSlug(title, { max: 60 }) || "screen"}.html`;
  const html = renderWire(nextSpec);
  const upload = await port.put(html, "text/html", filename);
  const version = {
    id: newVersionId(),
    blobHash: upload.blobHash,
    mimeType: "text/html",
    filename,
    size: upload.size
  };
  await port.send({ type: "item.addVersion", itemId: planned.screen.item, version }, group);
  const { width, height } = wireSize(nextSpec);
  if (title !== wireTitle(previous)) {
    await port.send({ type: "item.update", itemId: planned.screen.item, patch: { title } }, group);
  }
  if (width !== planned.screen.width || height !== planned.screen.height) {
    await port.send({ type: "item.resize", itemId: planned.screen.item, width, height }, group);
  }
  const updatedScreen = {
    ...planned.screen,
    spec: nextSpec,
    width,
    height
  };
  const afterCanvas = await port.canvas();
  const afterWires = await wiresOn(port, afterCanvas);
  const keptFlows2 = keptFlowsOf(afterCanvas, afterWires);
  const affectedFlow = keptFlows2.find((f) => f.items.some((i) => i.id === updatedScreen.item));
  let prototype;
  if (affectedFlow) {
    const written = await writePrototype(port, afterCanvas, affectedFlow, group);
    if (written.what !== "unchanged") prototype = { itemId: written.itemId, title: written.title };
  }
  return {
    group,
    screen: updatedScreen,
    previous,
    edit: planned.edit,
    by: planned.by,
    ...prototype ? { prototype } : {}
  };
}

// packages/modules/wireframe/src/presets.ts
var HOUSE = "house";
var PRESET_PROP = "wirePreset";
var OWN_PRESETS = [
  { id: "material", name: "Material", about: "Material 3's ideas \u2014 tonal violet, 12px corners, elevation", from: "own" },
  { id: "shadcn", name: "shadcn", about: "shadcn/ui's look \u2014 zinc neutrals, hairline borders, small corners", from: "own" },
  { id: "glass", name: "Glass", about: "glassmorphism \u2014 frosted translucent panes over a soft gradient", from: "own" },
  { id: "ios", name: "iOS", about: "Apple's HIG \u2014 system face, grouped greys, 10px corners, tint blue", from: "own" },
  { id: "fluent", name: "Fluent", about: "Fluent 2's ideas \u2014 neutral greys, communication blue, 4px corners, light shadows", from: "own" },
  { id: "carbon", name: "Carbon", about: "Carbon's ideas \u2014 square, dense, cool greys, one strong blue", from: "own" },
  { id: "brutalist", name: "Brutalist", about: "thick black borders, hard shadows, monospace, loud flat colour", from: "own" }
];
var PACK_PRESETS = ["duarte", "frog", "ideo", "ive", "kare", "linear", "rams", "tufte", "victor"].map((id) => ({
  id,
  name: id[0].toUpperCase() + id.slice(1),
  about: "a design-competition pack \u2014 its tokens mapped onto the wire by the answerer",
  from: "pack"
}));
var PRESET_NAMES = [HOUSE, ...OWN_PRESETS.map((p) => p.id), ...PACK_PRESETS.map((p) => p.id)];
function presetById(id) {
  return OWN_PRESETS.find((p) => p.id === id) ?? PACK_PRESETS.find((p) => p.id === id);
}
function presetFile(preset) {
  return preset.from === "own" ? `assets/styles/${preset.id}/DESIGN.md` : `assets/packs/${preset.id}/DESIGN.md`;
}
function presetOrSay(name) {
  const id = name.trim().toLowerCase();
  if (id === HOUSE) return HOUSE;
  const found = presetById(id);
  if (!found) throw new Error(`"${name}" is not a wire style \u2014 ${PRESET_NAMES.join(", ")}`);
  return found;
}
function presetTitle(preset) {
  return `${preset.name} \u2014 DESIGN.md`;
}
function flowScreens(all, itemIds) {
  if (itemIds.length === 0) return [...all];
  const named = new Set(itemIds);
  const flows = new Set(all.filter((s) => named.has(s.item)).map((s) => s.spec.flow || s.item));
  return all.filter((s) => named.has(s.item) || flows.has(s.spec.flow || s.item));
}
var GAP = 160;
function refuseOwnSystem(system, scope) {
  const where = scope ? `the group \u201C${scope.title}\u201D` : "this canvas";
  return new Error(`\u201C${system.title}\u201D is the design system of ${where}, and a wire style would become a new version of it. Wires draw in it already (\`isocan wire style\`); to use a wire style instead, stop it governing first \u2014 \`isocan design use ${system.id} --off\`, or its right-click menu \u2192 Stop using as design system.`);
}
async function applyPreset(port, all, screens, choice, text, resolver) {
  if (screens.length === 0) throw new Error('no wireframe to style \u2014 `isocan wire "<request>"` composes some');
  if (choice !== HOUSE && !text) throw new Error(`the ${choice.name} wire style has no DESIGN.md to read`);
  const before = await port.canvas();
  const group = newGroupId();
  const byScope = /* @__PURE__ */ new Map();
  for (const s of screens) {
    const item = before.items[s.item];
    if (!item) continue;
    const scope = canvasScopes(before, item)[0]?.id ?? null;
    byScope.set(scope, [...byScope.get(scope) ?? [], s]);
  }
  if (choice !== HOUSE) {
    for (const scope of byScope.keys()) {
      const own = ownDesignSystemAt(before, scope);
      if (own && own.properties?.[PRESET_PROP] === void 0) throw refuseOwnSystem(own, scope ? before.items[scope] ?? null : null);
    }
  }
  const placed = [];
  for (const [scope, list] of byScope) {
    const own = ownDesignSystemAt(before, scope);
    const mine = own && own.properties?.[PRESET_PROP] !== void 0 ? own : null;
    if (choice === HOUSE) {
      if (mine) {
        await port.send({ type: "item.delete", itemId: mine.id }, group);
        placed.push({ itemId: mine.id, scope, what: "removed" });
      }
      continue;
    }
    const words = text;
    const title = presetTitle(choice);
    if (mine) {
      const current = currentVersionOf(mine);
      if (mine.properties[PRESET_PROP] === choice.id && current && await port.readText(current.blobHash) === words) {
        placed.push({ itemId: mine.id, scope, what: "unchanged" });
        continue;
      }
      const upload2 = await port.put(words, "text/markdown", "DESIGN.md");
      await port.send({ type: "item.addVersion", itemId: mine.id, version: { id: newVersionId(), blobHash: upload2.blobHash, mimeType: "text/markdown", filename: "DESIGN.md", size: upload2.size } }, group);
      await port.send({ type: "item.update", itemId: mine.id, patch: { title, properties: { [PRESET_PROP]: choice.id } } }, group);
      placed.push({ itemId: mine.id, scope, what: "versioned" });
      continue;
    }
    const upload = await port.put(words, "text/markdown", "DESIGN.md");
    const itemId = newItemId();
    const scopeItem = scope ? before.items[scope] : void 0;
    await port.send({
      type: "item.add",
      itemId,
      version: { id: newVersionId(), blobHash: upload.blobHash, mimeType: "text/markdown", filename: "DESIGN.md", size: upload.size },
      width: 560,
      height: 720,
      // Beside the flow, level with its top: where somebody looking at the screens looks next.
      placement: { x: Math.max(...list.map((s) => s.x + s.width)) + GAP, y: Math.min(...list.map((s) => s.y)), chosen: true },
      title,
      properties: { [PRESET_PROP]: choice.id },
      ...scopeItem && isGroupItem(scopeItem) ? { containerId: scopeItem.id, groupPlacement: "exact" } : {}
    }, group);
    const landed = await port.canvas();
    await port.send(designUse(landed, landed.items[itemId]).op, group);
    placed.push({ itemId, scope, what: "added" });
  }
  const after = await port.canvas();
  const governs = (canvas, s) => {
    const item = canvas.items[s.item];
    const system = item ? governingSystem(canvas, item) : null;
    return system ? `${system.id}@${system.currentVersionId}` : "";
  };
  const asked = new Set(screens.map((s) => s.item));
  const touched = all.filter((s) => after.items[s.item] && (asked.has(s.item) || governs(before, s) !== governs(after, s)));
  const restyled = await restyle(port, after, all, touched, resolver, { toDefault: choice === HOUSE, group });
  return { group, name: choice === HOUSE ? HOUSE : choice.id, placed, restyled };
}
function presetSummary(r) {
  const style = r.name === HOUSE ? "house (the default greys)" : presetById(r.name)?.name ?? r.name;
  const files = r.placed.map((p) => p.what === "added" ? "its DESIGN.md placed beside the flow" : p.what === "versioned" ? "a new version of the flow's wire-style DESIGN.md" : p.what === "removed" ? "the wire-style DESIGN.md moved to the trash" : "its DESIGN.md already there");
  const { changed, targets } = r.restyled;
  const wrote = changed.length > 0 || r.placed.some((p) => p.what !== "unchanged");
  return `${style}: ${[...new Set(files)].join("; ") || "no file to change"} \xB7 ${changed.length} of ${targets.length} wires restyled${wrote ? " \u2014 one op group: one undo takes it all back" : " \u2014 nothing written"}`;
}

// packages/modules/wireframe/src/ds.ts
var DS_DIRECTIONS = [
  {
    id: "nordic-slate",
    name: "Nordic Slate",
    summary: "Crisp cool slate greys, deep navy primary, high-clarity technical tables and operations tools",
    surface: "flat",
    colors: {
      ground: "#ffffff",
      surface: "#f1f5f9",
      line: "#cbd5e1",
      ink: "#0f172a",
      "ink-muted": "#475569",
      bar: "#e2e8f0",
      primary: "#1e3a8a",
      "on-primary": "#ffffff"
    },
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
    radius: { sm: "4px", base: "6px", lg: "10px", full: "999px" }
  },
  {
    id: "editorial-warm",
    name: "Editorial Warm",
    summary: "Warm paper ground, stone surfaces, espresso ink and terracotta primary for consumer and publishing flows",
    surface: "raised",
    colors: {
      ground: "#fafaf9",
      surface: "#f5f5f4",
      line: "#d6d3d1",
      ink: "#1c1917",
      "ink-muted": "#57534e",
      bar: "#e7e5e4",
      primary: "#9a3412",
      "on-primary": "#ffffff"
    },
    fontFamily: "Georgia, 'Times New Roman', ui-serif, serif",
    radius: { sm: "6px", base: "8px", lg: "14px", full: "999px" }
  },
  {
    id: "precision-cobalt",
    name: "Precision Cobalt",
    summary: "Clean white ground, cool zinc borders, cobalt primary and raised cards for SaaS dashboards and analytics",
    surface: "raised",
    colors: {
      ground: "#ffffff",
      surface: "#f4f4f5",
      line: "#d4d4d8",
      ink: "#18181b",
      "ink-muted": "#52525b",
      bar: "#e4e4e7",
      primary: "#1d4ed8",
      "on-primary": "#ffffff"
    },
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    radius: { sm: "6px", base: "8px", lg: "12px", full: "999px" }
  },
  {
    id: "verdant-studio",
    name: "Verdant Studio",
    summary: "Soft sage-tinted surface, deep forest ink and emerald primary for health, sustainability and finance apps",
    surface: "glass",
    colors: {
      ground: "#ffffff",
      surface: "#f0fdf4",
      line: "#bbf7d0",
      ink: "#052e16",
      "ink-muted": "#166534",
      bar: "#dcfce7",
      primary: "#15803d",
      "on-primary": "#ffffff"
    },
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    radius: { sm: "8px", base: "12px", lg: "16px", full: "999px" }
  },
  {
    id: "industrial-amber",
    name: "Industrial Amber",
    summary: "High-contrast stark borders, bold surface shadows, dark bronze primary for field, warehouse and logistics tools",
    surface: "bold",
    colors: {
      ground: "#ffffff",
      surface: "#fef3c7",
      line: "#1c1917",
      ink: "#1c1917",
      "ink-muted": "#44403c",
      bar: "#fde68a",
      primary: "#78350f",
      "on-primary": "#ffffff"
    },
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    radius: { sm: "2px", base: "4px", lg: "6px", full: "999px" }
  }
];
function toHexByte(n) {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
}
function rgbToHex(r, g, b) {
  return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
}
function mixRgb(rgb, target, t) {
  return {
    r: rgb.r + (target.r - rgb.r) * t,
    g: rgb.g + (target.g - rgb.g) * t,
    b: rgb.b + (target.b - rgb.b) * t
  };
}
function ensurePairContrast(fgHex, bgHexes, minRatio) {
  const parsedFg = parseHex(fgHex);
  const bgLums = bgHexes.map((b) => luminance(b)).filter((l) => l !== null);
  if (!parsedFg || bgLums.length === 0) return fgHex;
  const passesAll = (candidate) => bgHexes.every((bg) => {
    const r = contrastRatio(candidate, bg);
    return r !== null && r >= minRatio;
  });
  if (passesAll(fgHex)) return fgHex;
  const avgBgLum = bgLums.reduce((acc, l) => acc + l, 0) / bgLums.length;
  const primaryTarget = avgBgLum > 0.35 ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };
  const fallbackTarget = avgBgLum > 0.35 ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 };
  for (const target of [primaryTarget, fallbackTarget]) {
    for (let step = 1; step <= 50; step++) {
      const t = step / 50;
      const mixed = mixRgb(parsedFg, target, t);
      const hex = rgbToHex(mixed.r, mixed.g, mixed.b);
      if (passesAll(hex)) return hex;
    }
  }
  return avgBgLum > 0.35 ? "#000000" : "#ffffff";
}
function repairContrast(colors, minRatio = CONTRAST_BODY) {
  const out = { ...colors };
  const repairs = [];
  const ground = out.ground ?? "#ffffff";
  const surface = out.surface ?? ground;
  const bgs = [ground, surface];
  for (const role of ["ink", "ink-muted", "primary"]) {
    const current = out[role];
    if (!current) continue;
    const worstBefore = Math.min(
      ...bgs.map((bg) => contrastRatio(current, bg) ?? minRatio)
    );
    if (worstBefore < minRatio) {
      const fixed = ensurePairContrast(current, bgs, minRatio);
      const worstAfter = Math.min(
        ...bgs.map((bg) => contrastRatio(fixed, bg) ?? minRatio)
      );
      out[role] = fixed;
      repairs.push({
        role,
        against: "ground/surface",
        from: current,
        to: fixed,
        beforeRatio: worstBefore,
        afterRatio: worstAfter
      });
    }
  }
  if (out["on-primary"] && out.primary) {
    const current = out["on-primary"];
    const before = contrastRatio(current, out.primary) ?? minRatio;
    if (before < minRatio) {
      const fixed = ensurePairContrast(current, [out.primary], minRatio);
      const after = contrastRatio(fixed, out.primary) ?? minRatio;
      out["on-primary"] = fixed;
      repairs.push({
        role: "on-primary",
        against: "primary",
        from: current,
        to: fixed,
        beforeRatio: before,
        afterRatio: after
      });
    }
  }
  return { colors: out, repairs };
}
async function proposeThenPick(request, answerer = stubAnswerer(1), candidates = DS_DIRECTIONS) {
  const list = candidates.length > 0 ? candidates : DS_DIRECTIONS;
  const dirCriteria = Object.fromEntries(list.map((c) => [c.id, `${c.name}: ${c.summary}`]));
  const surfaceCriteria = {
    flat: "Flat hairline borders and crisp surfaces without drop shadows",
    raised: "Subtle elevation and soft card shadows",
    glass: "Translucent frosted panels with backdrop blur",
    bold: "High-contrast stark borders and offset shadows"
  };
  const dirQ = {
    type: "choice",
    instructions: "Select the visual direction that best fits the product and request.",
    criteria: dirCriteria
  };
  const surfQ = {
    type: "choice",
    instructions: "Select the surface elevation mode for the design system.",
    criteria: surfaceCriteria
  };
  const densQ = {
    type: "score",
    instructions: "Score the appropriate information density for the product.",
    criteria: [
      "1 \u2014 compact density (tight 8px spacing for data-dense tools)",
      "2 \u2014 default density (balanced 12px spacing)",
      "3 \u2014 spacious density (generous 16px editorial spacing)"
    ]
  };
  const questions2 = {
    "ds.direction": dirQ,
    "ds.surface": surfQ,
    "ds.density": densQ
  };
  const req = {
    model: JEV_MODEL,
    state: { task: "Choose design system direction, surface and density", request },
    questions: questions2
  };
  const answered = await answerer.answer(req);
  const dirAns = answered.response.answers["ds.direction"];
  const dirChoice = dirAns ? chosenOption(dirQ, dirAns) : null;
  const pickedId = dirChoice ? dirChoice.value : list[0].id;
  const direction = list.find((c) => c.id === pickedId) ?? list[0];
  const p = dirChoice ? dirChoice.p : 1;
  const surfAns = answered.response.answers["ds.surface"];
  const pickedSurface = surfAns && surfAns.type === "choice" ? chosenOption(surfQ, surfAns).value : direction.surface;
  const densAns = answered.response.answers["ds.density"];
  const scoreIdx = densAns && densAns.type === "score" ? Math.max(0, Math.min(2, Math.round(densAns.score))) : 1;
  const density = DENSITY_LEVELS[scoreIdx] ?? "default";
  return {
    direction,
    surface: pickedSurface,
    density,
    p: Math.round(p * 1e3) / 1e3,
    by: answered.by,
    decisions: compactDecisions(req, answered.response)
  };
}
async function synthesizeDesignSystem(request, answerer = stubAnswerer(1), opts = {}) {
  const picked = await proposeThenPick(request, answerer, opts.candidates);
  const surface = opts.surface ?? picked.surface;
  const mergedColors = { ...picked.direction.colors };
  for (const [k, v] of Object.entries(opts.colors ?? {})) {
    if (typeof v === "string") mergedColors[k] = v;
  }
  const { colors, repairs } = repairContrast(mergedColors, CONTRAST_BODY);
  const name = sanitizeFlowTitle(opts.name ?? `${picked.direction.name} \u2014 ${request || "Design System"}`);
  const { fontFamily, radius } = picked.direction;
  const markdown = [
    "---",
    "version: alpha",
    `name: "${name.replace(/"/g, "'")}"`,
    `description: "Synthesized design system (${picked.direction.name}, surface ${surface}, density ${picked.density}) for ${request.replace(/"/g, "'") || "wireframe flow"}."`,
    `surface: ${surface}`,
    "colors:",
    `  ground: "${colors.ground}"`,
    `  surface: "${colors.surface}"`,
    `  line: "${colors.line}"`,
    `  ink: "${colors.ink}"`,
    `  ink-muted: "${colors["ink-muted"]}"`,
    `  bar: "${colors.bar}"`,
    `  primary: "${colors.primary}"`,
    `  on-primary: "${colors["on-primary"]}"`,
    "typography:",
    "  title:",
    `    fontFamily: "${fontFamily}"`,
    "    fontSize: 20px",
    "    fontWeight: 600",
    "    lineHeight: 1.3",
    "  body:",
    `    fontFamily: "${fontFamily}"`,
    "    fontSize: 14px",
    "    fontWeight: 400",
    "    lineHeight: 1.5",
    "  label:",
    `    fontFamily: "${fontFamily}"`,
    "    fontSize: 14px",
    "    fontWeight: 500",
    "    lineHeight: 1.4",
    "rounded:",
    `  sm: ${radius.sm}`,
    `  base: ${radius.base}`,
    `  lg: ${radius.lg}`,
    `  full: ${radius.full}`,
    "spacing:",
    "  xs: 4px",
    `  base: ${picked.density === "compact" ? "8px" : picked.density === "spacious" ? "16px" : "12px"}`,
    "  md: 16px",
    "  lg: 24px",
    "components:",
    "  button-primary:",
    '    backgroundColor: "{colors.primary}"',
    '    textColor: "{colors.on-primary}"',
    '    typography: "{typography.label}"',
    '    rounded: "{rounded.base}"',
    "    height: 40px",
    '    padding: "0 {spacing.md}"',
    "  card:",
    '    backgroundColor: "{colors.ground}"',
    '    textColor: "{colors.ink}"',
    '    rounded: "{rounded.lg}"',
    '    padding: "{spacing.lg}"',
    "---",
    "",
    "## Overview",
    "",
    `${picked.direction.summary}. Synthesized for "${request || "this canvas"}" with deterministic WCAG AA contrast verification.`,
    "",
    "## Colors",
    "",
    `- **ground** (${colors.ground}) and **surface** (${colors.surface}) establish the canvas hierarchy.`,
    `- **ink** (${colors.ink}) and **ink-muted** (${colors["ink-muted"]}) maintain \u2265 4.5:1 AA contrast against both ground and surface.`,
    `- **primary** (${colors.primary}) and **on-primary** (${colors["on-primary"]}) anchor primary actions.`,
    "",
    "## Typography",
    "",
    `Set in ${fontFamily} with a 20px semibold title and 14px body/label scale.`,
    "",
    "## Layout",
    "",
    `Default density is ${picked.density}.`,
    "",
    "## Elevation & Depth",
    "",
    `\`surface: ${surface}\` governs card and chrome depth across the flow.`,
    "",
    "## Shapes",
    "",
    `Controls use ${radius.base} corners; cards use ${radius.lg}.`,
    "",
    "## Components",
    "",
    "Primary buttons use `{colors.primary}` with `{colors.on-primary}`; cards sit on `{colors.ground}`.",
    "",
    "## Do's and Don'ts",
    "",
    "- Do keep every foreground/background pair at or above 4.5:1 contrast.",
    "- Don't introduce unmapped literal hex colours outside the role tokens.",
    ""
  ].join("\n");
  const doc = parseDesign(markdown);
  const findings = checkDesign(doc).filter((f) => f.severity === "error" || f.severity === "warning");
  if (findings.length > 0) {
    throw new Error(`Synthesized DESIGN.md failed design check: ${findings.map((f) => `${f.where}: ${f.what}`).join("; ")}`);
  }
  return {
    name,
    direction: picked.direction,
    surface,
    density: picked.density,
    colors,
    repairs,
    markdown,
    by: picked.by,
    p: picked.p,
    decisions: picked.decisions
  };
}
var GAP2 = 160;
async function wireDsOnCanvas(port, all, screens, request, answerer = stubAnswerer(1), opts = {}) {
  if (screens.length === 0) {
    throw new Error('no wireframe to style \u2014 `isocan wire "<request>"` composes some');
  }
  const effectiveRequest = request.trim() || screens[0].spec.request || screens[0].spec.title;
  const synthesized = await synthesizeDesignSystem(effectiveRequest, answerer, opts);
  const before = await port.canvas();
  const group = newGroupId();
  const firstItem = before.items[screens[0].item];
  const scope = firstItem ? canvasScopes(before, firstItem)[0]?.id ?? null : null;
  const existing = ownDesignSystemAt(before, scope);
  const title = `DESIGN.md \u2014 ${synthesized.direction.name}`;
  let dsItemId;
  let what;
  if (existing) {
    dsItemId = existing.id;
    const upload = await port.put(synthesized.markdown, "text/markdown", "DESIGN.md");
    await port.send(
      {
        type: "item.addVersion",
        itemId: existing.id,
        version: {
          id: newVersionId(),
          blobHash: upload.blobHash,
          mimeType: "text/markdown",
          filename: "DESIGN.md",
          size: upload.size
        }
      },
      group
    );
    await port.send(
      {
        type: "item.update",
        itemId: existing.id,
        patch: { title, properties: { [PRESET_PROP]: synthesized.direction.id } }
      },
      group
    );
    what = "versioned";
  } else {
    dsItemId = newItemId();
    const upload = await port.put(synthesized.markdown, "text/markdown", "DESIGN.md");
    const scopeItem = scope ? before.items[scope] : void 0;
    await port.send(
      {
        type: "item.add",
        itemId: dsItemId,
        version: {
          id: newVersionId(),
          blobHash: upload.blobHash,
          mimeType: "text/markdown",
          filename: "DESIGN.md",
          size: upload.size
        },
        width: 560,
        height: 720,
        placement: {
          x: Math.max(...screens.map((s) => s.x + s.width)) + GAP2,
          y: Math.min(...screens.map((s) => s.y)),
          chosen: true
        },
        title,
        properties: { [PRESET_PROP]: synthesized.direction.id },
        ...scopeItem && isGroupItem(scopeItem) ? { containerId: scopeItem.id, groupPlacement: "exact" } : {}
      },
      group
    );
    const landed = await port.canvas();
    await port.send(designUse(landed, landed.items[dsItemId]).op, group);
    what = "added";
  }
  const after = await port.canvas();
  const governs = (canvas, s) => {
    const item = canvas.items[s.item];
    const system = item ? governingSystem(canvas, item) : null;
    return system ? `${system.id}@${system.currentVersionId}` : "";
  };
  const asked = new Set(screens.map((s) => s.item));
  const touched = all.filter(
    (s) => after.items[s.item] && (asked.has(s.item) || governs(before, s) !== governs(after, s))
  );
  const resolver = new StyleResolver(port, answerer, async () => all.map((s) => s.spec));
  const restyled = await restyle(port, after, all, touched, resolver, { toDefault: false, group });
  return {
    group,
    dsItemId,
    what,
    synthesized,
    restyled
  };
}

// packages/modules/wireframe/src/polish.ts
function polishIntensityBudget(intensity) {
  const clamped = Math.max(0, Math.min(1, intensity));
  if (clamped < 0.25) return 0;
  if (clamped < 0.5) return 4;
  if (clamped <= 0.75) return 8;
  return 12;
}
function collectAttrValues(html, attr) {
  const out = /* @__PURE__ */ new Set();
  const re = new RegExp(`\\b${attr}="([^"]+)"`, "g");
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[1]) out.add(m[1]);
  }
  return out;
}
function verifyWireContract(baselineHtml, candidateHtml, spec) {
  const problems = [];
  const baseSec = collectAttrValues(baselineHtml, "data-sec");
  const candSec = collectAttrValues(candidateHtml, "data-sec");
  for (const s of baseSec) {
    if (!candSec.has(s)) {
      problems.push(`missing data-sec="${s}" in candidate HTML`);
    }
  }
  const baseWf = collectAttrValues(baselineHtml, "data-wf");
  const candWf = collectAttrValues(candidateHtml, "data-wf");
  for (const w of baseWf) {
    if (!candWf.has(w)) {
      problems.push(`missing data-wf="${w}" in candidate HTML`);
    }
  }
  const baseHot = collectAttrValues(baselineHtml, "data-hot");
  const candHot = collectAttrValues(candidateHtml, "data-hot");
  for (const h of baseHot) {
    if (!candHot.has(h)) {
      problems.push(`missing hotspot data-hot="${h}" in candidate HTML`);
    }
  }
  const baseIntent = collectAttrValues(baselineHtml, "data-intent");
  const candIntent = collectAttrValues(candidateHtml, "data-intent");
  for (const intent of baseIntent) {
    if (!candIntent.has(intent)) {
      problems.push(`missing actionable intent data-intent="${intent}" in candidate HTML`);
    }
  }
  if (spec?.polish) {
    const allowedTokens = new Set(POLISH_TOKENS);
    for (const patch of spec.polish) {
      if (!baseWf.has(patch.target) && !baseSec.has(patch.target)) {
        problems.push(`polish target "${patch.target}" does not match any data-wf or data-sec path on the screen`);
      }
      for (const t of patch.add ?? []) {
        if (!allowedTokens.has(t)) {
          problems.push(`polish token "${t}" on "${patch.target}" is not in POLISH_TOKENS`);
        }
      }
      for (const t of patch.remove ?? []) {
        if (!allowedTokens.has(t)) {
          problems.push(`polish remove token "${t}" on "${patch.target}" is not in POLISH_TOKENS`);
        }
      }
    }
  }
  if (spec?.style && spec.style.source === "design-system") {
    const roles = spec.style.roles;
    const ground = roles.ground?.value ?? DEFAULT_THEME.ground;
    const surface = roles.surface?.value ?? DEFAULT_THEME.surface;
    const ink = roles.ink?.value ?? DEFAULT_THEME.ink;
    const muted = roles["ink-muted"]?.value ?? DEFAULT_THEME["ink-muted"];
    const primary = roles.primary?.value ?? DEFAULT_THEME.primary;
    const onPrimary = roles["on-primary"]?.value ?? DEFAULT_THEME["on-primary"];
    const pairs = [
      ["ink vs ground", ink, ground],
      ["ink vs surface", ink, surface],
      ["ink-muted vs ground", muted, ground],
      ["ink-muted vs surface", muted, surface],
      ["on-primary vs primary", onPrimary, primary]
    ];
    for (const [label, fg, bg] of pairs) {
      const ratio = contrastRatio(fg, bg);
      if (ratio !== null && ratio < CONTRAST_BODY) {
        problems.push(`contrast violation (${label}): ${ratio}:1 < ${CONTRAST_BODY}:1`);
      }
    }
  }
  return { ok: problems.length === 0, problems };
}
function applyWirePolish(spec, patches) {
  const unpolishedSpec = { ...spec };
  delete unpolishedSpec.polish;
  const baselineHtml = renderWire(unpolishedSpec);
  const mergedPatches = [...spec.polish ?? [], ...patches];
  const nextSpec = mergedPatches.length > 0 ? { ...spec, polish: mergedPatches } : unpolishedSpec;
  const candidateHtml = renderWire(nextSpec);
  const check2 = verifyWireContract(baselineHtml, candidateHtml, nextSpec);
  if (!check2.ok) {
    throw new Error(`wire polish rejected by contract gate:
  ${check2.problems.join("\n  ")}`);
  }
  return { spec: nextSpec, html: candidateHtml };
}
var POLISH_DESCRIPTIONS = {
  "wf-elevated": "Elevated card surface with soft shadow and border",
  "wf-bordered": "Crisp 1.5px bordered container with balanced padding",
  "wf-subtle": "Subtle tinted surface background fill",
  "wf-emphasis": "Left accent border emphasizing the section",
  "wf-compact-pad": "Tighter inner padding for compact data sections",
  "wf-spacious-pad": "Generous inner padding for hero or focal sections",
  "wf-rounded-lg": "Larger corner radius for prominent cards",
  "wf-accent-ring": "Primary focus/accent outline ring",
  none: "Leave section unpolished"
};
async function planPolishWithJev(spec, answerer = stubAnswerer(1), opts = {}) {
  const resolvedSlots = spec.slots.filter((s) => s.block !== null);
  const questions2 = {
    "polish.intensity": {
      type: "noul",
      instructions: "Should this screen receive visual polish refinements (elevation, surface contrast, emphasis borders)?",
      criteria: {
        true: "Apply visual polish tokens to refine section hierarchy and surface depth",
        false: "Keep sections unpolished"
      }
    }
  };
  for (const s of resolvedSlots) {
    questions2[`polish.slot.${s.slot}`] = {
      type: "choice",
      instructions: `Choose the visual polish token for slot "${s.slot}" (${s.block}).`,
      criteria: POLISH_DESCRIPTIONS
    };
  }
  const req = {
    model: JEV_MODEL,
    state: {
      task: "Score polish_intensity and choose per-slot visual refinement tokens",
      archetype: spec.archetype,
      title: spec.title,
      request: spec.request,
      slots: resolvedSlots.map((s) => ({ slot: s.slot, block: s.block }))
    },
    questions: questions2
  };
  const answered = await answerer.answer(req);
  const intAns = answered.response.answers["polish.intensity"];
  const rawIntensity = opts.intensity !== void 0 ? opts.intensity : intAns && intAns.type === "noul" ? intAns.noul : 0.5;
  const budget = polishIntensityBudget(rawIntensity);
  const patches = [];
  if (budget > 0) {
    for (const s of resolvedSlots) {
      if (patches.length >= budget) break;
      const q = questions2[`polish.slot.${s.slot}`];
      const ans = answered.response.answers[`polish.slot.${s.slot}`];
      const pick = ans && ans.type === "choice" ? chosenOption(q, ans).value : "wf-bordered";
      const token = pick !== "none" && POLISH_TOKENS.includes(pick) ? pick : s.slot.startsWith("main") ? "wf-elevated" : "wf-subtle";
      patches.push({ target: s.slot, add: [token] });
    }
  }
  return {
    intensity: Math.round(rawIntensity * 1e3) / 1e3,
    budget,
    patches,
    by: answered.by,
    decisions: compactDecisions(req, answered.response)
  };
}
async function polishWireOnCanvas(port, canvas, all, screens, answerer = stubAnswerer(1), opts = {}) {
  const group = opts.group ?? newGroupId();
  let by = answerer.name;
  const plannedWrites = [];
  for (const s of screens) {
    if (isBlueprint(s.spec)) continue;
    const item = canvas.items[s.item];
    if (!item) continue;
    if (opts.clear) {
      if (!s.spec.polish || s.spec.polish.length === 0) continue;
      const cleared = { ...s.spec };
      delete cleared.polish;
      plannedWrites.push({
        screen: s,
        item,
        next: cleared,
        intensity: 0,
        budget: 0,
        patches: []
      });
      continue;
    }
    const planned = await planPolishWithJev(s.spec, answerer, {
      ...opts.intensity !== void 0 ? { intensity: opts.intensity } : {}
    });
    by = planned.by;
    if (planned.patches.length === 0) continue;
    const mergedDecisions = { ...s.spec.decisions ?? {}, ...planned.decisions };
    const { spec: polished } = applyWirePolish(
      Object.keys(mergedDecisions).length > 0 ? { ...s.spec, decisions: mergedDecisions } : s.spec,
      planned.patches
    );
    if (JSON.stringify(polished) === JSON.stringify(s.spec)) continue;
    plannedWrites.push({
      screen: s,
      item,
      next: polished,
      intensity: planned.intensity,
      budget: planned.budget,
      patches: planned.patches
    });
  }
  const changed = [];
  for (const p of plannedWrites) {
    if (await writeWire(port, p.item, p.next, group, p.screen.spec)) {
      changed.push({
        itemId: p.screen.item,
        title: wireTitle(p.next),
        intensity: p.intensity,
        budget: p.budget,
        patches: p.patches,
        spec: p.next
      });
    }
  }
  const prototypes = await rebuildPrototypes(
    port,
    canvas,
    all,
    changed.map((c) => ({ item: c.itemId, spec: c.spec })),
    group
  );
  return { group, by, changed, prototypes };
}

// packages/modules/wireframe/src/layers.ts
var WIRE_LAYER_PROP = "wireLayer";
var WIRE_LAYER_PREFIX = "wireLayer:";
var LAYER_LABELS = {
  system: { short: "System", label: "Design System", hint: "Governing DESIGN.md colors, type, radius & surface" },
  copy: { short: "Copy", label: "Copy & Data", hint: "Domain words & numbers instead of grey bars" },
  lofi: { short: "Low-Fi", label: "Low-Fi (Fluid UI)", hint: "Unboxed fluid layout, elevated cards & polish" },
  hifi: { short: "High-Fi", label: "High-Fi (Visual Craft)", hint: "Full art-directed visuals & studio stage" }
};
var TIER_LABELS = {
  wire: { title: "1 \xB7 Wire (Simple Blocks)", badge: "Wire", summary: "plain monochrome wireframe blocks and grey bars" },
  system: { title: "2 \xB7 Wire + Design System", badge: "System", summary: "design system tokens and domain copy" },
  lofi: { title: "3 \xB7 Low-Fi (Fluid UI)", badge: "Low-Fi", summary: "unboxed fluid cards, real controls and visual polish" },
  hifi: { title: "4 \xB7 High-Fi (Visual Craft)", badge: "High-Fi", summary: "art-directed high-fidelity visual craft" }
};
function tierFromLayers(layers) {
  if (layers.hifi) return "hifi";
  if (layers.lofi) return "lofi";
  if (layers.system || layers.copy) return "system";
  return "wire";
}
function layersForTier(tier) {
  switch (tier) {
    case "wire":
      return { system: false, copy: false, lofi: false, hifi: false };
    case "system":
      return { system: true, copy: true, lofi: false, hifi: false };
    case "lofi":
      return { system: true, copy: true, lofi: true, hifi: false };
    case "hifi":
      return { system: true, copy: true, lofi: true, hifi: true };
  }
}
function hasVersion(item, versionId) {
  return Boolean(versionId && item.versions.some((v) => v.id === versionId));
}
function resolveItemLayers(item, spec) {
  const props = item.properties ?? {};
  const savedHifi = props["wireLayer:hifi"];
  const savedLofi = props["wireLayer:lofi"];
  const savedSystem = props["wireLayer:system"];
  const savedWire = props["wireLayer:wire"];
  const hasSavedHifi = hasVersion(item, savedHifi);
  const hasSavedLofi = hasVersion(item, savedLofi);
  if (hasSavedHifi && item.currentVersionId === savedHifi) {
    return { system: true, copy: true, lofi: true, hifi: true, tier: "hifi", hasSavedHifi, hasSavedLofi };
  }
  if (hasSavedLofi && item.currentVersionId === savedLofi) {
    return { system: true, copy: true, lofi: true, hifi: false, tier: "lofi", hasSavedHifi, hasSavedLofi };
  }
  if (hasVersion(item, savedWire) && item.currentVersionId === savedWire && !spec?.layers) {
    return { system: false, copy: false, lofi: false, hifi: false, tier: "wire", hasSavedHifi, hasSavedLofi };
  }
  if (hasVersion(item, savedSystem) && item.currentVersionId === savedSystem && !spec?.layers) {
    return { system: true, copy: true, lofi: false, hifi: false, tier: "system", hasSavedHifi, hasSavedLofi };
  }
  const explicit = spec?.layers;
  const hifi = explicit?.hifi ?? props[WIRE_LAYER_PROP] === "hifi";
  if (hifi) {
    return { system: true, copy: true, lofi: true, hifi: true, tier: "hifi", hasSavedHifi, hasSavedLofi };
  }
  const lofi = explicit?.lofi ?? (props[WIRE_LAYER_PROP] === "lofi" || Boolean(spec?.polish && spec.polish.length > 0));
  const system = explicit?.system ?? Boolean(spec?.style && spec.style.source !== "default");
  const copy = explicit?.copy ?? Boolean(spec?.content || spec?.slots.some((s) => s.fill !== void 0));
  const tier = tierFromLayers({ system, copy, lofi, hifi: false });
  return { system, copy, lofi, hifi: false, tier, hasSavedHifi, hasSavedLofi };
}
function parseLayerDirective(raw, current) {
  const tokens = raw.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    throw new Error(
      "which layer? Choose a tier (`wire`, `system`, `lofi`, `hifi`) or toggle individual layers (`+system`, `-system`, `+copy`, `-copy`, `+lofi`, `-lofi`, `+hifi`, `-hifi`)."
    );
  }
  const single = tokens[0];
  if (tokens.length === 1) {
    if (single === "wire" || single === "1" || single === "basic" || single === "blocks") return layersForTier("wire");
    if (single === "system" || single === "2" || single === "ds") return layersForTier("system");
    if (single === "lofi" || single === "low-fi" || single === "3" || single === "fluid") return layersForTier("lofi");
    if (single === "hifi" || single === "high-fi" || single === "4" || single === "craft") return layersForTier("hifi");
  }
  const next = {
    system: current.system,
    copy: current.copy,
    lofi: current.lofi,
    hifi: current.hifi
  };
  for (const tok of tokens) {
    const normalizeLayer = (name2) => {
      if (name2 === "system" || name2 === "ds" || name2 === "style") return "system";
      if (name2 === "copy" || name2 === "content" || name2 === "flesh" || name2 === "data") return "copy";
      if (name2 === "lofi" || name2 === "low-fi" || name2 === "polish") return "lofi";
      if (name2 === "hifi" || name2 === "high-fi" || name2 === "craft") return "hifi";
      return null;
    };
    let op = "on";
    let name = tok;
    if (tok.startsWith("+") || tok.startsWith("on:")) {
      op = "on";
      name = tok.replace(/^(\+|on:)/, "");
    } else if (tok.startsWith("-") || tok.startsWith("no-") || tok.startsWith("off:")) {
      op = "off";
      name = tok.replace(/^(-|no-|off:)/, "");
    } else if (tok.startsWith("toggle:") || tok.startsWith("~")) {
      op = "toggle";
      name = tok.replace(/^(toggle:|~)/, "");
    }
    const layer = normalizeLayer(name);
    if (!layer) {
      throw new Error(
        `unknown layer "${tok}" \u2014 layers are ${WIRE_LAYER_IDS.join(", ")} (or tiers: ${WIRE_FIDELITY_TIERS.join(", ")})`
      );
    }
    const val = op === "toggle" ? !next[layer] : op === "on";
    if (layer === "hifi") {
      if (val) {
        next.system = true;
        next.copy = true;
        next.lofi = true;
        next.hifi = true;
      } else {
        next.hifi = false;
      }
    } else {
      next[layer] = val;
      if (!val && next.hifi) {
        next.hifi = false;
      }
    }
  }
  return next;
}
async function applyLayersOnCanvas(port, canvas, all, targets, directive) {
  const group = newGroupId();
  const changed = [];
  for (const screen of targets) {
    const item = canvas.items[screen.item];
    if (!item) continue;
    const currentResolved = resolveItemLayers(item, screen.spec);
    const nextLayers = typeof directive === "string" ? parseLayerDirective(directive, currentResolved) : directive;
    const nextTier = tierFromLayers(nextLayers);
    const propPatch = {
      [WIRE_LAYER_PROP]: nextTier
    };
    const currentKey = `${WIRE_LAYER_PREFIX}${currentResolved.tier}`;
    if (!item.properties?.[currentKey]) {
      propPatch[currentKey] = item.currentVersionId;
    }
    const exactTierMatch = nextTier === "hifi" && nextLayers.hifi || nextTier === "lofi" && !nextLayers.hifi && nextLayers.lofi && nextLayers.system && nextLayers.copy || nextTier === "system" && !nextLayers.hifi && !nextLayers.lofi && nextLayers.system && nextLayers.copy || nextTier === "wire" && !nextLayers.hifi && !nextLayers.lofi && !nextLayers.system && !nextLayers.copy;
    const savedTargetVer = exactTierMatch ? item.properties?.[`${WIRE_LAYER_PREFIX}${nextTier}`] : void 0;
    if (savedTargetVer && hasVersion(item, savedTargetVer)) {
      if (item.currentVersionId !== savedTargetVer) {
        await port.send({ type: "item.setCurrentVersion", itemId: item.id, versionId: savedTargetVer }, group);
      }
      await port.send({ type: "item.update", itemId: item.id, patch: { properties: propPatch } }, group);
      changed.push({ itemId: item.id, title: item.title, tier: nextTier, layers: nextLayers });
      continue;
    }
    const nextSpec = {
      ...screen.spec,
      layers: nextLayers
    };
    const html = renderWire(nextSpec);
    const currentVer = currentVersionOf(item);
    const currentHtml = currentVer ? await port.readText(currentVer.blobHash) : "";
    if (html !== currentHtml) {
      const filename = `${titleSlug(wireTitle(nextSpec), { max: 60 }) || "screen"}.html`;
      const uploaded = await port.put(html, "text/html", filename);
      const versionId = newVersionId();
      await port.send(
        {
          type: "item.addVersion",
          itemId: item.id,
          version: { id: versionId, blobHash: uploaded.blobHash, mimeType: "text/html", filename, size: uploaded.size }
        },
        group
      );
      if (exactTierMatch && !item.properties?.[`${WIRE_LAYER_PREFIX}${nextTier}`]) {
        propPatch[`${WIRE_LAYER_PREFIX}${nextTier}`] = versionId;
      }
    }
    await port.send({ type: "item.update", itemId: item.id, patch: { properties: propPatch } }, group);
    changed.push({ itemId: item.id, title: item.title, tier: nextTier, layers: nextLayers });
  }
  const prototypes = [];
  if (changed.length > 0) {
    const now = await port.canvas();
    const nowWires = await Promise.all(
      all.map(async (s) => {
        const it = now.items[s.item];
        const v = it ? currentVersionOf(it) : void 0;
        const parsed = v ? readWire(await port.readText(v.blobHash)) : null;
        return { ...s, spec: parsed ?? s.spec };
      })
    );
    const touchedFlows = new Set(targets.map((t) => t.spec.flow).filter(Boolean));
    for (const flow of keptFlowsOf(now, nowWires)) {
      if (!touchedFlows.has(flow.flow)) continue;
      const protoItem = Object.values(now.items).find((i) => i.properties?.[PROTOTYPE_PROP] === flow.flow);
      const targetTier = changed[0]?.tier;
      const savedProtoVer = targetTier ? protoItem?.properties?.[`${WIRE_LAYER_PREFIX}${targetTier}`] : void 0;
      if (protoItem && targetTier && savedProtoVer && hasVersion(protoItem, savedProtoVer)) {
        if (protoItem.currentVersionId !== savedProtoVer) {
          await port.send({ type: "item.setCurrentVersion", itemId: protoItem.id, versionId: savedProtoVer }, group);
        }
        await port.send(
          { type: "item.update", itemId: protoItem.id, patch: { properties: { [WIRE_LAYER_PROP]: targetTier } } },
          group
        );
        prototypes.push(protoItem.id);
      } else {
        const w = await writePrototype(port, now, flow, group);
        if (w.what !== "unchanged") prototypes.push(w.itemId);
      }
    }
  }
  return { group, changed, prototypes };
}
function layerSummary(result) {
  if (result.changed.length === 0) return "No wireframe screens changed";
  const first = result.changed[0];
  const tierInfo = TIER_LABELS[first.tier];
  const checked = WIRE_LAYER_IDS.filter((id) => first.layers[id]).map((id) => LAYER_LABELS[id].short);
  const checkWords2 = checked.length > 0 ? `checked: ${checked.join(", ")}` : "all enhancement layers off (pure wire blocks)";
  const protoWords = result.prototypes.length > 0 ? ` \xB7 prototype updated` : "";
  return `${result.changed.length} screen${result.changed.length === 1 ? "" : "s"} \u2192 ${tierInfo.badge} (${checkWords2})${protoWords} \u2014 one undo takes it back`;
}

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
function isWire(item) {
  return item.properties?.[FIDELITY_PROP] === "wireframe" && item.properties?.[PROTOTYPE_PROP] === void 0;
}
function specKey(item) {
  const v = currentVersionOf(item);
  return v && v.mimeType === "text/html" ? v.blobHash : null;
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

// packages/modules/wireframe/src/compose-cli.ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
function saver(dir) {
  if (!dir) return void 0;
  return async (round, calls, responses) => {
    await mkdir(dir, { recursive: true });
    await Promise.all(calls.map(async (call, i) => {
      const name = `round-${round}.${i + 1}`;
      await writeFile(path.join(dir, `${name}.request.json`), JSON.stringify(call.request, null, 2));
      await writeFile(path.join(dir, `${name}.response.json`), JSON.stringify(responses[i], null, 2));
    }));
  };
}
function mappingSaver(dir) {
  if (!dir) return void 0;
  return async (system, versionId, request, response) => {
    await mkdir(dir, { recursive: true });
    const stem = path.join(dir, `style-${system.id}-${versionId}`);
    await writeFile(`${stem}.request.json`, JSON.stringify(request, null, 2));
    await writeFile(`${stem}.response.json`, JSON.stringify(response, null, 2));
  };
}
function registerCompose(host, wire) {
  const { run, ctxOf, resolveCanvas, printJson, placementFor } = host;
  wire.argument("[request...]", "what the screens are for, in words \u2014 composes a flow").option("--answerer <name>", "jev (needs TYPESAFE_API_KEY), home (Jev through the canvas's home, with its key), stub (random, seeded) or agent (you answer: `wire questions` / `wire answer`) \u2014 default jev when the key is set, else the home, else the stub").option("--seed <n>", "the stub's seed", "1").option("--save <dir>", "write each round's requests and responses there as JSON").option("--canvas <canvas>").option("--at <x,y>", "start the row at world coordinates (default: under everything on the canvas)").option("--in <group>", "compose the flow inside this group \u2014 and in its design system, if it has one").option("--basic", "plain grey wires: no sample content and no prototype (the default fleshes the screens and puts the answerer's first choices in a prototype)").option("--flesh", "arrive fleshed \u2014 the default now; kept so older scripts still run").option("--pack <id>", "the content pack to flesh with, instead of asking (`wire flesh --packs` lists them)").option("--pin <key=value...>", "pin root flow decisions up front (for example: --pin platform=web --pin density=compact)").option("--no-ask", "suppress high-entropy root /ask prompts and pick top-1 silently").action(
    run(async (words, opts, cmd) => {
      const request = words.join(" ").trim();
      if (!request) {
        cmd.help();
        return;
      }
      const ctx = await ctxOf(cmd);
      const say = (line) => {
        if (!ctx.json) console.log(line);
      };
      const p = await resolveCanvas(ctx);
      const port = cliPort(host, ctx, p.id);
      const seed = Number(opts.seed);
      if (opts.basic && (opts.pack !== void 0 || opts.flesh)) throw new Error("--basic arrives unfleshed \u2014 it cannot take --pack or --flesh too");
      const pinned = parsePinFlags(opts.pin);
      if (opts.pack !== void 0) flagPack(opts.pack);
      const answerer = opts.answerer === "agent" ? "agent" : cliAnswerer(ctx, p.id, opts.answerer, seed, say);
      const snapshot = await ctx.client.snapshot(p.id);
      const placement = opts.in !== void 0 || opts.at ? placementFor(snapshot, { ...opts.at ? { at: opts.at } : {}, ...opts.in !== void 0 ? { in: opts.in } : {} }, wireSize(requestBlueprint(request, "flow"))) : void 0;
      const blueprintLine = (item, ms) => say(`${item}  "${request}" \u2014 a blueprint, on the canvas in ${ms} ms, before any answer`);
      if (answerer === "agent") {
        const t0 = Date.now();
        const { first, flow } = await startFlow(port, request, placement);
        const firstMs = Date.now() - t0;
        blueprintLine(first.item, firstMs);
        if (ctx.json) return printJson({ flow, items: [first.item], round: 1, answerer: "agent", firstBlueprintMs: firstMs });
        if (!opts.basic) say("sample content waits for the rounds: once the flow is drawn, `isocan wire flesh --flow " + flow + (opts.pack !== void 0 ? " --pack " + opts.pack : "") + "` fills it");
        say(`flow ${flow} is waiting on round 1 of 3. Answer it yourself:
  isocan wire questions > round.json    # Jev's request shape, one call per screen
  (fill each call's "response" in Jev's response shape)
  isocan wire answer round.json          # repeat until the flow is drawn`);
        return;
      }
      const who = answerer.name === "stub" ? `the stub (seed ${opts.seed})${localJevKey() ? "" : " \u2014 no TYPESAFE_API_KEY here, nor a stored typesafe key"}` : answerer.name === "home" ? "Jev through the canvas's home \u2014 no TYPESAFE_API_KEY here, nor a stored typesafe key, so the home's key answers" : "Jev";
      const onGateAsk = opts.ask !== false && process.stdin.isTTY && !ctx.json ? async (askQ) => {
        const { createInterface } = await import("node:readline/promises");
        const rl = createInterface({ input: process.stdin, output: process.stderr });
        try {
          const choices = askQ.options.map((o, idx) => `${idx + 1}=${o.value}`).join(", ");
          const raw = (await rl.question(`  Choose (${choices}, or Enter for ${askQ.chosen}): `)).trim();
          if (!raw) return void 0;
          const byIndex = Number(raw);
          if (Number.isInteger(byIndex) && byIndex >= 1 && byIndex <= askQ.options.length) {
            return askQ.options[byIndex - 1].value;
          }
          const byVal = askQ.options.find((o) => o.value.toLowerCase() === raw.toLowerCase());
          return byVal ? byVal.value : raw;
        } finally {
          rl.close();
        }
      } : void 0;
      const composed = await composeFlow(port, request, answerer, {
        ...placement ? { placement } : {},
        say,
        onBlueprint: (first, ms) => {
          blueprintLine(first.item, ms);
          say(`answering with ${who}`);
        },
        ...saver(opts.save) ? { onAsked: saver(opts.save), onMappingAsked: mappingSaver(opts.save) } : {},
        flesh: opts.basic ? false : opts.pack !== void 0 ? { pack: opts.pack } : {},
        ...Object.keys(pinned).length > 0 ? { pinned } : {},
        ...opts.ask === false ? { noAsk: true } : {},
        ...onGateAsk ? { onGateAsk } : {}
      });
      const { mapper, tallies } = composed;
      if (ctx.json) {
        return printJson({
          flow: composed.flow,
          answerer: composed.by,
          firstBlueprintMs: composed.firstMs,
          totalMs: composed.totalMs,
          screens: composed.screens.map((s) => ({ itemId: s.item, title: s.spec.title, archetype: s.spec.archetype, platform: s.spec.platform, slots: s.spec.slots, ...s.spec.varied ? { varied: s.spec.varied } : {}, ...s.spec.need !== void 0 ? { need: s.spec.need } : {}, ...s.spec.maybe ? { maybe: true } : {}, ...s.spec.by ? { by: s.spec.by } : {} })),
          variations: composed.variants.map((v) => ({ itemId: v.item, title: wireTitle(v.spec), variantOf: v.spec.variantOf, flip: v.spec.flip })),
          rounds: tallies,
          style: composed.style ?? { source: "default" },
          content: composed.pack ? { source: "pack", pack: composed.pack.pack, leaned: composed.pack.leaned, p: composed.pack.p, how: composed.pack.how } : null,
          prototype: composed.prototype ? { itemId: composed.prototype.itemId, title: composed.prototype.title, keptBy: composed.prototype.answerer, screens: composed.prototype.screens.map((s) => ({ itemId: s.item, title: wireTitle(s.spec) })), links: composed.prototype.links.length } : null,
          styleCalls: mapper.calls,
          inputTokens: tallies.reduce((s, t) => s + t.inputTokens, 0) + mapper.inputTokens,
          cost: (tallies.reduce((s, t) => s + t.inputTokens, 0) + mapper.inputTokens) * JEV_INPUT_PRICE
        });
      }
      say(costLine(tallies, composed.by, composed.screens.length, composed.screens.filter((s) => s.spec.maybe).length) + ` \xB7 ${composed.totalMs} ms in all \u2014 \`isocan undo\` takes the whole flow back${composed.prototype ? ", prototype included" : ""}`);
      if (composed.prototype) {
        say(`swap in a variation: \`isocan wire use <variation>\` and \`isocan wire unuse <its screen>\` \u2014 the prototype follows \xB7 \`isocan open ${composed.prototype.itemId}\` plays it`);
      }
    })
  );
}
async function questions(host, opts, cmd) {
  const { ctxOf, resolveCanvas } = host;
  const ctx = await ctxOf(cmd);
  const p = await resolveCanvas(ctx);
  const port = cliPort(host, ctx, p.id);
  const { flow, screens, round } = pickFlow(await flowsOn(port, await port.canvas()), opts.flow);
  const file = { flow, round, calls: roundCalls(round, screens) };
  console.log(JSON.stringify(file, null, 2));
}
async function answer(host, file, cmd) {
  const { ctxOf, resolveCanvas, printJson } = host;
  let answered;
  try {
    answered = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    throw new Error(`${file} is not a JSON file this can read: ${error.message}`);
  }
  const ctx = await ctxOf(cmd);
  const say = (line) => {
    if (!ctx.json) console.log(line);
  };
  const p = await resolveCanvas(ctx);
  const port = cliPort(host, ctx, p.id);
  const { flow, screens, round } = pickFlow(await flowsOn(port, await port.canvas()), answered.flow);
  if (answered.round !== round) throw new Error(`${file} answers round ${answered.round}, but flow ${flow} is waiting on round ${round} \u2014 \`isocan wire questions\` prints it`);
  const calls = roundCalls(round, screens);
  const responses = calls.map((call) => {
    const mine = (answered.calls ?? []).find((c) => c.item === call.item);
    if (!mine) throw new Error(`${file} has no call for ${call.item} \u2014 every screen in round ${round} needs its answers`);
    if (Object.keys(call.request.questions).length === 0) return { answers: {} };
    return answeredResponse({ ...call, response: mine.response }, `${file}'s call for ${call.item}`);
  });
  const canvas = new FlowCanvas(port, flow);
  canvas.by = wireBy("agent", port.actor);
  const mapper = new StyleResolver(port, cliAnswerer(ctx, p.id, void 0, 1, say), async () => screens.map((s) => s.spec));
  const styled = await styleAt(port, screens[0].item, mapper);
  canvas.style = styled.system ? styled.style : void 0;
  if (round === 1) for (const line of styled.lines) say(line);
  const after = await applyRound(canvas, round, screens, calls, responses, say);
  const next = pendingRound(after.map((s) => s.spec));
  if (ctx.json) return printJson({ flow, round, items: after.map((s) => s.item), next });
  say(next ? `round ${round} applied \u2014 round ${next} is next: \`isocan wire questions\`` : `round 3 applied \u2014 flow ${flow} is drawn; \`isocan undo\` takes the whole flow back. Put the screens that belong in a prototype with \`isocan wire use <screens...>\`, then \`isocan wire prototype\``);
}

// packages/modules/wireframe/src/vary-cli.ts
function registerVary(host, wire) {
  const { run, ctxOf, resolveCanvas, resolveItem, printJson } = host;
  wire.command("vary <screen>").description("Add a screen's variations under it \u2014 each flips the least certain remaining decision to its runner-up, from the distribution the answerer already gave").option("--canvas <canvas>").option("--count <n>", `how many variations the screen should have in all (default ${DEFAULT_VARIATIONS})`).action(
    run(async (ref, _local, cmd) => {
      const opts = cmd.optsWithGlobals();
      const count = opts.count === void 0 ? DEFAULT_VARIATIONS : Number(opts.count);
      if (!Number.isInteger(count) || count < 0) throw new Error(`--count must be a whole number \u2014 got: ${opts.count}`);
      const ctx = await ctxOf(cmd);
      const p = await resolveCanvas(ctx);
      const snapshot = await ctx.client.snapshot(p.id);
      const item = resolveItem(snapshot, ref);
      const port = cliPort(host, ctx, p.id);
      const wires = await wiresOn(port, snapshot.canvas);
      const screen = wires.find((w) => w.item === item.id);
      if (!screen) throw new Error(`"${item.title}" is not a wireframe screen \u2014 \`isocan wire "<request>"\` composes some`);
      if (screen.spec.variantOf) {
        const of = snapshot.canvas.items[screen.spec.variantOf];
        throw new Error(`"${item.title}" is a variation${of ? ` of "${of.title}"` : ""} \u2014 vary the screen itself: \`isocan wire vary ${screen.spec.variantOf}\``);
      }
      if (decisions(screen.spec).length === 0) {
        throw new Error(`"${item.title}" carries no answerer's distribution (drawn by hand, or not yet answered) \u2014 there is nothing to vary it from`);
      }
      const siblings = wires.filter((w) => w.spec.variantOf === screen.item);
      const canvas = new FlowCanvas(port, newGroupId());
      if (screen.spec.by) canvas.by = { ...screen.spec.by, ...port.actor ? { actor: port.actor } : {} };
      const made = await addVariations(canvas, screen, siblings, count);
      const left = honestFlips(screen.spec, [...siblings, ...made].map((v) => v.spec.flip).filter(Boolean));
      if (ctx.json) {
        return printJson({
          screen: screen.item,
          added: made.map((v) => ({ itemId: v.item, title: wireTitle(v.spec), flip: v.spec.flip })),
          siblings: siblings.length + made.length,
          honestLeft: left.length
        });
      }
      for (const v of made) console.log(`${v.item}  ${wireTitle(v.spec)}`);
      const total = siblings.length + made.length;
      if (made.length === 0 && total === 0) {
        console.log(`"${item.title}" \u2014 one way to draw this: no decision's runner-up reached ${VARIATION_FLOOR.toFixed(2)}`);
      } else if (made.length === 0) {
        console.log(`"${item.title}" already has ${total} variation${total === 1 ? "" : "s"}${left.length ? ` \u2014 --count ${total + 1} adds the next (${flipWords(left[0])})` : ", and no honest alternative is left"}`);
      } else {
        console.log(`${made.length} added under "${item.title}" (${total} in all)${left.length ? "" : " \u2014 no honest alternative is left"} \xB7 \`isocan undo\` takes them back`);
      }
    })
  );
  wire.command("keep <items...>").description(`Use screens in the prototype (${KEEP_EMOJI}) \u2014 a property on the item, as a slide is, so anyone can take it off. \`wire use\` says the same`).option("--canvas <canvas>").action(markScreens(host, true));
  wire.command("unkeep <items...>").description(`Take screens out of the prototype (${KEEP_EMOJI}) \u2014 anyone's mark, not only your own. \`wire unuse\` says the same`).option("--canvas <canvas>").action(markScreens(host, false));
  wire.command("kept").description(`List the screens in the prototype (${KEEP_EMOJI}) in reading order \u2014 rows top to bottom, each left to right`).option("--canvas <canvas>").option("--prototype <item>", "only the screens this prototype plays, in its order \u2014 its flow's screens in the prototype and any guest from another flow (what selecting it lights on the canvas)").action(
    run(async (opts, cmd) => {
      const ctx = await ctxOf(cmd);
      const p = await resolveCanvas(ctx);
      const snapshot = await ctx.client.snapshot(p.id);
      const canvas = snapshot.canvas;
      let list = kept(canvas);
      if (opts.prototype !== void 0) {
        const proto = resolveItem(snapshot, opts.prototype);
        if (proto.properties?.[PROTOTYPE_PROP] === void 0) throw new Error(`${proto.id} is not a prototype \u2014 \`isocan ls --filter Prototype\` finds them`);
        const port = cliPort(host, ctx, p.id);
        list = prototypeScreens(canvas, proto, await wiresOn(port, canvas));
        if (!ctx.json && list.length === 0) {
          console.log(`nothing prototype ${proto.id} plays is marked for it any more \u2014 \`isocan wire use <screens...>\` (${KEEP_EMOJI}) and it follows`);
          return;
        }
      }
      if (ctx.json) return printJson(list.map((i, n) => ({ n: n + 1, itemId: i.id, title: i.title })));
      if (list.length === 0) {
        console.log(`no screen is in the prototype \u2014 \`isocan wire use <screens...>\` marks them ${KEEP_EMOJI}`);
        return;
      }
      list.forEach((i, n) => console.log(`${String(n + 1).padStart(2)}. ${KEEP_EMOJI} ${i.id}  ${i.title}`));
    })
  );
}
function markScreens(host, on) {
  const { run, ctxOf, resolveCanvas, resolveItem, sendOp, printJson } = host;
  return run(async (refs, _local, cmd) => {
    const ctx = await ctxOf(cmd);
    const p = await resolveCanvas(ctx);
    const snapshot = await ctx.client.snapshot(p.id);
    const items = refs.map((ref) => resolveItem(snapshot, ref));
    const refused = items.filter((item) => !keepable(item) || item.properties?.[PROTOTYPE_PROP] !== void 0);
    if (refused.length) {
      throw new Error(`not a wireframe screen: ${refused.map((i) => `"${i.title}"`).join(", ")} \u2014 a prototype plays screens \`isocan wire\` drew`);
    }
    const group = newGroupId();
    const changed = [];
    const port = cliPort(host, ctx, p.id);
    const who = port.actor?.id;
    for (const item of items) {
      if (isKept(item) === on || changed.includes(item.id)) continue;
      await sendOp(ctx, p.id, { type: "item.update", itemId: item.id, patch: keepPatch(on, who) }, group);
      changed.push(item.id);
    }
    const followed = changed.length ? await followMarks(port, changed, group) : [];
    if (ctx.json) return printJson({ [on ? "kept" : "unkept"]: changed, unchanged: items.filter((i) => !changed.includes(i.id)).map((i) => i.id), prototypes: followed });
    for (const item of items) {
      const moved = changed.includes(item.id);
      console.log(`${item.id}  ${on ? KEEP_EMOJI : "  "} "${item.title}" ${on ? moved ? "in the prototype" : "was already in the prototype" : moved ? "removed from the prototype" : "was not in the prototype"}`);
    }
    const now = kept((await ctx.client.snapshot(p.id)).canvas).length;
    console.log(`${now} screen${now === 1 ? "" : "s"} in the prototype${changed.length && followed.length === 0 ? " \u2014 `isocan wire prototype` builds one for a flow that has none" : ""}`);
    for (const f of followed) console.log(followedLine(f));
  });
}

// packages/modules/wireframe/src/links-cli.ts
async function keptFlows(port) {
  const canvas = await port.canvas();
  return keptFlowsOf(canvas, await wiresOn(port, canvas));
}
function linkLine(l, title) {
  const where = l.to === LINK_BACK ? "back" : l.to ? `\u2192 "${title(l.to)}"` : l.needs ? `- - needs ${l.needs}` : "off";
  return `  ${l.key.padEnd(18)} ${l.label.padEnd(16)} ${where.padEnd(28)} ${l.rule}${l.to && l.to !== LINK_BACK ? `, ${l.transition}` : ""}`;
}
function registerLinks(host, wire) {
  const { run, ctxOf, resolveCanvas, resolveItem, printJson } = host;
  wire.command("links [screen]").description("Print where every hotspot on the screens in the prototype goes \u2014 inferred from intents, archetypes and reading order, and any override set with `wire link`").option("--canvas <canvas>").option("--flow <flow>", "which flow's prototype (default: the only one)").action(
    run(async (ref, _local, cmd) => {
      const opts = cmd.optsWithGlobals();
      const ctx = await ctxOf(cmd);
      const p = await resolveCanvas(ctx);
      const snapshot = await ctx.client.snapshot(p.id);
      const flows = await keptFlows(cliPort(host, ctx, p.id));
      const only = ref ? resolveItem(snapshot, ref) : null;
      const flow = only ? flows.find((f) => f.screens.some((s) => s.id === only.id) && !f.guests.includes(only.id)) : pickKeptFlow(flows, opts.flow);
      if (!flow) throw new Error(`"${only.title}" is not in the prototype \u2014 links run between the screens in it (\`isocan wire use ${only.id}\`)`);
      const links = inferLinks(flow.screens, { withNone: true });
      const shown = links.filter((l) => only ? l.from === only.id : !flow.guests.includes(l.from));
      if (ctx.json) return printJson({ flow: flow.flow, request: flow.request, screens: flow.screens.map((s) => ({ itemId: s.id, title: s.title })), links: shown });
      const title = (id) => flow.screens.find((s) => s.id === id)?.title ?? id;
      for (const s of flow.screens) {
        if (only && s.id !== only.id || flow.guests.includes(s.id)) continue;
        console.log(`${s.id}  "${s.title}" (${s.spec.archetype})`);
        const mine = shown.filter((l) => l.from === s.id);
        if (mine.length === 0) console.log("  (no hotspot that navigates)");
        for (const l of mine) console.log(linkLine(l, title));
      }
      const missing = shown.filter((l) => l.to === null && l.needs);
      const needs = [...new Set(missing.map((l) => l.needs))];
      console.log(`
${shown.length} links \xB7 ${missing.length} dashed${needs.length ? ` \u2014 still to make: ${needs.join(", ")}` : ""}`);
    })
  );
  wire.command("link <screen> <element> [target]").description("Override where one hotspot goes: to a screen, or --none to switch it off; --clear gives it back to the rules. A property on the source screen").option("--canvas <canvas>").option("--none", "the hotspot goes nowhere").option("--back", "the hotspot goes back, whatever the rules say").option("--clear", "forget the override \u2014 the rules decide again").action(
    run(async (ref, element, target, _local, cmd) => {
      const opts = cmd.optsWithGlobals();
      const given = [target !== void 0, Boolean(opts.none), Boolean(opts.back), Boolean(opts.clear)].filter(Boolean).length;
      if (given !== 1) throw new Error("say where it goes: a <target> screen, or one of --none, --back, --clear");
      const ctx = await ctxOf(cmd);
      const p = await resolveCanvas(ctx);
      const snapshot = await ctx.client.snapshot(p.id);
      const item = resolveItem(snapshot, ref);
      const port = cliPort(host, ctx, p.id);
      const [source] = await wiresOn(port, { ...snapshot.canvas, items: { [item.id]: item } });
      if (!source) throw new Error(`"${item.title}" is not a wireframe screen \u2014 links start on screens \`isocan wire\` drew`);
      const keys = hotspots(source.spec).map((h) => h.key);
      const matches = keys.includes(element) ? [element] : keys.filter((k) => k.endsWith(`#${element}`));
      if (matches.length !== 1) {
        throw new Error(`${matches.length === 0 ? `"${item.title}" has no hotspot "${element}"` : `"${element}" is on more than one slot`} \u2014 its hotspots: ${keys.join(", ")} (\`isocan wire links ${item.id}\`)`);
      }
      const key = matches[0];
      let value;
      let to = null;
      if (opts.clear) value = null;
      else if (opts.none) value = LINK_NONE;
      else if (opts.back) value = LINK_BACK;
      else {
        to = resolveItem(snapshot, target);
        if (to.properties?.[FIDELITY_PROP] !== "wireframe" || to.properties?.[PROTOTYPE_PROP] !== void 0) throw new Error(`"${to.title}" is not a wireframe screen \u2014 a link goes to a screen`);
        value = to.id;
      }
      const { overrides } = await setLinkOverride(port, item, key, value, newGroupId());
      const keptNow = to ? isKept(to) : true;
      if (ctx.json) return printJson({ itemId: item.id, key, to: value, overrides });
      const said = value === null ? "back to the rules" : value === LINK_NONE ? "switched off" : value === LINK_BACK ? "goes back" : `goes to "${to.title}"`;
      console.log(`${item.id}  "${item.title}" ${key} ${said}${keptNow ? "" : ` \u2014 "${to.title}" is not in the prototype, so the link draws dashed until it is`} \xB7 \`isocan undo\` takes it back`);
    })
  );
  wire.command("prototype").description("Assemble the screens in the prototype (\u{1F4D0}) as one clickable HTML item above them \u2014 rebuilt, it gains a version rather than being replaced").option("--canvas <canvas>").option("--flow <flow>", "which flow's prototype (default: the only one)").action(
    run(async (_local, cmd) => {
      const opts = cmd.optsWithGlobals();
      const ctx = await ctxOf(cmd);
      const p = await resolveCanvas(ctx);
      const port = cliPort(host, ctx, p.id);
      const canvas = await port.canvas();
      const flow = pickKeptFlow(keptFlowsOf(canvas, await wiresOn(port, canvas)), opts.flow);
      const { itemId, title, links, what } = await writePrototype(port, canvas, flow, newGroupId());
      const after = await ctx.client.snapshot(p.id);
      const versions = after.canvas.items[itemId]?.versions.length ?? 0;
      const dashed = links.filter((l) => l.to === null && l.needs);
      if (ctx.json) return printJson({ itemId, title, flow: flow.flow, screens: flow.screens.length, links: links.length, dashed: dashed.length, versions, [what]: true });
      console.log(`${itemId}  "${title}" \u2014 ${what === "added" ? "added above its screens" : what === "versioned" ? `version ${versions}` : what === "moved" ? `moved back above its flow (still version ${versions})` : `unchanged (still version ${versions}) \u2014 no screen in it has changed`}`);
      console.log(`  ${flow.screens.length} screens: ${flow.screens.map((s) => s.title).join(" \xB7 ")}`);
      console.log(`  ${links.length} links, ${dashed.length} dashed${dashed.length ? ` (needs ${[...new Set(dashed.map((l) => l.needs))].join(", ")})` : ""} \xB7 \`isocan open ${itemId}\` plays it${what === "unchanged" ? "" : " \xB7 `isocan undo` takes it back"}`);
    })
  );
}

// packages/modules/wireframe/src/style-cli.ts
import { existsSync, readFileSync } from "node:fs";
import path2 from "node:path";
import { fileURLToPath } from "node:url";
var OWN_DIR = "packages/modules/wireframe";
var PACKS_DIR = "packages/modules/design-competition";
function rootPath(...parts) {
  let dir = path2.dirname(fileURLToPath(import.meta.url));
  for (let up = 0; up < 12; up++) {
    const manifest = path2.join(dir, "package.json");
    if (existsSync(manifest)) {
      try {
        if (JSON.parse(readFileSync(manifest, "utf8")).name === "isocan") {
          return path2.join(dir, ...parts);
        }
      } catch {
      }
    }
    dir = path2.dirname(dir);
  }
  return path2.join(dir, ...parts);
}
function presetText(preset) {
  const rel = presetFile(preset);
  const where = preset.from === "own" ? moduleAsset(wireframeModule.name, rel) ?? rootPath(OWN_DIR, rel) : rootPath(PACKS_DIR, rel);
  if (!existsSync(where)) {
    throw new Error(preset.from === "pack" ? `the design competition's packs are not on this machine, so "${preset.id}" cannot be read \u2014 the module's own styles can (\`isocan wire style --list\`)` : `the ${preset.name} wire style's DESIGN.md is missing from this install (${rel})`);
  }
  return readFileSync(where, "utf8");
}
function readable(preset) {
  try {
    presetText(preset);
    return true;
  } catch {
    return false;
  }
}
function registerStyle(host, wire) {
  const { run, ctxOf, resolveCanvas, printJson } = host;
  wire.command("style").description("Restyle every wire in the design system that governs it \u2014 Jev maps the system's tokens onto the wire's roles, once per system version; one op group, a version per changed wire. --preset <name> chooses a named wire style for the flows (material, shadcn, glass, ios, fluent, carbon, brutalist, a design-competition pack, or house for the greys); --list names them; --default restores the greys; --check lists wires behind their system").argument("[screens...]", "only these screens' flows (ids, titles or #refs) \u2014 every wire when none").option("--canvas <canvas>").option("--preset <name>", "a wire style: its DESIGN.md placed beside the flow and made its group's (or the canvas's) design system, and the flow restyled \u2014 one op group; house returns to the greys and lets the style's file go").option("--list", "write nothing: name the wire styles --preset takes, and say which cannot be read here").option("--default", "back to the default wire look (the greys)").option("--check", "write nothing: list the wires that are behind the system that governs them").option("--flow <flow>", "only this flow's screens and their variations").action(
    run(async (refs, _local, cmd) => {
      const opts = cmd.optsWithGlobals();
      if (opts.default && opts.check) throw new Error("--default writes and --check does not \u2014 say one");
      if (opts.preset !== void 0 && (opts.default || opts.check)) throw new Error("--preset chooses a look; --default and --check do other things \u2014 say one (--preset house is the greys)");
      const ctx = await ctxOf(cmd);
      const say = (line) => {
        if (!ctx.json) console.log(line);
      };
      if (opts.list) return listPresets(ctx.json, printJson, say);
      const choice = opts.preset === void 0 ? void 0 : presetOrSay(opts.preset);
      const p = await resolveCanvas(ctx);
      const port = cliPort(host, ctx, p.id);
      const canvas = await port.canvas();
      const all = await wiresOn(port, canvas);
      const named = (refs ?? []).map((ref) => {
        const item = host.resolveItem({ canvas }, ref);
        if (!all.some((s) => s.item === item.id)) throw new Error(`"${item.title}" is not a wireframe screen \u2014 \`isocan wire "<request>"\` composes some`);
        return item.id;
      });
      const inFlow = opts.flow === void 0 ? all : all.filter((s) => s.spec.flow === opts.flow);
      const screens = named.length ? flowScreens(inFlow, named) : inFlow;
      if (screens.length === 0) {
        throw new Error(opts.flow === void 0 && !named.length ? 'no wireframe on this canvas \u2014 `isocan wire "<request>"` composes some' : `no wireframe in ${named.length ? "those screens' flows" : `flow "${opts.flow}"`} on this canvas`);
      }
      if (choice !== void 0) {
        const text = choice === HOUSE ? null : presetText(choice);
        const answerer2 = cliAnswerer(ctx, p.id, opts.answerer === "agent" ? void 0 : opts.answerer, Number(opts.seed ?? 1), say);
        const resolver2 = new StyleResolver(port, answerer2, async () => all.map((s) => s.spec), mappingSaver(opts.save));
        const r = await applyPreset(port, all, screens, choice, text, resolver2);
        if (ctx.json) {
          return printJson({
            group: r.group,
            preset: r.name,
            placed: r.placed,
            restyled: r.restyled.changed.map((t) => ({ itemId: t.item.id, title: wireTitle(t.screen.spec) })),
            unchanged: r.restyled.targets.filter((t) => !r.restyled.changed.includes(t)).map((t) => t.item.id),
            prototypes: r.restyled.prototypes,
            calls: resolver2.calls,
            cost: resolver2.cost()
          });
        }
        for (const m of resolver2.mappings.values()) for (const line of mappingLines(m, resolver2.who)) say(line);
        for (const pl of r.placed) say(`${pl.itemId} \u2014 ${pl.what === "added" ? "placed beside the flow and made" : pl.what === "versioned" ? "a new version of" : pl.what === "removed" ? "moved to the trash; no longer" : "already"} the design system of ${pl.scope ? `group ${pl.scope}` : "the canvas"}`);
        for (const pr of r.restyled.prototypes) say(`prototype ${pr.itemId} \u2014 ${pr.what === "versioned" ? "rebuilt as a new version" : pr.what}`);
        say(presetSummary(r).replace("one undo takes", "`isocan undo` takes"));
        return;
      }
      if (opts.check) {
        const read = /* @__PURE__ */ new Map();
        for (const system of systemsToRead(canvas, (hash) => all.find((s) => specKey(canvas.items[s.item]) === hash)?.spec)) read.set(system.id, await readSystemDoc(system, (h) => port.readText(h)));
        return check(canvas, screens.map((s) => ({ screen: s, item: canvas.items[s.item] })), (system) => read.get(system.id), ctx.json, printJson, say);
      }
      const answerer = cliAnswerer(ctx, p.id, opts.answerer === "agent" ? void 0 : opts.answerer, Number(opts.seed ?? 1), say);
      const resolver = new StyleResolver(port, answerer, async () => all.map((s) => s.spec), mappingSaver(opts.save));
      const result = await restyle(port, canvas, all, screens, resolver, { toDefault: Boolean(opts.default) });
      const { targets, changed, prototypes, group } = result;
      const mappings = [...resolver.mappings.values()];
      const by = resolver.who;
      if (ctx.json) {
        return printJson({
          group,
          style: opts.default ? "default" : "design-system",
          systems: mappings.map((m) => ({ itemId: m.system.id, versionId: m.versionId, version: m.version, name: m.name, how: m.how, roles: m.roles, wires: targets.filter((t) => t.system?.id === m.system.id).length })),
          restyled: changed.map((t) => ({ itemId: t.item.id, title: wireTitle(t.screen.spec), style: t.style.source === "design-system" ? t.style.itemId : "default" })),
          unchanged: targets.filter((t) => !changed.includes(t)).map((t) => t.item.id),
          prototypes,
          calls: resolver.calls,
          inputTokens: resolver.inputTokens,
          cost: resolver.cost(),
          answerer: by
        });
      }
      for (const m of mappings) {
        const governed = targets.filter((t) => t.system?.id === m.system.id);
        for (const line of mappingLines(m, by)) say(line);
        say(`  governs ${governed.length} wire${governed.length === 1 ? "" : "s"}`);
      }
      const inDefault = targets.filter((t) => t.style.source === "default").length;
      if (inDefault) say(`${inDefault} wire${inDefault === 1 ? "" : "s"} in the default look${opts.default ? "" : " \u2014 no design system governs where they sit"}`);
      for (const pr of prototypes) say(`prototype ${pr.itemId} \u2014 ${pr.what === "versioned" ? "rebuilt as a new version" : pr.what}`);
      say(restyleSummary(result).replace("one undo takes", "`isocan undo` takes"));
    })
  );
  wire.command("ds [request...]").description("Synthesize a WCAG AA contrast-repaired DESIGN.md with Jev, make it govern the flow's scope, and restyle all screens and prototype in one op group").option("--canvas <canvas>").option("--flow <flow>", "only this flow's screens").option("--name <name>", "explicit name for the synthesized design system").option("--surface <surface>", "override surface mode: flat | raised | glass | bold").action(
    run(async (words, _local, cmd) => {
      const opts = cmd.optsWithGlobals();
      const ctx = await ctxOf(cmd);
      const say = (line) => {
        if (!ctx.json) console.log(line);
      };
      const p = await resolveCanvas(ctx);
      const port = cliPort(host, ctx, p.id);
      const canvas = await port.canvas();
      const all = await wiresOn(port, canvas);
      const screens = requireScopedScreens(
        scopeFlowScreens(canvas, all, {
          ...opts.flow !== void 0 ? { flow: opts.flow } : {},
          wholeFlow: true
        })
      );
      const answerer = cliAnswerer(ctx, p.id, opts.answerer === "agent" ? void 0 : opts.answerer, Number(opts.seed ?? 1), say);
      const r = await wireDsOnCanvas(port, all, screens, words.join(" "), answerer, {
        ...opts.name ? { name: opts.name } : {},
        ...opts.surface ? { surface: opts.surface } : {}
      });
      if (ctx.json) {
        return printJson({
          group: r.group,
          dsItemId: r.dsItemId,
          what: r.what,
          direction: r.synthesized.direction.id,
          surface: r.synthesized.surface,
          density: r.synthesized.density,
          repairs: r.synthesized.repairs,
          restyled: r.restyled.changed.map((t) => ({ itemId: t.item.id, title: wireTitle(t.screen.spec) })),
          prototypes: r.restyled.prototypes
        });
      }
      say(`${r.dsItemId}  ${r.synthesized.name} (${r.synthesized.direction.id} \xB7 surface:${r.synthesized.surface} \xB7 density:${r.synthesized.density} \xB7 p ${r.synthesized.p.toFixed(2)})`);
      if (r.synthesized.repairs.length > 0) {
        say(`  repaired ${r.synthesized.repairs.length} contrast pair${r.synthesized.repairs.length === 1 ? "" : "s"} to \u2265 4.5:1 AA`);
      }
      say(`${r.restyled.changed.length} of ${r.restyled.targets.length} wires restyled \u2014 \`isocan undo\` takes it back`);
    })
  );
  wire.command("polish [screens...]").description("Apply Jev-budgeted visual refinement patches (0 | 4 | 8 | 12) guarded by verifyWireContract in one op group").option("--canvas <canvas>").option("--flow <flow>", "only this flow's screens").option("--intensity <n>", "override polish_intensity (0\u20131)").option("--clear", "remove polish patches from target screens").action(
    run(async (refs, _local, cmd) => {
      const opts = cmd.optsWithGlobals();
      const ctx = await ctxOf(cmd);
      const say = (line) => {
        if (!ctx.json) console.log(line);
      };
      const p = await resolveCanvas(ctx);
      const port = cliPort(host, ctx, p.id);
      const canvas = await port.canvas();
      const all = await wiresOn(port, canvas);
      const itemIds = (refs ?? []).map((ref) => {
        const item = host.resolveItem({ canvas }, ref);
        if (!all.some((s) => s.item === item.id) && item.properties?.[PROTOTYPE_PROP] === void 0 && !isGroupItem(item)) {
          throw new Error(`"${item.title}" is not a wireframe screen`);
        }
        return item.id;
      });
      const screens = requireScopedScreens(
        scopeFlowScreens(canvas, all, {
          itemIds,
          ...opts.flow !== void 0 ? { flow: opts.flow } : {},
          wholeFlow: false,
          excludeUnkeptVariants: true
        })
      );
      const answerer = cliAnswerer(ctx, p.id, opts.answerer === "agent" ? void 0 : opts.answerer, Number(opts.seed ?? 1), say);
      const r = await polishWireOnCanvas(port, canvas, all, screens, answerer, {
        ...opts.intensity !== void 0 ? { intensity: Number(opts.intensity) } : {},
        ...opts.clear ? { clear: true } : {}
      });
      if (ctx.json) {
        return printJson({
          group: r.group,
          by: r.by,
          changed: r.changed.map((c) => ({
            itemId: c.itemId,
            title: c.title,
            intensity: c.intensity,
            budget: c.budget,
            patches: c.patches
          })),
          prototypes: r.prototypes
        });
      }
      for (const c of r.changed) {
        say(`${c.itemId}  ${c.title} \u2014 ${c.patches.length} polish patch${c.patches.length === 1 ? "" : "es"} (intensity ${c.intensity}, budget ${c.budget})`);
      }
      say(`${r.changed.length} of ${screens.length} wire${screens.length === 1 ? "" : "s"} ${opts.clear ? "unpolished" : "polished"} (${r.by})${r.prototypes.length ? ", prototype rebuilt" : ""} \u2014 \`isocan undo\` takes it back`);
    })
  );
  wire.command("layer [directive] [screens...]").description("Check or uncheck non-destructive fidelity layers (`+system`, `-system`, `+copy`, `-copy`, `+lofi`, `-lofi`, `+hifi`, `-hifi`) or jump between the 4 fidelity tiers (`wire`, `system`, `lofi`, `hifi`) in one op group; with no directive or --list, prints each screen's active layers").option("--canvas <canvas>").option("--flow <flow>", "only this flow's screens").option("--list", "write nothing: print each wireframe screen's active fidelity layers and tier").action(
    run(async (directive, refs, _local, cmd) => {
      const opts = cmd.optsWithGlobals();
      const ctx = await ctxOf(cmd);
      const say = (line) => {
        if (!ctx.json) console.log(line);
      };
      const p = await resolveCanvas(ctx);
      const port = cliPort(host, ctx, p.id);
      const canvas = await port.canvas();
      const all = await wiresOn(port, canvas);
      const inFlow = opts.flow === void 0 ? all : all.filter((s) => s.spec.flow === opts.flow);
      if (inFlow.length === 0) {
        throw new Error('no wireframe on this canvas \u2014 `isocan wire "<request>"` composes some');
      }
      if (opts.list || !directive) {
        const rows = inFlow.map((s) => {
          const item = canvas.items[s.item];
          const resolved = resolveItemLayers(item, s.spec);
          return {
            itemId: item.id,
            title: item.title,
            tier: resolved.tier,
            layers: {
              system: resolved.system,
              copy: resolved.copy,
              lofi: resolved.lofi,
              hifi: resolved.hifi
            }
          };
        });
        if (ctx.json) return printJson({ screens: rows });
        for (const r2 of rows) {
          const checks = WIRE_LAYER_IDS.map((id) => `${r2.layers[id] ? "\u2611" : "\u2610"} ${LAYER_LABELS[id].short}`).join("  ");
          say(`${r2.itemId}  ${r2.title.padEnd(36)} ${TIER_LABELS[r2.tier].badge.padEnd(8)} ${checks}`);
        }
        return;
      }
      const named = (refs ?? []).map((ref) => {
        const item = host.resolveItem({ canvas }, ref);
        const found = inFlow.find((s) => s.item === item.id);
        if (!found) throw new Error(`"${item.title}" is not a wireframe screen`);
        return found;
      });
      const targets = named.length ? named : inFlow;
      const r = await applyLayersOnCanvas(port, canvas, all, targets, directive);
      if (ctx.json) return printJson(r);
      for (const c of r.changed) {
        const checks = WIRE_LAYER_IDS.map((id) => `${c.layers[id] ? "\u2611" : "\u2610"} ${LAYER_LABELS[id].short}`).join("  ");
        say(`${c.itemId}  ${c.title} \u2192 ${TIER_LABELS[c.tier].badge} (${checks})`);
      }
      say(layerSummary(r).replace("one undo takes", "`isocan undo` takes"));
    })
  );
}
function listPresets(json, printJson, say) {
  const rows = [
    { id: HOUSE, name: "House", about: "the default greys \u2014 lets go of a wire style's DESIGN.md", from: "house", readable: true },
    ...[...OWN_PRESETS, ...PACK_PRESETS].map((p) => ({ ...p, readable: readable(p) }))
  ];
  if (json) return printJson({ presets: rows });
  for (const r of rows) say(`${r.id.padEnd(10)} ${r.about}${r.readable ? "" : " \u2014 not readable on this machine"}`);
  say("`isocan wire style --preset <name> [screens\u2026]` \u2014 one op group; `isocan undo` takes it back");
}
function check(canvas, wires, docOf, json, printJson, say) {
  const rows = wires.map(({ screen, item }) => ({ ...checkWire(canvas, item, screen.spec, docOf), title: wireTitle(screen.spec) }));
  if (json) return printJson({ wires: rows, behind: rows.filter((r) => r.state !== "current").length });
  const off = rows.filter((r) => r.state !== "current");
  for (const r of off) say(`${r.itemId}  ${r.title} \u2014 ${checkWords(r)}${r.state === "behind" ? ` \xB7 ${restyleLabel(r)}: \`isocan wire style ${r.itemId}\`` : ""}`);
  say(off.length === 0 ? `all ${rows.length} wires draw in the system that governs them \u2014 nothing to bring forward` : `${off.length} of ${rows.length} wires are not in the system that governs them \u2014 \`isocan wire style\` brings them forward`);
}

// packages/modules/wireframe/src/play-cli.ts
function registerPlay(host, wire) {
  const { run, ctxOf, resolveCanvas, resolveItem, printJson } = host;
  wire.command("play <screen> [element]").description("Print the address that opens the flow's prototype full screen AT this screen of it \u2014 with [element], its hotspot pointed out. What an arrow's Play from here opens").option("--canvas <canvas>").action(
    run(async (ref, element, _local, cmd) => {
      const ctx = await ctxOf(cmd);
      const p = await resolveCanvas(ctx);
      const snapshot = await ctx.client.snapshot(p.id);
      const screen = resolveItem(snapshot, ref);
      const flows = keptFlowsOf(snapshot.canvas, await wiresOn(cliPort(host, ctx, p.id), snapshot.canvas));
      const flow = flows.find((f) => f.screens.some((s) => s.id === screen.id));
      if (!flow) throw new Error(`"${screen.title}" is not in the prototype \u2014 a prototype plays the screens used in it (\`isocan wire use ${screen.id}\`)`);
      const proto = Object.values(snapshot.canvas.items).find((i) => i.properties?.[PROTOTYPE_PROP] === flow.flow);
      if (!proto) throw new Error(`this flow has no prototype yet \u2014 \`isocan wire prototype${flows.length > 1 ? ` --flow ${flow.flow}` : ""}\` makes one`);
      let key;
      if (element !== void 0) {
        const keys = hotspots(flow.screens.find((s) => s.id === screen.id).spec).map((h) => h.key);
        const matches = keys.includes(element) ? [element] : keys.filter((k) => k.endsWith(`#${element}`));
        if (matches.length !== 1) throw new Error(`${matches.length === 0 ? `"${screen.title}" has no hotspot "${element}"` : `"${element}" is on more than one slot`} \u2014 its hotspots: ${keys.join(", ")}`);
        key = matches[0];
      }
      const origin = await ctx.homeOf(p.id) ?? ctx.client.base;
      const url = `${itemUrl(origin, p.id, proto.id)}?at=${encodeURIComponent(playAnchor(screen.id, key))}`;
      if (ctx.json) return printJson({ prototype: proto.id, screen: screen.id, ...key ? { hotspot: key } : {}, url });
      console.log(url);
      console.log(`  "${proto.title}" at "${screen.title}"${key ? `, ${key} pointed out` : ""} \u2014 open it in a browser signed in to this canvas (\`isocan open\` signs one in)`);
    })
  );
}

// packages/modules/wireframe/src/edit-cli.ts
function registerEditAndWhy(host, wire) {
  const { run, ctxOf, resolveCanvas, printJson } = host;
  wire.command("edit [words...]").description("Surgically edit a single slot or layout setting on an existing wireframe screen (`content`, `add`, `remove`, `variant`, `restyle`) in one op group, rebuilding its prototype automatically").option("--canvas <canvas>").option("--screen <item>", "target wireframe screen item id or title (default: Jev picks from the instruction)").option("--kind <kind>", `explicit edit kind (${EDIT_KINDS.join(", ")})`).option("--slot <slot>", "explicit target slot id (for example: main.1, main.2, header, nav)").option("--block <block>", "replacement or added block id").option("--density <density>", "spacing density override (compact, default, spacious)").option("--template <template>", "multi-region layout template override").option("--answerer <name>", "jev, home, or stub").option("--seed <n>", "the stub's seed", "1").action(
    run(
      async (words, _local, cmd) => {
        const opts = cmd.optsWithGlobals();
        const ctx = await ctxOf(cmd);
        const say = (line) => {
          if (!ctx.json) console.log(line);
        };
        const p = await resolveCanvas(ctx);
        const port = cliPort(host, ctx, p.id);
        const all = await wiresOn(port, await port.canvas());
        if (all.length === 0) {
          throw new Error('no wireframe screens on this canvas \u2014 `isocan wire "<request>"` composes some');
        }
        let screenId = opts.screen;
        let instruction = words.join(" ").trim();
        if (!screenId && words.length > 1) {
          const firstMatch = all.find(
            (s) => s.item === words[0] || s.spec.title.toLowerCase() === words[0].toLowerCase()
          );
          if (firstMatch) {
            screenId = firstMatch.item;
            instruction = words.slice(1).join(" ").trim();
          }
        }
        if (!instruction && !opts.kind) {
          throw new Error('what should change? `isocan wire edit [<screen>] "<instruction>"`');
        }
        let explicitEdit;
        if (opts.kind || opts.slot) {
          const kind = opts.kind ?? (opts.density || opts.template ? "restyle" : "variant");
          if (!EDIT_KINDS.includes(kind)) {
            throw new Error(`--kind must be one of ${EDIT_KINDS.join(", ")} \u2014 got "${opts.kind}"`);
          }
          if (kind === "content" && !instruction) {
            throw new Error('what should the words become? `isocan wire edit --kind content --slot <slot> "<instruction>"`');
          }
          const slot = opts.slot ?? "main.1";
          explicitEdit = {
            kind,
            slot,
            ...opts.block ? { block: opts.block } : {},
            ...opts.density ? { density: opts.density } : {},
            ...opts.template ? { template: opts.template } : {},
            ...kind === "content" && instruction ? { instruction } : {}
          };
        }
        const seed = Number(opts.seed ?? "1");
        const answerer = cliAnswerer(ctx, p.id, opts.answerer, seed, say);
        const result = await editWireOnCanvas(port, instruction || `${explicitEdit?.kind ?? "edit"} ${explicitEdit?.slot ?? ""}`, answerer, {
          ...screenId ? { screenId } : {},
          ...explicitEdit ? { edit: explicitEdit } : {},
          // A content edit's words come from the text generator, as `wire copy --ai`'s do: the home's key, or the stub.
          generator: resolveTextGenerator({ seed, useStub: opts.answerer === "stub", text: localTextKey() })
        });
        if (ctx.json) {
          return printJson({
            group: result.group,
            itemId: result.screen.item,
            title: wireTitle(result.screen.spec),
            edit: result.edit,
            by: result.by,
            prototype: result.prototype ?? null
          });
        }
        const protoPart = result.prototype ? ` \xB7 prototype ${result.prototype.itemId} rebuilt` : "";
        say(
          `${result.screen.item}  ${wireTitle(result.screen.spec)} \u2014 edited ${result.edit.slot} (${result.edit.kind}${result.edit.block ? ` \u2192 ${result.edit.block}` : ""})${protoPart} \xB7 \`isocan undo\` takes it back`
        );
      }
    )
  );
  wire.command("why [words...]").description("Explain why a wireframe screen's archetype, template, density, and slot blocks were chosen, citing recorded Jev probabilities and runner-up alternatives").option("--canvas <canvas>").option("--screen <item>", "wireframe screen item id or title (default: newest wireframe screen)").action(
    run(async (words, _local, cmd) => {
      const opts = cmd.optsWithGlobals();
      const ctx = await ctxOf(cmd);
      const p = await resolveCanvas(ctx);
      const port = cliPort(host, ctx, p.id);
      const all = await wiresOn(port, await port.canvas());
      if (all.length === 0) {
        throw new Error('no wireframe screens on this canvas \u2014 `isocan wire "<request>"` composes some');
      }
      let screenId = opts.screen;
      let question = words.join(" ").trim();
      if (!screenId && words.length > 0) {
        const match = all.find(
          (s) => s.item === words[0] || s.spec.title.toLowerCase() === words[0].toLowerCase()
        );
        if (match) {
          screenId = match.item;
          question = words.slice(1).join(" ").trim();
        }
      }
      const primary = all.filter((s) => !s.spec.variantOf);
      const target = screenId ? all.find((s) => s.item === screenId || s.spec.title.toLowerCase() === screenId.toLowerCase()) : primary[primary.length - 1] ?? all[all.length - 1];
      if (!target) {
        throw new Error(`no wireframe screen "${screenId}" on this canvas`);
      }
      const explanation = explainWireDecision(target.spec, question || void 0);
      if (ctx.json) {
        return printJson({
          itemId: target.item,
          ...explanation
        });
      }
      for (const line of explanation.lines) console.log(line);
    })
  );
}

// packages/modules/wireframe/src/voice-cli.ts
import { readFile as readFile2, writeFile as writeFile2 } from "node:fs/promises";
import { tmpdir } from "node:os";
import path3 from "node:path";

// packages/modules/wireframe/src/flow-voice.ts
function flowScreensOf(all, seed) {
  const screens = flowScreens(all, seed).filter((s) => !s.spec.variantOf || s.spec.variantOf === s.item);
  return { screens, flow: screens[0]?.spec.flow || screens[0]?.item || "" };
}
async function productVoice(port, canvas, itemId) {
  const item = canvas.items[itemId];
  const system = item ? governingSystem(canvas, item) : null;
  if (!system) return null;
  const doc = await readSystemDoc(system, (hash) => port.readText(hash));
  return doc ? voiceOf(doc) : null;
}
async function readFlowVoice(port, canvas, screens, flow) {
  const decks = [];
  const htmlOf = /* @__PURE__ */ new Map();
  for (const s of screens) {
    const item = canvas.items[s.item];
    const v = item ? currentVersionOf(item) : void 0;
    if (!v) continue;
    const html = await port.readText(v.blobHash);
    const deck = copyDeck(html);
    if (deck.unfleshed || deck.strings.length === 0) continue;
    htmlOf.set(s.item, html);
    decks.push({ itemId: s.item, title: wireTitle(s.spec), deck });
  }
  if (decks.length === 0) throw new Error(`the flow's ${screens.length} screen${screens.length === 1 ? "" : "s"} draw bars \u2014 \`isocan wire flesh --flow ${flow}\` gives them words first`);
  const voice = await productVoice(port, canvas, decks[0].itemId);
  return { flow, screens, decks, htmlOf, deck: flowCopyDeck(decks), voice };
}
async function applyFlowVoice(port, canvas, all, read, edits, by, choice) {
  const byScreen = splitFlowEdits(edits);
  const group = newGroupId();
  const changed = [];
  for (const s of read.screens) {
    const mine = byScreen.get(s.item);
    const html = read.htmlOf.get(s.item);
    if (!mine || !html) continue;
    const file = wireCopyFile(html, mine);
    if (!file.ok) throw new Error(`"${wireTitle(s.spec)}": ${file.reason}`);
    const r = await writeWireCopy(port, canvas, all, s, file.file, by, void 0, { group, rebuild: false });
    if (r.changed) changed.push({ item: s.item, title: wireTitle(r.next), spec: r.next, strings: file.changed.length });
  }
  if (choice && choice.stance.trim() && choice.against.length > 0 && changed.length > 0) {
    const pref = serializeCopyPreference({
      how: "voice",
      stance: choice.stance.trim(),
      against: [...choice.against]
    });
    for (const c of changed) {
      await port.send({ type: "item.update", itemId: c.item, patch: { properties: { [COPY_PREFERENCE_PROP]: pref } } }, group);
    }
  }
  const prototypes = changed.length ? await rebuildPrototypes(port, canvas, all, changed.map((c) => ({ item: c.item, spec: c.spec })), group) : [];
  return { group, changed, prototypes };
}

// packages/modules/wireframe/src/voice-cli.ts
function flowOf(host, canvas, all, refs, flow) {
  let seed;
  if (refs.length > 0) {
    seed = refs.map((ref) => {
      const item = host.resolveItem({ canvas }, ref);
      const found = all.find((s) => s.item === item.id);
      if (!found) throw new Error(`"${item.title}" is not a wireframe screen \u2014 \`isocan wire voice\` writes a flow's voices`);
      return found;
    });
  } else if (flow !== void 0) {
    seed = all.filter((s) => s.spec.flow === flow);
    if (seed.length === 0) throw new Error(`no wireframe in flow "${flow}" on this canvas`);
  } else {
    const flows = new Set(all.map((s) => s.spec.flow || s.item));
    if (flows.size !== 1) throw new Error(all.length === 0 ? 'no wireframe on this canvas \u2014 `isocan wire "<request>"` composes some' : `${flows.size} flows on this canvas \u2014 name a screen of one, or --flow <flow>`);
    seed = all;
  }
  return flowScreensOf(all, seed.map((s) => s.item));
}
function previewLines(voice, screens, perScreen = 3) {
  const byScreen = splitFlowEdits(voice.edits);
  const out = [];
  for (const s of screens.slice(0, 2)) {
    const edits = byScreen.get(s.itemId) ?? [];
    if (edits.length === 0) continue;
    out.push(`  ${s.title}:`);
    for (const e of edits.slice(0, perScreen)) out.push(`    ${JSON.stringify(e.text)} \u2192 ${JSON.stringify(e.to)}`);
    if (edits.length > perScreen) out.push(`    \u2026 and ${edits.length - perScreen} more`);
  }
  return out;
}
function pickVoice(voices, pick) {
  const n = Number(pick);
  if (Number.isInteger(n) && n >= 1 && n <= voices.length) return voices[n - 1];
  const found = voices.find((v) => v.stance.toLowerCase() === pick.trim().toLowerCase());
  if (!found) throw new Error(`--pick ${JSON.stringify(pick)} names no voice \u2014 pick 1\u2013${voices.length} or a stance: ${voices.map((v) => JSON.stringify(v.stance)).join(", ")}`);
  return found;
}
function registerVoice(host, wire) {
  const { run, ctxOf, resolveCanvas, printJson } = host;
  wire.command("voice [screens...]").description("N voices for a whole flow's words, previewed on its first two screens and saved to a file; --from <file> --pick <k> applies one voice to every screen as one op group, prototype rebuilt. Words only; intents untouched").option("--canvas <canvas>").option("--flow <flow>", "this flow's screens (default: the flow the named screen is in, or the canvas's only flow)").option("--n <n>", "how many voices (default 3)").option("--brief <text>", 'what the voices are for \u2014 "warmer, for first-time buyers"').option("--from <file>", `voices already written \u2014 this command's own file, or an agent's: { "variants": [{ "stance", "why", "edits": [{ "address": "<screen>::<string>", "to" }] }] }`).option("--pick <k>", "apply this voice \u2014 its number (1-based) or its stance \u2014 to every screen of the flow").option("--save <file>", "where to write the voices (default: a file under the temp directory, named in the receipt)").option("--by <name>", "who wrote the words, with --from (recorded on each screen's spec; default agent)").option("--answerer <name>", "stub: placeholder voices without a text model, said as such").action(
    run(async (refs, _local, cmd) => {
      const opts = cmd.optsWithGlobals();
      const ctx = await ctxOf(cmd);
      const p = await resolveCanvas(ctx);
      const port = cliPort(host, ctx, p.id);
      const canvas = await port.canvas();
      const all = await wiresOn(port, canvas);
      const { screens, flow } = flowOf(host, canvas, all, refs, opts.flow);
      const n = opts.n === void 0 ? void 0 : Number(opts.n);
      if (n !== void 0 && (!Number.isInteger(n) || n < 1 || n > MAX_COPY_VARIANTS)) throw new Error(`--n must be a whole number from 1 to ${MAX_COPY_VARIANTS} \u2014 got: ${opts.n}`);
      const read = await readFlowVoice(port, canvas, screens, flow);
      const { decks, deck, voice } = read;
      let raw;
      let by = opts.by ?? "agent";
      let placeholder = false;
      if (opts.from) {
        try {
          raw = JSON.parse(await readFile2(opts.from, "utf8"));
        } catch (error) {
          throw new Error(`${opts.from}: ${error.message}`);
        }
        const said = raw && typeof raw === "object" ? raw : {};
        if (!opts.by && typeof said.by === "string" && said.by) by = said.by;
        if (said.placeholder === true) placeholder = true;
      } else {
        const asked = n ?? 3;
        const text = opts.answerer === "stub" ? void 0 : localTextKey();
        if (text) {
          const generator = resolveTextGenerator({ text });
          const { prompt, schema } = copyVariantsRequest(deck, asked, opts.brief, voice, { screens: decks.length, titles: decks.map((d) => d.title) });
          raw = await generator.generateJson(prompt, schema);
          by = generator.name;
        } else {
          raw = placeholderCopyVariants(deck, asked);
          by = "placeholder words";
          placeholder = true;
          if (opts.answerer !== "stub") console.error("no text model on this machine (no ISOCAN_TEXT_API_KEY, and no key from `isocan keys set anthropic`) \u2014 these are PLACEHOLDER voices, not written copy");
        }
      }
      const checked = checkCopyVariants(deck, raw, opts.from && n === void 0 ? void 0 : n ?? 3, voice);
      if (!checked.ok) throw new Error(`${opts.from ?? "the text model's answer"}: ${checked.reason}`);
      const voices = checked.variants;
      if (!opts.pick) {
        const file = opts.save ?? (opts.from && !opts.save ? opts.from : path3.join(tmpdir(), `isocan-voices-${flow.replace(/[^A-Za-z0-9_-]/g, "")}-${Date.now()}.json`));
        if (file !== opts.from) await writeFile2(file, JSON.stringify({ flow, screens: decks.map((d) => d.itemId), by, placeholder, variants: voices }, null, 2));
        if (ctx.json) return printJson({ flow, screens: decks.map((d) => d.itemId), by, placeholder, voice: voice !== null, file, variants: voices.map((v) => ({ stance: v.stance, why: v.why, changed: v.edits.length })) });
        voices.forEach((v, i) => {
          console.log(`${i + 1}. ${v.stance} \u2014 ${v.why} (${v.edits.length} string${v.edits.length === 1 ? "" : "s"} across ${splitFlowEdits(v.edits).size} screen${splitFlowEdits(v.edits).size === 1 ? "" : "s"})`);
          for (const line of previewLines(v, decks)) console.log(line);
        });
        console.log(
          `${voices.length} voice${voices.length === 1 ? "" : "s"} for ${decks.length} screen${decks.length === 1 ? "" : "s"} by ${by}${placeholder ? " (placeholder)" : ""}${voice ? ", held to DESIGN.md's Voice" : ""} \u2014 saved to ${file}; \`isocan wire voice --from ${file} --pick <1\u2013${voices.length}>\` applies one to every screen`
        );
        return;
      }
      const chosen = pickVoice(voices, opts.pick);
      const against = voices.filter((v) => v.stance !== chosen.stance).map((v) => v.stance);
      const { group, changed, prototypes } = await applyFlowVoice(port, canvas, all, read, chosen.edits, by, { stance: chosen.stance, against });
      if (ctx.json) return printJson({ flow, stance: chosen.stance, by, placeholder, group, changed: changed.map((c) => ({ itemId: c.item, title: c.title, strings: c.strings })), prototypes });
      if (changed.length === 0) return void console.log(`the flow already speaks in "${chosen.stance}" \u2014 nothing written`);
      for (const c of changed) console.log(`${c.item}  ${c.title} \u2014 ${c.strings} string${c.strings === 1 ? "" : "s"}`);
      console.log(`"${chosen.stance}" applied to ${changed.length} of ${decks.length} screen${decks.length === 1 ? "" : "s"} by ${by}${placeholder ? " (placeholder)" : ""}${prototypes.length ? ", prototype rebuilt" : ""} \u2014 one op group; \`isocan undo\` takes it all back`);
    })
  );
}

// packages/modules/wireframe/src/cli-runtime.ts
function slugOf(title) {
  return titleSlug(title) || "screen";
}
function asData({ id, category, props, elements }) {
  return { id, category, props, elements: Object.fromEntries(Object.entries(elements ?? {}).map(([k, e]) => [k, { accepts: e.accepts, default: e.default }])) };
}
function registerRuntime(host, wire) {
  const { run, ctxOf, resolveCanvas, sendOp, printJson, placementFor } = host;
  registerCompose(host, wire);
  registerVary(host, wire);
  registerLinks(host, wire);
  registerStyle(host, wire);
  registerFlesh(host, wire);
  registerPlay(host, wire);
  registerEditAndWhy(host, wire);
  registerVoice(host, wire);
  wire.command("use <screens...>").description("Use screens in the prototype (\u{1F4D0}) \u2014 the same act as `wire keep`, in the words the item menu says").option("--canvas <canvas>").action(markScreens(host, true));
  wire.command("unuse <screens...>").description("Remove screens from the prototype (\u{1F4D0}) \u2014 the same act as `wire unkeep`").option("--canvas <canvas>").action(markScreens(host, false));
  wire.command("questions").description("Print the pending round of a wireframe flow as a question file, in Jev's request shape \u2014 for an agent to answer in Jev's place").option("--canvas <canvas>").option("--flow <flow>", "which flow (default: the newest one waiting on answers)").action(run((opts, cmd) => questions(host, opts, cmd)));
  wire.command("answer <file>").description("Apply a question file whose calls each carry a `response` in Jev's response shape \u2014 the screens fill in place, in the flow's op group").option("--canvas <canvas>").action(run((file, _opts, cmd) => answer(host, file, cmd)));
  wire.command("render [spec]").description("Draw a wireframe spec (a JSON file) and add it to the canvas as an HTML screen with the spec inside it \u2014 or, with --all, draw every wire on the canvas again from the spec it carries (one op group; a version only where the bytes change)").option("--canvas <canvas>").option("--all", "re-render every wire already on the canvas from its own spec \u2014 how a renderer change reaches screens drawn before it").option("--flow <flow>", "with --all: only this flow's screens and their variations").option("--title <title>", "the item's title (default: the spec's title)").option("--at <x,y>", "place at world coordinates").option("--anchor <item>", "place to the left of this item").option("--in <group>", "insert into this group").option("--cell <row,col>", "with --in: one cell of the sheet's grid").action(
    run(async (file, _local, cmd) => {
      const opts = cmd.optsWithGlobals();
      if (opts.all || opts.flow !== void 0) {
        if (file !== void 0) throw new Error("--all draws the wires already on the canvas \u2014 give it no spec file");
        return rerenderAll(host, cmd, opts.flow);
      }
      if (file === void 0) throw new Error("which spec? `isocan wire render <spec.json>` adds a screen; `isocan wire render --all` re-renders the ones already here");
      let spec;
      try {
        spec = JSON.parse(await readFile3(file, "utf8"));
      } catch (error) {
        throw new Error(`${file} is not a JSON file this can read: ${error.message}`);
      }
      const problems = validateWire(spec);
      if (problems.length > 0) {
        throw new Error(`${file} is not a drawable wireframe spec:
  ${problems.join("\n  ")}
  \`isocan wire spec <archetype>\` prints one that is.`);
      }
      const html = renderWire(spec);
      const ctx = await ctxOf(cmd);
      const p = await resolveCanvas(ctx);
      const snapshot = await ctx.client.snapshot(p.id);
      const title = opts.title ?? wireTitle(spec);
      const filename = `${slugOf(title)}.html`;
      const upload = await ctx.client.uploadBlob(p.id, Buffer.from(html, "utf8"), "text/html", filename);
      const { width, height } = wireSize(spec);
      const itemId = newItemId();
      const result = await sendOp(ctx, p.id, {
        type: "item.add",
        itemId,
        version: { id: newVersionId(), blobHash: upload.blobHash, mimeType: "text/html", filename, size: upload.size },
        width,
        height,
        placement: placementFor(snapshot, opts, { width, height }),
        title,
        properties: { [FIDELITY_PROP]: "wireframe" }
      });
      const at = host.insertionReceiptPlacement(result.envelope.op, itemId);
      const slots = spec.slots.length;
      const open = spec.slots.filter((s) => s.block === null).length;
      if (ctx.json) return printJson({ itemId, title, archetype: spec.archetype, platform: spec.platform, slots, undecided: open, ...at });
      console.log(`${itemId}  ${title} \u2014 ${spec.archetype}, ${spec.platform}, ${open === 0 ? "wireframe" : open === slots ? "blueprint" : `${slots - open} of ${slots} slots chosen`}`);
    })
  );
  wire.command("spec <archetype>").description("Print a spec for an archetype \u2014 a blueprint (every slot undecided), or with --resolved each slot's first block at its defaults").option("--platform <platform>", `one of ${PLATFORMS.join(", ")} (default: the archetype's first)`).option("--template <id>", `one of ${TEMPLATE_IDS.join(", ")}`).option("--resolved", "choose each slot's first option, with default props and intents").option("--title <title>").option("--request <words>", "the words that asked for it").action(
    run(async (archetype, opts) => {
      if (opts.platform !== void 0 && !PLATFORMS.includes(opts.platform)) {
        throw new Error(`--platform must be one of ${PLATFORMS.join(", ")} \u2014 got: ${opts.platform}`);
      }
      if (opts.template !== void 0 && !TEMPLATE_BY_ID.has(opts.template)) {
        throw new Error(`--template must be one of ${TEMPLATE_IDS.join(", ")} \u2014 got: ${opts.template}`);
      }
      const tpl = opts.template !== void 0 ? TEMPLATE_BY_ID.get(opts.template) : void 0;
      const platform = opts.platform ?? tpl?.platforms[0];
      const o = {
        ...platform ? { platform } : {},
        ...opts.template ? { template: opts.template } : {},
        ...opts.title ? { title: opts.title } : {},
        ...opts.request ? { request: opts.request } : {}
      };
      console.log(JSON.stringify(opts.resolved ? wireframe(archetype, o) : blueprint(archetype, o), null, 2));
    })
  );
  wire.command("catalog").description("List the archetypes (with each slot's options), and count the blocks, primitives and intents").action(
    run(async (_opts, cmd) => {
      if (cmd.optsWithGlobals().json) {
        return printJson({
          archetypes: RECIPES,
          blocks: BLOCKS.map(asData),
          primitives: PRIMITIVES.map(asData),
          intents: INTENTS
        });
      }
      for (const r of RECIPES) {
        console.log(`${r.id} (${r.platforms.join(", ")})`);
        for (const s of r.sections) console.log(`  ${s.slot.padEnd(9)} ${s.options.join(" | ")}${s.optional ? "  (optional)" : ""}`);
      }
      console.log(`
${RECIPES.length} archetypes, ${BLOCKS.length} blocks, ${PRIMITIVES.length} primitives, ${INTENTS.length} intents \u2014 \`isocan wire catalog --json\` has every prop and intent.`);
    })
  );
}
async function rerenderAll(host, cmd, flow) {
  const ctx = await host.ctxOf(cmd);
  const p = await host.resolveCanvas(ctx);
  const port = cliPort(host, ctx, p.id);
  const canvas = await port.canvas();
  const all = await wiresOn(port, canvas);
  const screens = flow === void 0 ? all : all.filter((s) => s.spec.flow === flow);
  if (screens.length === 0) throw new Error(flow === void 0 ? 'no wireframe on this canvas \u2014 `isocan wire "<request>"` composes some' : `no wireframe in flow "${flow}" on this canvas`);
  const r = await rerender(port, canvas, all, screens);
  if (ctx.json) {
    return host.printJson({
      group: r.group,
      wires: r.screens.length,
      rerendered: r.changed.map((s) => ({ itemId: s.item, title: wireTitle(s.spec) })),
      unchanged: r.screens.length - r.changed.length,
      resized: r.resized,
      prototypes: r.prototypes
    });
  }
  for (const line of rerenderLines(r)) console.log(line);
  for (const pr of r.prototypes) if (pr.what !== "unchanged") console.log(`prototype ${pr.itemId} \u2014 ${pr.what === "moved" ? "moved back above its flow" : "rebuilt as a new version"}`);
  console.log(rerenderSummary(r).replace("one undo takes", "`isocan undo` takes"));
}
async function executeWire(host, subcommand, args) {
  const actions = /* @__PURE__ */ new Map();
  const rawHost = { ...host, run: (fn2) => fn2 };
  const makeCmd = (name) => {
    const cmd = {
      description: () => cmd,
      argument: () => cmd,
      option: () => cmd,
      action: (fn2) => {
        actions.set(name, fn2);
        return cmd;
      },
      command: (spec) => makeCmd(spec.split(/\s+/)[0])
    };
    return cmd;
  };
  registerRuntime(rawHost, makeCmd(""));
  const fn = actions.get(subcommand);
  if (!fn) throw new Error(`unknown wire subcommand: ${subcommand}`);
  await fn(...args);
}
export {
  executeWire
};
