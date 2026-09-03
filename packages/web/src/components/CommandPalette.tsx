import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Actor, SlashCommand } from "@isocan/core";
import { useUiStore } from "../stores/uiStore.ts";
import { useCommands } from "../lib/commands.ts";
import { availableActions, type Action, type ActionContext } from "../lib/actions.ts";
import { useCanEdit } from "../lib/capability.ts";

/**
 * **⌘K: a launcher for anything, not a second composer.**
 *
 * ⌘K used to open a bar for messaging your emissary, which the Chat panel and
 * every comment already do — a keystroke spent on the third way to do one
 * thing. It is now the way to reach everything: type a few letters, press
 * Enter.
 *
 * **Two vocabularies, and keeping them apart is the design.** An ACTION is
 * something this app does the moment you choose it — fit the screen, arm the
 * Pen, open the Chat. A SLASH COMMAND is a message: `/format` posts a comment
 * and an agent carries it out, which is why the same words work from a
 * terminal. Folding either into the other would break something true:
 * `/fit-to-screen` would be a message asking somebody else to move your own
 * viewport, and an "action" that quietly posts a comment would be a menu item
 * that answers in four minutes.
 *
 * So they are shown in that order — *do this now*, then *ask somebody to do
 * this* — and the second group says out loud that it posts a message.
 *
 * The slash commands are read from `useCommands`, the same list `/help` and
 * every composer use, so the launcher cannot drift from what typing `/` in a
 * composer would offer. That includes commands a canvas defines for itself.
 */
export function CommandPalette({
  canvasId,
  actor,
  onClose,
}: {
  canvasId: string | null;
  actor: Actor;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const commands = useCommands();
  const selection = useUiStore((s) => s.selectedItemIds);
  const canEdit = useCanEdit();
  const [query, setQuery] = useState("");
  const [at, setAt] = useState(0);
  const field = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => field.current?.focus(), []);

  const ctx: ActionContext = useMemo(
    () => ({ canvasId, actor, navigate, selection }),
    [canvasId, actor, navigate, selection],
  );

  /**
   * **Matched on the words somebody can see**, and every term must appear —
   * "op ch" finds "Open Chat" without anybody guessing the word order. A
   * fuzzy matcher that scores letters anywhere is how a palette starts
   * offering "Delete everything" for "de".
   */
  const rows = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const hits = (hay: string) => terms.every((t) => hay.toLowerCase().includes(t));
    const actions = availableActions(ctx).filter((a) => hits(`${a.name} ${a.hint ?? ""} ${a.group}`));
    // A canvas is where a message can be posted; there is no thread on the
    // home screen, so offering to post one would be an entry that cannot work.
    // Nor can a reader post one: a slash command is a comment, and a comment
    // is a write (roles phase 1).
    const asks =
      canvasId && canEdit ? commands.filter((c) => hits(`/${c.name} ${c.description}`)) : [];
    return [
      ...actions.map((action) => ({ kind: "action" as const, action })),
      ...asks.map((command) => ({ kind: "ask" as const, command })),
    ];
  }, [query, ctx, commands, canvasId, canEdit]);

  useEffect(() => setAt(0), [query]);

  /* Keep the chosen row on screen when arrowing past the fold. */
  useEffect(() => {
    list.current?.querySelector('[data-at="1"]')?.scrollIntoView({ block: "nearest" });
  }, [at]);

  function choose(row: (typeof rows)[number]) {
    onClose();
    if (row.kind === "action") {
      void row.action.run(ctx);
      return;
    }
    /**
     * A command is a message, so this OPENS the Chat with it typed rather than
     * posting it. Most commands take an argument — `/variation 3 layouts` is
     * a different request from `/variation` — and a launcher that sent the
     * bare word would be guessing at the half somebody had not typed yet.
     */
    useUiStore.getState().setPendingChat(`/${row.command.name} `);
    if (canvasId) openChat(canvasId);
  }

  return (
    <>
      <div className="palette-backdrop" onPointerDown={onClose} />
      <div className="palette" role="dialog" aria-label="Run a command">
        <input
          ref={field}
          className="palette-field"
          placeholder="Type a command…"
          aria-label="Type a command"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") return onClose();
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setAt((n) => Math.min(rows.length - 1, n + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setAt((n) => Math.max(0, n - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const row = rows[at];
              if (row) choose(row);
            }
          }}
        />
        <div className="palette-rows" ref={list} role="listbox">
          {rows.length === 0 && <p className="palette-none">Nothing matches “{query.trim()}”.</p>}
          {rows.map((row, i) => {
            const key = row.kind === "action" ? row.action.id : `ask-${row.command.name}`;
            const name = row.kind === "action" ? row.action.name : `/${row.command.name}`;
            const hint =
              row.kind === "action" ? row.action.hint : row.command.description;
            /* The group header appears once, above the first row that has it —
               derived from the rows rather than kept as a second structure
               that could disagree about what is in each group. */
            const group = row.kind === "action" ? row.action.group : "Ask an agent";
            const previous = rows[i - 1];
            const lastGroup =
              previous === undefined
                ? null
                : previous.kind === "action"
                  ? previous.action.group
                  : "Ask an agent";
            return (
              <div key={key}>
                {group !== lastGroup && <div className="palette-group">{group}</div>}
                <button
                  className={`palette-row${i === at ? " at" : ""}`}
                  data-at={i === at ? "1" : undefined}
                  role="option"
                  aria-selected={i === at}
                  onPointerEnter={() => setAt(i)}
                  onClick={() => choose(row)}
                >
                  <span className="palette-name">{name}</span>
                  {hint && <span className="palette-hint">{hint}</span>}
                  {row.kind === "action" && row.action.keys && (
                    <kbd className="palette-keys">{row.action.keys}</kbd>
                  )}
                  {row.kind === "ask" && <span className="palette-posts">posts a message</span>}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

/** Open the Chat, where a slash command becomes a message. */
function openChat(canvasId: string): void {
  void import("../lib/panels.ts").then((m) => m.openPanel(canvasId, "main"));
}

export type { SlashCommand };
