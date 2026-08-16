import { useState } from "react";
import type { Actor } from "@isocan/core";
import { adoptIdentity, enterAs, knownIdentities } from "../lib/identity.ts";
import { actorColor } from "../lib/colors.ts";

/**
 * The door. First time through it asks for a name; after that it also offers
 * the names this browser has worn, because coming back as yourself should be
 * one click and should return the SAME actor id — the one your undo stack and
 * your mentions hang off.
 */
export function IdentityDialog({ onDone }: { onDone: (actor: Actor) => void }) {
  const [name, setName] = useState("");
  const [known] = useState(knownIdentities);

  return (
    <div className="identity-backdrop">
      <div className="identity-dialog">
        <h2>{known.length > 0 ? "Who's writing?" : "Welcome to isocan"}</h2>
        <p>
          Pick a name — it's stamped on everything you add, move, and say on the
          canvas, here and in the CLI.
        </p>
        {known.length > 0 && (
          <div className="identity-known">
            {known.map((actor) => (
              <button
                key={actor.id}
                className="identity-known-row"
                onClick={() => onDone(adoptIdentity(actor))}
                title={`Come back as ${actor.name}`}
              >
                <span className="face-mark" style={{ background: actorColor(actor.id) }}>
                  {actor.name.charAt(0).toUpperCase()}
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
            if (trimmed) onDone(enterAs(trimmed));
          }}
        >
          <input
            className="text-input"
            autoFocus
            placeholder={known.length > 0 ? "Or a different name" : "Your name"}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn primary" type="submit" disabled={!name.trim()}>
            Start
          </button>
        </form>
      </div>
    </div>
  );
}
