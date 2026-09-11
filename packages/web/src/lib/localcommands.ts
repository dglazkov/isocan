import { findCommand, parseSlashCommand, type SlashCommand } from "@isocan/core";
import { useUiStore } from "../stores/uiStore.ts";
import { moduleDialog } from "../modules.ts";

/**
 * The commands the app answers itself.
 *
 * Nearly every slash command is a request an agent carries out — that is the
 * whole design, and it is what makes the same request work from a terminal.
 * The exception is a command ABOUT the app you are already holding: /help
 * would otherwise post "what does ? do" into a thread and leave you waiting
 * for an agent to tell you what your own keyboard does. With no agent parked,
 * you would wait forever.
 *
 * So a built-in may declare itself `local`, and every composer asks here
 * before posting. It returns true when it handled the message, which is the
 * caller's cue to clear the field and post nothing.
 */
export function runLocalCommand(body: string, commands: SlashCommand[]): boolean {
  const parsed = parseSlashCommand(body);
  if (!parsed) return false;
  const command = findCommand(commands, parsed.name);
  if (!command) return false;
  /**
   * **A module command that opens a dialog** (proposed: `dialogs`): local
   * here, a skill on the terminal. Honoured only for `source: "module"` — a
   * home command is a file, and a file must not be able to claim a dialog —
   * and only when the dialog it names is actually loaded; otherwise the
   * command posts, and an agent carries it out with the module's verbs.
   */
  if (command.source === "module" && command.opens && moduleDialog(command.opens)) {
    useUiStore.getState().openModuleDialog(command.opens, parsed.args);
    return true;
  }
  // `local` on a home command means nothing: there is no code here to run it,
  // and a file must not be able to claim otherwise.
  if (command.source !== "built-in" || !command.local) return false;
  if (command.name === "help") {
    useUiStore.getState().setHelpOpen(true);
    return true;
  }
  return false;
}
