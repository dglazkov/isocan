import type { Actor } from "@isocan/core";
import { modules } from "../modules.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { useWebHost } from "../lib/modulehost.ts";
import { useTheme } from "../lib/theme.ts";

/**
 * **A module's control in the message composer's row** (proposed: `composer`).
 *
 * The overlay slot next door names an EDGE and may never cover the middle,
 * which is the right rule and is why voice had nowhere to go: the gesture
 * people expect is a mic among the composer's own buttons — neither an edge
 * nor the middle, but inside a piece of the shell's chrome.
 *
 * ## The shell keeps the row
 *
 * A module contributes one control, drawn beside Send. When it wants the
 * whole row — a live voice session standing where the message box was — it
 * calls `takeOver(true)`, and the composer puts its own input and send button
 * away until it hears otherwise. The module never draws the row itself
 * uninvited and never decides what yielding it means.
 *
 * **A takeover is dropped when the module goes.** An experiment switched off
 * mid-session would otherwise leave a composer nobody can type in and no
 * control to give it back — the failure worth designing for, because it is
 * unrecoverable without a reload and looks like the app is broken.
 */
/** Which loaded modules offer a composer control right now. The composer
 *  watches this so a holder whose module has gone — an experiment switched
 *  off mid-session — does not keep a row it can no longer give back. */
export function composerControlModules(): string[] {
  return modules().filter((m) => (m.composer ?? []).length > 0).map((m) => m.core.name);
}

export function ModuleComposerControls({
  canvasId,
  actor,
  takenOverBy,
  onTakeOver,
}: {
  canvasId: string;
  actor: Actor;
  /** Which module holds the row, if any — the shell's answer. */
  takenOverBy: string | null;
  onTakeOver: (moduleName: string, active: boolean) => void;
}) {
  const canvas = useCanvasStore((s) => s.canvas);
  const project = useCanvasStore((s) => s.project);
  // Re-render when a runtime module arrives and when an experiment is
  // switched on — the same two reasons `modules()` is a function.
  useUiStore((s) => s.modulesGeneration);
  useUiStore((s) => s.experiments);
  const host = useWebHost(canvasId, actor);
  const theme = useTheme((s) => s.resolved);
  if (!canvas) return null;

  const here = modules().flatMap((m) =>
    (m.composer ?? []).slice(0, 1).map((control) => ({ module: m.core.name, control })),
  );
  if (here.length === 0) return null;

  return (
    <>
      {here.map(({ module, control }) => {
        const Body = control.component;
        const active = takenOverBy === module;
        // While one module holds the row, the others are not drawn: the row
        // is small, and a second control beside a live session is a button
        // whose effect nobody can predict.
        if (takenOverBy !== null && !active) return null;
        return (
          <div
            key={`${module}:${control.label}`}
            className={`module-composer-control${active ? " module-composer-wide" : ""}`}
            aria-label={control.label}
          >
            <Body
              canvasId={canvasId}
              canvas={canvas}
              host={host}
              groupMode={project?.groupMode ?? "legacy"}
              theme={theme}
              active={active}
              takeOver={(on: boolean) => onTakeOver(module, on)}
            />
          </div>
        );
      })}
    </>
  );
}
