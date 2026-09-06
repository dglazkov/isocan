import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Actor, Canvas, SlashCommand } from "@isocan/core";
import { ago, litRuns, rankCanvases, type SwitchRow } from "@isocan/core";
import { useUiStore, type PaletteMode } from "../stores/uiStore.ts";
import { useCommands } from "../lib/commands.ts";
import { availableActions, type Action, type ActionContext } from "../lib/actions.ts";
import { useCanEdit } from "../lib/capability.ts";
import { listCanvases } from "../lib/api.ts";
import { readRecents } from "../lib/recents.ts";
import { switchCanvas } from "../lib/canvasswitch.ts";

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
 *
 * **The same window has a second face: the switcher** (`mode === "canvases"`).
 * Choosing "Switch canvas…", pressing ⌘O, or the ⌄ beside the canvas's name
 * flips this window to a list of canvases — the ones you were on lately
 * first, everything else by activity — and a few letters find one. It is
 * the same component rather than a second dialog because it IS the same
 * gesture (a field, a list, Enter) and a second modal over the first would
 * have to answer which of two Escapes closes what. Backspace on an empty
 * field steps back to the commands, so the two faces are one place with a
 * door between them.
 *
 * And the commands face still finds a canvas: type a title and the matches
 * appear as a "Switch to" group under the actions, so the common trip is ⌘K,
 * three letters, Enter — with no mode to know about.
 */
export function CommandPalette({
  canvasId,
  actor,
  mode,
  onMode,
  onClose,
}: {
  canvasId: string | null;
  actor: Actor;
  mode: PaletteMode;
  onMode: (mode: PaletteMode) => void;
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
  // A new face starts with a clean field: what you typed to find "Switch
  // canvas…" is not the canvas you are looking for.
  useEffect(() => {
    setQuery("");
    field.current?.focus();
  }, [mode]);

  const canvases = useCanvasList(canvasId, mode === "canvases" || query.trim().length > 0);
  const recents = useMemo(() => readRecents(), []);

  const ctx: ActionContext = useMemo(
    () => ({ canvasId, actor, navigate, selection }),
    [canvasId, actor, navigate, selection],
  );

  /**
   * **Matched on the words somebody can see**, and every term must appear —
   * "op ch" finds "Open Chat" without anybody guessing the word order. A
   * fuzzy matcher that scores letters anywhere is how a palette starts
   * offering "Delete everything" for "de".
   *
   * The canvases under them are the exception, and `rankCanvases` says why:
   * a wrong canvas match does nothing to any canvas, so there the trade goes
   * the other way.
   */
  const rows = useMemo((): Row[] => {
    if (mode === "canvases") {
      return rankCanvases(canvases, query, recents.map((r) => r.id), canvasId).map((row) => ({
        kind: "canvas" as const,
        row,
      }));
    }
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const hits = (hay: string) => terms.every((t) => hay.toLowerCase().includes(t));
    const actions = availableActions(ctx).filter((a) => hits(`${a.name} ${a.hint ?? ""} ${a.group}`));
    // A canvas is where a message can be posted; there is no thread on the
    // home screen, so offering to post one would be an entry that cannot work.
    // Nor can a reader post one: a slash command is a comment, and a comment
    // is a write (roles phase 1).
    const asks =
      canvasId && canEdit ? commands.filter((c) => hits(`/${c.name} ${c.description}`)) : [];
    // Only once something is typed: with an empty field the switcher's own
    // face is the place for the list, and it is one row away.
    const jumps =
      terms.length > 0
        ? rankCanvases(canvases, query, recents.map((r) => r.id), canvasId).slice(0, INLINE_JUMPS)
        : [];
    return [
      ...actions.map((action) => ({ kind: "action" as const, action })),
      ...asks.map((command) => ({ kind: "ask" as const, command })),
      ...jumps.map((row) => ({ kind: "canvas" as const, row })),
    ];
  }, [mode, query, ctx, commands, canvasId, canEdit, canvases, recents]);

  useEffect(() => setAt(0), [query, mode]);

  /* Keep the chosen row on screen when arrowing past the fold. */
  useEffect(() => {
    list.current?.querySelector('[data-at="1"]')?.scrollIntoView({ block: "nearest" });
  }, [at]);

  function choose(row: Row) {
    if (row.kind === "action") {
      // "Switch canvas…" flips this window rather than closing it: the
      // action sets the mode, and closing first would set it on a window
      // that is not there.
      if (row.action.id === SWITCH_ACTION) {
        onMode("canvases");
        return;
      }
      onClose();
      void row.action.run(ctx);
      return;
    }
    onClose();
    if (row.kind === "canvas") {
      switchCanvas(navigate, row.row.canvas.id);
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

  const switching = mode === "canvases";
  const nowMs = Date.now();

  return (
    <>
      <div className="palette-backdrop" onPointerDown={onClose} />
      <div
        className={`palette${switching ? " palette-canvases" : ""}`}
        role="dialog"
        aria-label={switching ? "Switch canvas" : "Run a command"}
      >
        <input
          ref={field}
          className="palette-field"
          placeholder={switching ? "Switch to a canvas…" : "Type a command…"}
          aria-label={switching ? "Find a canvas" : "Type a command"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") return onClose();
            // The door back: an empty field and Backspace is "not this face".
            if (e.key === "Backspace" && switching && query.length === 0) {
              e.preventDefault();
              onMode("commands");
              return;
            }
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
          {rows.length === 0 && (
            <p className="palette-none">
              {switching && query.trim().length === 0
                ? canvases.length === 0
                  ? "No other canvas here yet."
                  : "This is the only canvas here."
                : `Nothing matches “${query.trim()}”.`}
            </p>
          )}
          {rows.map((row, i) => {
            /* The group header appears once, above the first row that has it —
               derived from the rows rather than kept as a second structure
               that could disagree about what is in each group. In the
               switcher the groups are Recent and Everything else, and only
               while nothing is typed: a ranked list has one order, not two. */
            const ranked = switching && query.trim().length > 0;
            const group = groupOf(row, mode, ranked);
            const previous = rows[i - 1];
            const lastGroup = previous === undefined ? null : groupOf(previous, mode, ranked);
            return (
              <div key={keyOf(row)}>
                {group !== lastGroup && <div className="palette-group">{group}</div>}
                <button
                  className={`palette-row${i === at ? " at" : ""}`}
                  data-at={i === at ? "1" : undefined}
                  role="option"
                  aria-selected={i === at}
                  onPointerEnter={() => setAt(i)}
                  onClick={() => choose(row)}
                >
                  {row.kind === "canvas" ? (
                    <CanvasRow row={row.row} nowMs={nowMs} />
                  ) : (
                    <>
                      <span className="palette-name">
                        {row.kind === "action" ? row.action.name : `/${row.command.name}`}
                      </span>
                      {hintOf(row) && <span className="palette-hint">{hintOf(row)}</span>}
                      {row.kind === "action" && row.action.keys && (
                        <kbd className="palette-keys">{row.action.keys}</kbd>
                      )}
                      {row.kind === "ask" && <span className="palette-posts">posts a message</span>}
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
        {switching && (
          <div className="palette-foot">
            <span>↑↓ to choose · ↵ to go</span>
            <span>⌫ on an empty field for the commands</span>
          </div>
        )}
      </div>
    </>
  );
}

/** The action whose choice flips the window instead of closing it. */
const SWITCH_ACTION = "switch-canvas";

/** How many canvases the commands face shows under the actions. Enough for
 *  the canvas you meant to be there; few enough that the actions stay the
 *  list's subject. */
const INLINE_JUMPS = 5;

type Row =
  | { kind: "action"; action: Action }
  | { kind: "ask"; command: SlashCommand }
  | { kind: "canvas"; row: SwitchRow };

function keyOf(row: Row): string {
  if (row.kind === "action") return row.action.id;
  if (row.kind === "ask") return `ask-${row.command.name}`;
  return `canvas-${row.row.canvas.id}`;
}

function hintOf(row: Row): string | undefined {
  if (row.kind === "action") return row.action.hint;
  if (row.kind === "ask") return row.command.description;
  return undefined;
}

/** `mode` and `ranked` decide a canvas row's heading: under the actions it
 *  is "Switch to" whatever its history, on the switcher's own face it is
 *  Recent or Everything else, and a ranked list has one order, not two. */
function groupOf(row: Row, mode: PaletteMode, ranked: boolean): string | null {
  if (row.kind === "action") return row.action.group;
  if (row.kind === "ask") return "Ask an agent";
  if (mode === "commands") return "Switch to";
  if (ranked) return null;
  return row.row.recent ? "Recent" : "Everything else";
}

/**
 * One canvas as a row: the title with the matched letters lit, and when it
 * was last touched — the same clock the home screen's cards keep, so the two
 * never disagree about which canvas is the live one.
 */
function CanvasRow({ row, nowMs }: { row: SwitchRow; nowMs: number }) {
  const when = ago(row.canvas.updatedAt, nowMs);
  return (
    <>
      <span className="palette-name palette-canvas-title">
        {litRuns(row.canvas.title, row.positions).map(([text, lit], i) =>
          lit ? <mark key={i}>{text}</mark> : <span key={i}>{text}</span>,
        )}
      </span>
      {row.canvas.description && <span className="palette-hint">{row.canvas.description}</span>}
      {when && <span className="palette-when">{when}</span>}
    </>
  );
}

/**
 * **The canvases this window can take you to** — the ones this origin is the
 * home of, which is the home screen's own list and for the same reason: a
 * client-side navigation never asks the server, so a row for a canvas homed
 * elsewhere would open a stale local copy of it (phase 10.3).
 *
 * Fetched once per opening, and only once a canvas could be shown — the
 * switcher's face, or a letter typed on the commands face — so a ⌘K that
 * runs "Fit to screen" costs no request. Until it lands, and if it never
 * does (offline, a daemon that is down), the browser's own recents stand in,
 * titles and all — so the list paints at once, and offline it is exactly the
 * canvases the replica can open.
 */
function useCanvasList(canvasId: string | null, wanted: boolean): Canvas[] {
  const [fetched, setFetched] = useState<Canvas[] | null>(null);
  useEffect(() => {
    if (!wanted || fetched !== null) return;
    let live = true;
    listCanvases().then(
      (found) => live && setFetched(found),
      () => {},
    );
    return () => {
      live = false;
    };
    // `fetched` is read to ask once, not to re-ask when it lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasId, wanted]);
  return useMemo(() => {
    if (fetched) return fetched;
    // No stamps: the browser does not know when these were last touched, and
    // `ago` of an unparseable date is "", which is the honest column.
    return readRecents().map(
      (recent): Canvas => ({
        id: recent.id,
        title: recent.title,
        description: "",
        properties: {},
        createdAt: "",
        createdBy: { id: "", name: "" },
        updatedAt: "",
        updatedBy: { id: "", name: "" },
      }),
    );
  }, [fetched]);
}

/** Open the Chat, where a slash command becomes a message. */
function openChat(canvasId: string): void {
  void import("../lib/panels.ts").then((m) => m.openPanel(canvasId, "main"));
}

export type { SlashCommand };
