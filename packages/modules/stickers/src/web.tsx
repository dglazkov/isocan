import { useEffect, useState } from "react";
import { newItemId, type DropFacts, type InspectorFacts, type Operation, type OverlayFacts, type RendererFacts, type WebModule } from "@isocan/core";
import {
  STICKERS,
  STICKER_MIME,
  STICKER_SIZE,
  findSticker,
  stickerEmoji,
  stickerFile,
  stickersCore,
  type StickerDef,
} from "./core.ts";

/**
 * **The web half, written against the slots #219 asked for.**
 *
 * Worth reading beside that exploration, because the difference IS the answer
 * to "does the new API make this better". The version that found the gaps had
 * to be handed `dropFile` on the overlay's facts and `addVersion` on the
 * inspector's — two host-provided functions, each optional, each doing mint +
 * place + send in one call. Every write below is instead an ordinary
 * operation this module composes and `host.send` delivers, exactly as a
 * palette action's has always been.
 *
 * What that buys, concretely and not in principle:
 *
 * - The tray sets its own **title** on the item it makes. `dropFile` had no
 *   room for one, so a dropped sticker was called `star.sticker`.
 * - Dropping is **one undo**, because the ops share a group.
 * - The inspector **changes a sticker in place** with `item.addVersion` — the
 *   op that already existed and that no module could reach.
 * - Nothing is optional, so there is no `if (!dropFile) return null` branch
 *   that cannot be tested and would be a silently dead tray if it ever ran.
 */

/** The drag type the tray writes and the canvas claims. Its own mime rather
 *  than `text/plain`, so dragging a sticker into a text field still pastes an
 *  emoji and dragging one onto the canvas makes a sticker. */
const DRAG_MIME = "application/vnd.isocan.sticker-id";

/** One item, made from one sticker, at a point. The whole write, as data. */
function placeSticker(blobHash: string, size: number, sticker: StickerDef, at: { x: number; y: number }, containerId?: string | null): Operation {
  return {
    type: "item.add",
    itemId: newItemId(),
    version: { id: newItemId(), blobHash, mimeType: STICKER_MIME, filename: stickerFile(sticker).filename, size },
    width: STICKER_SIZE.width,
    height: STICKER_SIZE.height,
    placement: { x: Math.round(at.x - STICKER_SIZE.width / 2), y: Math.round(at.y - STICKER_SIZE.height / 2) },
    ...(containerId !== undefined ? { containerId, groupPlacement: "auto" as const } : {}),
    // The thing `dropFile` had nowhere to put: a name a person reads in the
    // files panel, in search, and in a comment that mentions it.
    title: sticker.name,
  } as Operation;
}

/** Draws the emoji, big and centred. A sticker has no chrome — it IS its
 *  mark, the way a drawing is. */
function StickerView({ readText }: RendererFacts) {
  const [emoji, setEmoji] = useState("");
  useEffect(() => {
    let live = true;
    void readText().then((text) => {
      if (live) setEmoji(stickerEmoji(text));
    });
    return () => {
      live = false;
    };
  }, [readText]);
  return (
    <div className="sticker-view" style={{ display: "grid", placeItems: "center", width: "100%", height: "100%", fontSize: "min(56cqw, 56cqh)", containerType: "size", userSelect: "none" }}>
      <span aria-label={emoji ? `Sticker ${emoji}` : "Sticker"}>{emoji}</span>
    </div>
  );
}

/**
 * The tray: five stickers you drag onto the canvas.
 *
 * It writes nothing itself — a drag is not a write until it lands — so this
 * component only sets the drag data, and the canvas's drop handler does the
 * rest through `drops` below. That split is deliberate: a tray that wrote on
 * `dragstart` would make a sticker you then had to drag somewhere, which is
 * the wrong shape and the wrong undo.
 */
function StickerTray(_: OverlayFacts) {
  return (
    <div className="sticker-tray" role="group" aria-label="Stickers" style={{ display: "flex", flexDirection: "column", gap: 4, padding: 6 }}>
      {STICKERS.map((s) => (
        <button
          key={s.id}
          type="button"
          draggable
          title={`${s.name} — drag onto the canvas`}
          aria-label={`${s.name} sticker`}
          onDragStart={(e) => {
            e.dataTransfer.setData(DRAG_MIME, s.id);
            // A plain-text fallback, so dragging one into a composer types the
            // emoji instead of doing nothing.
            e.dataTransfer.setData("text/plain", s.emoji);
            e.dataTransfer.effectAllowed = "copy";
          }}
          style={{ fontSize: 22, lineHeight: 1, background: "none", border: "none", cursor: "grab", padding: 4 }}
        >
          {s.emoji}
        </button>
      ))}
    </div>
  );
}

/**
 * Change a sticker without replacing the item.
 *
 * `item.addVersion` has existed all along and no module could reach it: an
 * inspector had no way to return an op and no way to mint the bytes one would
 * name. Both halves are `host`, and this is the smallest thing that proves it
 * — the sticker changes, the item keeps its id, its place and its history.
 */
function StickerInspector({ item, host }: InspectorFacts) {
  return (
    <div className="sticker-inspector" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {STICKERS.map((s) => (
        <button
          key={s.id}
          type="button"
          className="btn"
          title={s.name}
          onClick={() => {
            void (async () => {
              const file = stickerFile(s);
              const blob = new Blob([file.body], { type: STICKER_MIME });
              const put = await host.putBlob(blob, file.filename);
              await host.send([
                {
                  type: "item.addVersion",
                  itemId: item.id,
                  version: { id: newItemId(), blobHash: put.blobHash, mimeType: STICKER_MIME, filename: file.filename, size: put.size },
                } as Operation,
              ]);
            })();
          }}
          style={{ fontSize: 20 }}
        >
          {s.emoji}
        </button>
      ))}
    </div>
  );
}

export const stickersWeb: WebModule<never, typeof StickerView, typeof StickerInspector, never, typeof StickerTray> = {
  core: stickersCore,
  renderers: [{ mimes: [STICKER_MIME], component: StickerView }],
  inspectors: [{ kinds: ["sticker"], label: "Sticker", component: StickerInspector }],
  overlays: [{ region: "left", label: "Stickers", component: StickerTray }],
  drops: [
    {
      mimes: [DRAG_MIME],
      /**
       * Mint the bytes, then say what to do with them. Two steps rather than
       * one `dropFile`, and the second step is where the title, the size and
       * the placement live — none of which a host helper could have known.
       */
      run: async ({ data, at, host, containerId }: DropFacts) => {
        const sticker = findSticker(data);
        if (!sticker) return; // a claim on a mime is not a promise about its payload
        const file = stickerFile(sticker);
        const blob = new Blob([file.body], { type: STICKER_MIME });
        const put = await host.putBlob(blob, file.filename);
        return [placeSticker(put.blobHash, put.size, sticker, at, containerId)];
      },
    },
  ],
};

export default stickersWeb;
