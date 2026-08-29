import { useCallback, useEffect, useMemo, useState } from "react";
import type { Actor, Persona } from "@isocan/core";
import { goalLine, personaWarnings } from "@isocan/core";
import { PanelResizer } from "./PanelResizer.tsx";
import { useUiStore } from "../stores/uiStore.ts";
import { openPanel } from "../lib/panels.ts";
import { PersonaGlyph } from "./Glyphs.tsx";

/**
 * **The roles an agent can take on here.**
 *
 * A persona is a file — `.agents/personas/<name>.md` — and this panel is a
 * second way into the same file rather than a second copy of it. The listing
 * is parsed by core, so this and `isocan persona ls` cannot disagree about
 * what a persona says; the editor holds the file VERBATIM, because an editor
 * that shows a re-rendering of what we understood is an editor that silently
 * drops what we did not.
 *
 * **It only exists on the owner's own machine, and says so rather than
 * pretending.** The route is gated exactly like the tree — this daemon, this
 * machine, loopback, a verified binding — because it reads and writes
 * somebody's disk. On a hosted canvas there is no directory to read, and the
 * honest answer is a sentence, not an empty list that reads as "you have no
 * personas".
 *
 * `docs/projects/personas/design.md` stages the canvas after this: when a
 * second person is editing a persona, it becomes an item and this panel reads
 * the canvas instead. The format was chosen so that move costs nothing — one
 * file per persona, and front matter that keeps keys it does not understand.
 */
export function openPersonasPanel(canvasId: string, open: boolean): void {
  openPanel(canvasId, open ? "personas" : null);
}

interface Loaded {
  file: string;
  persona: Persona;
  text: string;
}

type State =
  | { state: "loading" }
  | { state: "none"; note: string }
  | { state: "ready"; root: string; personas: Loaded[] };

export function PersonasPanel({ canvasId, actor }: { canvasId: string; actor: Actor }) {
  const open = useUiStore((s) => s.personasPanelOpen);
  const panelWidth = useUiStore((s) => s.panelWidth);
  const [state, setState] = useState<State>({ state: "loading" });
  /** Which one is being edited, and the text as it stands in the box. */
  const [editing, setEditing] = useState<{ name: string; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [token, setToken] = useState(0);
  const reload = useCallback(() => setToken((n) => n + 1), []);
  void actor;

  useEffect(() => {
    if (!open) return;
    let live = true;
    void (async () => {
      try {
        const res = await fetch(`/api/projects/${canvasId}/personas`);
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          if (live) {
            setState({
              state: "none",
              note: body?.error ?? "personas live with this canvas's own daemon",
            });
          }
          return;
        }
        const body = (await res.json()) as { root: string; personas: Loaded[] };
        if (live) setState({ state: "ready", ...body });
      } catch {
        if (live) setState({ state: "none", note: "that could not be read" });
      }
    })();
    return () => {
      live = false;
    };
  }, [canvasId, open, token]);

  const count = state.state === "ready" ? state.personas.length : 0;
  /** Everything the list is warning about, so the header can say it once. */
  const warnings = useMemo(
    () =>
      state.state === "ready"
        ? state.personas.reduce((n, p) => n + personaWarnings(p.persona).length, 0)
        : 0,
    [state],
  );

  if (!open) return null;

  async function save() {
    if (!editing || saving) return;
    setSaving(true);
    setRefusal(null);
    try {
      const res = await fetch(`/api/projects/${canvasId}/personas/${editing.name}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: editing.text }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        // Every refusal is its own sentence and is shown verbatim: being told
        // "no" without being told WHICH no is how somebody ends up guessing
        // at their own file.
        setRefusal(body?.error ?? "that could not be saved");
        return;
      }
      setEditing(null);
      reload();
    } catch {
      setRefusal("the daemon did not answer");
    } finally {
      setSaving(false);
    }
  }

  return (
    <aside
      className="personas-panel dock-panel floats"
      style={{ width: panelWidth }}
      aria-label="The personas in this canvas's directory"
    >
      <PanelResizer />
      <header>
        <span className="files-glyph">
          <PersonaGlyph size={13} />
        </span>
        <b>Personas</b>
        {count > 0 && <span className="files-count">{count}</span>}
        <span className="spacer" />
        <button
          className="main-close"
          title="Close"
          aria-label="Close the personas panel"
          onClick={() => openPersonasPanel(canvasId, false)}
        >
          ✕
        </button>
      </header>

      <div className="files-scroll">
        {state.state === "loading" && <p className="wb-quiet">Reading…</p>}
        {state.state === "none" && (
          <div className="persona-none">
            <p className="wb-quiet">{state.note}</p>
            <p className="wb-quiet">
              A persona is a file in <code>.agents/personas/</code> — a lens, the tools for
              it, and a goal it is judged against.
            </p>
          </div>
        )}
        {state.state === "ready" && state.personas.length === 0 && (
          <div className="persona-none">
            <p className="wb-quiet">Nothing in <code>.agents/personas/</code> yet.</p>
          </div>
        )}
        {state.state === "ready" && warnings > 0 && !editing && (
          /**
           * **Said at the top, where it is read.** A persona that cannot fail
           * is the thing this feature exists to make impossible, and it is
           * invisible unless somebody says so — three instruments this week
           * reported nothing and were believed.
           */
          <div className="persona-warn-summary">
            {warnings} thing{warnings === 1 ? "" : "s"} worth fixing below
          </div>
        )}

        {state.state === "ready" &&
          state.personas.map(({ persona, file, text }) => (
            <section key={file} className="persona-row">
              <div className="persona-head">
                <b>{persona.name}</b>
                {persona.model && <i>{persona.model}</i>}
                <span className="spacer" />
                <button
                  className="btn"
                  onClick={() =>
                    setEditing(
                      editing?.name === persona.name ? null : { name: persona.name, text },
                    )
                  }
                >
                  {editing?.name === persona.name ? "Close" : "Edit"}
                </button>
              </div>
              <p className="persona-desc">{persona.description}</p>
              {persona.goals.map((goal) => (
                <p key={goal.name} className="persona-goal">
                  {goalLine(goal)}
                  <code>{goal.measuredBy}</code>
                </p>
              ))}
              {personaWarnings(persona).map((warning) => (
                <p key={warning} className="persona-warn">
                  {warning}
                </p>
              ))}
              {editing?.name === persona.name && (
                <div className="persona-edit">
                  {/* The file verbatim. Saving replaces it whole — there is no
                      merge here and there should not be: the file is small,
                      one person is editing it, and a clever merge would be a
                      way to lose a line nobody noticed. */}
                  <textarea
                    className="text-input persona-text"
                    value={editing.text}
                    spellCheck={false}
                    aria-label={`${persona.name} as a file`}
                    onChange={(e) => setEditing({ name: persona.name, text: e.target.value })}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                  <div className="persona-edit-row">
                    <span className="wb-quiet">{file}</span>
                    <span className="spacer" />
                    <button className="btn" disabled={saving} onClick={() => setEditing(null)}>
                      Cancel
                    </button>
                    <button className="btn primary" disabled={saving} onClick={() => void save()}>
                      {saving ? "…" : "Save"}
                    </button>
                  </div>
                  {refusal && <p className="wb-bind-refusal">{refusal}</p>}
                </div>
              )}
            </section>
          ))}
      </div>
    </aside>
  );
}
