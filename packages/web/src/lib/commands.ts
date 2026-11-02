import { useEffect, useMemo } from "react";
import type { CommandMetadata } from "@isocan/core";
import { DEFAULT_COMMAND_CATALOGUE, mergeCommands, withModuleCommands } from "@isocan/core";
import { fetchCommands } from "./api.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";

/**
 * The slash commands the composer offers.
 *
 * They come from the daemon, because a home can write its own and the menu
 * must show the same list `isocan command list` shows — a person picking
 * "/tidy" from a menu that an agent has never heard of is worse than no menu.
 * Until that answer arrives (or if it never does), the built-ins stand in:
 * they are compiled into both clients, so the common case works with no round
 * trip and an offline canvas still has a menu.
 */
export function useCommands(): CommandMetadata[] {
  const loaded = useCanvasStore((s) => s.commands);
  // A runtime module that arrived after first paint may add commands.
  const modulesGeneration = useUiStore((s) => s.modulesGeneration);
  useEffect(() => {
    if (loaded !== null) return;
    let alive = true;
    void fetchCommands()
      .then((commands) => {
        if (alive) useCanvasStore.setState({ commands });
      })
      .catch(() => {
        // No daemon, or an old one: the built-ins are a real menu, not a stub.
        if (alive) useCanvasStore.setState({ commands: mergeCommands(DEFAULT_COMMAND_CATALOGUE, []) });
      });
    return () => {
      alive = false;
    };
  }, [loaded]);
  /**
   * **Memoised, and that is not a nicety — it was an infinite render loop.**
   *
   * This built a fresh array on every call, and `useCanvasTools` has the
   * result in an effect's dependency list. So: render makes a new array, the
   * deps look changed, the effect runs and calls `setTools` with a new array,
   * which renders, which makes a new array. Forever.
   *
   * It cost about a third of a core on every open canvas, quietly — the tab
   * measured 68% idle sitting still and doing nothing, and every isocan tab in
   * the Task Manager sat at 76–117% CPU. Clicking the switcher mounted a
   * second consumer into the looping tree, which made each turn of the loop
   * heavy enough to starve input and raise "Page Unresponsive".
   *
   * A hook that returns a fresh object or array on every call is safe until
   * somebody puts it in a dependency array, and nothing warns at the seam. The
   * rule this leaves: **a hook returning a non-primitive returns the SAME one
   * until the inputs change.**
   *
   * `modulesGeneration` is in the deps because a module that arrives after
   * first paint adds commands — the same reason `ItemView` reads it.
   */
  return useMemo(() => {
    // Read INSIDE the memo, not merely listed: `withModuleCommands` reaches
    // for the module registry rather than taking it as an argument, so the
    // generation is the only thing that can tell this memo the answer has
    // changed — and `exhaustive-deps` cannot see a link it is not shown.
    void modulesGeneration;
    return commandsFrom(loaded);
  }, [loaded, modulesGeneration]);
}

/** The list, from whatever the daemon answered — the built-ins standing in
 *  until it does — with the loaded modules' commands laid under it. */
function commandsFrom(loaded: CommandMetadata[] | null): CommandMetadata[] {
  return withModuleCommands(loaded ?? mergeCommands(DEFAULT_COMMAND_CATALOGUE, []));
}

/**
 * **The same list, read outside React** — for the module host's `commands`,
 * so a voice session is handed exactly what the Chat's menu shows. One
 * expression behind both, rather than a second derivation that drifts: the
 * voice had been reading the compiled built-ins alone, and so had never heard
 * of `/wire`.
 */
export function currentCommands(): CommandMetadata[] {
  return commandsFrom(useCanvasStore.getState().commands);
}
