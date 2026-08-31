import { useEffect } from "react";
import { SHORTCUT_GROUPS, shortcutsIn, type SlashCommand } from "@isocan/core";
import { useUiStore } from "../stores/uiStore.ts";
import { Modal } from "./Modal.tsx";
import { useCommands } from "../lib/commands.ts";

/**
 * What this canvas answers to: the keys, and the work you can ask for.
 *
 * Opened with ? — the key every app with shortcuts has trained people to try —
 * or from the top bar, and closed with Escape or a click outside.
 *
 * Both halves are read from core rather than written here: the keys from the
 * shortcut list the app is built against, the commands from the same registry
 * the composer offers and `isocan command list` prints. A help panel that
 * describes a different app than the one it is in is worse than no help panel,
 * and the only way to prevent that is to have one source.
 */
export function HelpPanel() {
  const open = useUiStore((s) => s.helpOpen);
  const setOpen = useUiStore((s) => s.setHelpOpen);
  const commands = useCommands();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open) return null;
  return (
    /* The shared shell — see `Modal.tsx`. This is where the shape was first
       written; What's new wanted it verbatim, which is the moment a copy
       becomes a component. */
    <Modal
      label="Keyboard shortcuts and commands"
      title="What this canvas answers to"
      onClose={() => setOpen(false)}
      wide
    >
          <div className="help-columns">
            {SHORTCUT_GROUPS.map((group) => (
              <section key={group} className="help-group">
                <h3>{group}</h3>
                {shortcutsIn(group).map((shortcut) => (
                  <div className="help-row" key={`${group}-${shortcut.does}`}>
                    <span className="help-keys">
                      {shortcut.keys.map((key) => (
                        <kbd key={key}>{key}</kbd>
                      ))}
                    </span>
                    <span className="help-does">
                      {shortcut.does}
                      {shortcut.note && <i>{shortcut.note}</i>}
                    </span>
                  </div>
                ))}
              </section>
            ))}
          </div>

          <section className="help-group help-commands">
            <h3>Ask for work</h3>
            <p className="help-lede">
              Type <kbd>/</kbd> at the start of a message. The command is posted as an
              ordinary comment and an agent carries it out — so the same request works
              from a terminal with <code>isocan comment add</code>.
            </p>
            {commands.map((command: SlashCommand) => (
              <div className="help-row" key={command.name}>
                <span className="help-keys">
                  <kbd>/{command.name}</kbd>
                  {command.usage && <em>{command.usage}</em>}
                </span>
                <span className="help-does">
                  {command.description}
                  {command.source === "home" && <i>yours — ~/.isocan/commands/{command.name}.md</i>}
                </span>
              </div>
            ))}
          </section>
    </Modal>
  );
}
