import { create } from "zustand";
import type { ReactNode } from "react";

/**
 * **What a far-away text node draws instead of its opening words, and a
 * group or an area inside its frame, by item id** (Semantic Zoom). Empty
 * unless the experiment is on: the lazy `SemanticZoom` chunk is the only
 * writer, and it hands over the finished mark or card, so the first paint
 * carries this line and ItemView's one read of it, not the summary's markup.
 * `px` is a group's or an area's members' median type size (world units),
 * which `zoomDecisions` turns into `Z_GIST`. An item with no entry draws what
 * it always did.
 */
export const useGistStore = create<Record<string, { node: ReactNode; px?: number }>>(() => ({}));
