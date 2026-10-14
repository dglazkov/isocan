import { create } from "zustand";
import type { ReactNode } from "react";

/**
 * **What a far-away text node draws instead of its opening words, by item id**
 * (Semantic Zoom, phase 1). Empty unless the experiment is on: the lazy
 * `SemanticZoom` chunk is the only writer, and it hands over the finished
 * mark, so the first paint carries this line and ItemView's one read of it,
 * not the summary's markup. An item with no entry draws its title, as it
 * always did.
 */
export const useGistStore = create<Record<string, ReactNode>>(() => ({}));
