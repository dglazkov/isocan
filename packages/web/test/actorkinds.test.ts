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

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const presence = read("../src/components/Presence.tsx");
const api = read("../src/lib/api.ts");
const board = read("../../../scripts/canvas-board.mjs");

/**
 * **The canvas knows who is an agent**, and says so where a person looks:
 * the face card and its tooltip read the registry's kinds, so an agent that
 * spoke and left is "agent · away", never a person who went quiet. And the
 * bot that posted 137 notices into one Chat now posts on its own panel.
 */
describe("a face says when it is an agent", () => {
  it("reads the kinds once and uses them in the tooltip and the card", () => {
    expect(api).toContain("export function fetchActorKinds()");
    expect(presence).toContain("const kinds = useActorKinds();");
    expect(presence).toContain("function tooltip(face: Face, kinds: ActorKinds)");
    expect(presence).toContain('else if (isAgentActor(kinds, face.actor.id)) parts.push("agent");');
    expect(presence).toContain('"agent · away"');
  });
});

describe("the board keeps its notices out of the Chat", () => {
  it("posts on its own panel's thread, and reaches for the Chat only when there is no panel yet", () => {
    expect(board).toContain("board.comment(");
    expect(board).toContain("board.reply(");
    // One notify left, and it is the fallback for a canvas with no board on it.
    expect(board.match(/board\.notify\(/g)).toHaveLength(1);
    expect(board).toContain("else await board.notify(notice);");
  });
});
