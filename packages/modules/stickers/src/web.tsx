import { useEffect, useState, type ComponentType } from "react";
import type { InspectorFacts, OverlayFacts, RendererFacts, WebModule } from "@isocan/core";
import { STICKER_KIND, STICKER_MIME, STICKERS, type StickerDef, stickersModule } from "./core.ts";

const STYLES = `
.sticker-view {
  width: 100%; height: 100%; display: grid; place-items: center;
  overflow: hidden; background: var(--card); border-radius: var(--radius);
  user-select: none;
}
.sticker-emoji {
  line-height: 1; display: flex; align-items: center; justify-content: center;
}
.sticker-tray {
  position: absolute; left: 50%; bottom: calc(var(--edge) + 48px); transform: translateX(-50%);
  z-index: var(--z-float);
  display: flex; align-items: center; gap: 8px; padding: 4px 8px 4px 12px;
  background: var(--panel); backdrop-filter: blur(6px);
  border: 1px solid var(--line); border-radius: 999px; box-shadow: var(--shadow-pop);
}
.sticker-tray-label {
  font-size: 11px; font-weight: 500; color: var(--ink-muted); text-transform: uppercase; letter-spacing: 0.04em;
}
.sticker-tray-list {
  display: flex; align-items: center; gap: 4px;
}
.sticker-btn {
  display: flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: 50%;
  background: none; border: 1px solid transparent; cursor: grab;
  font-size: 18px; line-height: 1; transition: transform 0.1s ease;
}
.sticker-btn:hover {
  background: var(--chip); transform: scale(1.15);
}
.sticker-btn:active {
  cursor: grabbing; transform: scale(0.95);
}
.sticker-inspector-grid {
  display: flex; align-items: center; justify-content: space-between; gap: 6px;
  padding: 2px 0;
}
.sticker-inspector-btn {
  display: flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border-radius: var(--radius);
  background: var(--card); border: 1px solid var(--line); cursor: pointer;
  font-size: 18px; line-height: 1; transition: transform 0.1s ease;
}
.sticker-inspector-btn:hover {
  background: var(--chip); transform: scale(1.1);
}
.sticker-inspector-btn.active {
  background: var(--accent); border-color: var(--accent); color: var(--accent-ink);
}
`;

/**
 * **The sticker renderer**: draws the emoji large, crisp, and centered on the card.
 */
function StickerView({ filename, readText, blobHash }: RendererFacts) {
  const [emoji, setEmoji] = useState<string>("");

  useEffect(() => {
    let live = true;
    readText()
      .then((text) => {
        if (live) setEmoji(text.trim());
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [blobHash, readText]);

  return (
    <div className="sticker-view" title={filename}>
      <style>{STYLES}</style>
      <span className="sticker-emoji" role="img" aria-label="sticker" style={{ fontSize: 64 }}>
        {emoji}
      </span>
    </div>
  );
}

/**
 * **The floating sticker tray**: screen-space dock offering the 5 emoji.
 *
 * You can drag an emoji directly onto the canvas to place it at the pointer,
 * or click one to drop it in the center of the current view.
 */
function StickerTray({ dropFile }: OverlayFacts) {
  async function onDropClick(s: StickerDef) {
    if (!dropFile) return;
    const file = new File([`${s.emoji}\n`], s.filename, { type: STICKER_MIME });
    await dropFile(file);
  }

  return (
    <aside className="sticker-tray" role="toolbar" aria-label="Stickers">
      <style>{STYLES}</style>
      <span className="sticker-tray-label" aria-hidden>
        Stickers
      </span>
      <div className="sticker-tray-list">
        {STICKERS.map((s) => (
          <button
            key={s.id}
            className="sticker-btn"
            type="button"
            draggable
            title={`Drag onto canvas or click to drop: ${s.name}`}
            aria-label={`Drop ${s.name} sticker`}
            onDragStart={(e) => {
              e.dataTransfer.setData("application/x-isocan-sticker", s.emoji);
              e.dataTransfer.setData("text/plain", s.emoji);
              e.dataTransfer.effectAllowed = "copy";
            }}
            onClick={() => void onDropClick(s)}
          >
            <span className="sticker-tray-emoji">{s.emoji}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}

/**
 * **The sticker inspector**: options for changing the selected sticker's emoji.
 */
export function StickerInspector({ item, readText, addVersion }: InspectorFacts) {
  const [current, setCurrent] = useState<string>("");

  useEffect(() => {
    let live = true;
    readText()
      .then((text) => {
        if (live) setCurrent(text.trim());
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [item.currentVersionId, readText]);

  async function onChangeSticker(s: StickerDef) {
    if (!addVersion || current === s.emoji) return;
    setCurrent(s.emoji);
    const file = new File([`${s.emoji}\n`], s.filename, { type: STICKER_MIME });
    await addVersion(file);
  }

  return (
    <div className="sticker-inspector">
      <style>{STYLES}</style>
      <div className="sticker-inspector-grid" role="group" aria-label="Change sticker emoji">
        {STICKERS.map((s) => {
          const isActive = current === s.emoji;
          return (
            <button
              key={s.id}
              type="button"
              className={`sticker-inspector-btn${isActive ? " active" : ""}`}
              title={`Change to ${s.name} (${s.emoji})`}
              aria-label={`Change to ${s.name}`}
              aria-pressed={isActive}
              onClick={() => void onChangeSticker(s)}
            >
              <span>{s.emoji}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const stickersWeb: WebModule<
  never,
  ComponentType<RendererFacts>,
  ComponentType<InspectorFacts>,
  never,
  ComponentType<OverlayFacts>
> = {
  core: stickersModule,
  renderers: [{ mimes: [STICKER_MIME], component: StickerView }],
  inspectors: [
    {
      kinds: [STICKER_KIND.id],
      label: "Sticker",
      component: StickerInspector,
    },
  ],
  overlays: [StickerTray],
};

export default stickersWeb;
