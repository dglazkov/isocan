/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
