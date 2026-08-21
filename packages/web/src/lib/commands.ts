import { useEffect } from "react";
import type { SlashCommand } from "@isocan/core";
import { DEFAULT_COMMANDS, mergeCommands } from "@isocan/core";
import { fetchCommands } from "./api.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";

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
export function useCommands(): SlashCommand[] {
  const loaded = useCanvasStore((s) => s.commands);
  useEffect(() => {
    if (loaded !== null) return;
    let alive = true;
    void fetchCommands()
      .then((commands) => {
        if (alive) useCanvasStore.setState({ commands });
      })
      .catch(() => {
        // No daemon, or an old one: the built-ins are a real menu, not a stub.
        if (alive) useCanvasStore.setState({ commands: mergeCommands(DEFAULT_COMMANDS, []) });
      });
    return () => {
      alive = false;
    };
  }, [loaded]);
  return loaded ?? mergeCommands(DEFAULT_COMMANDS, []);
}
