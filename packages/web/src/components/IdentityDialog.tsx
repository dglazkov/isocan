import { useState } from "react";
import type { Actor } from "@isocan/core";
import { saveIdentity } from "../lib/identity.ts";

export function IdentityDialog({ onDone }: { onDone: (actor: Actor) => void }) {
  const [name, setName] = useState("");

  return (
    <div className="identity-backdrop">
      <div className="identity-dialog">
        <h2>Welcome to isocan</h2>
        <p>
          Pick a name — it's stamped on everything you add, move, and say on the
          canvas, here and in the CLI.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = name.trim();
            if (trimmed) onDone(saveIdentity(trimmed));
          }}
        >
          <input
            className="text-input"
            autoFocus
            placeholder="Your name"
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
