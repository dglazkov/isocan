import { create } from "zustand";
import type { FocusSubtarget } from "@isocan/core";

const CHAT_OPEN_KEY = "isocan.focus.chat";

function readStoredChatOpen(): boolean {
  try {
    const raw = localStorage.getItem(CHAT_OPEN_KEY);
    if (raw === "closed") return false;
    if (raw === "open") return true;
  } catch {
    // Storage unavailable; default open in Edit Focus.
  }
  return true;
}

function writeStoredChatOpen(open: boolean): void {
  try {
    localStorage.setItem(CHAT_OPEN_KEY, open ? "open" : "closed");
  } catch {
    // Session-only when storage is denied.
  }
}

export type FocusFilePaneMode = "studio" | "code" | "split";

export interface FocusState {
  focusedItemId: string | null;
  subtarget: FocusSubtarget | null;
  chatOpen: boolean;
  seedPrompt: string | null;
  activeThreadId: string | null;
  syncItem: (itemId: string | null) => void;
  setSubtarget: (subtarget: FocusSubtarget | null) => void;
  setChatOpen: (open: boolean) => void;
  toggleChat: () => void;
  askAgent: (seedPrompt?: string) => void;
  consumeSeedPrompt: () => string | null;
  setActiveThreadId: (threadId: string | null) => void;
}

export const useFocusStore = create<FocusState>((set, get) => ({
  focusedItemId: null,
  subtarget: null,
  chatOpen: readStoredChatOpen(),
  seedPrompt: null,
  activeThreadId: null,
  syncItem: (itemId) => {
    if (get().focusedItemId === itemId) return;
    set({
      focusedItemId: itemId,
      subtarget: null,
      seedPrompt: null,
      activeThreadId: null,
    });
  },
  setSubtarget: (subtarget) => set({ subtarget }),
  setChatOpen: (open) => {
    writeStoredChatOpen(open);
    set({ chatOpen: open });
  },
  toggleChat: () => {
    const next = !get().chatOpen;
    writeStoredChatOpen(next);
    set({ chatOpen: next });
  },
  askAgent: (seedPrompt) => {
    writeStoredChatOpen(true);
    set({
      chatOpen: true,
      ...(seedPrompt !== undefined ? { seedPrompt } : {}),
    });
  },
  consumeSeedPrompt: () => {
    const current = get().seedPrompt;
    if (current !== null) set({ seedPrompt: null });
    return current;
  },
  setActiveThreadId: (activeThreadId) => set({ activeThreadId }),
}));
