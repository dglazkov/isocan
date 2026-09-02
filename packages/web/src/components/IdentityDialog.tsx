import { faceMark } from "@isocan/core";
import { useState } from "react";
import type { Actor } from "@isocan/core";
import { adoptIdentity, enterAs, knownIdentities } from "../lib/identity.ts";
import { actorColorIn, useActorColors } from "../lib/colors.ts";
import { useActorMarks } from "../lib/marks.ts";
import { useResumable } from "../lib/signin.ts";

/**
 * The door. First time through it asks for a name; after that it also offers
 * the names this browser has worn, because coming back as yourself should be
 * one click and should return the SAME actor id — the one your undo stack and
 * your mentions hang off. Both paths are `actor.claim` (#58), so the daemon
 * is the one answering — and a refusal (the name already answers to someone
 * on a canvas) is shown here, not silently overridden.
 *
 * Two lists feed the rows, and they render the same (multi-identity phase 1).
 * `knownIdentities()` is who this browser has been; `useResumable()` is who
 * it may be, because another badge that proved the same address holds that
 * actor. To the person both are a name to click and become, and both go
 * through `adoptIdentity`. An actor in both lists renders once.
 */
export function IdentityDialog({ onDone }: { onDone: (actor: Actor) => void }) {
  const colors = useActorColors();
  const marks = useActorMarks();
  const [name, setName] = useState("");
  const [known] = useState(knownIdentities);
  const resumable = useResumable();
  const people = withResumable(known, resumable);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const attempt = (claim: Promise<Actor>) => {
    setBusy(true);
    setError(null);
    claim.then(onDone).catch((err: Error) => {
      setError(err.message);
      setBusy(false);
    });
  };

  return (
    <div className="identity-backdrop">
      <div className="identity-dialog">
        <h2>{people.length > 0 ? "Who's writing?" : "Welcome to isocan"}</h2>
        <p>
          Pick a name — it's stamped on everything you add, move, and say on the
          canvas, here and in the CLI.
        </p>
        {people.length > 0 && (
          <div className="identity-known">
            {people.map((actor) => (
              <button
                key={actor.id}
                className="identity-known-row"
                disabled={busy}
                onClick={() => attempt(adoptIdentity(actor))}
                title={`Come back as ${actor.name}`}
              >
                <span className="face-mark" style={{ background: actorColorIn(colors, actor.id) }}>
                  {faceMark(marks, actor)}
                </span>
                {actor.name}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = name.trim();
            if (trimmed) attempt(enterAs(trimmed));
          }}
        >
          <input
            className="text-input"
            autoFocus
            placeholder={people.length > 0 ? "Or a different name" : "Your name"}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn primary" type="submit" disabled={!name.trim() || busy}>
            Start
          </button>
        </form>
        {error && <div className="identity-warning">{error}</div>}
      </div>
    </div>
  );
}

/** Known first, then the resumable actors this browser has not worn, by id. */
export function withResumable(known: readonly Actor[], resumable: readonly Actor[]): Actor[] {
  const seen = new Set(known.map((actor) => actor.id));
  return [...known, ...resumable.filter((actor) => !seen.has(actor.id))];
}
