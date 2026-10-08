import {
  newGroupId,
  type CanvasContents,
  type Item,
} from "@isocan/core";
import {
  envTextGenerator,
  stubTextGenerator,
  type JsonSchema,
  type TextGenerator,
} from "./answerer.ts";
import { COMPONENTS, component } from "./catalog/index.ts";
import { INTENT_BY_ID } from "./catalog/intents.ts";
import { applyCopy, copyOf, fleshSpec, isBlueprint, seedKey, withWords, wordsOf, type CopyFile } from "./content/flesh-spec.ts";
import { packOf, type SlotFill } from "./content/fill.ts";
import type { Screen } from "./flow.ts";
import { rebuildPrototypes } from "./kept-flows.ts";
import type { WirePort } from "./port.ts";
import { writeWire } from "./rerender.ts";
import { defaultIntent, recipe, wireTitle, type WireSlot, type WireSpec } from "./spec.ts";

/**
 * **Schema-driven AI copy and flow naming** (`design.md` §14, Phase 12).
 *
 * Builds a strict `JsonSchema` (`blockContentSchema(spec)`) from a screen's
 * resolved blocks and variants, validates copy payloads while keeping every
 * actionable `Intent` intact, and names a whole flow coherently (`nameFlow`)
 * so screen titles and shared navigation bars agree across the flow.
 */

/** Ensure a `WireSpec` has deterministic `slot.fill` shapes so its word paths can be inspected or replaced. */
export function ensureFleshedForCopy(spec: WireSpec, key?: string): WireSpec {
  const resolvedKey = key ?? seedKey(spec, spec.archetype || "screen");
  if (!spec.content) {
    return fleshSpec(spec, resolvedKey, packOf(undefined), { by: "pack" });
  }
  const pack = packOf(spec.content.pack);
  let missingFill = false;
  for (const s of spec.slots) {
    if (s.block && !s.fill) {
      missingFill = true;
      break;
    }
  }
  if (!missingFill) return spec;
  const fleshed = fleshSpec(spec, resolvedKey, pack, { by: spec.content.by ?? "pack" });
  return {
    ...spec,
    slots: spec.slots.map((s, i) => (s.fill ? s : fleshed.slots[i] ?? s)),
  };
}

/** Describe what a word path inside a block slot represents for the JSON schema. */
function describeWordPath(spec: WireSpec, slot: WireSlot, path: string, sample: string): string {
  if (path.startsWith("actions.") && slot.block) {
    const element = path.slice("actions.".length);
    const c = component(slot.block);
    const r = recipe(spec.archetype);
    const intent = slot.intents?.[element] ?? (c.elements?.[element] ? defaultIntent(r, c, element) : element);
    const intentLabel = INTENT_BY_ID.get(intent)?.label ?? intent;
    return `Action label bound to intent "${intent}" (keep verb "${intentLabel}", e.g. "${sample}")`;
  }
  return `${slot.block ?? "slot"} ${path} (e.g. "${sample}")`;
}

/**
 * Build a strict `JsonSchema` describing every replaceable word path on `spec`
 * across its resolved slots, blocks, and variants, while locking actionable
 * elements to their typed `Intent`.
 */
export function blockContentSchema(spec: WireSpec): JsonSchema {
  const fleshed = ensureFleshedForCopy(spec);
  const slotProps: Record<string, JsonSchema> = {};
  const requiredSlots: string[] = [];

  for (const slot of fleshed.slots) {
    if (!slot.block || !slot.fill) continue;
    const words = wordsOf(slot.fill);
    const paths = Object.keys(words);
    if (paths.length === 0) continue;
    const wordProps: Record<string, JsonSchema> = {};
    for (const p of paths) {
      wordProps[p] = {
        type: "string",
        description: describeWordPath(fleshed, slot, p, words[p] ?? ""),
      };
    }
    const variant = typeof slot.props?.variant === "string" ? slot.props.variant : "default";
    slotProps[slot.slot] = {
      type: "object",
      description: `Words for slot "${slot.slot}" (block "${slot.block}", variant "${variant}")`,
      properties: wordProps,
      required: paths,
      additionalProperties: false,
    };
    requiredSlots.push(slot.slot);
  }

  const properties: Record<string, JsonSchema> = {
    title: {
      type: "string",
      description: `Screen heading for ${fleshed.archetype} screen (currently "${fleshed.content?.title ?? fleshed.title}")`,
    },
    ...(fleshed.archetype === "detail" || fleshed.content?.bar !== undefined
      ? {
          bar: {
            type: "string",
            description: `App bar context label above the detail heading (currently "${fleshed.content?.bar ?? fleshed.title}")`,
          },
        }
      : {}),
    slots: {
      type: "object",
      description: "Replacement words keyed by slot id and dot-path",
      properties: slotProps,
      required: requiredSlots,
      additionalProperties: false,
    },
  };

  return {
    type: "object",
    description: `Wireframe copy schema for screen "${fleshed.title}" (archetype "${fleshed.archetype}", ${COMPONENTS.size} catalog components supported)`,
    properties,
    required: ["title", "slots"],
    additionalProperties: false,
  };
}

/**
 * Validate an untrusted copy payload against `spec`'s resolved slots and word paths,
 * normalizing `{ block, words }` wrapper entries if present and rejecting unknown slots,
 * unknown paths, non-string values, or attempts to alter actionable intents.
 */
export function validateCopyPayload(spec: WireSpec, raw: unknown): CopyFile {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("copy payload must be a JSON object");
  }
  const obj = raw as Record<string, unknown>;
  if ("intents" in obj) {
    throw new Error("copy payload cannot modify actionable intents");
  }
  if (obj.title !== undefined && (typeof obj.title !== "string" || obj.title.trim().length === 0)) {
    throw new Error("title must be a non-empty string");
  }
  if (obj.bar !== undefined && (typeof obj.bar !== "string" || obj.bar.trim().length === 0)) {
    throw new Error("bar must be a non-empty string");
  }
  if (obj.slots !== undefined && (!obj.slots || typeof obj.slots !== "object" || Array.isArray(obj.slots))) {
    throw new Error("slots must be an object mapping slot names to words");
  }

  const fleshed = ensureFleshedForCopy(spec);
  const bySlot = new Map(fleshed.slots.map((s) => [s.slot, s]));
  const normalizedSlots: Record<string, Record<string, string> | string[]> = {};

  for (const [slotName, rawEntry] of Object.entries((obj.slots ?? {}) as Record<string, unknown>)) {
    const slot = bySlot.get(slotName);
    if (!slot) {
      throw new Error(`no slot "${slotName}" on this screen — it has ${fleshed.slots.map((s) => s.slot).join(", ")}`);
    }
    if (!slot.fill) {
      if (
        rawEntry &&
        typeof rawEntry === "object" &&
        !Array.isArray(rawEntry) &&
        Object.keys(rawEntry as Record<string, unknown>).length === 0
      ) {
        continue;
      }
      throw new Error(`slot "${slotName}" (${slot.block ?? "undecided"}) holds no words`);
    }
    const have = wordsOf(slot.fill);
    const validPaths = Object.keys(have);

    if (Array.isArray(rawEntry)) {
      if (rawEntry.length > validPaths.length) {
        throw new Error(`slot "${slotName}": ${rawEntry.length} words given, but the slot holds ${validPaths.length}`);
      }
      for (let i = 0; i < rawEntry.length; i++) {
        if (typeof rawEntry[i] !== "string") {
          throw new Error(`slot "${slotName}": entry ${i} must be a string`);
        }
      }
      normalizedSlots[slotName] = rawEntry as string[];
      continue;
    }

    if (!rawEntry || typeof rawEntry !== "object") {
      throw new Error(`slot "${slotName}" must be an object or array of strings`);
    }
    const unwrapped =
      "words" in (rawEntry as Record<string, unknown>) &&
      typeof (rawEntry as { words?: unknown }).words === "object" &&
      (rawEntry as { words?: unknown }).words !== null
        ? ((rawEntry as { words: Record<string, unknown> }).words)
        : (rawEntry as Record<string, unknown>);

    const slotWords: Record<string, string> = {};
    for (const [path, val] of Object.entries(unwrapped)) {
      if (!(path in have)) {
        throw new Error(`slot "${slotName}": no word at "${path}" — it holds ${validPaths.join(", ")}`);
      }
      if (typeof val !== "string") {
        throw new Error(`slot "${slotName}": "${path}" must be a string`);
      }
      slotWords[path] = val;
    }
    normalizedSlots[slotName] = slotWords;
  }

  return {
    ...(typeof obj.title === "string" ? { title: sanitizeFlowTitle(obj.title) } : {}),
    ...(typeof obj.bar === "string" ? { bar: sanitizeFlowTitle(obj.bar) } : {}),
    slots: normalizedSlots,
  };
}

/** Options for `generateWireCopy`. */
export interface GenerateWireCopyOptions {
  /** Extra domain or tone brief appended to the prompt. */
  brief?: string;
  /** Deterministic seed key for ensuring initial slot shapes when the screen is unfleshed. */
  key?: string;
}

/**
 * Generate schema-validated domain copy for a single `WireSpec` using `generator`
 * and apply it as `source: "copy"`, preserving every actionable `Intent`.
 */
export async function generateWireCopy(
  spec: WireSpec,
  generator: TextGenerator = stubTextGenerator(1),
  opts: GenerateWireCopyOptions = {},
): Promise<WireSpec> {
  const base = ensureFleshedForCopy(spec, opts.key);
  const schema = blockContentSchema(base);
  const current = copyOf(base);
  const slotSchemas = schema.properties?.slots?.properties ?? {};
  const wordySlotIds = Object.keys(slotSchemas);
  const totalWordPaths = current.slots.reduce((sum, s) => sum + Object.keys(s.words).length, 0);

  if (totalWordPaths <= 20 || wordySlotIds.length <= 3) {
    const promptLines = [
      `Write realistic product UI copy for the "${base.title}" screen (archetype: ${base.archetype}).`,
      `Flow request: ${base.request || base.title}`,
      ...(opts.brief ? [`Copy brief: ${opts.brief}`] : []),
      `Current slots and sample words: ${JSON.stringify(current.slots)}`,
    ];
    const raw = await generator.generateJson<CopyFile>(promptLines.join("\n"), schema);
    const validated = validateCopyPayload(base, raw);
    return applyCopy(base, validated, generator.name);
  }

  const mergedSlots: Record<string, Record<string, string> | string[]> = {};
  let mergedTitle: string | undefined;
  let mergedBar: string | undefined;

  for (let i = 0; i < wordySlotIds.length; i += 3) {
    const batchIds = wordySlotIds.slice(i, i + 3);
    const batchProps: Record<string, JsonSchema> = {};
    for (const id of batchIds) batchProps[id] = slotSchemas[id]!;
    const includeTop = i === 0;
    const batchSchema: JsonSchema = {
      type: "object",
      properties: {
        ...(includeTop && schema.properties?.title ? { title: schema.properties.title } : {}),
        ...(includeTop && schema.properties?.bar ? { bar: schema.properties.bar } : {}),
        slots: {
          type: "object",
          properties: batchProps,
          required: batchIds,
          additionalProperties: false,
        },
      },
      required: [
        ...(includeTop && schema.properties?.title ? ["title"] : []),
        ...(includeTop && schema.properties?.bar ? ["bar"] : []),
        "slots",
      ],
      additionalProperties: false,
    };
    const batchSlots = current.slots.filter((s) => batchIds.includes(s.slot));
    const batchPrompt = [
      `Write realistic product UI copy for slots ${batchIds.join(", ")} on the "${base.title}" screen (archetype: ${base.archetype}).`,
      `Flow request: ${base.request || base.title}`,
      ...(opts.brief ? [`Copy brief: ${opts.brief}`] : []),
      `Current slots and sample words: ${JSON.stringify(batchSlots)}`,
    ].join("\n");
    const part = await generator.generateJson<CopyFile>(batchPrompt, batchSchema);
    if (includeTop) {
      if (typeof part.title === "string") mergedTitle = part.title;
      if (typeof part.bar === "string") mergedBar = part.bar;
    }
    Object.assign(mergedSlots, part.slots ?? {});
  }

  const mergedRaw: CopyFile = {
    ...(mergedTitle !== undefined ? { title: mergedTitle } : {}),
    ...(mergedBar !== undefined ? { bar: mergedBar } : {}),
    slots: mergedSlots,
  };
  const validated = validateCopyPayload(base, mergedRaw);
  return applyCopy(base, validated, generator.name);
}

/**
 * **Rewrite one slot's words per an instruction** — what a `content` edit
 * (`wire edit --kind content`, `/wire edit`) does with the person's words.
 * The instruction is a request ABOUT the words, not the words: it goes to
 * `generator` with the slot's current words and a schema narrowed to that one
 * slot (`blockContentSchema`), and the answer is held to `validateCopyPayload`
 * — so action labels stay bound to their intents, and no other slot, title or
 * bar can change. Returns the slot's whole fill with the new words in place.
 */
export async function rewriteSlotCopy(
  spec: WireSpec,
  slotId: string,
  instruction: string,
  generator: TextGenerator = stubTextGenerator(1),
): Promise<SlotFill> {
  const base = ensureFleshedForCopy(spec);
  const slot = base.slots.find((s) => s.slot === slotId);
  if (!slot) throw new Error(`${base.title} has no slot "${slotId}" to update content on`);
  const full = blockContentSchema(base);
  const slotSchema = full.properties?.slots?.properties?.[slotId];
  if (!slot.fill || !slotSchema) throw new Error(`slot "${slotId}" (${slot.block ?? "undecided"}) holds no words to rewrite`);
  const schema: JsonSchema = {
    type: "object",
    description: `Rewritten words for slot "${slotId}" on screen "${base.title}"`,
    properties: {
      slots: {
        type: "object",
        description: "Replacement words keyed by slot id and dot-path",
        properties: { [slotId]: slotSchema },
        required: [slotId],
        additionalProperties: false,
      },
    },
    required: ["slots"],
    additionalProperties: false,
  };
  const prompt = [
    `Rewrite the UI copy in slot "${slotId}" (block "${slot.block}") of the "${base.title}" screen (archetype: ${base.archetype}).`,
    `Flow request: ${base.request || base.title}`,
    `Edit instruction: ${instruction}`,
    `Follow the instruction by writing the slot's words — do not repeat the instruction as copy, and keep each action's verb.`,
    `Current words: ${JSON.stringify(wordsOf(slot.fill))}`,
  ].join("\n");
  const raw = await generator.generateJson<CopyFile>(prompt, schema);
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const extra = Object.keys(raw as Record<string, unknown>).filter((k) => k !== "slots");
    if (extra.length > 0) throw new Error(`a content edit changes only slot "${slotId}" — the answer also set ${extra.join(", ")}`);
  }
  const validated = validateCopyPayload(base, raw);
  const others = Object.keys(validated.slots ?? {}).filter((k) => k !== slotId);
  if (others.length > 0) throw new Error(`a content edit changes only slot "${slotId}" — the answer also set ${others.join(", ")}`);
  const words = validated.slots?.[slotId];
  if (!words) throw new Error(`the answer held no words for slot "${slotId}"`);
  return withWords(slot.fill, words, `slot "${slotId}"`);
}

/**
 * Strip conversational filler ("Sure, here is...", markdown quotes, prefixes,
 * trailing punctuation) from a model-generated flow or screen title.
 */
export function sanitizeFlowTitle(raw: string): string {
  let text = raw.trim();
  const firstLine = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  text = firstLine ?? "";
  text = text.replace(
    /^(?:sure[!,.]?\s*|certainly[!,.]?\s*|of course[!,.]?\s*)?(?:here(?:'s| is)\s+(?:a|the|your)\s+(?:suggested\s+|concise\s+)?(?:flow\s+|screen\s+|product\s+|app\s+|brand\s+)?(?:title|name)\s*[:\-–—]\s*)/i,
    "",
  );
  text = text.replace(/^(?:title|name|flow|brand|screen)\s*[:\-–—]\s*/i, "");
  text = text.replace(/^[`*"'\u2018\u2019\u201c\u201d.;:!?]+|[`*"'\u2018\u2019\u201c\u201d.;:!?]+$/g, "").trim();
  text = text.replace(/\s+/g, " ");
  if (text.length > 48) {
    text = text.slice(0, 48).replace(/\s+\S*$/, "").trim() || text.slice(0, 48).trim();
  }
  return text || "Untitled";
}

const NAV_BLOCKS = new Set(["tab-bar", "side-nav", "navbar"]);

/** Build the JSON schema used by `nameFlow` across a flow's screens. */
export function flowNameSchema(specs: readonly WireSpec[]): JsonSchema {
  const titleProps: Record<string, JsonSchema> = {};
  const requiredKeys: string[] = [];
  let navItemCount = 4;

  for (let i = 0; i < specs.length; i++) {
    const s = ensureFleshedForCopy(specs[i]!, `screen-${i}`);
    const key = `${s.archetype}-${i}`;
    titleProps[key] = {
      type: "string",
      description: `Specific screen title for archetype "${s.archetype}" (currently "${s.title}")`,
    };
    requiredKeys.push(key);
    for (const slot of s.slots) {
      if (slot.block && NAV_BLOCKS.has(slot.block)) {
        const actionKeys = Object.keys(slot.fill?.actions ?? {});
        if (actionKeys.length > 0) navItemCount = actionKeys.length;
        else if (slot.fill?.items?.length) navItemCount = slot.fill.items.length;
      }
    }
  }

  return {
    type: "object",
    description: "Coherent flow naming: brand, per-screen titles, and shared navigation labels",
    properties: {
      brand: {
        type: "string",
        description: "Short brand or product name (1-3 words)",
      },
      titles: {
        type: "object",
        description: "Screen title keyed by screen id",
        properties: titleProps,
        required: requiredKeys,
        additionalProperties: false,
      },
      navLabels: {
        type: "array",
        description: "Shared navigation item labels in order across the flow",
        items: { type: "string", description: "Navigation tab or link label" },
        minItems: navItemCount,
        maxItems: navItemCount,
      },
    },
    required: ["brand", "titles", "navLabels"],
    additionalProperties: false,
  };
}

/** Result of `nameFlow`. */
export interface NamedFlow {
  brand: string;
  titles: Record<string, string>;
  navLabels: string[];
  specs: WireSpec[];
}

/**
 * Name a flow's brand, per-screen titles, and shared navigation bar labels
 * coherently so tab bars, side navs, and headers agree across every screen.
 */
export async function nameFlow(
  specs: readonly WireSpec[],
  request?: string,
  generator: TextGenerator = stubTextGenerator(1),
): Promise<NamedFlow> {
  if (specs.length === 0) {
    return { brand: "Acme", titles: {}, navLabels: [], specs: [] };
  }
  const fleshedSpecs = specs.map((s, i) => ensureFleshedForCopy(s, seedKey(s, `screen-${i}`)));
  const schema = flowNameSchema(fleshedSpecs);
  const flowReq = request ?? fleshedSpecs[0]?.request ?? fleshedSpecs[0]?.title ?? "Product flow";
  const prompt = [
    `Name the product brand, each screen's specific title, and the shared navigation bar labels for this flow.`,
    `Flow request: ${flowReq}`,
    `Screens: ${fleshedSpecs.map((s, i) => `${s.archetype}-${i} (${s.archetype})`).join(", ")}`,
  ].join("\n");

  const raw = await generator.generateJson<{
    brand?: string;
    titles?: Record<string, string>;
    navLabels?: string[];
  }>(prompt, schema);

  const brand = sanitizeFlowTitle(raw?.brand ?? "Acme");
  const navLabels = (raw?.navLabels ?? []).map((l: unknown) => sanitizeFlowTitle(String(l)));
  const titles: Record<string, string> = {};

  const namedSpecs = fleshedSpecs.map((spec, i) => {
    const key = `${spec.archetype}-${i}`;
    const rawTitle = raw?.titles?.[key] ?? spec.content?.title ?? spec.title;
    const cleanTitle = sanitizeFlowTitle(rawTitle);
    titles[key] = cleanTitle;

    const slots = spec.slots.map((slot) => {
      if (!slot.block) return slot;
      if (NAV_BLOCKS.has(slot.block) && navLabels.length > 0) {
        const baseFill: SlotFill = slot.fill ? structuredClone(slot.fill) : {};
        const actionKeys = Object.keys(baseFill.actions ?? {});
        const keysToFill =
          actionKeys.length > 0
            ? actionKeys
            : navLabels.map((_, idx) => `item-${idx + 1}`);
        const actions: Record<string, string> = { ...(baseFill.actions ?? {}) };
        keysToFill.forEach((k, idx) => {
          actions[k] = navLabels[idx % navLabels.length]!;
        });
        const fill: SlotFill = {
          ...baseFill,
          actions,
          ...(slot.block === "navbar" ? { heading: brand } : {}),
          ...(baseFill.items
            ? {
                items: baseFill.items.map((it, idx) => ({
                  ...it,
                  title: navLabels[idx % navLabels.length] ?? it.title,
                })),
              }
            : {}),
        };
        return { ...slot, fill };
      }
      return slot;
    });

    const content = spec.content
      ? {
          ...spec.content,
          source: "copy" as const,
          by: generator.name,
          title: cleanTitle,
        }
      : {
          source: "copy" as const,
          by: generator.name,
          title: cleanTitle,
        };

    return {
      ...spec,
      title: cleanTitle,
      content,
      slots,
    };
  });

  return { brand, titles, navLabels, specs: namedSpecs };
}

/**
 * Resolve a `TextGenerator` from a resolved key, the environment or a stub
 * seed. `text` is this machine's key as the CLI resolved it
 * (`cli-port.ts`'s `localTextKey`: `ISOCAN_TEXT_API_KEY`, else
 * `~/.isocan/keys.json`) — passed in because this file is also the web
 * dialog's, and the browser has no file to read. Without it, with
 * `ISOCAN_TEXT_API_KEY` set, the provider `ISOCAN_TEXT_PROVIDER` names (else
 * the key's shape — `sk-ant-` is Claude's); otherwise the seeded stub.
 */
export function resolveTextGenerator(opts: { seed?: number; useStub?: boolean; text?: { key: string; provider: "anthropic" | "openai"; model?: string } | undefined } = {}): TextGenerator {
  if (!opts.useStub && opts.text) {
    return envTextGenerator({ apiKey: opts.text.key, provider: opts.text.provider, ...(opts.text.model ? { model: opts.text.model } : {}) });
  }
  if (!opts.useStub && process.env.ISOCAN_TEXT_API_KEY) {
    return envTextGenerator();
  }
  return stubTextGenerator(opts.seed ?? 1);
}

/** Result of running `copyAiOnCanvas` or `nameFlowOnCanvas`. */
export interface CopyCanvasResult {
  group: string;
  by: string;
  changed: Array<{ itemId: string; title: string; spec: WireSpec }>;
  prototypes: Array<{ itemId: string; what: string }>;
}

/**
 * Run schema-driven AI copy (`wire copy --ai`) across target screens on a canvas,
 * writing one version per changed screen and rebuilding prototypes in one op group.
 */
export async function copyAiOnCanvas(
  port: WirePort,
  canvas: CanvasContents,
  all: readonly Screen[],
  screens: readonly Screen[],
  generator: TextGenerator = stubTextGenerator(1),
  opts: { brief?: string; group?: string } = {},
): Promise<CopyCanvasResult> {
  const group = opts.group ?? newGroupId();
  const planned: Array<{ screen: Screen; item: Item; next: WireSpec }> = [];

  for (const s of screens) {
    if (isBlueprint(s.spec)) continue;
    const item = canvas.items[s.item];
    if (!item) continue;
    const next = await generateWireCopy(s.spec, generator, {
      ...(opts.brief ? { brief: opts.brief } : {}),
      key: seedKey(s.spec, s.item),
    });
    if (JSON.stringify(next) === JSON.stringify(s.spec)) continue;
    planned.push({ screen: s, item, next });
  }

  const changed: Array<{ itemId: string; title: string; spec: WireSpec }> = [];
  for (const { screen, item, next } of planned) {
    if (await writeWire(port, item, next, group, screen.spec)) {
      changed.push({ itemId: screen.item, title: wireTitle(next), spec: next });
    }
  }

  const prototypes = await rebuildPrototypes(
    port,
    canvas,
    all,
    changed.map((c) => ({ item: c.itemId, spec: c.spec })),
    group,
  );
  return { group, by: generator.name, changed, prototypes };
}

/**
 * Run `nameFlow` across target screens on a canvas (`wire name`), updating
 * screen titles, item titles, and shared navigation labels and rebuilding
 * prototypes in one op group.
 */
export async function nameFlowOnCanvas(
  port: WirePort,
  canvas: CanvasContents,
  all: readonly Screen[],
  screens: readonly Screen[],
  generator: TextGenerator = stubTextGenerator(1),
  opts: { request?: string; group?: string } = {},
): Promise<CopyCanvasResult & { brand: string; navLabels: string[] }> {
  const group = opts.group ?? newGroupId();
  const targetScreens = screens.filter((s) => !isBlueprint(s.spec));
  const named = await nameFlow(
    targetScreens.map((s) => s.spec),
    opts.request,
    generator,
  );
  const changed: Array<{ itemId: string; title: string; spec: WireSpec }> = [];

  for (let i = 0; i < targetScreens.length; i++) {
    const s = targetScreens[i]!;
    const next = named.specs[i]!;
    if (JSON.stringify(next) === JSON.stringify(s.spec)) continue;
    const item = canvas.items[s.item];
    if (!item) continue;
    if (await writeWire(port, item, next, group, s.spec)) {
      changed.push({ itemId: s.item, title: wireTitle(next), spec: next });
    }
  }

  const prototypes = await rebuildPrototypes(
    port,
    canvas,
    all,
    changed.map((c) => ({ item: c.itemId, spec: c.spec })),
    group,
  );
  return {
    group,
    by: generator.name,
    brand: named.brand,
    navLabels: named.navLabels,
    changed,
    prototypes,
  };
}
