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

import { create } from "zustand";
import type { InboxPollState } from "../lib/inboxpoll.ts";

/** The one authenticated navigation owner publishes; home and notification
 * surfaces read the same response, never another set of snapshot requests. */
export const useInboxStore = create<InboxPollState & { actorId: string | null; refresh: () => void }>(() => ({
  actorId: null, data: null, error: null, loading: true, refresh: () => {},
}));
