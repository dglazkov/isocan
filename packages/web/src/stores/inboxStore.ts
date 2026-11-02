import { create } from "zustand";
import type { InboxPollState } from "../lib/inboxpoll.ts";

/** The one authenticated navigation owner publishes; home and notification
 * surfaces read the same response, never another set of snapshot requests. */
export const useInboxStore = create<InboxPollState & { actorId: string | null; refresh: () => void }>(() => ({
  actorId: null, data: null, error: null, loading: true, refresh: () => {},
}));
