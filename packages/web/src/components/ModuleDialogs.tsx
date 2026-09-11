import { useEffect, useMemo, useRef } from "react";
import type { Actor } from "@isocan/core";
import { moduleDialog } from "../modules.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { webHostFor } from "../lib/modulehost.ts";
import { useRcParked } from "../lib/answerable.ts";
import { canEditNow } from "../lib/capability.ts";
import { Modal } from "./Modal.tsx";

/**
 * **A module's popup** (proposed: `dialogs`, 11 Sep 2026 —
 * `docs/projects/design-competition/module-gaps.md` §3).
 *
 * The eighth slot, and the first one a person OPENS rather than finds on the
 * screen. Overlays are edges and pages are cover routes; neither is a thing
 * that comes up over where you are because you asked — a picker. So the shell
 * owns the box and the module fills the inside:
 *
 * - **One at a time**, by construction: the store holds one `{ id, args }`.
 * - **The app's own `Modal`**, so Escape, the backdrop and the ✕ close it the
 *   way they close Help — "this closes" is a property of being a modal, not a
 *   thing a module gets an opinion about.
 * - **Focus goes in and comes back**: the first control in the dialog takes
 *   focus when it opens, Tab stays inside it, and whatever had focus before
 *   gets it back when it closes. A keyboard user who opened it from ⌘K is
 *   returned to where they were, not to the top of the page.
 *
 * It opens only from a door a person used — a command they typed
 * (`localcommands.ts`) or a palette entry they chose (`actions.ts`) — never
 * on load and never from an op arriving. That is the whole of its risk
 * budget, and why a module cannot open one itself: `DialogFacts` hands it a
 * way to CLOSE, not to open.
 */
export function ModuleDialogs({ canvasId, actor }: { canvasId: string; actor: Actor }) {
  const open = useUiStore((s) => s.moduleDialog);
  const close = useUiStore((s) => s.closeModuleDialog);
  const selection = useUiStore((s) => s.selectedItemIds);
  // A runtime module's dialog may arrive after the command that names it.
  useUiStore((s) => s.modulesGeneration);
  const canvas = useCanvasStore((s) => s.canvas);
  const rcParked = useRcParked(canvasId);
  const base = useMemo(() => webHostFor(canvasId, actor), [canvasId, actor]);
  const host = useMemo(() => ({ ...base, close }), [base, close]);
  const bodyRef = useRef<HTMLDivElement>(null);

  const dialog = open ? moduleDialog(open.id) : null;

  useEffect(() => {
    if (!dialog) return;
    const before = document.activeElement as HTMLElement | null;
    const focusables = () =>
      [...(bodyRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      ) ?? [])];
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const all = focusables();
      if (all.length === 0) return;
      const first = all[0]!;
      const last = all[all.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      before?.focus?.();
    };
  }, [dialog]);

  if (!open || !canvas) return null;
  if (!dialog) return null;
  const Body = dialog.component;
  return (
    <Modal label={dialog.title} title={dialog.title} onClose={close} {...(dialog.wide ? { wide: true } : {})}>
      <div ref={bodyRef} className="module-dialog">
        <Body
          canvasId={canvasId}
          canvas={canvas}
          selection={selection}
          args={open.args}
          rcParked={rcParked}
          canEdit={canEditNow()}
          host={host}
        />
      </div>
    </Modal>
  );
}
