/**
 * Identity colors: the one color an actor wears everywhere — their cursor,
 * their face in the pile, the outline on an item they are holding, a comment
 * pin, and the default ink in their Pen.
 *
 * A color is DERIVED from the actor id by default, so every client agrees on
 * it with no storage and no round trip, and a brand-new actor has a color the
 * moment it exists. Choosing one instead is `actor.setColor`: the choice lands
 * in the actor registry beside the name, which is what makes it durable and —
 * more importantly — the same for everyone. A color you can only see yourself
 * is not an identity.
 *
 * The palette is small and curated on purpose: every entry has to read on the
 * vellum ground AND the graphite one, because there is one canvas and two
 * themes, and drawings carry literal colors into their SVG.
 */

/** The palette, in the order a picker should show it. Cobalt is deliberately
 * absent: the app reserves it for structure (your own selection, primary
 * actions), so an actor wearing it would read as "selected". */
export const IDENTITY_COLORS: ReadonlyArray<{ name: string; value: string }> = [
  { name: "Teal", value: "#0f8a80" },
  { name: "Crimson", value: "#c93a55" },
  { name: "Violet", value: "#7a3fd0" },
  { name: "Amber", value: "#b26a00" },
  { name: "Forest", value: "#3a7d2c" },
  { name: "Periwinkle", value: "#3d63dd" },
  { name: "Graphite", value: "#6b7280" },
];

/** Chosen colors, keyed by actor id — the registry's `colors` map. */
export type ActorColors = Record<string, string>;

/** Any color the app is willing to store or draw with: a literal hex. */
export function isIdentityColor(value: string): boolean {
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

/** The color this actor wears: their choice if they made one, else the one
 * their id has always implied. */
export function actorColor(actorId: string, colors?: ActorColors): string {
  const chosen = colors?.[actorId];
  if (chosen && isIdentityColor(chosen)) return chosen;
  let hash = 0;
  for (let i = 0; i < actorId.length; i++) {
    hash = (hash * 31 + actorId.charCodeAt(i)) >>> 0;
  }
  // Graphite is a choice, not a fate: the derived colors stop before it.
  return IDENTITY_COLORS[hash % (IDENTITY_COLORS.length - 1)]!.value;
}
