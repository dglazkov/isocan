import type { CoreModule, ModuleKind } from "@isocan/core";

export const FIGHTER_MIME = "application/vnd.isocan.fighter+json";

/** The fighter card: the one new kind, and only because a portrait needs a
 *  renderer. Without the module it is a small JSON file. */
export const FIGHTER_KIND: ModuleKind = {
  id: "fighter",
  mimes: [FIGHTER_MIME],
  extensions: ["fighter"],
  label: "Fighters",
  noun: "fighter card",
  icon: "document",
};

/** The local command opens a dialog; its agent instructions live in the loaded half. */
export const COMPETITION_COMMAND_METADATA = {
  name: "design-competition",
  description: "Choose your fighters — rival designers build one brief, the room votes",
  usage: "<what to design>",
  source: "module" as const,
  opens: "fighters",
};

/** Metadata offered before the picker or a fighter card requests the web chunk. */
export const competitionActivation = {
  core: { name: "@isocan/design-competition", kinds: [FIGHTER_KIND], commands: [{ ...COMPETITION_COMMAND_METADATA, body: "" }] } satisfies CoreModule,
  actions: [{ id: "design-competition", name: "Start a design competition", hint: "choose your fighters — rival designers, one brief, a vote", opens: "fighters" }],
  dialogs: [{ id: "fighters", title: "Choose your fighter", wide: true }],
  renderers: [{ mimes: [FIGHTER_MIME] }],
};
