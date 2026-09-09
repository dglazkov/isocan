import type { CanvasContents, CoreModule, Item, ModuleKind, SlashCommand } from "@isocan/core";

/**
 * **Emoji stickers**: drop one of 5 emoji onto the canvas.
 *
 * A sticker is an ordinary item whose blob is a UTF-8 file containing the emoji,
 * typed as `text/vnd.isocan.sticker` with extension `.sticker`.
 *
 * The module adds one KIND, `sticker`, and a renderer that draws the emoji centered
 * and crisp on the canvas card and stage. If the module is unloaded, the item gracefully
 * falls through to whatever the built-in mime tests call it — a document containing
 * the emoji text.
 */
export const STICKER_MIME = "text/vnd.isocan.sticker";
export const STICKER_EXTENSION = "sticker";

export const STICKER_KIND: ModuleKind = {
  id: "sticker",
  mimes: [STICKER_MIME],
  extensions: [STICKER_EXTENSION],
  label: "Stickers",
  noun: "sticker",
  icon: "drawing",
};

export const STICKER_SIZE = { width: 120, height: 120 } as const;

export interface StickerDef {
  id: string;
  emoji: string;
  name: string;
  filename: string;
}

export const STICKERS: readonly StickerDef[] = [
  { id: "star", emoji: "⭐", name: "Star", filename: "star.sticker" },
  { id: "heart", emoji: "❤️", name: "Heart", filename: "heart.sticker" },
  { id: "fire", emoji: "🔥", name: "Fire", filename: "fire.sticker" },
  { id: "thumbs-up", emoji: "👍", name: "Thumbs Up", filename: "thumbs-up.sticker" },
  { id: "party", emoji: "🎉", name: "Party", filename: "party.sticker" },
];

/**
 * Resolve a sticker by its emoji character, id, or case-insensitive name.
 */
export function findSticker(input: string): StickerDef | undefined {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();
  const normalized = lower.replace(/[-_\s]/g, "");

  return STICKERS.find((s) => {
    if (s.emoji === trimmed) return true;
    if (s.id === lower) return true;
    if (s.id.replace(/-/g, "") === normalized) return true;
    if (s.name.toLowerCase() === lower) return true;
    return false;
  });
}

function currentMime(item: Item): string {
  return (item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0])?.mimeType ?? "";
}

export function isStickerItem(item: Item): boolean {
  return currentMime(item) === STICKER_MIME;
}

/** The stickers on a canvas, newest first. */
export function stickersOn(canvas: CanvasContents): Item[] {
  return Object.values(canvas.items)
    .filter(isStickerItem)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
}

const stickerCommand: SlashCommand = {
  name: "sticker",
  description: "Drop one of 5 emoji stickers onto the canvas",
  usage: "<emoji|name> [--at <x,y>]",
  source: "module",
  body: `Drop one of 5 emoji stickers onto the canvas.

Available stickers:
- ⭐ Star (\`star\`)
- ❤️ Heart (\`heart\`)
- 🔥 Fire (\`fire\`)
- 👍 Thumbs Up (\`thumbs-up\`)
- 🎉 Party (\`party\`)

Use \`isocan sticker drop <emoji>\` to place one.`,
};

export const stickersModule: CoreModule = {
  name: "@isocan/stickers",
  kinds: [STICKER_KIND],
  commands: [stickerCommand],
};

export default stickersModule;

