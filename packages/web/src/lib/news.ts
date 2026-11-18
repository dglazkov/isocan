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

import { useEffect, useState } from "react";
import { unseen } from "@isocan/core";
import { fetchNews } from "./api.ts";

const SEEN_KEY = "isocan.news.seen";

/** The last day this browser was shown, or null for somebody who has never
 *  opened it. Per browser rather than per actor: it is about what these eyes
 *  have read, and an actor is a name you can change. */
function lastSeen(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    // A browser refusing storage gets a panel that never claims unread — the
    // list still reads, which is the part that matters.
    return null;
  }
}

/** Record the newest day when its notes arrive in an open dialog. */
export function markSeen(day: string | null): void {
  if (!day) return;
  try {
    localStorage.setItem(SEEN_KEY, day);
  } catch {
    /* nothing to remember it with; the panel still works */
  }
}

/**
 * How many days this reader has not seen. Zero for a first visit on purpose —
 * meeting somebody with fifty unread notices is a chore, not a welcome, and a
 * dot is a claim about their attention rather than about the list.
 */
export function useUnreadNews(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let live = true;
    fetchNews()
      .then((r) => live && setCount(unseen(r.days, lastSeen()).length))
      .catch(() => {
        /* a home that will not answer has no news; the dot stays off */
      });
    return () => {
      live = false;
    };
  }, []);
  return count;
}

