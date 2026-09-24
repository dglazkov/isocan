import type { CoreModule, SlashCommand } from "@isocan/core";
import { wireframeModule } from "./record.ts";
import { KEEP_PROP } from "./keep.ts";
import { MAYBE_PROP } from "./maybe.ts";

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

/**
 * The record with the command's skill and the property keys it owns — what
 * both loaded halves register. The keys live here rather than on the record
 * first paint carries (`record.ts`) because nothing on the web reads them:
 * they are the CLI's manifest and the daemon's, forever, and namespaced.
 * `wireKeepBy` (who put a screen in the prototype, keep.ts), `wireLinks`
 * (a person's overrides, links.ts — since phase 8 one
 * `wireLink:<hotspot>` each, link-override.ts), `wirePrototype`
 * (prototype.ts) and `wirePrototypeAt` (kept-flows.ts) are spelled out.
 */
export const wireframeCore: CoreModule = {
  ...wireframeModule,
  propertyKeys: [KEEP_PROP, "wireKeepBy", MAYBE_PROP, "wireLinks", "wireLink:*", "wirePrototype", "wirePrototypeAt"],
  commands: [WIRE_COMMAND],
};
