import type { CoreModule, SlashCommand } from "@isocan/core";
import { wireframeModule } from "./record.ts";

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
  land first, then fill in place, and arrive fleshed with sample content; one
  \`isocan undo\` takes the whole flow back, content and all. With no
  TYPESAFE_API_KEY here the canvas's home answers (the CLI says which).
- \`/wire basic <what the screens are for>\` → \`isocan wire --basic "<request>"\`
  (plain grey wires, no sample content).
- \`/wire prototype\` → \`isocan wire prototype\` (the kept screens, 📐 — keep
  some first with \`isocan wire keep <screens…>\` if nothing is kept).
- \`/wire style\` → \`isocan wire style\`; \`/wire style --default\` →
  \`isocan wire style --default\`.
- \`/wire flesh\` → \`isocan wire flesh\` (sample content instead of grey bars
  on wires that have none;
  \`/wire flesh --pack <id>\` and \`/wire flesh --bars\` pass through). Exact
  words for a screen are \`isocan wire copy <screen>\`, edited, then
  \`isocan wire copy <screen> --apply <file>\` — only when asked for copy.
- \`/wire rerender\` → \`isocan wire render --all\` (every wire drawn again from
  its own spec; a version only where the bytes change).
- \`/wire prototypes\` → \`isocan ls --filter Prototype\` (the prototypes carry
  \`wirePrototype\`); say which ones there are and where.

Post ONE comment saying what landed: how many screens, which answered, and
that one undo takes it back.`,
};

/** The record with the command's skill — what both loaded halves register. */
export const wireframeCore: CoreModule = { ...wireframeModule, commands: [WIRE_COMMAND] };
