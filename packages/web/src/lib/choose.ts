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

import type { Actor, Operation } from "@isocan/core";
import { convergeOps, convergePlan, isRefusal, newGroupId } from "@isocan/core";
import { flashNotice, sendEchoed, setNotice, useCanvasStore } from "../stores/canvasStore.ts";

/**
 * **"Choose this variation", from the item menu** — the web's door to
 * `isocan choose`, which until this existed was the only way to converge an
 * exploration (atlas/convergence.md: "no web door").
 *
 * The winner's content becomes the next version of what it was made from and
 * every sibling, the winner included, goes to the trash. The plan and the ops
 * are core's (`convergePlan`, `convergeOps`), the same two the CLI verb calls,
 * sent under one group so one ⌘Z takes the whole decision back —
 * `packages/web/test/choose.test.ts` holds the two surfaces equal against a
 * real daemon. Loaded on the click, never on first paint.
 *
 * `send` is a parameter so a test can hold the ops the menu WOULD send; the
 * menu passes nothing and gets `sendEchoed`, like every other entry.
 */
export async function chooseVariation(
  canvasId: string,
  actor: Actor,
  itemId: string,
  send: (op: Operation, group: string) => Promise<unknown> = (op, group) => sendEchoed(canvasId, actor, op, group),
): Promise<Operation[] | null> {
  const canvas = useCanvasStore.getState().canvas;
  if (!canvas) return null;
  const plan = convergePlan(canvas, itemId);
  if (isRefusal(plan)) {
    setNotice(plan.refused);
    return null;
  }
  const ops = convergeOps(plan);
  const group = newGroupId();
  for (const op of ops) await send(op, group);
  const parent = canvas.items[plan.parentId]!;
  const others = plan.trash.length - 1;
  flashNotice(
    `“${canvas.items[itemId]!.title}” is v${parent.versions.length + 1} of “${parent.title}”` +
      (others > 0 ? `, and ${others} other${others === 1 ? "" : "s"} went to the trash` : "") +
      " (⌘Z takes it all back)",
  );
  return ops;
}
