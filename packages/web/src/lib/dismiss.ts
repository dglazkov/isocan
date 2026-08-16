import { useEffect, useRef } from "react";

/**
 * Click away to dismiss — what every popover on this app owes the pointer.
 *
 * The ref belongs on a wrapper holding BOTH the popover and the control that
 * opened it. A press on the trigger must not read as "outside": the trigger's
 * own toggle would then re-open what this just closed, and the popover would
 * look stuck.
 *
 * Capture phase, on pointerdown: the canvas swallows pointer events to start
 * pans and marquees, and dismissal should happen with the gesture, not after
 * it.
 */
export function useDismissOnOutside<T extends HTMLElement>(
  open: boolean,
  onDismiss: () => void,
) {
  const ref = useRef<T>(null);
  const latest = useRef(onDismiss);
  latest.current = onDismiss;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const node = ref.current;
      if (node && !node.contains(event.target as Node)) latest.current();
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  return ref;
}
