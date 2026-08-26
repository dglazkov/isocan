import { useUiStore, PANEL_MIN_WIDTH, maxPanelWidth } from "../stores/uiStore.ts";

/**
 * The docked panel's right edge, as a handle.
 *
 * **A grab strip, not a border.** The border is one pixel and a pointer cannot
 * be asked to find it; this is a transparent strip straddling the edge, wide
 * enough to hit and narrow enough that nothing behind it becomes unclickable.
 * It shows itself on hover — the cursor is the affordance, and a permanent
 * bar down the side of a panel would be furniture.
 *
 * **Pointer capture rather than window listeners.** A drag that leaves the
 * window, crosses an iframe, or ends on another element still belongs to the
 * element that started it. The canvas is full of iframes, and without capture
 * a drag that passes over one loses its own pointermove events to a document
 * we do not control.
 *
 * **Double-click resets to the floor**, which is the width this panel had for
 * its whole life before it could be dragged. Somebody who widens it to read
 * one long message wants a way back that is not "guess where 320 was".
 */
export interface ResizerProps {
  /** The width being dragged. */
  value: number;
  /** Where a drag or an arrow lands — the OWNER clamps; this only reports. */
  onChange: (width: number) => void;
  /** Double-click and Home land here — the width the pane had before it
   * could be dragged. */
  resetTo: number;
  min: number;
  max: number;
  label: string;
}

/**
 * Generalized the day the workbench grew its own draggable edge: the props
 * default to the docked panel's store wiring, so the two call sites that
 * predate them (`MainThreadPanel`, `FilesPanel`) did not change.
 */
export function PanelResizer(props: Partial<ResizerProps> = {}) {
  const storeWidth = useUiStore((s) => s.panelWidth);
  const value = props.value ?? storeWidth;
  const onChange = props.onChange ?? ((w: number) => useUiStore.getState().setPanelWidth(w));
  const resetTo = props.resetTo ?? PANEL_MIN_WIDTH;
  const min = props.min ?? PANEL_MIN_WIDTH;
  const max =
    props.max ?? maxPanelWidth(typeof window === "undefined" ? 1280 : window.innerWidth);
  const label = props.label ?? "Resize the panel";

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startWidth = value;
    useUiStore.getState().setPanelResizing(true);

    function onMove(ev: PointerEvent) {
      onChange(startWidth + (ev.clientX - startX));
    }
    function onUp(ev: PointerEvent) {
      useUiStore.getState().setPanelResizing(false);
      handle.releasePointerCapture(ev.pointerId);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
    }
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    // A cancelled pointer (the OS taking over, a touch becoming a scroll) has
    // to release the same way an ordinary one does, or the next click drags.
    handle.addEventListener("pointercancel", onUp);
  }

  return (
    <div
      className="panel-resizer"
      onPointerDown={onPointerDown}
      onDoubleClick={() => onChange(resetTo)}
      // A separator is a real ARIA role with real keys, and wiring them is
      // cheaper than the alternative: a panel only a mouse can resize.
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 64 : 16;
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          onChange(value - step);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          onChange(value + step);
        } else if (e.key === "Home") {
          e.preventDefault();
          onChange(resetTo);
        }
      }}
    />
  );
}
