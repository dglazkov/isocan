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
      if (!node) return;
      const target = event.target as Node;
      if (node.contains(target)) return;
      /**
       * **A portalled surface belongs to whoever opened it.**
       *
       * `contains` asks about the TREE, and a popover the menu opened may not
       * be in it: the emoji picker portals to `document.body` deliberately, to
       * escape the overflow and transform of whatever it hangs off. So an
       * emoji click read as "outside", the identity menu closed, and the
       * picker unmounted before its own `onPick` could run — the click
       * dismissed the menu and chose nothing, every time.
       *
       * Anything marked `data-owned-popover` is treated as inside. It is an
       * attribute rather than a class list so the rule is about INTENT — this
       * surface belongs to something — and not about which component happens
       * to be portalling this month.
       */
      if ((target as Element)?.closest?.("[data-owned-popover]")) return;
      latest.current();
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  return ref;
}
