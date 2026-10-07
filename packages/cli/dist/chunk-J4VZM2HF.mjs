import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  newVoiceSlips,
  voicePrompt,
  voiceSlipText
} from "./chunk-3GCZKVLQ.mjs";
import {
  copyBudget
} from "./chunk-SGXD6ULG.mjs";

// packages/core/src/copy-variants.ts
var COPY_STANCE_PROP = "copyStance";
var COPY_WHY_PROP = "copyWhy";
var VARIANT_PARENT_PROP = "parent";
var VARIANT_GAP = 40;
var VARIANT_PREFERRED_OVER_PROP = "preferredOver";
var VARIANT_PREFERENCE_PROP = "copyPreference";
var MAX_COPY_VARIANTS = 6;
var STANCE_WORDS = 5;
var words = (s) => s.trim().split(/\s+/).filter(Boolean).length;
var show = (s) => JSON.stringify(s.length > 40 ? `${s.slice(0, 39)}\u2026` : s);
function copyVariantsRequest(deck, n, brief, voice, scope) {
  const said = voicePrompt(voice);
  const lines = deck.strings.map((s) => `${s.address}	${s.role}	${JSON.stringify(s.text)}`);
  const subject = scope ? `a flow of ${scope.screens} screens` : "one screen";
  const prompt = [
    `Rewrite the words of ${subject} in ${n} distinct voices. Words only: you are not redesigning the screen${scope ? "s" : ""}.`,
    "",
    ...scope ? [
      `The flow's strings, screen by screen in reading order (address, role, current words). An address is \`<screen>${FLOW_ADDRESS_SEP}<string>\`; the screens are: ${scope.titles.map((t) => JSON.stringify(t)).join(", ")}.`,
      "One voice means ONE voice across every screen: the same tone, and one name per thing \u2014 a button that goes to the same place says the same words on every screen."
    ] : ["The screen's strings, in reading order (address, role, current words):"],
    ...lines,
    "",
    ...brief?.trim() ? [`What the person asked for: ${brief.trim()}`, ""] : [],
    ...said ? ["The product's voice, from its DESIGN.md \u2014 keep to it in every variant:", said, ""] : [],
    `Return exactly ${n} variants. Each has:`,
    `- "stance": what this voice is trying, in at most ${STANCE_WORDS} words (e.g. "Plain and direct", "Warm", "Benefit-first"). Every stance must be different from the others.`,
    '- "why": one sentence on why someone would pick this voice.',
    '- "edits": the strings this voice changes, each { "address", "to" } with an address from the list above. Leave out strings it would keep.',
    "Keep each string doing the same job: a button stays a short action, a label stays a label, a heading stays one line. Keep names, numbers, prices and links' destinations as they are."
  ].join("\n");
  const addresses = deck.strings.map((s) => s.address);
  const schema = {
    type: "object",
    properties: {
      variants: {
        type: "array",
        minItems: n,
        maxItems: n,
        items: {
          type: "object",
          properties: {
            stance: { type: "string", description: `what this voice is trying, at most ${STANCE_WORDS} words` },
            why: { type: "string", description: "one sentence: why pick this voice" },
            edits: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                properties: {
                  address: { type: "string", enum: addresses },
                  to: { type: "string", description: "the new words for that string" }
                },
                required: ["address", "to"],
                additionalProperties: false
              }
            }
          },
          required: ["stance", "why", "edits"],
          additionalProperties: false
        }
      }
    },
    required: ["variants"],
    additionalProperties: false
  };
  return { prompt, schema };
}
function checkCopyVariants(deck, raw, n, voice) {
  const list = raw && typeof raw === "object" && Array.isArray(raw.variants) ? raw.variants : null;
  if (!list) return { ok: false, reason: 'variants are { "variants": [{ "stance", "why", "edits": [{ "address", "to" }] }] }' };
  if (list.length === 0) return { ok: false, reason: "no variants" };
  if (n !== void 0 && list.length !== n) return { ok: false, reason: `asked for ${n} variant${n === 1 ? "" : "s"} and got ${list.length}` };
  if (list.length > MAX_COPY_VARIANTS) return { ok: false, reason: `${list.length} variants \u2014 at most ${MAX_COPY_VARIANTS} in one go` };
  const byAddress = new Map(deck.strings.map((s) => [s.address, s]));
  const stances = /* @__PURE__ */ new Map();
  const out = [];
  for (const [i, entry] of list.entries()) {
    const at = `variant ${i + 1}`;
    if (!entry || typeof entry !== "object") return { ok: false, reason: `${at} is not an object` };
    const v = entry;
    const stance = typeof v.stance === "string" ? v.stance.trim().replace(/\s+/g, " ") : "";
    if (!stance) return { ok: false, reason: `${at} has no stance` };
    if (words(stance) > STANCE_WORDS) return { ok: false, reason: `${at}'s stance ${show(stance)} is more than ${STANCE_WORDS} words \u2014 a stance is a label` };
    const key = stance.toLowerCase();
    if (stances.has(key)) return { ok: false, reason: `${at}'s stance ${show(stance)} is variant ${stances.get(key) + 1}'s too \u2014 each voice must be a different one` };
    stances.set(key, i);
    const why = typeof v.why === "string" ? v.why.trim().replace(/\s+/g, " ") : "";
    if (!why) return { ok: false, reason: `${at} (${stance}) has no why` };
    if (!Array.isArray(v.edits)) return { ok: false, reason: `${at} (${stance}) has no edits` };
    const seen = /* @__PURE__ */ new Set();
    const edits = [];
    for (const e of v.edits) {
      const edit = e;
      if (!edit || typeof edit.address !== "string" || typeof edit.to !== "string") return { ok: false, reason: `${at} (${stance}): every edit is { "address", "to" }` };
      const string = byAddress.get(edit.address);
      if (!string) return { ok: false, reason: `${at} (${stance}) edits ${edit.address}, which this screen does not have \u2014 \`isocan words <item>\` lists the addresses` };
      if (seen.has(edit.address)) return { ok: false, reason: `${at} (${stance}) edits ${edit.address} twice` };
      seen.add(edit.address);
      const to = edit.to.trim();
      if (!to) return { ok: false, reason: `${at} (${stance}) empties ${edit.address} (${string.role}) \u2014 a variant changes words, it does not remove them` };
      const shape = copyBudget(string.role);
      if (shape.oneLine && /[\r\n]/.test(to)) return { ok: false, reason: `${at} (${stance}) breaks ${edit.address} (${string.role}) over lines \u2014 a ${string.role} stays one line` };
      if (to.length > shape.chars) return { ok: false, reason: `${at} (${stance}) makes ${edit.address} (${string.role}) ${to.length} characters \u2014 a ${string.role} stays under ${shape.chars}` };
      const slip = newVoiceSlips(voice, string.text, to)[0];
      if (slip) return { ok: false, reason: `${at} (${stance}) ${voiceSlipText(slip)} at ${edit.address} (${string.role}) \u2014 DESIGN.md's Voice section` };
      if (to !== string.text) edits.push({ address: edit.address, text: string.text, to });
    }
    if (edits.length === 0) return { ok: false, reason: `${at} (${stance}) changes no words` };
    out.push({ stance, why, edits });
  }
  return { ok: true, variants: out };
}
var FLOW_ADDRESS_SEP = "::";
function flowCopyDeck(screens) {
  const strings = screens.flatMap((s) => s.deck.strings.map((str) => ({ ...str, address: `${s.itemId}${FLOW_ADDRESS_SEP}${str.address}` })));
  return { kind: screens[0]?.deck.kind ?? "html", strings };
}
function splitFlowEdits(edits) {
  const out = /* @__PURE__ */ new Map();
  for (const e of edits) {
    const at = e.address.indexOf(FLOW_ADDRESS_SEP);
    if (at < 0) throw new Error(`${e.address} is not a flow address (<screen>${FLOW_ADDRESS_SEP}<string>)`);
    const itemId = e.address.slice(0, at);
    const list = out.get(itemId) ?? [];
    list.push({ ...e, address: e.address.slice(at + FLOW_ADDRESS_SEP.length) });
    out.set(itemId, list);
  }
  return out;
}
function placeholderCopyVariants(deck, n) {
  const isLoud = (s) => s.role === "heading" || s.role === "button" || s.role === "link";
  const pick = (strings, most) => {
    const loud = strings.filter(isLoud).slice(0, most);
    return loud.length ? loud : strings.slice(0, 1);
  };
  const screens = /* @__PURE__ */ new Map();
  for (const s of deck.strings) {
    const at = s.address.indexOf(FLOW_ADDRESS_SEP);
    if (at < 0) continue;
    const key = s.address.slice(0, at);
    screens.set(key, [...screens.get(key) ?? [], s]);
  }
  const targets = screens.size > 0 ? [...screens.values()].flatMap((strings) => pick(strings, 2)) : pick(deck.strings, 4);
  return {
    variants: Array.from({ length: n }, (_, i) => {
      const letter = String.fromCharCode(65 + i);
      return {
        stance: `Placeholder ${letter}`,
        why: "No text model was reachable, so these are placeholder words \u2014 not written copy.",
        edits: targets.map((s) => ({ address: s.address, to: `Placeholder ${s.role} ${letter}` }))
      };
    })
  };
}
function copyVariantTitle(source, stance) {
  return `${source.title || source.id} \u2014 ${stance}`;
}
function copyVariantOps(canvas, source, made) {
  const children = Object.values(canvas.items).filter((item) => item.properties[VARIANT_PARENT_PROP] === source.id);
  let bottom = Math.max(source.y + source.height, ...children.map((c) => c.y + c.height));
  return made.map(({ itemId, variant, version, properties }) => {
    const y = bottom + VARIANT_GAP;
    bottom = y + source.height;
    return {
      type: "item.add",
      itemId,
      version,
      width: source.width,
      height: source.height,
      placement: { x: source.x, y, chosen: true },
      title: copyVariantTitle(source, variant.stance),
      properties: { ...properties, [VARIANT_PARENT_PROP]: source.id, [COPY_STANCE_PROP]: variant.stance, [COPY_WHY_PROP]: variant.why },
      ...source.containerId ? { containerId: source.containerId, groupPlacement: "exact" } : {}
    };
  });
}
function copyVariantsOf(canvas, sourceId) {
  return Object.values(canvas.items).filter((item) => item.properties[VARIANT_PARENT_PROP] === sourceId && item.properties[COPY_STANCE_PROP] !== void 0).sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
}
function copyMixRows(source, variants) {
  for (const v of variants) {
    const lined = v.deck.kind === source.kind && v.deck.strings.length === source.strings.length && v.deck.strings.every((s, i) => s.address === source.strings[i].address && s.role === source.strings[i].role);
    if (!lined) return { ok: false, reason: `"${v.stance}" no longer lines up with its source string for string \u2014 the source changed since it was varied; vary it again` };
  }
  const rows = [];
  source.strings.forEach((s, i) => {
    const said = variants.map((v) => ({ itemId: v.itemId, text: v.deck.strings[i].text }));
    if (said.some((v) => v.text !== s.text)) rows.push({ address: s.address, role: s.role, source: s.text, variants: said });
  });
  return { ok: true, rows };
}
function copyMixEdits(source, variants, picks, sourceId) {
  const read = copyMixRows(source, variants);
  if (!read.ok) return read;
  const rows = new Map(read.rows.map((r) => [r.address, r]));
  const known = new Map(variants.map((v) => [v.itemId, v.stance]));
  const edits = [];
  for (const [address, itemId] of Object.entries(picks)) {
    if (itemId === sourceId) continue;
    if (!known.has(itemId)) return { ok: false, reason: `${itemId} is not one of this screen's copy variants \u2014 \`isocan lineage <source>\` lists what was made from it` };
    const row = rows.get(address);
    if (!row) {
      const here = source.strings.find((s) => s.address === address);
      if (!here) return { ok: false, reason: `this screen has no string at ${address} \u2014 \`isocan words <source>\` lists the addresses` };
      return { ok: false, reason: `no voice changed ${address} (${here.role}) \u2014 there is nothing to take from "${known.get(itemId)}"` };
    }
    const to = row.variants.find((v) => v.itemId === itemId).text;
    if (to === row.source) return { ok: false, reason: `"${known.get(itemId)}" kept ${address} (${row.role}) as it was \u2014 pick a voice that changed it` };
    edits.push({ address, text: row.source, to });
  }
  if (edits.length === 0) return { ok: false, reason: "the mix is the source's own words \u2014 pick at least one string from a variant" };
  const order = new Map(source.strings.map((s, i) => [s.address, i]));
  return { ok: true, edits: edits.sort((a, b) => order.get(a.address) - order.get(b.address)) };
}
function copyMixPreferencePatch(source, variants, pickedIds) {
  const pickedSet = pickedIds instanceof Set ? pickedIds : new Set(pickedIds);
  const picked = variants.filter((v) => pickedSet.has(v.itemId));
  const unpicked = variants.filter((v) => !pickedSet.has(v.itemId));
  const against = unpicked.length > 0 ? unpicked.map((v) => v.stance) : picked.length > 1 ? picked.map((v) => v.stance) : [];
  if (picked.length === 0 || against.length === 0) return null;
  const stance = picked.map((v) => v.stance).join(" + ");
  const againstIds = unpicked.map((v) => v.itemId);
  const rawOver = source.properties[VARIANT_PREFERRED_OVER_PROP];
  const already = typeof rawOver === "string" && rawOver !== "" ? rawOver.split(",").filter(Boolean) : [];
  const fresh = againstIds.filter((id) => id !== source.id && !already.includes(id));
  return {
    properties: {
      ...fresh.length > 0 ? { [VARIANT_PREFERRED_OVER_PROP]: [...already, ...fresh].join(",") } : {},
      [VARIANT_PREFERENCE_PROP]: JSON.stringify({
        how: "mix",
        stance,
        against,
        ...againstIds.length > 0 ? { againstIds } : {}
      })
    }
  };
}
function copyMixOps(sourceId, version, variantIds, preferencePatch) {
  return [
    { type: "item.addVersion", itemId: sourceId, version },
    ...preferencePatch ? [{ type: "item.update", itemId: sourceId, patch: preferencePatch }] : [],
    ...variantIds.map((itemId) => ({ type: "item.delete", itemId }))
  ];
}

export {
  COPY_STANCE_PROP,
  COPY_WHY_PROP,
  VARIANT_PARENT_PROP,
  VARIANT_GAP,
  VARIANT_PREFERRED_OVER_PROP,
  VARIANT_PREFERENCE_PROP,
  MAX_COPY_VARIANTS,
  copyVariantsRequest,
  checkCopyVariants,
  flowCopyDeck,
  splitFlowEdits,
  placeholderCopyVariants,
  copyVariantOps,
  copyVariantsOf,
  copyMixRows,
  copyMixEdits,
  copyMixPreferencePatch,
  copyMixOps
};
