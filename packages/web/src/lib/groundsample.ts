import { create } from "zustand";

/**
 * **A picture's colour, looked at once** (smart contrast phase 3, design §4).
 *
 * A canvas standing on somebody's photograph takes its ink from the colour
 * the photograph actually is under the scrim, not from an assumption. That is
 * worked out once per picture, when it has decoded — drawn into 16×16, handed
 * to core's `sampledGround` — and kept here by the picture's sha256 for the
 * life of the tab. Never stored, never sent: every browser that draws the
 * picture can look at it. Until it has, the tone is core's worst case. The
 * looking itself is `lib/groundlook.ts`, loaded with the picture's chunk.
 */
export const useGroundSamples = create<{ byHash: Record<string, string> }>(() => ({ byHash: {} }));
