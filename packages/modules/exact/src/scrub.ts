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

import { useSyncExternalStore } from "react";
import type { ModuleCommentFacts, ModuleMenuRow } from "@isocan/core";
import { EXACT_PROPS } from "./core.ts";
import { momentOf, parseFilm } from "./film.ts";

/**
 * **Where each film is scrubbed to, in this tab** (exact phase 4) — one
 * person's view, never written, as motion's paused moment is
 * (`packages/web/src/lib/motionclock.ts`): the strip shows it, a comment made
 * there carries it as `at`, and opening a comment that carries `at` scrubs
 * the strip back to it.
 *
 * Opening a comment: the shell asks a loaded module for its buttons under
 * each comment of the thread it shows (`WebModule.comments`) — the one moment
 * a module hears that a thread is open, without reaching into the shell's
 * stores. A comment with `at`, pinned to a film, scrubs it there the first
 * time it is shown (and again when it is shown after a pause, a reopening),
 * and offers *Scrub to … ms* to go back after scrubbing away.
 */

const moments = new Map<string, number>();
const listeners = new Set<() => void>();
let version = 0;
const notify = () => { version++; for (const l of listeners) l(); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function scrubTo(itemId: string, ms: number): void {
  if (moments.get(itemId) === ms) return;
  moments.set(itemId, ms);
  notify();
}

export function scrubbedAt(itemId: string): number | undefined {
  return moments.get(itemId);
}

/** This film's moment, re-rendering when any film moves. */
export function useScrub(itemId: string): number | undefined {
  useSyncExternalStore(subscribe, () => version);
  return moments.get(itemId);
}

/** The comment last shown, and when: a comment shown again after a pause is a thread opened again. */
let shown: { key: string; at: number } | null = null;
const REOPENED_MS = 1500;

export function filmCommentRows({ canvas, thread, comment }: ModuleCommentFacts): readonly ModuleMenuRow[] {
  if (comment.at === undefined || !thread.anchorItemId) return [];
  const item = canvas.items[thread.anchorItemId];
  if (!item || !parseFilm(item.properties?.[EXACT_PROPS.film])) return [];
  const ms = momentOf(comment.at);
  const key = `${thread.id}\u0000${comment.id}`;
  const now = Date.now();
  const opened = !shown || shown.key !== key || now - shown.at > REOPENED_MS;
  shown = { key, at: now };
  // Asked while the shell renders the thread: scrub after it, not during it.
  if (opened) queueMicrotask(() => scrubTo(item.id, ms));
  return [{ label: `Scrub to ${ms} ms`, run: () => scrubTo(item.id, ms) }];
}
