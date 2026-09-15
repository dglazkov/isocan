import { benchStandingWords, benchWords, type Actor } from "@isocan/core";
import { useBench } from "../lib/bench.ts";
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
 * **The rows are not computed here, and they are not fetched here either.**
 * `useBench()` in `../lib/bench.ts` does the reading, and every word in the
 * third column comes from `benchRows()` in `@isocan/core` — a fourth caller
 * of `roster()`, the same fold `isocan who`, the agent tray and the workbench
 * read. This component renders. A state decided in a browser would disagree
 * with the CLI within the week, which is the drift the isomorphism law exists
 * to stop, and `packages/web/test/yourbench.test.ts` fails if this file starts
 * spelling one of the three states for itself.
 *
 * The reader moved out when the agents panel needed the same rows for journey
 * 2's **Join** (`BenchJoin.tsx`); two copies of the fetch would have drifted
 * the same way two copies of the fold would.
 */
export function YourBench({ actor, onClose }: { actor: Actor; onClose: () => void }) {
  const { rows, error } = useBench(actor.id);

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
