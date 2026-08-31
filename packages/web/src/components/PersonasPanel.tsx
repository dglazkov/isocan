import { useCallback, useEffect, useMemo, useState } from "react";
import type { Actor } from "@isocan/core";
import { goalLine, personaWarnings } from "@isocan/core";
import type { PersonaFile } from "../lib/api.ts";
import { getPersonas, homeAnswered, savePersona } from "../lib/api.ts";
import { PanelResizer } from "./PanelResizer.tsx";
import { useUiStore } from "../stores/uiStore.ts";
import { openPanel } from "../lib/panels.ts";
import { PersonaGlyph } from "./Glyphs.tsx";
import { PanelHead } from "./PanelHead.tsx";

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

type State =
  | { state: "loading" }
  | { state: "none"; note: string }
  | { state: "ready"; root: string; personas: PersonaFile[] };

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
        const body = await getPersonas(canvasId);
        if (live) setState({ state: "ready", ...body });
      } catch (err) {
        // The refusal is this panel's content on every canvas but the
        // owner's own — "these live with the home daemon" is the honest
        // empty state, and an empty LIST in its place would read as "you
        // have no personas". Which is exactly what a 401 used to make it
        // read as, one cleared cookie at a time; `getPersonas` goes to the
        // door and comes back with the real answer first.
        if (live) {
          setState({
            state: "none",
            note: homeAnswered(err) ? err.message : "that could not be read",
          });
        }
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
      await savePersona(canvasId, editing.name, editing.text);
      setEditing(null);
      reload();
    } catch (err) {
      // Every refusal is its own sentence and is shown verbatim: being told
      // "no" without being told WHICH no is how somebody ends up guessing at
      // their own file. "The daemon did not answer" is a different fact and
      // gets its own sentence — the box still holds the text either way.
      setRefusal(homeAnswered(err) ? err.message : "the daemon did not answer");
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
      <PanelHead
        glyph={<PersonaGlyph size={13} />}
        name="Personas"
        hint="a lens, its tools, and the number it is judged against"
        count={count}
        closeLabel="Close the personas panel"
        onClose={() => openPersonasPanel(canvasId, false)}
      />

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
