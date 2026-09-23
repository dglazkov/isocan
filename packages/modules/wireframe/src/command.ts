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
  land first, then fill in place; one \`isocan undo\` takes the whole flow back.
  With no TYPESAFE_API_KEY here the canvas's home answers (the CLI says which).
- \`/wire prototype\` → \`isocan wire prototype\` (the kept screens, 📐 — keep
  some first with \`isocan wire keep <screens…>\` if nothing is kept).
- \`/wire style\` → \`isocan wire style\`; \`/wire style --default\` →
  \`isocan wire style --default\`.

Post ONE comment saying what landed: how many screens, which answered, and
that one undo takes it back.`,
};

/** The record with the command's skill — what both loaded halves register. */
export const wireframeCore: CoreModule = { ...wireframeModule, commands: [WIRE_COMMAND] };
