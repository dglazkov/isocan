import { newGroupId, newVersionId, titleSlug } from "@isocan/core";
import { JEV_MODEL, chosenOption, type Answerer, type JevQuestion, type JevRequest } from "./answerer.ts";
import {
  DENSITY_LEVELS,
  TEMPLATE_IDS,
  component,
  type DensityLevel,
  type Props,
  type TemplateId,
} from "./catalog/index.ts";
import type { SlotFill } from "./content/fill.ts";
import { stubTextGenerator, type TextGenerator } from "./answerer.ts";
import { rewriteSlotCopy } from "./copy-schema.ts";
import { wiresOn, type Screen } from "./flow.ts";
import { keptFlowsOf, writePrototype } from "./kept-flows.ts";
import type { WirePort } from "./port.ts";
import { renderWire } from "./render.ts";
import {
  presentElements,
  recipe,
  resolveSlot,
  wireBy,
  wireSize,
  wireTitle,
  type WireDeclined,
  type WireSlot,
  type WireSpec,
} from "./spec.ts";

/**
 * **Surgical single-section editing (`wire edit` / `/wire edit`) and turn routing**
 * (design §13).
 *
 * Instead of regenerating an entire flow on a follow-up request, `scopeEdit`
 * applies a single `EditOperation` (`content`, `add`, `remove`, `variant`, or
 * `restyle`) to one targeted slot on a `WireSpec` while preserving every
 * sibling slot, `flow`, `request`, `pinned`, `style`, and `decisions`.
 * `editWireOnCanvas` writes the updated screen version and rebuilds any
 * affected flow prototype in a single op group so one undo reverts both.
 */

/** Turn modes recognized by the conversational wireframe router. */
export const TURN_MODES = ["create", "edit", "why", "ds", "polish"] as const;

/** One of the conversational turn modes in `TURN_MODES`. */
export type TurnMode = (typeof TURN_MODES)[number];

/**
 * Deterministic keyword classification of a wireframe prompt into a `TurnMode`.
 */
export function classifyTurn(prompt: string): TurnMode {
  const clean = prompt.trim().toLowerCase();
  if (/^(?:why\b|explain\b|how come\b|what made\b)/.test(clean)) return "why";
  if (/^(?:ds\b|design system\b|palette\b|brand tokens\b)/.test(clean)) return "ds";
  if (/^(?:polish\b|refine\b|tighten\b)/.test(clean)) return "polish";
  if (/^(?:edit\b|change\b|swap\b|replace\b|add\b|remove\b|drop\b|make the\b|update\b)/.test(clean)) return "edit";
  return "create";
}

/**
 * Route a free-form prompt to a `TurnMode` (`create`, `edit`, `why`, `ds`,
 * `polish`). Uses deterministic prefix matching when unambiguous and falls back
 * to a 1-call Jev `choice` question when an `answerer` is provided.
 */
export async function routeTurn(prompt: string, answerer?: Answerer): Promise<TurnMode> {
  const fast = classifyTurn(prompt);
  if (fast !== "create" || !answerer) return fast;
  const req: JevRequest = {
    model: JEV_MODEL,
    state: { prompt },
    questions: {
      mode: {
        type: "choice",
        instructions: "Which wireframe action is the user asking for?",
        criteria: {
          create: "Compose a new multi-screen wireframe flow",
          edit: "Modify, swap, add, or remove a section on an existing screen",
          why: "Explain why a screen or block decision was chosen",
          ds: "Synthesize or apply a design system",
          polish: "Polish visual spacing and contrast on existing screens",
        },
      },
    },
  };
  const ans = await answerer.answer(req);
  return chosenOption(req.questions.mode!, ans.response.answers.mode!).value as TurnMode;
}

/** Supported surgical edit kinds on a single wireframe slot or screen. */
export const EDIT_KINDS = ["content", "add", "remove", "variant", "restyle"] as const;

/** A surgical edit kind from `EDIT_KINDS`. */
export type EditKind = (typeof EDIT_KINDS)[number];

/** A single surgical edit operation targeting one slot of a `WireSpec`. */
export interface EditOperation {
  /** Which kind of edit to apply (`content`, `add`, `remove`, `variant`, `restyle`). */
  kind: EditKind;
  /** Target slot id (e.g. `"main.1"`, `"main.2"`, `"header"`, `"nav"`). */
  slot: string;
  /** Replacement or added component block id (for `"variant"` or `"add"`). */
  block?: string;
  /** Prop overrides to merge onto the targeted slot (for `"variant"` or `"add"`). */
  props?: Props;
  /**
   * Copy fill to merge onto the targeted slot (for `"content"`) — words, never
   * an instruction. `editWireOnCanvas` writes it from `instruction` with the
   * text generator when it is absent.
   */
  fill?: SlotFill;
  /** What the person asked the slot's words to become (for `"content"`) — a request to the text generator, never copy itself. */
  instruction?: string;
  /** Screen spacing density override (for `"restyle"`). */
  density?: DensityLevel;
  /** Screen multi-region layout template override (for `"restyle"`). */
  template?: TemplateId;
  /** Sub-region assignment for the targeted slot (for `"add"` or `"restyle"`). */
  region?: string;
}

/**
 * Apply a single surgical `EditOperation` to `spec` without touching any
 * sibling slot's `block`, `props`, `intents`, `fill`, `p`, or `alternatives`,
 * and preserving `flow`, `request`, `pinned`, `style`, and `decisions`.
 */
export function scopeEdit(spec: WireSpec, edit: EditOperation): WireSpec {
  const r = recipe(spec.archetype);

  if (edit.kind === "content") {
    const idx = spec.slots.findIndex((s) => s.slot === edit.slot);
    if (idx < 0) throw new Error(`${spec.title} has no slot "${edit.slot}" to update content on`);
    if (!edit.fill) {
      // An instruction is not copy: the words come from the text generator (`editWireOnCanvas`), never from here.
      throw new Error(`a content edit on "${edit.slot}" needs words — \`editWireOnCanvas\` writes them from the instruction`);
    }
    const slots = spec.slots.map((s, i) => {
      if (i !== idx) return s;
      const mergedFill: SlotFill = { ...(s.fill ?? {}), ...(edit.fill ?? {}) };
      return { ...s, fill: mergedFill };
    });
    return {
      ...spec,
      slots,
      content: spec.content ?? { source: "copy", by: spec.by?.model ?? spec.by?.answerer ?? "agent" },
    };
  }

  if (edit.kind === "variant") {
    const idx = spec.slots.findIndex((s) => s.slot === edit.slot);
    if (idx < 0) throw new Error(`${spec.title} has no slot "${edit.slot}" to vary`);
    const current = spec.slots[idx]!;
    const section = r.sections.find((s) => s.slot === edit.slot);
    const nextBlock = edit.block ?? current.block;
    if (!nextBlock) throw new Error(`slot "${edit.slot}" is undecided — give a block to resolve it`);
    if (section && !section.options.includes(nextBlock)) {
      throw new Error(`slot "${edit.slot}" on ${r.id} accepts ${section.options.join(", ")} — not "${nextBlock}"`);
    }
    const baseSlot = nextBlock !== current.block
      ? resolveSlot(r.id, edit.slot, nextBlock, edit.props)
      : (() => {
          const c = component(nextBlock);
          const mergedProps: Props = { ...current.props, ...(edit.props ?? {}) };
          const present = presentElements(c, mergedProps);
          const resolved = resolveSlot(r.id, edit.slot, nextBlock, mergedProps);
          const intents = present.length > 0
            ? Object.fromEntries(present.map((el) => [el, current.intents?.[el] ?? resolved.intents![el]!]))
            : undefined;
          return {
            ...current,
            props: resolved.props,
            ...(intents ? { intents } : {}),
          };
        })();
    const updatedSlot: WireSlot = {
      ...baseSlot,
      ...(current.p !== undefined && nextBlock === current.block ? { p: current.p } : {}),
      ...(current.alternatives && nextBlock === current.block ? { alternatives: current.alternatives } : {}),
      ...(edit.region ?? current.region ? { region: (edit.region ?? current.region)! } : {}),
      ...(current.fill && nextBlock === current.block ? { fill: current.fill } : {}),
    };
    const slots = spec.slots.map((s, i) => (i === idx ? updatedSlot : s));
    return { ...spec, slots };
  }

  if (edit.kind === "add") {
    const section = r.sections.find((s) => s.slot === edit.slot);
    if (!section) {
      throw new Error(`${r.id} has no section "${edit.slot}" — valid sections: ${r.sections.map((s) => s.slot).join(", ")}`);
    }
    const chosenBlock = edit.block ?? spec.declined?.find((d) => d.slot === edit.slot)?.block ?? section.options[0]!;
    if (!section.options.includes(chosenBlock)) {
      throw new Error(`slot "${edit.slot}" on ${r.id} accepts ${section.options.join(", ")} — not "${chosenBlock}"`);
    }
    const resolved = resolveSlot(r.id, edit.slot, chosenBlock, edit.props);
    const newSlot: WireSlot = {
      ...resolved,
      ...(edit.region ? { region: edit.region } : {}),
      ...(edit.fill ? { fill: edit.fill } : {}),
    };
    const existingIdx = spec.slots.findIndex((s) => s.slot === edit.slot);
    let slots: WireSlot[];
    if (existingIdx >= 0) {
      slots = spec.slots.map((s, i) => (i === existingIdx ? newSlot : s));
    } else {
      // Insert in recipe section order
      const order = r.sections.map((s) => s.slot);
      const targetOrder = order.indexOf(edit.slot);
      slots = [...spec.slots];
      const insertAt = slots.findIndex((s) => order.indexOf(s.slot) > targetOrder);
      if (insertAt < 0) slots.push(newSlot);
      else slots.splice(insertAt, 0, newSlot);
    }
    const nextDeclined = (spec.declined ?? []).filter((d) => d.slot !== edit.slot);
    const out: WireSpec = { ...spec, slots };
    if (nextDeclined.length > 0) out.declined = nextDeclined;
    else delete out.declined;
    return out;
  }

  if (edit.kind === "remove") {
    const idx = spec.slots.findIndex((s) => s.slot === edit.slot);
    if (idx < 0) throw new Error(`${spec.title} has no slot "${edit.slot}" to remove`);
    const removed = spec.slots[idx]!;
    const section = r.sections.find((s) => s.slot === edit.slot);
    const slots = spec.slots.filter((_, i) => i !== idx);
    const nextDeclined: WireDeclined[] = [...(spec.declined ?? []).filter((d) => d.slot !== edit.slot)];
    if (section?.optional && removed.block) {
      nextDeclined.push({ slot: edit.slot, p: 1, block: removed.block });
    }
    return {
      ...spec,
      slots,
      ...(nextDeclined.length > 0 ? { declined: nextDeclined } : {}),
    };
  }

  // kind === "restyle"
  const nextTemplate = edit.template && TEMPLATE_IDS.includes(edit.template) ? edit.template : spec.template;
  const nextDensity = edit.density && DENSITY_LEVELS.includes(edit.density) ? edit.density : spec.density;
  const slots = edit.region
    ? spec.slots.map((s) => (s.slot === edit.slot ? { ...s, region: edit.region! } : s))
    : spec.slots;
  return {
    ...spec,
    slots,
    ...(nextTemplate ? { template: nextTemplate } : {}),
    ...(nextDensity ? { density: nextDensity } : {}),
  };
}

/**
 * Use Jev (at most 1 call to pick the target screen when `targetScreenId` is
 * omitted, plus 1 batched call for the edit parameters) to plan a surgical
 * `EditOperation` from a natural-language instruction.
 */
export async function planEditWithJev(
  screens: readonly Screen[],
  instruction: string,
  answerer: Answerer,
  targetScreenId?: string,
): Promise<{ screen: Screen; edit: EditOperation; by: string }> {
  if (screens.length === 0) {
    throw new Error("no wireframe screens on this canvas to edit");
  }
  let screen: Screen | undefined;
  let by = answerer.name as string;
  if (targetScreenId) {
    screen = screens.find((s) => s.item === targetScreenId || s.spec.title.toLowerCase() === targetScreenId.toLowerCase());
    if (!screen) throw new Error(`no wireframe screen "${targetScreenId}" on this canvas`);
  } else if (screens.length === 1) {
    screen = screens[0]!;
  } else {
    const pickReq: JevRequest = {
      model: JEV_MODEL,
      state: { instruction, screens: screens.map((s) => ({ id: s.item, title: s.spec.title, archetype: s.spec.archetype })) },
      questions: {
        screen: {
          type: "choice",
          instructions: "Which wireframe screen should this edit instruction apply to?",
          criteria: Object.fromEntries(screens.map((s) => [s.item, `${s.spec.title} (${s.spec.archetype})`])),
        },
      },
    };
    const picked = await answerer.answer(pickReq);
    by = picked.by;
    const itemId = chosenOption(pickReq.questions.screen!, picked.response.answers.screen!).value;
    screen = screens.find((s) => s.item === itemId) ?? screens[0]!;
  }

  const r = recipe(screen.spec.archetype);
  const allSlots = r.sections.map((s) => s.slot);
  const presentSlots = screen.spec.slots.map((s) => s.slot);
  const slotChoices = allSlots.length > 0 ? allSlots : presentSlots;

  const questions: Record<string, JevQuestion> = {
    kind: {
      type: "choice",
      instructions: "What kind of surgical edit does the instruction ask for?",
      criteria: {
        variant: "Swap a slot's block or adjust its component props",
        content: "Change the heading, labels, or sample text inside a slot",
        add: "Add or restore an optional section on the screen",
        remove: "Remove an optional section from the screen",
        restyle: "Adjust layout template, region assignment, or spacing density",
      },
    },
    slot: {
      type: "choice",
      instructions: "Which slot on the screen does the instruction target?",
      criteria: Object.fromEntries(
        r.sections.map((s) => [s.slot, `${s.region} (${s.options.join(" | ")}${s.optional ? ", optional" : ""})`]),
      ),
    },
    density: {
      type: "choice",
      instructions: "If the instruction adjusts spacing density, which density should apply?",
      criteria: {
        compact: "Tight 8px spacing",
        default: "Balanced 12px spacing",
        spacious: "Airy 16px spacing",
      },
    },
  };

  for (const s of r.sections) {
    if (s.options.length > 1) {
      questions[`block:${s.slot}`] = {
        type: "choice",
        instructions: `If slot ${s.slot} changes block, which block should fill it?`,
        criteria: Object.fromEntries(s.options.map((o) => [o, o.replace(/-/g, " ")])),
      };
    }
  }

  const editReq: JevRequest = {
    model: JEV_MODEL,
    state: {
      instruction,
      screen: screen.spec.title,
      archetype: screen.spec.archetype,
      slots: screen.spec.slots.map((s) => ({ slot: s.slot, block: s.block })),
      declined: screen.spec.declined ?? [],
    },
    questions,
  };
  const answered = await answerer.answer(editReq);
  by = answered.by;
  const kind = chosenOption(questions.kind!, answered.response.answers.kind!).value as EditKind;
  const chosenSlot = slotChoices.includes(chosenOption(questions.slot!, answered.response.answers.slot!).value)
    ? chosenOption(questions.slot!, answered.response.answers.slot!).value
    : (presentSlots[0] ?? slotChoices[0]!);

  // Ensure "remove" or "variant" or "content" targets a slot currently on the screen
  const targetSlot = (kind === "remove" || kind === "variant" || kind === "content") && !presentSlots.includes(chosenSlot)
    ? (presentSlots.find((s) => s.startsWith("main")) ?? presentSlots[0]!)
    : chosenSlot;

  const section = r.sections.find((s) => s.slot === targetSlot);
  const blockQ = questions[`block:${targetSlot}`];
  const blockA = answered.response.answers[`block:${targetSlot}`];
  const chosenBlock = blockQ && blockA
    ? chosenOption(blockQ, blockA).value
    : section?.options[0];
  const chosenDensity = chosenOption(questions.density!, answered.response.answers.density!).value as DensityLevel;

  const edit: EditOperation = {
    kind,
    slot: targetSlot,
    ...(kind === "variant" || kind === "add" ? (chosenBlock ? { block: chosenBlock } : {}) : {}),
    ...(kind === "content" ? { instruction } : {}),
    ...(kind === "restyle" ? { density: chosenDensity } : {}),
  };

  return { screen, edit, by };
}

/** Result of applying a surgical edit to a wireframe screen on the canvas. */
export interface EditedWire {
  /** Shared op group id for the screen version and any rebuilt prototype. */
  group: string;
  /** Updated screen record. */
  screen: Screen;
  /** Spec before the edit. */
  previous: WireSpec;
  /** The surgical edit that was applied. */
  edit: EditOperation;
  /** Answerer attribution. */
  by: string;
  /** Rebuilt prototype if the edited screen belongs to a kept flow. */
  prototype?: { itemId: string; title: string };
}

/**
 * Apply a surgical edit to a wireframe screen on the canvas in a single op
 * group, automatically rebuilding the flow's prototype when the edited screen
 * is in a prototype.
 */
export async function editWireOnCanvas(
  port: WirePort,
  instruction: string,
  answerer: Answerer,
  opts: { screenId?: string; edit?: EditOperation; generator?: TextGenerator } = {},
): Promise<EditedWire> {
  const beforeCanvas = await port.canvas();
  const all = await wiresOn(port, beforeCanvas);
  const primaryScreens = all.filter((s) => !s.spec.variantOf);
  const pool = opts.screenId ? all : (primaryScreens.length > 0 ? primaryScreens : all);
  const planned = opts.edit
    ? (() => {
        const target = opts.screenId
          ? pool.find((s) => s.item === opts.screenId || s.spec.title.toLowerCase() === opts.screenId!.toLowerCase())
          : pool[0];
        if (!target) throw new Error(opts.screenId ? `no wireframe screen "${opts.screenId}" on this canvas` : "no wireframe screens on this canvas");
        return { screen: target, edit: opts.edit, by: answerer.name as string };
      })()
    : await planEditWithJev(pool, instruction, answerer, opts.screenId);

  const previous = planned.screen.spec;
  if (planned.edit.kind === "content" && !planned.edit.fill) {
    // The instruction is a request about the words: the text generator writes them, held to the copy schema.
    const fill = await rewriteSlotCopy(previous, planned.edit.slot, planned.edit.instruction ?? instruction, opts.generator ?? stubTextGenerator(1));
    planned.edit = { ...planned.edit, fill };
  }
  const nextSpec: WireSpec = {
    ...scopeEdit(previous, planned.edit),
    by: wireBy(planned.by, port.actor),
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
    size: upload.size,
  };
  await port.send({ type: "item.addVersion", itemId: planned.screen.item, version }, group);
  const { width, height } = wireSize(nextSpec);
  if (title !== wireTitle(previous)) {
    await port.send({ type: "item.update", itemId: planned.screen.item, patch: { title } }, group);
  }
  if (width !== planned.screen.width || height !== planned.screen.height) {
    await port.send({ type: "item.resize", itemId: planned.screen.item, width, height }, group);
  }

  const updatedScreen: Screen = {
    ...planned.screen,
    spec: nextSpec,
    width,
    height,
  };

  // If the edited screen belongs to a kept flow, rebuild its prototype in the SAME op group.
  const afterCanvas = await port.canvas();
  const afterWires = await wiresOn(port, afterCanvas);
  const keptFlows = keptFlowsOf(afterCanvas, afterWires);
  const affectedFlow = keptFlows.find((f) => f.items.some((i) => i.id === updatedScreen.item));
  let prototype: { itemId: string; title: string } | undefined;
  if (affectedFlow) {
    const written = await writePrototype(port, afterCanvas, affectedFlow, group);
    prototype = { itemId: written.itemId, title: written.title };
  }

  return {
    group,
    screen: updatedScreen,
    previous,
    edit: planned.edit,
    by: planned.by,
    ...(prototype ? { prototype } : {}),
  };
}
