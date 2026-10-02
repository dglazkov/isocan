import type { SlashCommand } from "@isocan/core";
import { KEEP_PROP, MAYBE_PROP, wireframeModule } from "./record.ts";

/**
 * **`/wire`** — local on the web (it opens the Wireframes dialog, which runs
 * the composer in the browser against the home's judge), a skill on the
 * terminal: an agent reading it from the Chat does the same thing with the
 * verbs, and never draws a screen by hand.
 */
export const WIRE_COMMAND: SlashCommand = {
  ...wireframeModule.commands![0]!,
  body: `Wireframes on this canvas, with the \`isocan wire\` verbs — never draw a
screen by hand, and never write its copy yourself unless asked.

- \`/wire <what the screens are for>\` → \`isocan wire "<request>"\`. Blueprints
  land first, then fill in place, arrive fleshed with sample content, and end
  with a prototype of the answerer's first choices (📐) above the row; one
  \`isocan undo\` takes the whole flow back, content and prototype and all.
  With no TYPESAFE_API_KEY here the canvas's home answers (the CLI says which).
- \`/wire basic <what the screens are for>\` → \`isocan wire --basic "<request>"\`
  (plain grey wires, no sample content, nothing in a prototype).
- \`/wire prototype\` → \`isocan wire prototype\` (the screens marked 📐 — use
  some in it first with \`isocan wire use <screens…>\` if none is).
- \`/wire style <name>\` → \`isocan wire style --preset <name>\` (a named look —
  material, shadcn, glass, ios, fluent, carbon, brutalist, a design-competition
  pack, or house for the greys — placed beside the flow as its DESIGN.md and
  made its design system; one undo takes it back). \`/wire style\` alone →
  \`isocan wire style --list\`: say which styles there are and ask which.
- \`/wire style system\` → \`isocan wire style\` (every wire in the design
  system that governs it); \`/wire style --default\` → \`isocan wire style
  --default\`.
- \`/wire flesh\` → \`isocan wire flesh\` (sample content instead of grey bars
  on wires that have none;
  \`/wire flesh --pack <id>\` and \`/wire flesh --bars\` pass through). Exact
  words for a screen are \`isocan wire copy <screen>\`, edited, then
  \`isocan wire copy <screen> --apply <file>\` — only when asked for copy.
- \`/wire rerender\` → \`isocan wire render --all\` (every wire drawn again from
  its own spec; a version only where the bytes change).
- \`/wire layer <wire|system|lofi|hifi|+layer|-layer>\` → \`isocan wire layer
  <directive> [screens…]\` (check or uncheck fidelity layers \`system\`,
  \`copy\`, \`lofi\`, \`hifi\`, or jump between the 4 fidelity tiers
  non-destructively).
- \`/wire prototypes\` → \`isocan ls --filter Prototype\` (the prototypes carry
  \`wirePrototype\`); say which ones there are and where.

Post ONE comment saying what landed: how many screens, which answered, and
that one undo takes it back.`,
};

/** The property keys owned by the wireframe module across both surfaces. */
export const WIRE_PROPERTY_KEYS: readonly string[] = [
  KEEP_PROP,
  "wireKeepBy",
  MAYBE_PROP,
  "wireLinks",
  "wireLink:*",
  "wirePrototype",
  "wirePrototypeAt",
  "wirePreset",
  "wireLayer",
  "wireLayer:*",
];
