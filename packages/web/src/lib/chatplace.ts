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

/**
 * **Where this viewer keeps the Chat: docked on the left, or a bar at the
 * bottom.**
 *
 * A viewer's layout, not a fact about the canvas — so it is one localStorage
 * key for every canvas, no Operation and no CLI verb. An agent has no screen
 * for the Chat to sit on; what it says lands in the same thread either way.
 *
 * This half is in the entry chunk because the first paint has to know which
 * frame to draw. Moving it — the drag, the drop zones, the bar itself — is
 * `chatmove.ts` and `ChatBar.tsx`, fetched when somebody uses them.
 */
export type ChatAt = "left" | "bottom";

/** The one localStorage key, for every canvas. `chatmove.ts` writes it. */
export const CHAT_AT_KEY = "isocan.chatAt";

/** The slice of `Storage` the placement uses — a parameter, so a test can
 *  hand in storage that throws. */
export type Store = Pick<Storage, "getItem" | "setItem">;

/** Left unless "bottom" was chosen here. Storage that throws — private mode, a
 *  sandboxed frame — reads as never chosen, which is today's dock. */
export function readChatAt(store?: Store): ChatAt {
  try {
    return (store ?? localStorage).getItem(CHAT_AT_KEY) === "bottom" ? "bottom" : "left";
  } catch {
    return "left";
  }
}
