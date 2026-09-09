import type { CoreModule, ModuleKind } from "@isocan/core";

/**
 * **Emoji stickers** — five things you can drag onto a canvas.
 *
 * The kind, the mimes and the sticker table are @romannurik's, from the
 * exploration in #219 that found the module API's gaps by hitting them. They
 * are kept close to as written: the part that needed changing was the WEB
 * half, and keeping this recognisable is what makes the two comparable.
 *
 * A sticker is an ordinary item whose blob is a UTF-8 file holding the emoji,
 * typed `text/vnd.isocan.sticker`. Unload the module and every sticker on the
 * canvas is still there — a small text file with a legible mime — which is
 * #156's removal story and the reason an experiment is safe to switch off.
 *
 * **It is deliberately not a useful feature.** It exists to be the smallest
 * real module that needs a tray (an overlay), a drag (a drop) and a way to
 * write from inside a component (the host) — the three things nothing had
 * asked for until somebody built one.
 */
export const STICKER_MIME = "text/vnd.isocan.sticker";
export const STICKER_EXTENSION = "sticker";

/** Square, and small: a sticker is a mark on the canvas rather than a card
 *  with something in it. */
export const STICKER_SIZE = { width: 120, height: 120 } as const;

export const STICKER_KIND: ModuleKind = {
  id: "sticker",
  mimes: [STICKER_MIME],
  extensions: [STICKER_EXTENSION],
  label: "Stickers",
  noun: "sticker",
  icon: "drawing",
};

export interface StickerDef {
  id: string;
  emoji: string;
  name: string;
}

export const STICKERS: readonly StickerDef[] = [
  { id: "star", emoji: "⭐", name: "Star" },
  { id: "heart", emoji: "❤️", name: "Heart" },
  { id: "fire", emoji: "🔥", name: "Fire" },
  { id: "thumbs-up", emoji: "👍", name: "Thumbs up" },
  { id: "party", emoji: "🎉", name: "Party" },
];

/** The file a sticker's blob is: the emoji and nothing else, so the item is
 *  readable as text by anything that does not know this module. */
export function stickerFile(sticker: StickerDef): { body: string; filename: string } {
  return { body: sticker.emoji, filename: `${sticker.id}.${STICKER_EXTENSION}` };
}

/**
 * A sticker by emoji, id, or name — the three things somebody might type.
 *
 * @romannurik's, and it earns its keep on the CLI side where a person types
 * `isocan sticker drop fire` or pastes the emoji itself.
 */
export function findSticker(input: string): StickerDef | undefined {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();
  const flat = lower.replace(/[-_\s]/g, "");
  return STICKERS.find(
    (s) =>
      s.emoji === trimmed ||
      s.id === lower ||
      s.id.replace(/-/g, "") === flat ||
      s.name.toLowerCase() === lower,
  );
}

/** The emoji a sticker item holds, from its bytes. Anything unrecognised
 *  draws as itself: a sticker file somebody hand-edited is still a file. */
export function stickerEmoji(body: string): string {
  return body.trim().slice(0, 8);
}

export const stickersCore: CoreModule = {
  name: "@isocan/stickers",
  kinds: [STICKER_KIND],
};

/** The runtime loader reads `mod.default`; a named export alone builds and
 *  loads nothing. */
export default stickersCore;
