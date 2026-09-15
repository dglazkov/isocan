import { useEffect, useState } from "react";
import {
  benchAgents,
  benchRows,
  benchStandingWords,
  benchWords,
  type Actor,
  type BenchCanvas,
  type BenchRow,
} from "@isocan/core";
import { fetchRcAnswering, getSnapshot, listCanvases } from "../lib/api.ts";
import { personalApi } from "../lib/personal.ts";
import "./yourbench.css";

/**
 * **"Your bench"** — the agents this person has, under their own face
 * (`docs/projects/bench/design.md`, journey 1).
 *
 * It belongs in the identity menu for the reason that menu already states:
 * this menu is *how I'm connected here*, and the agents that answer for you
 * are another way you are connected. A standing agent belongs to a canvas and
 * is drawn in the workbench; a BENCH belongs to a person, which is why it
 * hangs off the face and not off Share.
 *
 * **The rows are not computed here.** Every word in the third column comes
 * from `benchRows()` in `@isocan/core`, which is a fourth caller of
 * `roster()` — the same fold `isocan who`, the agent tray and the workbench
 * read. This component fetches and renders; a state decided in a browser would
 * disagree with the CLI within the week, which is the drift the isomorphism
 * law exists to stop, and `packages/web/test/yourbench.test.ts` fails if this
 * file starts spelling one of the three states for itself.
 *
 * What a browser cannot measure it does not claim. The machine-local running
 * half — `~/.isocan/rc-agents.json` — is not readable from a tab, so the set
 * is passed empty and `elsewhere` is carried by the enrolments, which are
 * canvas state and travel. Likewise the sessions: the per-canvas presence
 * lists belong to the socket for the canvas you are looking at, so `ready`
 * here rests on the daemon's connection-bound rc holds, which is the
 * strongest fact available either way.
 */
export function YourBench({ actor, onClose }: { actor: Actor; onClose: () => void }) {
  const [rows, setRows] = useState<BenchRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const control = new AbortController();
    void (async () => {
      try {
        const status = await personalApi.personalStatus(actor.id, control.signal);
        const source = status.source?.state === "live" ? status.source.canvasId : null;
        if (!source) {
          if (!control.signal.aborted) setRows([]);
          return;
        }
        const mine = await getSnapshot(source, control.signal);
        const canvases = await listCanvases();
        const seen = await Promise.all(
          canvases.map(async (canvas): Promise<BenchCanvas | null> => {
            const snapshot = await getSnapshot(canvas.id, control.signal).catch(() => null);
            if (!snapshot) return null;
            const answering = await fetchRcAnswering(canvas.id).catch(() => null);
            return {
              canvasId: canvas.id,
              canvasTitle: canvas.title,
              canvas: snapshot.canvas,
              sessions: [],
              ...(answering ? { answerable: new Set(answering.actorIds) } : {}),
            };
          }),
        );
        if (control.signal.aborted) return;
        setRows(
          benchRows(
            benchAgents(mine.canvas),
            seen.filter((one): one is BenchCanvas => one !== null),
            new Set<string>(),
            Date.now(),
          ),
        );
      } catch (err) {
        if (!control.signal.aborted) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => control.abort();
  }, [actor.id]);

  return (
    <div className="identity-menu bench-panel" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <h3>Your bench</h3>
      <p className="bench-why">
        The agents you have, kept on your own private canvas. A row is a record: it grants no
        standing and no reach. Whether anything could answer is measured, every time you look.
      </p>
      {error && <p role="alert" className="bench-why">{error}</p>}
      {rows === null && !error && <p className="bench-why">Reading your bench…</p>}
      {rows?.length === 0 && (
        <p className="bench-why">
          Nobody on your bench yet. <code>isocan bench add &lt;name&gt;</code> puts one there.
        </p>
      )}
      {rows && rows.length > 0 && (
        <ul className="bench-rows">
          {rows.map((row) => (
            <li key={row.itemId} className="bench-row">
              <span className="bench-name">{row.name}</span>
              <span className={`bench-reach ${row.reach}`}>{benchWords(row)}</span>
              <span className="bench-where">
                {row.harness ?? "harness unsaid"} · {benchStandingWords(row)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <button className="btn" onClick={onClose}>
        Close
      </button>
    </div>
  );
}
