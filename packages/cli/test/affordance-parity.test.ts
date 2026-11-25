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

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SHORTCUTS } from "../../core/src/shortcuts.ts";

/**
 * **Affordance parity guard** (Open Stitch phase 1B).
 *
 * `surface.test.ts` checks that every registered CLI verb is documented in
 * `--agent-help`. This test holds the complementary direction: every user
 * keyboard shortcut in `packages/core/src/shortcuts.ts` must EITHER map to an
 * actual registered CLI verb (`SHORTCUT_TO_CLI_VERB`) OR be explicitly listed
 * in `USER_ONLY_SHORTCUTS` with a one-line pointer/viewport/UI reason.
 *
 * Adding a new shortcut without a CLI verb or an explicit user-only reason
 * fails the build rather than silently shipping a human-only feature.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../..");

function registeredCommandWords(): Set<string> {
  const modulesRoot = path.join(repo, "packages/modules");
  const moduleClis = readdirSync(modulesRoot)
    .map((name) => path.join(modulesRoot, name, "src/cli.ts"))
    .filter((f) => existsSync(f));

  const sources = [
    path.join(repo, "packages/cli/src/main.ts"),
    path.join(repo, "packages/cli/src/canvas-groups.ts"),
    path.join(repo, "packages/cli/src/context-reads.ts"),
    path.join(repo, "packages/cli/src/questionnaire.ts"),
    path.join(repo, "packages/cli/src/design-request.ts"),
    path.join(repo, "packages/cli/src/design-system.ts"),
    path.join(repo, "packages/cli/src/personal-context.ts"),
    path.join(repo, "packages/cli/src/bench.ts"),
    path.join(repo, "packages/cli/src/operator.ts"),
    path.join(repo, "packages/cli/src/tweak.ts"),
    path.join(repo, "packages/cli/src/jobs.ts"),
    ...moduleClis,
  ];

  const words = new Set<string>();
  for (const file of sources) {
    for (const match of readFileSync(file, "utf8").matchAll(/\.command\("([a-z-]+)/g)) {
      words.add(match[1]!);
    }
  }
  return words;
}

/**
 * Canvas shortcuts whose intent is reachable by agents through a registered CLI
 * verb. Every token in the value is verified against the CLI's registered
 * `.command(...)` definitions.
 */
export const SHORTCUT_TO_CLI_VERB: Record<string, string> = {
  "Pen — draw on the canvas": "add",
  "Text — click the canvas and type": "text",
  "Comment — click anywhere to start a thread": "comment",
  "Customize UI": "tweak",
  "Comment on the selection": "comment",
  "Switch canvas": "canvas",
  "Include archived canvases": "canvas ls",
  "Group selection": "canvas group wrap",
  "Ungroup": "canvas group ungroup",
  "Drag one item in or out of its group": "mv",
  "Nudge the selection": "mv",
  "Rename": "set",
  "Show the version stack": "versions",
  "Stack or spread the group": "canvas group stack",
  "Fit the item to its content": "fit",
  "Download": "get",
  "Move the selection to the trash": "rm",
  "Undo and redo": "undo",
  "Copy the selection": "copy",
  "Paste": "copy",
  "View the selection": "get",
  "Edit the selection": "edit",
  "Annotate it": "add",
  "Send it": "comment",
  "Send the comment you are writing": "comment",
  "Address someone": "comment",
  "Point at an item": "comment",
  "Signal on your cursor, or ask for a known piece of work": "session",
  "This list": "shortcuts",
};

/**
 * Reviewed shortcuts that have no CLI verb because they are purely local
 * pointer, viewport, presentation-projector, or transient UI controls.
 */
export const USER_ONLY_SHORTCUTS: Record<string, string> = {
  "Select": "pointer tool selection for direct mouse clicks",
  "Hand — drag the canvas": "viewport camera panning with the pointer",
  "Zoom — click an item to fit it, or drag a region": "viewport camera zoom gesture",
  "Back out: leave full screen, stop watching, close a popover, drop the tool, deselect": "local UI modal/tool dismissal",
  "Zoom in and out": "viewport camera zoom level",
  "Fit the selection": "viewport camera framing around selection",
  "Fit everything": "viewport camera framing around all items",
  "Workbench — the agent room": "local UI mode switch into the Workbench view",
  "Actual size (100%)": "viewport camera reset to 100% zoom",
  "Jump to the nearest item that way": "viewport camera focus navigation between items",
  "Flip through the slides": "full-screen projector navigation between slides",
  "Jump to a slide, or the last, in full screen": "full-screen projector jump to a numbered slide",
  "Start or stop the slides turning themselves, in full screen": "full-screen projector auto-advance timer",
  "Show or hide the bar, in full screen": "full-screen projector HUD visibility toggle",
  "Speaker notes, in full screen": "full-screen presenter notes drawer toggle",
  "Pan and zoom": "trackpad/wheel viewport camera gesture",
  "Select one item inside a group": "pointer click-through selection inside a group",
  "Open selection menu": "keyboard trigger for the browser context menu popover",
  "Snap harder to the guides": "pointer drag modifier increasing guide magnet radius",
  "Flip through a stack": "local visual peek cycling the front card of a stack without mutating canvas state",
  "Its content moves, not the canvas": "wheel routing into an item's inner scroll container",
  "Step inside it: scroll it, click its links": "inline iframe/content focus gesture",
  "Reach the item underneath": "pointer click-through hit test for stacked items",
  "Select several": "pointer marquee box selection",
  "Take back the last stroke": "local wet-ink buffer undo before stroke settles into an op",
  "Settle the ink into an item now": "manual flush of local wet-ink buffer",
  "Open the launcher: fit, arm a tool, open a panel, switch canvas, or ask an agent": "browser command palette popover",
  "Open or close the Chat": "browser chat rail visibility toggle",
  "Hide or show the interface": "transient per-browser chrome visibility toggle (Cmd+\\)",
};

describe("affordance parity between keyboard shortcuts and CLI verbs", () => {
  const registered = registeredCommandWords();

  it("accounts for every shortcut in core/src/shortcuts.ts", () => {
    const missing: string[] = [];
    const duplicated: string[] = [];

    for (const shortcut of SHORTCUTS) {
      const inCli = Object.prototype.hasOwnProperty.call(SHORTCUT_TO_CLI_VERB, shortcut.does);
      const inUserOnly = Object.prototype.hasOwnProperty.call(USER_ONLY_SHORTCUTS, shortcut.does);
      if (!inCli && !inUserOnly) missing.push(`${shortcut.keys.join("/")} — ${shortcut.does}`);
      if (inCli && inUserOnly) duplicated.push(shortcut.does);
    }

    expect(
      missing,
      `Every shortcut must map to a CLI verb in SHORTCUT_TO_CLI_VERB or declare a pointer/viewport reason in USER_ONLY_SHORTCUTS:\n  - ${missing.join("\n  - ")}`,
    ).toEqual([]);
    expect(duplicated, "A shortcut cannot be both CLI-mapped and user-only").toEqual([]);
  });

  it("maps every CLI-backed shortcut to verbs actually registered in the CLI", () => {
    const unknown: string[] = [];
    for (const [does, verbSpec] of Object.entries(SHORTCUT_TO_CLI_VERB)) {
      const words = verbSpec.trim().split(/\s+/);
      for (const word of words) {
        if (!registered.has(word)) {
          unknown.push(`${does} -> "${verbSpec}" (missing command "${word}")`);
        }
      }
    }
    expect(unknown, `Unregistered CLI verbs in SHORTCUT_TO_CLI_VERB:\n  - ${unknown.join("\n  - ")}`).toEqual([]);
  });

  it("carries a non-empty pointer/viewport reason for every user-only shortcut", () => {
    for (const [does, reason] of Object.entries(USER_ONLY_SHORTCUTS)) {
      expect(reason.trim().length, `empty reason for "${does}"`).toBeGreaterThanOrEqual(10);
    }
  });
});
