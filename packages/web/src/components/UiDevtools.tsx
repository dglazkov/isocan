import "./ui-devtools.css";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Actor } from "@isocan/core";
import {
  UI_KNOBS,
  UI_PIECES,
  UI_TWEAKS_PROP,
  cleanUiTweaks,
  compileUiTweaksCss,
  findUiKnob,
  findUiPiece,
  isDefaultUiTweak,
  knobsForPiece,
  normalizeUiTweakValue,
  parseUiTweaks,
  serializeUiTweaks,
  type UiKnob,
  type UiPiece,
  type UiPieceId,
  type UiTweaks,
} from "@isocan/core/ui-tweaks";
import { flashNotice, sendEchoed, useCanvasStore } from "../stores/canvasStore.ts";
import { canEditNow } from "../lib/capability.ts";
import { browserClipboard, copyToClipboard } from "../lib/copy.ts";
import { FloatingHandles, useFloatingBox } from "../lib/floatingbox.tsx";
import {
  UI_TWEAKS_STORAGE_KEY,
  closeUiDevtools,
  notifyLocalUiTweaks,
  openUiDevtools,
  startUiPiecePicker,
  stopUiPiecePicker,
  useUiTweaksSignal,
} from "../lib/uitweaks.ts";

interface HoveredPiece {
  piece: UiPiece;
  rect: DOMRect;
  zIndex: string;
  opacity: string;
}

/** Screen-space bounding box for glowing a UI piece when its pill is clicked. */
export interface GlowBox {
  left: number;
  top: number;
  width: number;
  height: number;
  borderRadius: string;
}

/**
 * CSS `left` offset for a range slider's default-value marker.
 *
 * Native `<input type="range">` thumbs are ~16px wide, so the thumb's centre
 * travels from `8px` (at `min`) to `calc(100% - 8px)` (at `max`), not `0%` to
 * `100%`. Mapping the ratio across `(100% - 16px)` keeps the tick centred
 * under the thumb at every position along the track.
 */
export function defaultRangeOffset(knob: UiKnob): string {
  const min = knob.min ?? 0;
  const max = knob.max ?? 1;
  const def = Number(knob.defaultValue);
  const ratio = max > min ? Math.max(0, Math.min(1, (def - min) / (max - min))) : 0;
  const rounded = Math.round(ratio * 10000) / 10000;
  return `calc(8px + ${rounded} * (100% - 16px))`;
}

function glowSelectorForPiece(piece: UiPiece): string {
  if (piece.id === "toolbar") return ".bar-cluster";
  if (piece.id === "minimap") return ".minimap-panel, .minimap-handle";
  return piece.selector;
}

/**
 * Measure visible screen-space bounding boxes for every live DOM element
 * belonging to `piece`, excluding UI Devtools itself.
 */
export function collectPieceGlowBoxes(piece: UiPiece): GlowBox[] {
  if (typeof document === "undefined" || typeof window === "undefined") return [];
  const selector = `[data-tweak-piece="${piece.id}"], ${glowSelectorForPiece(piece)}`;
  let elements: Element[];
  try {
    elements = Array.from(document.querySelectorAll(selector));
  } catch {
    return [];
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const boxes: GlowBox[] = [];

  for (const el of elements) {
    if (el.closest(".ui-devtools, .ui-devtools-inspector, .ui-devtools-glow")) continue;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || parseFloat(style.opacity) === 0) {
      continue;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    if (rect.right <= 0 || rect.bottom <= 0 || rect.left >= vw || rect.top >= vh) continue;

    // Full-bleed surfaces (`:root`, `.canvas-viewport`) inset slightly so the
    // glow frame isn't clipped against the browser window's outer edge.
    const fullBleed = rect.width >= vw - 4 && rect.height >= vh - 4;
    const left = fullBleed ? 6 : rect.left;
    const top = fullBleed ? 6 : rect.top;
    const width = fullBleed ? Math.max(0, vw - 12) : rect.width;
    const height = fullBleed ? Math.max(0, vh - 12) : rect.height;
    const borderRadius = fullBleed ? "12px" : style.borderRadius || "8px";

    boxes.push({ left, top, width, height, borderRadius });
    if (boxes.length >= 24) break;
  }
  return boxes;
}

function readStoredLocalOverrides(): UiTweaks {
  try {
    const raw = localStorage.getItem(UI_TWEAKS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: UiTweaks = {};
    for (const [key, val] of Object.entries(parsed)) {
      const knob = findUiKnob(key);
      if (!knob || (typeof val !== "number" && typeof val !== "string")) continue;
      const norm = normalizeUiTweakValue(knob, val);
      if (norm !== null) out[key] = norm;
    }
    return out;
  } catch {
    return {};
  }
}

function writeStoredLocalOverrides(overrides: UiTweaks): void {
  const keys = Object.keys(overrides);
  try {
    if (keys.length > 0) {
      localStorage.setItem(UI_TWEAKS_STORAGE_KEY, JSON.stringify(overrides));
    } else {
      localStorage.removeItem(UI_TWEAKS_STORAGE_KEY);
    }
  } catch {
    // localStorage may be unavailable in private browsing; memory state still holds.
  }
  notifyLocalUiTweaks(keys.length > 0);
}

function matchPieceForElement(target: Element | null): { piece: UiPiece; element: Element } | null {
  if (!target) return null;
  if (target.closest(".ui-devtools, .ui-devtools-inspector")) return null;

  const tagged = target.closest("[data-tweak-piece]");
  if (tagged) {
    const id = tagged.getAttribute("data-tweak-piece") ?? "";
    const piece = findUiPiece(id);
    if (piece) return { piece, element: tagged };
  }

  // Match specific pieces before generic `.floats` / `:root`.
  const order: UiPieceId[] = ["toolbar", "rail", "zoom", "minimap", "dock", "items", "glass", "layers"];
  for (const id of order) {
    const piece = findUiPiece(id);
    if (!piece) continue;
    const found = target.closest(piece.selector);
    if (found) return { piece, element: found };
  }
  return null;
}

export default function UiDevtools({ canvasId, actor }: { canvasId: string; actor: Actor }) {
  const signal = useUiTweaksSignal();
  const canvasRaw = useCanvasStore((s) => s.record?.properties?.[UI_TWEAKS_PROP] ?? null);
  const canvasTweaks = useMemo(() => parseUiTweaks(canvasRaw), [canvasRaw]);
  const [localTweaks, setLocalTweaks] = useState<UiTweaks>(readStoredLocalOverrides);
  const merged = useMemo(() => cleanUiTweaks({ ...canvasTweaks, ...localTweaks }), [canvasTweaks, localTweaks]);

  const activePiece: UiPieceId = (findUiPiece(signal.piece)?.id ?? "glass") as UiPieceId;
  const pieceInfo = findUiPiece(activePiece) ?? UI_PIECES[0]!;
  const knobs = useMemo(() => knobsForPiece(activePiece), [activePiece]);

  const [pos] = useState<{ x: number; y: number }>(() => ({
    x: typeof window !== "undefined" ? Math.max(20, window.innerWidth - 376) : 20,
    y: 68,
  }));
  const float = useFloatingBox<HTMLElement>({ minWidth: 280, minHeight: 220 });
  const [hovered, setHovered] = useState<HoveredPiece | null>(null);
  const [glow, setGlow] = useState<{ seq: number; pieceId: UiPieceId; boxes: GlowBox[] } | null>(null);
  const glowTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (glowTimerRef.current !== null) {
        window.clearTimeout(glowTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!signal.open && glow !== null) {
      setGlow(null);
    }
  }, [signal.open, glow]);

  function triggerPieceGlow(piece: UiPiece): void {
    if (glowTimerRef.current !== null) {
      window.clearTimeout(glowTimerRef.current);
      glowTimerRef.current = null;
    }
    const boxes = collectPieceGlowBoxes(piece);
    if (boxes.length === 0) {
      setGlow(null);
      return;
    }
    setGlow((prev) => ({ seq: (prev?.seq ?? 0) + 1, pieceId: piece.id, boxes }));
    glowTimerRef.current = window.setTimeout(() => {
      setGlow(null);
      glowTimerRef.current = null;
    }, 1100);
  }

  // Sync runtime `<style data-ui-tweaks>` into `<head>` whenever tweaks change.
  useLayoutEffect(() => {
    const css = compileUiTweaksCss(merged);
    let styleEl = document.head.querySelector<HTMLStyleElement>("style[data-ui-tweaks]");
    if (!css) {
      styleEl?.remove();
      return;
    }
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.setAttribute("data-ui-tweaks", "");
      document.head.appendChild(styleEl);
    }
    if (styleEl.textContent !== css) {
      styleEl.textContent = css;
    }
  }, [merged]);

  // Listen for cross-tab localStorage updates or external resets.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === UI_TWEAKS_STORAGE_KEY) {
        setLocalTweaks(readStoredLocalOverrides());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Element picker mode ("Pick"): hover any UI piece to inspect and click to edit.
  useEffect(() => {
    if (!signal.picking) {
      setHovered(null);
      return;
    }

    const onPointerMove = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const hit = matchPieceForElement(el);
      if (!hit) {
        setHovered(null);
        return;
      }
      const computed = window.getComputedStyle(hit.element);
      setHovered({
        piece: hit.piece,
        rect: hit.element.getBoundingClientRect(),
        zIndex: computed.zIndex || "auto",
        opacity: computed.opacity || "1",
      });
    };

    const onPointerDown = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (el?.closest(".ui-devtools")) return;
      e.preventDefault();
      e.stopPropagation();
      const hit = matchPieceForElement(el);
      stopUiPiecePicker(hit?.piece.id);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        stopUiPiecePicker();
      }
    };

    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [signal.picking]);

  function updateLocal(next: UiTweaks): void {
    setLocalTweaks(next);
    writeStoredLocalOverrides(next);
  }

  function setKnobOverride(knob: UiKnob, raw: string | number | null, base: UiTweaks): UiTweaks {
    const norm = normalizeUiTweakValue(knob, raw);
    if (norm === null) return base;
    const next = { ...base };
    if (isDefaultUiTweak(knob, norm)) {
      if (canvasTweaks[knob.key] !== undefined) {
        next[knob.key] = knob.defaultValue;
      } else {
        delete next[knob.key];
      }
    } else if (canvasTweaks[knob.key] === norm) {
      delete next[knob.key];
    } else {
      next[knob.key] = norm;
    }
    return next;
  }

  function onKnobChange(knob: UiKnob, raw: string | number | null): void {
    updateLocal(setKnobOverride(knob, raw, localTweaks));
  }

  function onResetPiece(): void {
    let next = { ...localTweaks };
    for (const knob of knobs) {
      next = setKnobOverride(knob, "reset", next);
    }
    updateLocal(next);
  }

  function onResetAll(): void {
    let next: UiTweaks = {};
    for (const knob of UI_KNOBS) {
      if (canvasTweaks[knob.key] !== undefined) {
        next[knob.key] = knob.defaultValue;
      }
    }
    updateLocal(next);
    flashNotice("Reset UI customizations to defaults");
  }

  async function onSaveToCanvas(): Promise<void> {
    if (!canEditNow()) {
      flashNotice("Read-only on this canvas — customizations stay in this browser.");
      return;
    }
    const serialized = serializeUiTweaks(merged);
    await sendEchoed(canvasId, actor, {
      type: "project.update",
      patch: serialized ? { properties: { [UI_TWEAKS_PROP]: serialized } } : { removeProperties: [UI_TWEAKS_PROP] },
    });
    updateLocal({});
    flashNotice(serialized ? "Saved UI customizations to canvas" : "Cleared UI customizations from canvas");
  }

  const totalChanged = Object.keys(merged).length;
  const pieceHasChanges = (id: UiPieceId) => UI_KNOBS.some((k) => k.piece === id && merged[k.key] !== undefined);
  const canEdit = canEditNow();

  if (!signal.open) return null;

  return (
    <>
      {glow &&
        glow.boxes.map((box, idx) => (
          <div
            key={`${glow.seq}-${idx}`}
            className="ui-devtools-glow"
            data-glow-piece={glow.pieceId}
            style={{
              left: box.left,
              top: box.top,
              width: box.width,
              height: box.height,
              borderRadius: box.borderRadius,
            }}
            aria-hidden
          />
        ))}
      {signal.picking && hovered && (
        <div
          className="ui-devtools-inspector"
          style={{
            left: hovered.rect.left,
            top: hovered.rect.top,
            width: hovered.rect.width,
            height: hovered.rect.height,
          }}
        >
          <span className="ui-devtools-inspector-tag">
            {hovered.piece.name} · {Math.round(hovered.rect.width)}×{Math.round(hovered.rect.height)}px · z {hovered.zIndex} · α {hovered.opacity}
          </span>
        </div>
      )}
      <aside
        ref={float.ref}
        className="ui-devtools"
        style={{ left: pos.x, top: pos.y, ...float.style }}
        aria-label="UI Devtools"
        onPointerDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
      >
        <FloatingHandles box={float} />
        <div
          className="ui-devtools-head"
          onPointerDown={float.onDragPointerDown}
          onDoubleClick={float.reset}
        >
          <span className="ui-devtools-title">UI Devtools</span>
          {totalChanged > 0 && (
            <span className="ui-devtools-count" title={`${totalChanged} active customization${totalChanged === 1 ? "" : "s"}`}>
              {totalChanged}
            </span>
          )}
          <button
            type="button"
            className={`ui-devtools-pick${signal.picking ? " active" : ""}`}
            title="Hover and click any UI piece on screen to inspect and tweak it"
            aria-pressed={signal.picking}
            onClick={() => (signal.picking ? stopUiPiecePicker() : startUiPiecePicker())}
          >
            {signal.picking ? "Picking…" : "⌖ Pick"}
          </button>
          <button
            type="button"
            className="main-close"
            title="Close UI Devtools (⌥D)"
            aria-label="Close UI Devtools"
            onClick={closeUiDevtools}
          >
            ✕
          </button>
        </div>

        <div className="ui-devtools-tabs" role="tablist" aria-label="UI pieces">
          {UI_PIECES.map((piece) => {
            const active = piece.id === activePiece;
            const changed = pieceHasChanges(piece.id);
            return (
              <button
                key={piece.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`ui-devtools-tab${active ? " active" : ""}`}
                onClick={() => {
                  openUiDevtools(piece.id);
                  triggerPieceGlow(piece);
                }}
              >
                {piece.name}
                {changed && <span className="ui-devtools-tab-dot" aria-hidden />}
              </button>
            );
          })}
        </div>

        <div className="ui-devtools-summary">{pieceInfo.summary}</div>

        <div className="ui-devtools-body" role="tabpanel" aria-label={pieceInfo.name}>
          {knobs.map((knob) => {
            const current = merged[knob.key] ?? knob.defaultValue;
            const changed = !isDefaultUiTweak(knob, merged[knob.key]);
            return (
              <div key={knob.key} className="ui-devtools-row" title={knob.hint}>
                <div className="ui-devtools-label-row">
                  <span className={`ui-devtools-label${changed ? " changed" : ""}`}>{knob.label}</span>
                  <button
                    type="button"
                    className="ui-devtools-reset-one"
                    disabled={!changed}
                    title={`Reset ${knob.label} to ${knob.defaultValue || "default"}`}
                    aria-label={`Reset ${knob.label}`}
                    onClick={() => onKnobChange(knob, "reset")}
                  >
                    ↺
                  </button>
                </div>
                {knob.kind === "number" ? (
                  <div className="ui-devtools-controls">
                    <div className="ui-devtools-range-wrap">
                      <span
                        className={`ui-devtools-range-default${changed ? " changed" : ""}`}
                        style={{ left: defaultRangeOffset(knob) }}
                        title={`Default: ${knob.defaultValue}${knob.unit ?? ""}`}
                        aria-hidden
                      />
                      <input
                        type="range"
                        className="ui-devtools-range"
                        min={knob.min}
                        max={knob.max}
                        step={knob.step}
                        value={typeof current === "number" ? current : Number(knob.defaultValue)}
                        aria-label={knob.label}
                        onChange={(e) => onKnobChange(knob, Number(e.target.value))}
                        onDoubleClick={() => onKnobChange(knob, "reset")}
                      />
                    </div>
                    <input
                      type="number"
                      className="ui-devtools-num"
                      min={knob.min}
                      max={knob.max}
                      step={knob.step}
                      value={typeof current === "number" ? current : Number(knob.defaultValue)}
                      aria-label={`${knob.label} value`}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") return;
                        onKnobChange(knob, Number(raw));
                      }}
                    />
                    <span className="ui-devtools-unit">{knob.unit ?? ""}</span>
                  </div>
                ) : (
                  <div className="ui-devtools-controls">
                    <input
                      type="color"
                      className="ui-devtools-color-swatch"
                      value={
                        typeof current === "string" && current.startsWith("#") && current.length === 7
                          ? current
                          : knob.placeholder ?? "#1f3fd0"
                      }
                      aria-label={`${knob.label} color picker`}
                      onChange={(e) => onKnobChange(knob, e.target.value)}
                    />
                    <input
                      type="text"
                      className="ui-devtools-color-hex"
                      value={typeof current === "string" ? current : ""}
                      placeholder={knob.placeholder ?? "#hex"}
                      aria-label={`${knob.label} hex value`}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        if (val === "") {
                          onKnobChange(knob, "reset");
                        } else if (/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(val)) {
                          onKnobChange(knob, val);
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="ui-devtools-foot">
          <button
            type="button"
            className="btn"
            disabled={!pieceHasChanges(activePiece)}
            onClick={onResetPiece}
          >
            Reset piece
          </button>
          <button
            type="button"
            className="btn"
            disabled={totalChanged === 0}
            onClick={onResetAll}
          >
            Reset all
          </button>
          <button
            type="button"
            className="btn"
            disabled={totalChanged === 0}
            onClick={() => {
              const css = compileUiTweaksCss(merged);
              void copyToClipboard(css, browserClipboard()).then((res) =>
                flashNotice(res === "copied" ? "Copied custom CSS" : "Clipboard unavailable — run `isocan tweak css`"),
              );
            }}
          >
            Copy CSS
          </button>
          {canEdit && (
            <button
              type="button"
              className="btn primary"
              onClick={() => void onSaveToCanvas()}
              title="Save these UI customizations onto the canvas so every collaborator and session sees them"
            >
              Save to canvas
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
